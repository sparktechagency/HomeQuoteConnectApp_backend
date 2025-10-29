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

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // 🔍 Check user existence
    const existingUser = await User.findOne({ email });

    if (purpose === 'signup') {
      if (existingUser) {
        if (existingUser.isVerified) {
          // ✅ Already verified — do not send OTP
          return res.status(400).json({
            success: false,
            message: 'User already verified. Please log in instead.'
          });
        } else {
          // 🔁 User exists but not verified — resend OTP for verification
          const otpRecord = await OTP.generateOTP(email, 'signup');

          // Send OTP email
          const emailSent = await sendOTPEmail(email, otpRecord.otp, 'User');
          if (!emailSent) {
            await OTP.findByIdAndDelete(otpRecord._id);
            return res.status(500).json({
              success: false,
              message: 'Failed to send verification OTP email'
            });
          }

          return res.status(200).json({
            success: true,
            message: 'Verification OTP re-sent successfully',
            data: {
              email,
              purpose: 'signup',
              expiresAt: otpRecord.expiresAt
            }
          });
        }
      }

      // 🆕 New user — proceed with signup OTP
      const otpRecord = await OTP.generateOTP(email, 'signup');
      const emailSent = await sendOTPEmail(email, otpRecord.otp, 'User');

      if (!emailSent) {
        await OTP.findByIdAndDelete(otpRecord._id);
        return res.status(500).json({
          success: false,
          message: 'Failed to send OTP email'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Signup OTP sent successfully',
        data: {
          email,
          purpose,
          expiresAt: otpRecord.expiresAt
        }
      });
    }

    // If purpose is NOT signup (like password reset)
    if (purpose !== 'signup') {
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: 'No user found with this email'
        });
      }

      const otpRecord = await OTP.generateOTP(email, purpose);
      const emailSent = await sendOTPEmail(email, otpRecord.otp, 'User');

      if (!emailSent) {
        await OTP.findByIdAndDelete(otpRecord._id);
        return res.status(500).json({
          success: false,
          message: 'Failed to send OTP email'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'OTP sent successfully',
        data: {
          email,
          purpose,
          expiresAt: otpRecord.expiresAt
        }
      });
    }
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

    if (!email || !otp || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP, and purpose are required'
      });
    }

    // Find the latest unused OTP
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

    // Verify OTP match and expiration
    await otpRecord.verifyOTP(otp);

    // 🔄 Mark OTP as used
    otpRecord.isUsed = true;
    await otpRecord.save();

    // Purpose-based logic
    let actionMessage = 'OTP verified successfully';

    if (purpose === 'signup' || purpose === 'verify') {
      // ✅ Mark user verified
      const user = await User.findOne({ email });
      if (user) {
        user.isVerified = true;
        await user.save();
        actionMessage = 'User verified successfully';
      } else if (purpose === 'signup') {
        // 🆕 (Optional) you can create user here if not exists yet
        // const newUser = await User.create({ email, isVerified: true });
      }
    }

    if (purpose === 'resetPassword') {
      // ⚙️ For password reset, you can return a token or set a flag
      actionMessage = 'OTP verified. You can now reset your password.';
    }

    if (purpose === 'changeEmail') {
      actionMessage = 'OTP verified. Email change confirmed.';
    }

    return res.status(200).json({
      success: true,
      message: actionMessage,
      data: {
        email,
        purpose,
        isVerified: true
      }
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Error verifying OTP'
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
    // if (password !== confirmPassword) {
    //   return res.status(400).json({
    //     success: false,
    //     message: 'Passwords do not match'
    //   });
    // }

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

    // If a profile photo was uploaded via multipart/form-data, upload to Cloudinary
    if (req.file && req.file.buffer) {
      try {
        const uploadResult = await uploadToCloudinary(req.file.buffer, 'profile_photos');
        userData.profilePhoto = {
          public_id: uploadResult.public_id,
          url: uploadResult.secure_url
        };
      } catch (uploadErr) {
        console.error('Profile photo upload error:', uploadErr);
        // Don't block registration for photo upload failures; continue without photo
      }
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