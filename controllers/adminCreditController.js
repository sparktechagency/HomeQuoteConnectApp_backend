// controllers/adminCreditController.js
const User = require('../models/User');
const CreditActivity = require('../models/CreditActivity');
const SystemSettings = require('../models/SystemSettings');
const { success, error } = require('../utils/response');

// @desc    Get system credit settings
// @route   GET /api/admin/credits/settings
// @access  Private (Admin only)
const getCreditSettings = async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    
    return res.status(200).json({
      success: true,
      message: 'Credit settings retrieved successfully',
      data: {
        signupCredits: settings.creditSettings.signupCredits,
        verificationCredits: settings.creditSettings.verificationCredits,
        lastUpdated: settings.updatedAt,
        updatedBy: settings.updatedBy
      }
    });
  } catch (err) {
    console.error('Error in getCreditSettings:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch credit settings',
      error: err.message
    });
  }
};

// @desc    Update system credit settings
// @route   PUT /api/admin/credits/settings
// @access  Private (Admin only)
const updateCreditSettings = async (req, res) => {
  try {
    const { signupCredits, verificationCredits } = req.body;
    
    // Validation
    if (signupCredits !== undefined) {
      if (typeof signupCredits !== 'number' || signupCredits < 0 || signupCredits > 1000) {
        return res.status(400).json({
          success: false,
          message: 'Signup credits must be a number between 0 and 1000'
        });
      }
    }
    
    if (verificationCredits !== undefined) {
      if (typeof verificationCredits !== 'number' || verificationCredits < 0 || verificationCredits > 1000) {
        return res.status(400).json({
          success: false,
          message: 'Verification credits must be a number between 0 and 1000'
        });
      }
    }
    
    const updates = { creditSettings: {} };
    if (signupCredits !== undefined) updates.creditSettings.signupCredits = signupCredits;
    if (verificationCredits !== undefined) updates.creditSettings.verificationCredits = verificationCredits;
    
    const settings = await SystemSettings.updateSettings(updates, req.user._id);
    
    return res.status(200).json({
      success: true,
      message: 'Credit settings updated successfully',
      data: {
        signupCredits: settings.creditSettings.signupCredits,
        verificationCredits: settings.creditSettings.verificationCredits,
        lastUpdated: settings.updatedAt
      }
    });
  } catch (err) {
    console.error('Error in updateCreditSettings:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update credit settings',
      error: err.message
    });
  }
};

// @desc    Adjust credits for a specific user
// @route   POST /api/admin/credits/adjust
// @access  Private (Admin only)
const adjustUserCredits = async (req, res) => {
  try {
    const { userId, creditChange, reason, type = 'bonus' } = req.body;
    
    // Validation
    if (!userId || !creditChange || !reason) {
      return res.status(400).json({
        success: false,
        message: 'userId, creditChange, and reason are required'
      });
    }
    
    if (typeof creditChange !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'creditChange must be a number'
      });
    }
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (user.role !== 'provider') {
      return res.status(400).json({
        success: false,
        message: 'Credits can only be adjusted for providers'
      });
    }
    
    // Calculate new balance
    const previousBalance = user.credits || 0;
    const newBalance = Math.max(0, previousBalance + creditChange); // Prevent negative balance
    
    // Update user credits
    user.credits = newBalance;
    await user.save();
    
    // Log activity
    await CreditActivity.create({
      user: userId,
      creditChange: creditChange,
      newBalance: newBalance,
      type: type, // 'bonus', 'refund', 'adjustment', etc.
      description: reason,
      metadata: {
        adjustedBy: req.user._id,
        adjustedByName: req.user.fullName,
        adjustedAt: new Date()
      }
    });
    
    return res.status(200).json({
      success: true,
      message: 'User credits adjusted successfully',
      data: {
        userId: user._id,
        userName: user.fullName,
        email: user.email,
        previousBalance,
        creditChange,
        newBalance,
        reason
      }
    });
  } catch (err) {
    console.error('Error in adjustUserCredits:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to adjust user credits',
      error: err.message
    });
  }
};

// @desc    Get user credit balance and history
// @route   GET /api/admin/credits/user/:userId
// @access  Private (Admin only)
const getUserCredits = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    // Find user
    const user = await User.findById(userId).select('fullName email role credits profilePhoto');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get credit activity history
    const activities = await CreditActivity.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((page - 1) * limit)
      .lean();
    
    const total = await CreditActivity.countDocuments({ user: userId });
    
    return res.status(200).json({
      success: true,
      message: 'User credit information retrieved successfully',
      data: {
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          profilePhoto: user.profilePhoto,
          currentBalance: user.credits || 0
        },
        activities,
        pagination: {
          current: Number(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (err) {
    console.error('Error in getUserCredits:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user credit information',
      error: err.message
    });
  }
};

// @desc    Bulk credit adjustment
// @route   POST /api/admin/credits/bulk-adjust
// @access  Private (Admin only)
const bulkAdjustCredits = async (req, res) => {
  try {
    const { adjustments, reason } = req.body;
    
    // Validation
    if (!Array.isArray(adjustments) || adjustments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'adjustments array is required and cannot be empty'
      });
    }
    
    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'reason is required for bulk adjustments'
      });
    }
    
    const results = {
      successful: [],
      failed: []
    };
    
    // Process each adjustment
    for (const adjustment of adjustments) {
      try {
        const { userId, creditChange } = adjustment;
        
        if (!userId || typeof creditChange !== 'number') {
          results.failed.push({
            userId,
            error: 'Invalid userId or creditChange'
          });
          continue;
        }
        
        const user = await User.findById(userId);
        if (!user) {
          results.failed.push({
            userId,
            error: 'User not found'
          });
          continue;
        }
        
        if (user.role !== 'provider') {
          results.failed.push({
            userId,
            error: 'User is not a provider'
          });
          continue;
        }
        
        const previousBalance = user.credits || 0;
        const newBalance = Math.max(0, previousBalance + creditChange);
        
        user.credits = newBalance;
        await user.save();
        
        await CreditActivity.create({
          user: userId,
          creditChange,
          newBalance,
          type: 'bonus',
          description: `Bulk adjustment: ${reason}`,
          metadata: {
            adjustedBy: req.user._id,
            adjustedByName: req.user.fullName,
            bulkOperation: true
          }
        });
        
        results.successful.push({
          userId,
          userName: user.fullName,
          previousBalance,
          creditChange,
          newBalance
        });
      } catch (err) {
        results.failed.push({
          userId: adjustment.userId,
          error: err.message
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      message: 'Bulk credit adjustment completed',
      data: {
        totalProcessed: adjustments.length,
        successful: results.successful.length,
        failed: results.failed.length,
        results
      }
    });
  } catch (err) {
    console.error('Error in bulkAdjustCredits:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to perform bulk credit adjustment',
      error: err.message
    });
  }
};

// @desc    Get credit statistics
// @route   GET /api/admin/credits/statistics
// @access  Private (Admin only)
const getCreditStatistics = async (req, res) => {
  try {
    // Total credits distributed
    const totalCreditsDistributed = await CreditActivity.aggregate([
      {
        $match: {
          creditChange: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$creditChange' }
        }
      }
    ]);
    
    // Total credits used
    const totalCreditsUsed = await CreditActivity.aggregate([
      {
        $match: {
          creditChange: { $lt: 0 }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $abs: '$creditChange' } }
        }
      }
    ]);
    
    // Current total credits in circulation
    const currentCreditsInCirculation = await User.aggregate([
      {
        $match: {
          role: 'provider',
          credits: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$credits' }
        }
      }
    ]);
    
    // Credits by activity type
    const creditsByType = await CreditActivity.aggregate([
      {
        $group: {
          _id: '$type',
          totalChange: { $sum: '$creditChange' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Top users by credits
    const topUsersByCredits = await User.find({ role: 'provider' })
      .select('fullName email credits profilePhoto')
      .sort({ credits: -1 })
      .limit(10);
    
    return res.status(200).json({
      success: true,
      message: 'Credit statistics retrieved successfully',
      data: {
        totalCreditsDistributed: totalCreditsDistributed[0]?.total || 0,
        totalCreditsUsed: totalCreditsUsed[0]?.total || 0,
        currentCreditsInCirculation: currentCreditsInCirculation[0]?.total || 0,
        creditsByType,
        topUsersByCredits
      }
    });
  } catch (err) {
    console.error('Error in getCreditStatistics:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch credit statistics',
      error: err.message
    });
  }
};

module.exports = {
  getCreditSettings,
  updateCreditSettings,
  adjustUserCredits,
  getUserCredits,
  bulkAdjustCredits,
  getCreditStatistics
};
