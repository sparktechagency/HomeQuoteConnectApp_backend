// controllers/webhookController.js
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const UserSubscription = require('../models/UserSubscription');
const CreditActivity = require('../models/CreditActivity');
const { handleSubscriptionPayment } = require('./subscriptionController');

// @desc    Main webhook handler for Stripe events
// @route   POST /api/webhooks/stripe
// @access  Public
const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    console.log(`Processing Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;
      
      case 'account.updated':
        await handleAccountUpdated(event.data.object);
        break;
      
      case 'payout.paid':
        await handlePayoutPaid(event.data.object);
        break;
      
      case 'transfer.created':
        await handleTransferCreated(event.data.object);
        break;
      
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object);
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

// Handle successful payments
const handlePaymentIntentSucceeded = async (paymentIntent) => {
  const { type } = paymentIntent.metadata;
  
  if (type === 'subscription' || type === 'credits') {
    await handleSubscriptionPayment(paymentIntent);
  } else {
    // Handle regular job payments
    await handleJobPaymentSucceeded(paymentIntent);
  }
};

// Handle job payment success
const handleJobPaymentSucceeded = async (paymentIntent) => {
  const { jobId, quoteId, clientId, providerId } = paymentIntent.metadata;

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
  const Job = require('../models/Job');
  await Job.findByIdAndUpdate(jobId, {
    status: 'completed'
  });

  // Update provider stats
  await User.findByIdAndUpdate(providerId, {
    $inc: { totalCompletedJobs: 1 }
  });

  // Notify both parties
  if (global.io) {
    const { sendNotificationToUser } = require('../socket/socketHandler');
    
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

// Handle Stripe Connect account updates
const handleAccountUpdated = async (account) => {
  const Wallet = require('../models/Wallet');
  const wallet = await Wallet.findOne({ stripeAccountId: account.id });
  
  if (wallet) {
    wallet.stripeAccountStatus = account.charges_enabled ? 'verified' : 'pending';
    await wallet.save();

    // Notify provider about account verification
    if (global.io && account.charges_enabled) {
      const { sendNotificationToUser } = require('../socket/socketHandler');
      sendNotificationToUser(global.io, wallet.user, {
        type: 'stripe_account_verified',
        title: 'Payment Account Verified',
        message: 'Your Stripe account has been verified and you can now receive payments',
        accountId: account.id
      });
    }
  }
};

// Handle payout completion
const handlePayoutPaid = async (payout) => {
  console.log(`Payout ${payout.id} completed for amount: ${payout.amount / 100}`);
  // Could update withdrawal status here if tracking individual payouts
};

// Handle transfer creation
const handleTransferCreated = async (transfer) => {
  const transaction = await Transaction.findOne({ stripeTransferId: transfer.id });
  if (transaction) {
    console.log(`Transfer ${transfer.id} created for transaction: ${transaction._id}`);
  }
};

// Handle charge refunds
const handleChargeRefunded = async (charge) => {
  const transaction = await Transaction.findOne({ stripeChargeId: charge.id });
  if (transaction) {
    transaction.status = 'refunded';
    transaction.refundedAt = new Date();
    await transaction.save();
    
    console.log(`Charge ${charge.id} refunded for transaction: ${transaction._id}`);
  }
};

module.exports = {
  handleStripeWebhook
};