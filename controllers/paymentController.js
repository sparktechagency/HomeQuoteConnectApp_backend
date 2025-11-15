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
const { sendNotification, sendAdminNotification } = require('../socket/notificationHandler');

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
      sendNotification(req.app.get('io'), transaction.user, {
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
      case 'charge.succeeded':
      console.log('💰 Charge succeeded:', event.data.object.id);
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

  console.log('💳 PaymentIntent succeeded:', paymentIntent.id);

  // Find related transaction
  const transaction = await Transaction.findOne({
    stripePaymentIntentId: paymentIntent.id
  }).populate('job quote');

  if (!transaction) {
    console.error(`❌ Transaction not found for PaymentIntent ${paymentIntent.id}`);
    return;
  }

  // Mark transaction completed
  transaction.status = 'completed';
  transaction.stripeChargeId = paymentIntent.latest_charge;
  transaction.paidAt = new Date();
  transaction.completedAt = new Date();
  await transaction.save();

  // Mark job completed
  const job = await Job.findByIdAndUpdate(
    jobId,
    { status: 'completed' },
    { new: true }
  );

  if (!job) {
    console.error(`⚠️ Job not found for ID: ${jobId}`);
  }

  // ✅ Ensure provider wallet exists
  const providerWallet = await Wallet.getOrCreate(providerId);

  // ✅ Decide where to add funds
  if (providerWallet.stripeAccountId && providerWallet.stripeAccountStatus === 'verified') {
    // Send payout directly to provider’s Stripe Connect account
    try {
      await transferToProvider(
        transaction.providerAmount,
        providerWallet.stripeAccountId,
        {
          transactionId: transaction._id.toString(),
          jobId,
          quoteId,
        }
      );

      // Funds are transferred instantly
      await providerWallet.addEarnings(transaction.providerAmount);
      console.log(`✅ Funds transferred directly to provider ${providerId}`);
    } catch (transferErr) {
      console.error('⚠️ Transfer to provider failed:', transferErr.message);
      // Add to pending balance if direct transfer fails
      await providerWallet.addEarnings(transaction.providerAmount, true);
    }
  } else {
    // Provider hasn’t verified Stripe account yet → keep in pending
    await providerWallet.addEarnings(transaction.providerAmount, true);
    // schedule for automatic release after 24 hours
    transaction.pendingReleaseAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await transaction.save();
    console.log(`💰 Added to pending balance for provider ${providerId}; scheduled release at ${transaction.pendingReleaseAt.toISOString()}`);
  }

  // ✅ Update provider performance stats
  await User.findByIdAndUpdate(providerId, {
    $inc: { totalCompletedJobs: 1 }
  });

  // ✅ Send real-time notifications
  if (global.io) {
    // Notify client
    sendNotification(global.io, clientId, {
      type: 'payment_successful',
      title: 'Payment Successful',
      message: `Your payment for "${transaction.job?.title || 'the job'}" has been successfully processed.`,
      jobId,
      amount: transaction.amount,
    });

    // Notify provider
    sendNotification(global.io, providerId, {
      type: 'payment_received',
      title: 'Payment Received',
      message: `You’ve received payment for "${transaction.job?.title || 'the job'}".`,
      jobId,
      amount: transaction.providerAmount,
    });
  }

  console.log(`✅ Payment successfully recorded for provider ${providerId}`);
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
      sendNotification(global.io, transaction.user, {
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
      return res.status(403).json({ success: false, message: 'Only providers can setup Stripe Connect' });
    }

    // Get or create wallet
    let wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) wallet = await Wallet.create({ user: req.user._id });

    // Create Stripe account if not exists
    if (!wallet.stripeAccountId) {
      const account = await createConnectAccount(req.user);
      wallet.stripeAccountId = account.id;
      wallet.stripeAccountStatus = 'pending';
      await wallet.save();
    }

    // Create account onboarding link
    const accountLink = await createAccountLink(
      wallet.stripeAccountId,
      `${process.env.CLIENT_URL}/provider/payment-setup?refresh=true`,
      `${process.env.CLIENT_URL}/provider/success=true`
    );

    res.status(200).json({
      success: true,
      message: 'Stripe onboarding link created successfully',
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

const checkStripeAccountStatus = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user._id });

    if (!wallet || !wallet.stripeAccountId) {
      return res.status(404).json({
        success: false,
        message: 'No Stripe account found. Please start onboarding.'
      });
    }

    const account = await stripe.accounts.retrieve(wallet.stripeAccountId);
    const isVerified =
      account.charges_enabled &&
      account.payouts_enabled &&
      !account.requirements?.disabled_reason;

    // ✅ Update DB if changed
    wallet.stripeAccountStatus = isVerified ? 'verified' : 'pending';
    await wallet.save();

    res.status(200).json({
      success: true,
      message: 'Stripe account status fetched successfully',
      data: {
        status: wallet.stripeAccountStatus,
        detailsSubmitted: account.details_submitted,
        payoutsEnabled: account.payouts_enabled,
        chargesEnabled: account.charges_enabled
      }
    });

  } catch (error) {
    console.error('Stripe status check error:', error);
    res.status(500).json({ success: false, message: error.message });
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
// @desc    Request withdrawal (Provider)
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
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    if (wallet.availableBalance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient available balance' });
    }

    if (amount < 10) {
      return res.status(400).json({ success: false, message: 'Minimum withdrawal amount is $10' });
    }

    // Ensure stripe account exists and is verified
    if (!wallet.stripeAccountId || wallet.stripeAccountStatus !== 'verified') {
      return res.status(400).json({
        success: false,
        message: 'Stripe account not connected or not verified. Complete onboarding to receive payouts.'
      });
    }

    // Fetch connected account details to ensure external/bank account exists
    let connectedAccount;
    try {
      connectedAccount = await stripe.accounts.retrieve(wallet.stripeAccountId);
    } catch (err) {
      console.error('Error retrieving connected account:', err);
      return res.status(500).json({ success: false, message: 'Failed to verify Stripe account', error: err.message });
    }

    // Check for external/bank account on connected account (may vary by country/type)
    const externalAccounts = (connectedAccount.external_accounts && connectedAccount.external_accounts.data) || [];
    if (externalAccounts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No payout destination (bank account) found on connected Stripe account. Please add bank details in Stripe onboarding.'
      });
    }

    // Deduct from wallet first (atomically)
    await wallet.processWithdrawal(amount); // this will throw if insufficient

    // Try to transfer funds to connected account (platform -> connected)
    // Using transferToProvider helper (which uses stripe.transfers.create)
    try {
      const transfer = await transferToProvider(amount, wallet.stripeAccountId, {
        reason: 'withdrawal',
        provider: wallet.user.toString()
      });

      // Optionally save transfer id somewhere — here we'll push into recentTransactions
      wallet.recentTransactions = wallet.recentTransactions || [];
      wallet.recentTransactions.push({
        type: 'withdrawal',
        amount,
        date: new Date(),
        stripeTransferId: transfer.id
      });
      await wallet.save();

      // Notify provider through socket if available
      if (req.app.get('io')) {
        sendNotification(req.app.get('io'), req.user._id, {
          type: 'withdrawal_processed',
          title: 'Withdrawal Processed',
          message: `Your withdrawal of $${amount} has been transferred to your Stripe account.`,
          amount,
          transferId: transfer.id
        });
      }

      // === NOTIFY ALL ADMINS ===
      if (req.app.get('io')) {
        await sendAdminNotification(req.app.get('io'), {
          type: 'withdrawal_requested',
          title: 'Withdrawal Requested',
          message: `${req.user.fullName} requested a withdrawal of $${amount}`,
          data: {
            providerId: req.user._id,
            providerName: req.user.fullName,
            amount,
            transferId: transfer.id,
            requestedAt: new Date()
          },
          category: 'withdrawal',
          priority: 'high'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Withdrawal initiated successfully',
        data: { wallet, transferId: transfer.id }
      });

    } catch (stripeErr) {
      console.error('Stripe transfer/payout error:', stripeErr);

      // Revert wallet changes when transfer failed
      await Wallet.findByIdAndUpdate(wallet._id, {
        $inc: {
          availableBalance: amount,
          withdrawnBalance: -amount
        }
      });

      // Provide actionable error message for debugging
      const stripeMessage = stripeErr && stripeErr.message ? stripeErr.message : 'Stripe error';
      return res.status(500).json({
        success: false,
        message: 'Withdrawal failed. Please try again later.',
        error: stripeMessage
      });
    }

  } catch (error) {
    console.error('Withdrawal request error (outer):', error);
    res.status(500).json({
      success: false,
      message: 'Error processing withdrawal',
      error: error.message
    });
  }
};


module.exports = {
  checkStripeAccountStatus,
  createPayment,
  confirmCashPayment,
  handleWebhook,
  setupStripeConnect,
  getWallet,
  requestWithdrawal,
};