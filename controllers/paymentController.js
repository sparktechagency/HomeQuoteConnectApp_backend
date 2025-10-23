// controllers/paymentController.js
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const Job = require('../models/Job');
const Quote = require('../models/Quote');
const User = require('../models/User');
const { 
  createPaymentIntent, 
  createConnectAccount, 
  createAccountLink,
  transferToProvider,
  stripe 
} = require('../config/stripe');
const { sendNotificationToUser } = require('../socket/socketHandler');

// Platform commission rate (10%)
const PLATFORM_COMMISSION_RATE = 0.10;

// @desc    Create payment intent for job
// @route   POST /api/payments/create-payment-intent
// @access  Private (Client only)
const createPayment = async (req, res) => {
  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({
        success: false,
        message: 'Only clients can make payments'
      });
    }

    const { jobId, paymentMethod = 'card' } = req.body;

    // Find job and verify client ownership
    const job = await Job.findOne({
      _id: jobId,
      client: req.user._id,
      status: 'in_progress'
    }).populate('acceptedQuote');

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found or not ready for payment'
      });
    }

    if (!job.acceptedQuote) {
      return res.status(400).json({
        success: false,
        message: 'No accepted quote found for this job'
      });
    }

    const quote = job.acceptedQuote;
    const amount = quote.price;
    const platformCommission = amount * PLATFORM_COMMISSION_RATE;
    const providerAmount = amount - platformCommission;

    // For cash payments, create transaction record directly
    if (paymentMethod === 'cash') {
      const transaction = await Transaction.create({
        user: req.user._id,
        job: jobId,
        quote: quote._id,
        amount,
        platformCommission,
        providerAmount,
        paymentMethod: 'cash',
        status: 'pending'
      });

      return res.status(200).json({
        success: true,
        message: 'Cash payment recorded. Please pay the provider directly.',
        data: { 
          transaction,
          paymentMethod: 'cash'
        }
      });
    }

    // For card payments, create Stripe payment intent
    const paymentIntent = await createPaymentIntent(amount, 'usd', {
      jobId: jobId.toString(),
      quoteId: quote._id.toString(),
      clientId: req.user._id.toString(),
      providerId: quote.provider.toString()
    });

    // Create transaction record
    const transaction = await Transaction.create({
      user: req.user._id,
      job: jobId,
      quote: quote._id,
      amount,
      platformCommission,
      providerAmount,
      paymentMethod: 'card',
      stripePaymentIntentId: paymentIntent.id,
      status: 'pending'
    });

    res.status(200).json({
      success: true,
      message: 'Payment intent created successfully',
      data: {
        clientSecret: paymentIntent.client_secret,
        transaction,
        amount,
        currency: 'usd'
      }
    });

  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating payment',
      error: error.message
    });
  }
};

// @desc    Confirm cash payment received (Provider)
// @route   PUT /api/payments/cash/:transactionId/confirm
// @access  Private (Provider only)
const confirmCashPayment = async (req, res) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({
        success: false,
        message: 'Only providers can confirm cash payments'
      });
    }

    const { transactionId } = req.params;

    const transaction = await Transaction.findOne({
      _id: transactionId,
      paymentMethod: 'cash',
      status: 'pending'
    }).populate('job quote');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found or already processed'
      });
    }

    // Verify provider owns the quote
    if (transaction.quote.provider.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to confirm this payment'
      });
    }

    // Update transaction status
    transaction.status = 'completed';
    transaction.cashPayment.confirmedByProvider = true;
    transaction.cashPayment.confirmedAt = new Date();
    transaction.completedAt = new Date();
    await transaction.save();

    // Update job status
    await Job.findByIdAndUpdate(transaction.job._id, {
      status: 'completed'
    });

    // Update provider's wallet
    const providerWallet = await Wallet.getOrCreate(transaction.quote.provider);
    await providerWallet.addEarnings(transaction.providerAmount);

    // Update provider stats
    await User.findByIdAndUpdate(transaction.quote.provider, {
      $inc: { totalCompletedJobs: 1 }
    });

    // Notify client
    if (req.app.get('io')) {
      sendNotificationToUser(req.app.get('io'), transaction.user, {
        type: 'payment_confirmed',
        title: 'Payment Confirmed',
        message: `Your cash payment for "${transaction.job.title}" has been confirmed by the provider`,
        jobId: transaction.job._id,
        amount: transaction.amount
      });
    }

    res.status(200).json({
      success: true,
      message: 'Cash payment confirmed successfully',
      data: { transaction }
    });

  } catch (error) {
    console.error('Confirm cash payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error confirming cash payment',
      error: error.message
    });
  }
};

// @desc    Process successful card payment (Webhook)
// @route   POST /api/payments/webhook
// @access  Public (Stripe webhook)
const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;
      case 'transfer.created':
        await handleTransferCreated(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// Handle successful payment
const handlePaymentIntentSucceeded = async (paymentIntent) => {
  const { jobId, quoteId, clientId, providerId } = paymentIntent.metadata;

  // Find and update transaction
  const transaction = await Transaction.findOne({
    stripePaymentIntentId: paymentIntent.id
  }).populate('job quote');

  if (!transaction) {
    throw new Error(`Transaction not found for payment intent: ${paymentIntent.id}`);
  }

  // Update transaction status
  transaction.status = 'completed';
  transaction.stripeChargeId = paymentIntent.latest_charge;
  transaction.paidAt = new Date();
  transaction.completedAt = new Date();
  await transaction.save();

  // Update job status
  await Job.findByIdAndUpdate(jobId, {
    status: 'completed'
  });

  // Get provider's wallet and Stripe account
  const providerWallet = await Wallet.findOne({ user: providerId });
  
  if (providerWallet && providerWallet.stripeAccountId) {
    // Transfer funds to provider's Stripe account
    await transferToProvider(
      transaction.providerAmount,
      providerWallet.stripeAccountId,
      {
        transactionId: transaction._id.toString(),
        jobId: jobId,
        quoteId: quoteId
      }
    );

    // Update provider's wallet
    await providerWallet.addEarnings(transaction.providerAmount);
  } else {
    // If no Stripe account, add to pending balance
    await providerWallet.addEarnings(transaction.providerAmount, true);
  }

  // Update provider stats
  await User.findByIdAndUpdate(providerId, {
    $inc: { totalCompletedJobs: 1 }
  });

  // Notify both parties
  if (global.io) {
    sendNotificationToUser(global.io, clientId, {
      type: 'payment_successful',
      title: 'Payment Successful',
      message: `Your payment for "${transaction.job.title}" has been processed successfully`,
      jobId: jobId,
      amount: transaction.amount
    });

    sendNotificationToUser(global.io, providerId, {
      type: 'payment_received',
      title: 'Payment Received',
      message: `You have received payment for "${transaction.job.title}"`,
      jobId: jobId,
      amount: transaction.providerAmount
    });
  }
};

// Handle failed payment
const handlePaymentIntentFailed = async (paymentIntent) => {
  const transaction = await Transaction.findOne({
    stripePaymentIntentId: paymentIntent.id
  });

  if (transaction) {
    transaction.status = 'failed';
    await transaction.save();

    // Notify client about payment failure
    if (global.io && transaction.user) {
      sendNotificationToUser(global.io, transaction.user, {
        type: 'payment_failed',
        title: 'Payment Failed',
        message: 'Your payment failed. Please try again.',
        jobId: transaction.job?.toString()
      });
    }
  }
};

// @desc    Setup Stripe Connect for provider
// @route   POST /api/payments/setup-connect
// @access  Private (Provider only)
const setupStripeConnect = async (req, res) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({
        success: false,
        message: 'Only providers can setup Stripe Connect'
      });
    }

    // Check if already has Stripe account
    let wallet = await Wallet.findOne({ user: req.user._id });
    
    if (wallet && wallet.stripeAccountId) {
      // Generate new account link for existing account
      const accountLink = await createAccountLink(
        wallet.stripeAccountId,
        `${process.env.CLIENT_URL}/provider/payment-setup?refresh=true`,
        `${process.env.CLIENT_URL}/provider/payment-setup?success=true`
      );

      return res.status(200).json({
        success: true,
        message: 'Stripe account already exists',
        data: { accountLink }
      });
    }

    // Create new Stripe Connect account
    const account = await createConnectAccount(req.user);

    // Create wallet if doesn't exist
    if (!wallet) {
      wallet = await Wallet.create({ user: req.user._id });
    }

    // Update wallet with Stripe account ID
    wallet.stripeAccountId = account.id;
    wallet.stripeAccountStatus = 'pending';
    await wallet.save();

    // Create account link for onboarding
    const accountLink = await createAccountLink(
      account.id,
      `${process.env.CLIENT_URL}/provider/payment-setup?refresh=true`,
      `${process.env.CLIENT_URL}/provider/payment-setup?success=true`
    );

    res.status(200).json({
      success: true,
      message: 'Stripe Connect setup initiated',
      data: { accountLink }
    });

  } catch (error) {
    console.error('Stripe Connect setup error:', error);
    res.status(500).json({
      success: false,
      message: 'Error setting up Stripe Connect',
      error: error.message
    });
  }
};

// @desc    Get wallet balance
// @route   GET /api/payments/wallet
// @access  Private
const getWallet = async (req, res) => {
  try {
    const wallet = await Wallet.getOrCreate(req.user._id);
    
    // Get recent transactions
    const transactions = await Transaction.find({
      $or: [
        { user: req.user._id }, // Client payments made
        { 'quote.provider': req.user._id } // Provider earnings
      ]
    })
    .populate('job', 'title')
    .populate('quote')
    .sort({ createdAt: -1 })
    .limit(10);

    res.status(200).json({
      success: true,
      data: {
        wallet,
        recentTransactions: transactions
      }
    });

  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching wallet',
      error: error.message
    });
  }
};

// @desc    Request withdrawal
// @route   POST /api/payments/withdraw
// @access  Private (Provider only)
const requestWithdrawal = async (req, res) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({
        success: false,
        message: 'Only providers can request withdrawals'
      });
    }

    const { amount } = req.body;

    const wallet = await Wallet.findOne({ user: req.user._id });
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }

    if (wallet.availableBalance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient available balance'
      });
    }

    if (amount < 10) { // Minimum withdrawal amount
      return res.status(400).json({
        success: false,
        message: 'Minimum withdrawal amount is $10'
      });
    }

    // Process withdrawal (in real implementation, this would create a withdrawal request)
    await wallet.processWithdrawal(amount);

    // If Stripe account is verified, process payout immediately
    if (wallet.stripeAccountId && wallet.stripeAccountStatus === 'verified') {
      try {
        await createPayout(amount, wallet.stripeAccountId);
        
        // Notify provider
        if (req.app.get('io')) {
          sendNotificationToUser(req.app.get('io'), req.user._id, {
            type: 'withdrawal_processed',
            title: 'Withdrawal Processed',
            message: `Your withdrawal of $${amount} has been processed successfully`,
            amount
          });
        }
      } catch (payoutError) {
        console.error('Stripe payout error:', payoutError);
        // If Stripe payout fails, revert the withdrawal
        await Wallet.findByIdAndUpdate(wallet._id, {
          $inc: {
            availableBalance: amount,
            withdrawnBalance: -amount
          }
        });
        
        throw new Error('Withdrawal failed. Please try again later.');
      }
    }

    res.status(200).json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      data: { wallet }
    });

  } catch (error) {
    console.error('Withdrawal request error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing withdrawal',
      error: error.message
    });
  }
};

module.exports = {
  createPayment,
  confirmCashPayment,
  handleWebhook,
  setupStripeConnect,
  getWallet,
  requestWithdrawal,
};