// controllers/adminPaymentController.js
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const User = require('../models/User');
const Job = require('../models/Job');
const { transferToProvider, stripe } = require('../config/stripe');

// @desc    Get all transactions with filtering
// @route   GET /api/admin/payments/transactions
// @access  Private (Admin only)
const getTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      paymentMethod,
      dateFrom,
      dateTo,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = {};
    
    if (status) filter.status = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    
    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo + 'T23:59:59.999Z');
    }

    // Search filter (user name or email)
    if (search) {
      const users = await User.find({
        $or: [
          { fullName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      
      const userIds = users.map(user => user._id);
      filter.$or = [
        { user: { $in: userIds } },
        { 'quote.provider': { $in: userIds } }
      ];
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const transactions = await Transaction.find(filter)
      .populate('user', 'fullName email profilePhoto')
      .populate('job', 'title')
      .populate({
        path: 'quote',
        populate: {
          path: 'provider',
          select: 'fullName businessName email'
        }
      })
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Transaction.countDocuments(filter);

    // Calculate summary statistics
    const stats = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalCommission: { $sum: '$platformCommission' },
          totalTransactions: { $sum: 1 },
          completedTransactions: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          pendingAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] }
          }
        }
      }
    ]);

    const summary = stats.length > 0 ? stats[0] : {
      totalAmount: 0,
      totalCommission: 0,
      totalTransactions: 0,
      completedTransactions: 0,
      pendingAmount: 0
    };

    res.status(200).json({
      success: true,
      data: {
        transactions,
        summary,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions',
      error: error.message
    });
  }
};

// @desc    Get transaction details
// @route   GET /api/admin/payments/transactions/:id
// @access  Private (Admin only)
const getTransactionDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await Transaction.findById(id)
      .populate('user', 'fullName email phoneNumber profilePhoto')
      .populate('job', 'title description location photos')
      .populate({
        path: 'quote',
        populate: [
          {
            path: 'provider',
            select: 'fullName businessName email phoneNumber profilePhoto averageRating'
          },
          {
            path: 'job',
            select: 'title'
          }
        ]
      });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { transaction }
    });

  } catch (error) {
    console.error('Get transaction details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transaction details',
      error: error.message
    });
  }
};

// @desc    Release payment to provider
// @route   PUT /api/admin/payments/transactions/:id/release
// @access  Private (Admin only)
const releasePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const transaction = await Transaction.findOne({
      _id: id,
      status: 'completed'
    }).populate('quote');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found or not completed'
      });
    }

    // Check if payment already released
    if (transaction.stripeTransferId) {
      return res.status(400).json({
        success: false,
        message: 'Payment has already been released to provider'
      });
    }

    const provider = await User.findById(transaction.quote.provider);
    const providerWallet = await Wallet.findOne({ user: provider._id });

    if (!providerWallet) {
      return res.status(400).json({
        success: false,
        message: 'Provider wallet not found'
      });
    }

    // Release funds to provider
    if (providerWallet.stripeAccountId) {
      try {
        // Transfer to provider's Stripe account
        const transfer = await transferToProvider(
          transaction.providerAmount,
          providerWallet.stripeAccountId,
          {
            transactionId: transaction._id.toString(),
            jobId: transaction.job._id.toString()
          }
        );

        transaction.stripeTransferId = transfer.id;
        
        // Update provider's wallet
        await providerWallet.addEarnings(transaction.providerAmount);

      } catch (stripeError) {
        console.error('Stripe transfer error:', stripeError);
        
        // If Stripe transfer fails, add to provider's pending balance
        await providerWallet.addEarnings(transaction.providerAmount, true);
        
        return res.status(500).json({
          success: false,
          message: 'Stripe transfer failed. Funds added to provider\'s pending balance.'
        });
      }
    } else {
      // If no Stripe account, add to provider's pending balance
      await providerWallet.addEarnings(transaction.providerAmount, true);
    }

    transaction.metadata = {
      ...transaction.metadata,
      releasedBy: req.user._id,
      releasedAt: new Date(),
      releaseNotes: notes
    };

    await transaction.save();

    // Notify provider
    if (req.app.get('io')) {
      const { sendNotificationToUser } = require('../socket/socketHandler');
      sendNotificationToUser(req.app.get('io'), provider._id, {
        type: 'payment_released',
        title: 'Payment Released',
        message: `Payment of $${transaction.providerAmount} for job "${transaction.job.title}" has been released to your wallet`,
        transactionId: transaction._id,
        amount: transaction.providerAmount
      });
    }

    res.status(200).json({
      success: true,
      message: 'Payment released successfully',
      data: { transaction }
    });

  } catch (error) {
    console.error('Release payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error releasing payment',
      error: error.message
    });
  }
};

// @desc    Process refund
// @route   PUT /api/admin/payments/transactions/:id/refund
// @access  Private (Admin only)
const processRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, amount, notes } = req.body;

    const transaction = await Transaction.findOne({
      _id: id,
      status: 'completed'
    }).populate('user job');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found or not completed'
      });
    }

    const refundAmount = amount || transaction.amount;

    if (refundAmount > transaction.amount) {
      return res.status(400).json({
        success: false,
        message: 'Refund amount cannot exceed transaction amount'
      });
    }

    // Process Stripe refund for card payments
    if (transaction.paymentMethod === 'card' && transaction.stripeChargeId) {
      try {
        const refund = await stripe.refunds.create({
          charge: transaction.stripeChargeId,
          amount: Math.round(refundAmount * 100), // Convert to cents
          metadata: {
            transactionId: transaction._id.toString(),
            reason: reason,
            adminNotes: notes,
            processedBy: req.user._id.toString()
          }
        });

        transaction.stripeRefundId = refund.id;
      } catch (stripeError) {
        console.error('Stripe refund error:', stripeError);
        return res.status(500).json({
          success: false,
          message: 'Stripe refund failed: ' + stripeError.message
        });
      }
    }

    // Update transaction status
    transaction.status = 'refunded';
    transaction.refundedAt = new Date();
    transaction.metadata = {
      ...transaction.metadata,
      refund: {
        reason,
        amount: refundAmount,
        notes,
        processedBy: req.user._id,
        processedAt: new Date()
      }
    };

    await transaction.save();

    // Update job status if needed
    await Job.findByIdAndUpdate(transaction.job._id, {
      status: 'cancelled'
    });

    // Notify user
    if (req.app.get('io')) {
      const { sendNotificationToUser } = require('../socket/socketHandler');
      sendNotificationToUser(req.app.get('io'), transaction.user._id, {
        type: 'refund_processed',
        title: 'Refund Processed',
        message: `Your refund of $${refundAmount} for job "${transaction.job.title}" has been processed`,
        transactionId: transaction._id,
        amount: refundAmount,
        reason: reason
      });
    }

    res.status(200).json({
      success: true,
      message: 'Refund processed successfully',
      data: { transaction }
    });

  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing refund',
      error: error.message
    });
  }
};

// @desc    Get provider wallets
// @route   GET /api/admin/payments/wallets
// @access  Private (Admin only)
const getProviderWallets = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      minBalance,
      maxBalance,
      sortBy = 'availableBalance',
      sortOrder = 'desc'
    } = req.query;

    // Build filter for providers with wallets
    const userFilter = { role: 'provider' };
    if (search) {
      userFilter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { businessName: { $regex: search, $options: 'i' } }
      ];
    }

    const providers = await User.find(userFilter)
      .select('fullName email businessName profilePhoto verificationStatus')
      .sort({ createdAt: -1 });

    const providerIds = providers.map(p => p._id);

    // Get wallets for these providers
    const walletFilter = { user: { $in: providerIds } };
    
    if (minBalance) {
      walletFilter.availableBalance = { $gte: parseFloat(minBalance) };
    }
    if (maxBalance) {
      walletFilter.availableBalance = { ...walletFilter.availableBalance, $lte: parseFloat(maxBalance) };
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const wallets = await Wallet.find(walletFilter)
      .populate('user', 'fullName email businessName profilePhoto verificationStatus')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Wallet.countDocuments(walletFilter);

    // Calculate total balances
    const balanceStats = await Wallet.aggregate([
      { $match: walletFilter },
      {
        $group: {
          _id: null,
          totalAvailable: { $sum: '$availableBalance' },
          totalPending: { $sum: '$pendingBalance' },
          totalWithdrawn: { $sum: '$withdrawnBalance' },
          totalEarned: { $sum: '$totalEarned' },
          walletCount: { $sum: 1 }
        }
      }
    ]);

    const stats = balanceStats.length > 0 ? balanceStats[0] : {
      totalAvailable: 0,
      totalPending: 0,
      totalWithdrawn: 0,
      totalEarned: 0,
      walletCount: 0
    };

    res.status(200).json({
      success: true,
      data: {
        wallets,
        statistics: stats,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get provider wallets error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching provider wallets',
      error: error.message
    });
  }
};

// @desc    Get platform earnings
// @route   GET /api/admin/payments/earnings
// @access  Private (Admin only)
const getPlatformEarnings = async (req, res) => {
  try {
    const { period = 'this_month', groupBy = 'day' } = req.query;

    const { startDate, endDate } = calculateDateRange(period);

    // Earnings over time
    const earningsOverTime = await Transaction.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: getGroupByExpression(groupBy),
          totalRevenue: { $sum: '$amount' },
          totalCommission: { $sum: '$platformCommission' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Current period stats
    const currentStats = await Transaction.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalCommission: { $sum: '$platformCommission' },
          transactionCount: { $sum: 1 },
          avgTransaction: { $avg: '$amount' }
        }
      }
    ]);

    // Previous period for comparison
    const previousStartDate = new Date(startDate);
    const previousEndDate = new Date(endDate);
    const timeDiff = endDate - startDate;
    previousStartDate.setTime(previousStartDate.getTime() - timeDiff);
    previousEndDate.setTime(previousEndDate.getTime() - timeDiff);

    const previousStats = await Transaction.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: previousStartDate, $lte: previousEndDate }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalCommission: { $sum: '$platformCommission' },
          transactionCount: { $sum: 1 }
        }
      }
    ]);

    const current = currentStats.length > 0 ? currentStats[0] : {
      totalRevenue: 0,
      totalCommission: 0,
      transactionCount: 0,
      avgTransaction: 0
    };

    const previous = previousStats.length > 0 ? previousStats[0] : {
      totalRevenue: 0,
      totalCommission: 0,
      transactionCount: 0
    };

    // Calculate growth percentages
    const revenueGrowth = previous.totalRevenue === 0 ? 100 : 
      ((current.totalRevenue - previous.totalRevenue) / previous.totalRevenue) * 100;
    
    const commissionGrowth = previous.totalCommission === 0 ? 100 : 
      ((current.totalCommission - previous.totalCommission) / previous.totalCommission) * 100;
    
    const transactionGrowth = previous.transactionCount === 0 ? 100 : 
      ((current.transactionCount - previous.transactionCount) / previous.transactionCount) * 100;

    res.status(200).json({
      success: true,
      data: {
        earningsOverTime,
        statistics: {
          current: {
            ...current,
            revenueGrowth: Math.round(revenueGrowth),
            commissionGrowth: Math.round(commissionGrowth),
            transactionGrowth: Math.round(transactionGrowth)
          },
          previous: {
            ...previous
          }
        },
        period: {
          current: { startDate, endDate },
          previous: { startDate: previousStartDate, endDate: previousEndDate }
        }
      }
    });

  } catch (error) {
    console.error('Get platform earnings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching platform earnings',
      error: error.message
    });
  }
};

// Helper functions
const calculateDateRange = (period) => {
  const now = new Date();
  let startDate, endDate;

  switch (period) {
    case 'today':
      startDate = new Date(now.setHours(0, 0, 0, 0));
      endDate = new Date(now.setHours(23, 59, 59, 999));
      break;
    case 'this_week':
      startDate = new Date(now.setDate(now.getDate() - now.getDay()));
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      break;
    case 'this_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'this_year':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
      break;
    default:
      startDate = new Date(0);
      endDate = new Date();
  }

  return { startDate, endDate };
};

const getGroupByExpression = (groupBy) => {
  switch (groupBy) {
    case 'day':
      return {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' }
      };
    case 'week':
      return {
        year: { $year: '$createdAt' },
        week: { $week: '$createdAt' }
      };
    case 'month':
      return {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' }
      };
    default:
      return {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' }
      };
  }
};

module.exports = {
  getTransactions,
  getTransactionDetails,
  releasePayment,
  processRefund,
  getProviderWallets,
  getPlatformEarnings
};