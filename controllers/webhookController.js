// controllers/webhookController.js
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const UserSubscription = require('../models/UserSubscription');
const CreditActivity = require('../models/CreditActivity');
const Wallet = require('../models/Wallet');
const { handleSubscriptionPayment } = require('./subscriptionController');
const Job = require('../models/Job');  
const { sendNotificationToUser } = require('../socket/socketHandler'); // ✅ Import notifications if used


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
  const { jobId, clientId, providerId } = paymentIntent.metadata;
  const totalAmount = paymentIntent.amount_received / 100; // cents to dollars

  console.log(`✅ Payment succeeded for Job: ${jobId} — Total $${totalAmount}`);

  // Find related transaction
  const transaction = await Transaction.findOne({ stripePaymentIntentId: paymentIntent.id }).populate('job');
  if (!transaction) {
    throw new Error(`Transaction not found for payment intent: ${paymentIntent.id}`);
  }

  // 💰 Calculate commission (10%) and provider share
  const platformCommission = parseFloat((totalAmount * 0.10).toFixed(2));
  const providerAmount = parseFloat((totalAmount - platformCommission).toFixed(2));

  // 1️⃣ Update transaction details
  transaction.status = 'completed';
  transaction.stripeChargeId = paymentIntent.latest_charge;
  transaction.paidAt = new Date();
  transaction.completedAt = new Date();
  transaction.amount = totalAmount;
  transaction.platformCommission = platformCommission;
  transaction.providerAmount = providerAmount;
  await transaction.save();

  // 2️⃣ Update job status
  await Job.findByIdAndUpdate(jobId, { status: 'completed', isPaid: true });

// 3️⃣ Update provider wallet (add to pending balance)
let providerWallet = await Wallet.findOne({ user: providerId });
if (!providerWallet) {
  providerWallet = await Wallet.create({
    user: providerId,
    pendingBalance: 0,
    totalEarned: 0,
    recentTransactions: [] // ✅ Make sure it's initialized
  });
}

// ✅ Ensure recentTransactions always exists as an array
if (!Array.isArray(providerWallet.recentTransactions)) {
  providerWallet.recentTransactions = [];
}

providerWallet.pendingBalance += providerAmount;
providerWallet.totalEarned += providerAmount;

providerWallet.recentTransactions.push({
  transaction: transaction._id,
  amount: providerAmount,
  type: 'pending',
  date: new Date(),
});

await providerWallet.save();

  // 4️⃣ Update admin overview totals
  // (Assuming your Overview collection has a single document that tracks totals)
  let overview = await Overview.findOne();
  if (!overview) {
    overview = await Overview.create({
      totalRevenue: 0,
      totalCommission: 0,
      completedTransactions: 0,
    });
  }

  overview.totalRevenue += totalAmount;
  overview.totalCommission += platformCommission;
  overview.completedTransactions += 1;
  await overview.save();

  // 5️⃣ Send notifications (client + provider)
  if (global.io) {
    sendNotificationToUser(global.io, clientId, {
      type: 'payment_successful',
      title: 'Payment Successful',
      message: `You paid $${totalAmount} for job "${transaction.job?.title || ''}".`,
      amount: totalAmount,
    });

    sendNotificationToUser(global.io, providerId, {
      type: 'payment_received',
      title: 'Payment Received',
      message: `You received $${providerAmount} for job "${transaction.job?.title || ''}". Pending for approval.`,
      amount: providerAmount,
    });
  }

  console.log(`🎉 Job payment processed → Total: $${totalAmount}, Commission: $${platformCommission}, Provider: $${providerAmount}`);
};


// Handle Stripe Connect account updates (account.updated Event)
const handleAccountUpdated = async (account) => {
  try {
    const wallet = await Wallet.findOne({ stripeAccountId: account.id });

    if (!wallet) {
      console.log(`⚠️ No wallet found for Stripe account: ${account.id}`);
      return;
    }

    // Check verification status
    const isVerified = 
      account.charges_enabled === true && 
      account.payouts_enabled === true && 
      account.requirements?.disabled_reason === null;

    // Update wallet status accordingly
    wallet.stripeAccountStatus = isVerified ? 'verified' : 'pending';
    await wallet.save();

    console.log(`✅ Stripe Connect account updated → ${account.id}, status = ${wallet.stripeAccountStatus}`);

    // Notify provider when fully verified
    if (isVerified && global.io) {
      const { sendNotificationToUser } = require('../socket/socketHandler');
      sendNotificationToUser(global.io, wallet.user, {
        type: 'stripe_account_verified',
        title: '✅ Stripe Account Verified',
        message: 'Your payment account has been verified. You can now receive payouts successfully.',
        accountId: account.id
      });
    }

  } catch (err) {
    console.error('❌ Error handling account.updated:', err);
  }
};

// Handle payout completion
const handlePayoutPaid = async (payout) => {
  console.log(`Payout ${payout.id} completed for amount: ${payout.amount / 100}`);
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
