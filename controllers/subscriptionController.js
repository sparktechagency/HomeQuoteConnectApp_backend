// controllers/subscriptionController.js
const mongoose = require('mongoose');   // ✅ Must Be Added
const Subscription = require('../models/Subscription');
const UserSubscription = require('../models/UserSubscription');
const CreditPackage = require('../models/CreditPackage');
const CreditActivity = require('../models/CreditActivity');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { createPaymentIntent } = require('../config/stripe');
const { sendNotificationToUser } = require('../socket/socketHandler');

// @desc    Get all active subscriptions
// @route   GET /api/subscriptions
// @access  Public
const getSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ isActive: true })
      .sort({ price: 1 });

    res.status(200).json({
      success: true,
      data: { subscriptions }
    });

  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subscriptions',
      error: error.message
    });
  }
};

// @desc    Purchase subscription
// @route   POST /api/subscriptions/purchase
// @access  Private (Providers only)
const purchaseSubscription = async (req, res) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({
        success: false,
        message: 'Only providers can purchase subscriptions'
      });
    }

    const { subscriptionId, paymentMethod = 'card' } = req.body;

    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription || !subscription.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found or inactive'
      });
    }

    // Check if user already has an active subscription
    const activeSubscription = await UserSubscription.findOne({
      user: req.user._id,
      status: 'active',
      endDate: { $gt: new Date() }
    });

    if (activeSubscription) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active subscription'
      });
    }

    const amount = subscription.discountedPrice;

    // For card payments, create Stripe payment intent
    if (paymentMethod === 'card') {
      const paymentIntent = await createPaymentIntent(
        amount,
        'usd', 
        {
          type: 'subscription',
          subscriptionId: subscription._id.toString(),
          userId: req.user._id.toString(),
          email: req.user.email
        }
      );

      // Create pending user subscription
      const userSubscription = await UserSubscription.create({
        user: req.user._id,
        subscription: subscriptionId,
        email: req.user.email,
        startDate: new Date(),
        endDate: calculateEndDate(subscription.duration),
        status: 'pending',
        stripeSubscriptionId: paymentIntent.id
      });

      // Create pending transaction
      const transaction = await Transaction.create({
        user: req.user._id,
        amount,
        platformCommission: 0, // No commission on subscriptions
        providerAmount: amount,
        paymentMethod: 'card',
        stripePaymentIntentId: paymentIntent.id,
  job: null,
  quote: null,
        type: 'subscription', // ✅ Add type to differentiate 
        status: 'pending',
        metadata: {
          type: 'subscription',
          subscriptionId: subscription._id,
          subscriptionType: subscription.type
        }
      });

      res.status(200).json({
        success: true,
        message: 'Subscription purchase initiated',
        data: {
          clientSecret: paymentIntent.client_secret,
          subscription: userSubscription,
          amount,
          currency: 'usd'
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Only card payments are supported for subscriptions'
      });
    }

  } catch (error) {
    console.error('Purchase subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Error purchasing subscription',
      error: error.message
    });
  }
};

// @desc    Get user's current subscription
// @route   GET /api/subscriptions/my-subscription
// @access  Private (Providers only)
const getMySubscription = async (req, res) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({
        success: false,
        message: 'Only providers can access subscriptions'
      });
    }

    const subscription = await UserSubscription.findOne({
      user: req.user._id,
      status: 'active',
      endDate: { $gt: new Date() }
    })
    .populate('subscription')
    .sort({ createdAt: -1 });

    // Get subscription usage statistics
    let usage = null;
    if (subscription) {
      const quotesUsed = subscription.quotesUsed;
      const quoteLimit = subscription.subscription.quoteLimit;
      const quotesRemaining = quoteLimit === 0 ? 'Unlimited' : quoteLimit - quotesUsed;

      usage = {
        quotesUsed,
        quoteLimit,
        quotesRemaining,
        usagePercentage: quoteLimit === 0 ? 0 : (quotesUsed / quoteLimit) * 100
      };
    }

    res.status(200).json({
      success: true,
      data: {
        subscription,
        usage
      }
    });

  } catch (error) {
    console.error('Get my subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subscription',
      error: error.message
    });
  }
};

// @desc    Get credit packages
// @route   GET /api/subscriptions/credits/packages
// @access  Public
const getCreditPackages = async (req, res) => {
  try {
    const packages = await CreditPackage.find({ isActive: true })
      .sort({ credits: 1 });

    res.status(200).json({
      success: true,
      data: { packages }
    });

  } catch (error) {
    console.error('Get credit packages error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching credit packages',
      error: error.message
    });
  }
};

// @desc    Purchase credits
// @route   POST /api/subscriptions/credits/purchase
// @access  Private
const purchaseCredits = async (req, res) => {
  try {
    const { packageId, paymentMethod = 'card' } = req.body;

    const creditPackage = await CreditPackage.findById(packageId);
    if (!creditPackage || !creditPackage.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Credit package not found or inactive'
      });
    }

    const amount = creditPackage.discountedPrice;
    const credits = creditPackage.credits;

    // For card payments, create Stripe payment intent
    if (paymentMethod === 'card') {
      const paymentIntent = await createPaymentIntent(amount, 'usd', {
        type: 'credits',
        packageId: creditPackage._id.toString(),
        userId: req.user._id.toString(),
        credits
      });

      // Create pending transaction
      const transaction = await Transaction.create({
        user: req.user._id,
        amount,
        platformCommission: 0, // No commission on credit purchases
        providerAmount: amount,
        paymentMethod: 'card',
        stripePaymentIntentId: paymentIntent.id,
        status: 'pending',
        metadata: {
          type: 'credits',
          packageId: creditPackage._id,
          credits
        }
      });

      res.status(200).json({
        success: true,
        message: 'Credit purchase initiated',
        data: {
          clientSecret: paymentIntent.client_secret,
          credits,
          amount,
          currency: 'usd'
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Only card payments are supported for credit purchases'
      });
    }

  } catch (error) {
    console.error('Purchase credits error:', error);
    res.status(500).json({
      success: false,
      message: 'Error purchasing credits',
      error: error.message
    });
  }
};

// @desc    Get credit activity
// @route   GET /api/subscriptions/credits/activity
// @access  Private
const getCreditActivity = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const activities = await CreditActivity.find({ user: req.user._id })
      .populate('referenceId')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await CreditActivity.countDocuments({ user: req.user._id });

    res.status(200).json({
      success: true,
      data: {
        activities,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get credit activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching credit activity',
      error: error.message
    });
  }
};

// Helper function to calculate subscription end date
const calculateEndDate = (subscriptionType) => {
  const endDate = new Date();
  
  switch (subscriptionType) {
    case 'monthly':
      endDate.setMonth(endDate.getMonth() + 1);
      break;
    case '6months':
      endDate.setMonth(endDate.getMonth() + 6);
      break;
    case 'yearly':
      endDate.setFullYear(endDate.getFullYear() + 1);
      break;
    default:
      endDate.setMonth(endDate.getMonth() + 1);
  }
  
  return endDate;
};

// Webhook handler for subscription payments (add to paymentController)
const handleSubscriptionPayment = async (paymentIntent) => {
  const { subscriptionId, userId, type } = paymentIntent.metadata;

  if (type === 'subscription') {
    const userSubscription = await UserSubscription.findOne({
      stripeSubscriptionId: paymentIntent.id
    }).populate('subscription');

    if (userSubscription) {
      userSubscription.status = 'active';
      userSubscription.transaction = await Transaction.findOne({
        stripePaymentIntentId: paymentIntent.id
      });
      await userSubscription.save();

      // Notify user
      if (global.io) {
        sendNotificationToUser(global.io, userId, {
          type: 'subscription_activated',
          title: 'Subscription Activated',
          message: `Your ${userSubscription.subscription.type} subscription has been activated!`,
          subscriptionId: userSubscription._id
        });
      }
    }
  } else if (type === 'credits') {
    const { credits, packageId } = paymentIntent.metadata;
    
    // Add credits to user
    await User.findByIdAndUpdate(userId, {
      $inc: { credits: parseInt(credits) }
    });

    // Log credit activity
    await CreditActivity.logActivity(
      userId,
      parseInt(credits),
      'purchase',
      `Purchased ${credits} credits`,
      packageId,
      'CreditPackage',
      { packageId, credits }
    );

    // Update transaction status
    await Transaction.findOneAndUpdate(
      { stripePaymentIntentId: paymentIntent.id },
      { status: 'completed' }
    );

    // Notify user
    if (global.io) {
      sendNotificationToUser(global.io, userId, {
        type: 'credits_added',
        title: 'Credits Added',
        message: `Your account has been credited with ${credits} credits`,
        credits: parseInt(credits)
      });
    }
  }
};

module.exports = {
  getSubscriptions,
  purchaseSubscription,
  getMySubscription,
  getCreditPackages,
  purchaseCredits,
  getCreditActivity,
  handleSubscriptionPayment
};