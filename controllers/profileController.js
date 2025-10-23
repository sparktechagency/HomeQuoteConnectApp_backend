// controllers/profileController.js
const User = require('../models/User');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');
const { generateToken } = require('../utils/generateToken');

// @desc    Get user profile
// @route   GET /api/profile/me
// @access  Private
const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('specializations', 'name category')
      .select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: error.message
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/profile/update
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const {
      fullName,
      phoneNumber,
      dateOfBirth,
      location,
      bio,
      businessName,
      experienceLevel,
      specializations,
      serviceAreas,
      workingHours
    } = req.body;

    const updateData = {
      fullName,
      phoneNumber,
      bio,
      businessName,
      experienceLevel,
      specializations,
      serviceAreas,
      workingHours
    };

    // Parse date if provided
    if (dateOfBirth) {
      updateData.dateOfBirth = new Date(dateOfBirth);
    }

    // Parse location if provided
    if (location) {
      if (typeof location === 'string') {
        updateData.location = JSON.parse(location);
      } else {
        updateData.location = location;
      }
    }

    // Remove undefined fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
};

// @desc    Upload or update profile photo
// @route   PUT /api/profile/photo
// @access  Private
const updateProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a photo'
      });
    }

    // Check file type
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image file'
      });
    }

    const user = await User.findById(req.user._id);

    // Delete old photo from Cloudinary if exists
    if (user.profilePhoto && user.profilePhoto.public_id) {
      await deleteFromCloudinary(user.profilePhoto.public_id);
    }

    // Upload new photo to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer, 'raza-home-quote/profile-photos');

    // Update user profile photo
    user.profilePhoto = {
      public_id: result.public_id,
      url: result.secure_url
    };

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile photo updated successfully',
      data: {
        profilePhoto: user.profilePhoto
      }
    });

  } catch (error) {
    console.error('Update profile photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile photo',
      error: error.message
    });
  }
};

// @desc    Upload verification documents (for providers)
// @route   POST /api/profile/verification-documents
// @access  Private
const uploadVerificationDocuments = async (req, res) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({
        success: false,
        message: 'Only providers can upload verification documents'
      });
    }

    const { files } = req;

    if (!files || (!files.businessLicense && !files.certificate)) {
      return res.status(400).json({
        success: false,
        message: 'Please upload at least one document'
      });
    }

    const user = await User.findById(req.user._id);
    const updates = {};

    // Upload business license if provided
    if (files.businessLicense) {
      const licenseFile = files.businessLicense[0];
      
      // Delete old license if exists
      if (user.verificationDocuments.businessLicense.public_id) {
        await deleteFromCloudinary(user.verificationDocuments.businessLicense.public_id);
      }

      const result = await uploadToCloudinary(
        licenseFile.buffer, 
        'raza-home-quote/verification-documents'
      );

      updates['verificationDocuments.businessLicense'] = {
        public_id: result.public_id,
        url: result.secure_url,
        uploadedAt: new Date(),
        status: 'pending'
      };
    }

    // Upload certificate if provided
    if (files.certificate) {
      const certificateFile = files.certificate[0];
      
      // Delete old certificate if exists
      if (user.verificationDocuments.certificate.public_id) {
        await deleteFromCloudinary(user.verificationDocuments.certificate.public_id);
      }

      const result = await uploadToCloudinary(
        certificateFile.buffer,
        'raza-home-quote/verification-documents'
      );

      updates['verificationDocuments.certificate'] = {
        public_id: result.public_id,
        url: result.secure_url,
        uploadedAt: new Date(),
        status: 'pending'
      };
    }

    // Update verification status to pending
    updates.verificationStatus = 'pending';

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'Verification documents uploaded successfully',
      data: {
        verificationDocuments: updatedUser.verificationDocuments,
        verificationStatus: updatedUser.verificationStatus
      }
    });

  } catch (error) {
    console.error('Upload verification documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading verification documents',
      error: error.message
    });
  }
};

// @desc    Update notification settings
// @route   PUT /api/profile/notification-settings
// @access  Private
const updateNotificationSettings = async (req, res) => {
  try {
    const { general, sound, vibrate, newService, payment } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        notificationSettings: {
          general: general !== undefined ? general : req.user.notificationSettings.general,
          sound: sound !== undefined ? sound : req.user.notificationSettings.sound,
          vibrate: vibrate !== undefined ? vibrate : req.user.notificationSettings.vibrate,
          newService: newService !== undefined ? newService : req.user.notificationSettings.newService,
          payment: payment !== undefined ? payment : req.user.notificationSettings.payment
        }
      },
      { new: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'Notification settings updated successfully',
      data: {
        notificationSettings: user.notificationSettings
      }
    });

  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating notification settings',
      error: error.message
    });
  }
};

// @desc    Change password
// @route   PUT /api/profile/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate new passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New passwords do not match'
      });
    }

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');

    // Check current password
    const isCurrentPasswordValid = await user.matchPassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Generate new token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
      data: { token }
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password',
      error: error.message
    });
  }
};

// @desc    Delete user account
// @route   DELETE /api/profile/delete-account
// @access  Private
const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');

    // Verify password
    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Password is incorrect'
      });
    }

    // Delete profile photo from Cloudinary if exists
    if (user.profilePhoto && user.profilePhoto.public_id) {
      await deleteFromCloudinary(user.profilePhoto.public_id);
    }

    // Delete verification documents from Cloudinary if exist
    if (user.verificationDocuments.businessLicense.public_id) {
      await deleteFromCloudinary(user.verificationDocuments.businessLicense.public_id);
    }
    if (user.verificationDocuments.certificate.public_id) {
      await deleteFromCloudinary(user.verificationDocuments.certificate.public_id);
    }

    // Delete user from database
    await User.findByIdAndDelete(req.user._id);

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully'
    });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting account',
      error: error.message
    });
  }
};

// @desc    Update online status
// @route   PUT /api/profile/online-status
// @access  Private
const updateOnlineStatus = async (req, res) => {
  try {
    const { isOnline } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        isOnline: isOnline !== undefined ? isOnline : req.user.isOnline,
        lastActive: new Date()
      },
      { new: true }
    ).select('-password');

    // Emit socket event for real-time status update
    if (req.app.get('io')) {
      req.app.get('io').emit('user-status-changed', {
        userId: user._id,
        isOnline: user.isOnline,
        lastActive: user.lastActive
      });
    }

    res.status(200).json({
      success: true,
      message: 'Online status updated successfully',
      data: {
        isOnline: user.isOnline,
        lastActive: user.lastActive
      }
    });

  } catch (error) {
    console.error('Update online status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating online status',
      error: error.message
    });
  }
};

module.exports = {
  getMyProfile,
  updateProfile,
  updateProfilePhoto,
  uploadVerificationDocuments,
  updateNotificationSettings,
  changePassword,
  deleteAccount,
  updateOnlineStatus
};