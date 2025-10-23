// controllers/authController.js
const OTP = require('../models/OTP');
const User = require('../models/User');
const { generateToken } = require('../utils/generateToken');
const { sendOTPEmail } = require('../utils/emailService');
const { uploadToCloudinary } = require('../utils/cloudinary');

// @desc    Send OTP for registration
// @route   POST /api/auth/send-otp
// @access  Public
const sendOTP = async (req, res) => {
  try {
    const { email, purpose = 'signup' } = req.body;

    // Check if user already exists for signup
    if (purpose === 'signup') {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with this email'
        });
      }
    }

    // Generate and save OTP
    const otpRecord = await OTP.generateOTP(email, purpose);
    
    // Send OTP via email
    const emailSent = await sendOTPEmail(email, otpRecord.otp, 'User');
    
    if (!emailSent) {
      await OTP.findByIdAndDelete(otpRecord._id);
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email'
      });
    }

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      data: {
        email,
        purpose,
        expiresAt: otpRecord.expiresAt
      }
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending OTP',
      error: error.message
    });
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTP = async (req, res) => {
  try {
    const { email, otp, purpose } = req.body;

    // Find the latest OTP for this email and purpose
    const otpRecord = await OTP.findOne({
      email,
      purpose,
      isUsed: false
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Verify OTP
    await otpRecord.verifyOTP(otp);

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      data: {
        email,
        purpose,
        verified: true
      }
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Register user (Client or Provider)
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      confirmPassword,
      role = 'client',
      location,
      phoneNumber,
      dateOfBirth,
      // Provider specific fields
      businessName,
      bio,
      experienceLevel,
      specializations,
      serviceAreas,
      workingHours
    } = req.body;

    // Validation
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Parse location if provided
    let locationData = {};
    if (location) {
      if (typeof location === 'string') {
        locationData = JSON.parse(location);
      } else {
        locationData = location;
      }
    }

    // Create user
    const userData = {
      fullName,
      email,
      password,
      role,
      phoneNumber,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      location: locationData
    };

    // Add provider-specific fields
    if (role === 'provider') {
      userData.businessName = businessName;
      userData.bio = bio;
      userData.experienceLevel = experienceLevel;
      userData.specializations = specializations;
      userData.serviceAreas = serviceAreas;
      userData.workingHours = workingHours;
      
      // Give free 25 credits to new providers
      userData.credits = 25;
    }

    const user = await User.create(userData);

    // Generate token
    const token = generateToken(user._id);

    // Prepare response data
    const userResponse = {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      profilePhoto: user.profilePhoto,
      isVerified: user.isVerified,
      phoneNumber: user.phoneNumber,
      location: user.location,
      notificationSettings: user.notificationSettings,
      profileCompletion: user.profileCompletion
    };

    // Add provider-specific response fields
    if (role === 'provider') {
      userResponse.businessName = user.businessName;
      userResponse.bio = user.bio;
      userResponse.experienceLevel = user.experienceLevel;
      userResponse.specializations = user.specializations;
      userResponse.serviceAreas = user.serviceAreas;
      userResponse.workingHours = user.workingHours;
      userResponse.credits = user.credits;
      userResponse.verificationStatus = user.verificationStatus;
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: userResponse,
        token
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: error.message
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password, rememberMe = false } = req.body;

    // Check if user exists and include password for comparison
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (user.isBlocked) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been blocked. Please contact support.'
      });
    }

    // Update last active and online status
    user.lastActive = new Date();
    user.isOnline = true;
    await user.save();

    // Generate token with longer expiry if remember me is true
    const token = generateToken(user._id);

    // Prepare response data
    const userResponse = {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      profilePhoto: user.profilePhoto,
      isVerified: user.isVerified,
      phoneNumber: user.phoneNumber,
      location: user.location,
      notificationSettings: user.notificationSettings,
      profileCompletion: user.profileCompletion,
      isOnline: user.isOnline,
      lastActive: user.lastActive
    };

    // Add role-specific fields
    if (user.role === 'provider') {
      userResponse.businessName = user.businessName;
      userResponse.bio = user.bio;
      userResponse.experienceLevel = user.experienceLevel;
      userResponse.specializations = user.specializations;
      userResponse.serviceAreas = user.serviceAreas;
      userResponse.workingHours = user.workingHours;
      userResponse.credits = user.credits;
      userResponse.verificationStatus = user.verificationStatus;
      userResponse.totalCompletedJobs = user.totalCompletedJobs;
      userResponse.averageRating = user.averageRating;
    }

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message
    });
  }
};

// @desc    Forgot password - Send OTP
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user found with this email'
      });
    }

    // Generate and send OTP
    const otpRecord = await OTP.generateOTP(email, 'forgot-password');
    const emailSent = await sendOTPEmail(email, otpRecord.otp, user.fullName);

    if (!emailSent) {
      await OTP.findByIdAndDelete(otpRecord._id);
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email'
      });
    }

    res.status(200).json({
      success: true,
      message: 'OTP sent to your email for password reset',
      data: {
        email,
        expiresAt: otpRecord.expiresAt
      }
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing forgot password request',
      error: error.message
    });
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    // Find and verify OTP
    const otpRecord = await OTP.findOne({
      email,
      purpose: 'forgot-password',
      isUsed: false
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    await otpRecord.verifyOTP(otp);

    // Update user password
    const user = await User.findOne({ email });
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  try {
    // Update user online status
    await User.findByIdAndUpdate(req.user._id, {
      isOnline: false,
      lastActive: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during logout',
      error: error.message
    });
  }
};

module.exports = {
  sendOTP,
  verifyOTP,
  register,
  login,
  forgotPassword,
  resetPassword,
  logout
};