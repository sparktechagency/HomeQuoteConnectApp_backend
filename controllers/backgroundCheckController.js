// controllers/backgroundCheckController.js
const BackgroundCheck = require('../models/BackgroundCheck');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');
const { success: successResponse, error: errorResponse } = require('../utils/response');
const Notification = require('../models/Notification');
const { createPaymentIntent, stripe } = require('../config/stripe');

// Background check fee
const BACKGROUND_CHECK_FEE = 30; // $30

/**
 * @desc    Submit background check (Provider)
 * @route   POST /api/background-check/submit
 * @access  Private (Provider only)
 */
const submitBackgroundCheck = async (req, res) => {
  try {
    // Ensure request is authenticated
    if (!req.user || !req.user.id) {
      return errorResponse(res, 'Authentication required', 401);
    }

    const providerId = req.user.id;
    console.log('[BackgroundCheck] Access attempt:', { userId: providerId });

    // Check if user is a provider
    const provider = await User.findById(providerId);
    if (!provider) {
      return errorResponse(res, 'User not found', 404);
    }
    // Enforce provider role explicitly (more specific than generic authorize message)
    if (provider.role !== 'provider') {
      return errorResponse(res, 'Only provider accounts can submit background checks', 403);
    }

    // Check for existing background check
    const existingCheck = await BackgroundCheck.findOne({ provider: providerId });

    // If already approved, don't allow resubmission
    if (existingCheck && existingCheck.status === 'approved') {
      return errorResponse(res, 'Your background check has already been approved', 400);
    }

    // If pending, don't allow resubmission
    if (existingCheck && existingCheck.status === 'pending') {
      return errorResponse(res, 'Your background check is currently under review', 400);
    }

    // ============ PAYMENT GATING - START ============
    // Check if payment has already been made for this background check
    let paymentCompleted = false;
    let existingTransaction = null;

    if (existingCheck && existingCheck.paymentStatus === 'paid') {
      paymentCompleted = true;
      console.log('[BackgroundCheck] Payment already completed for existing check');
    }

    // If payment not yet completed, require payment
    if (!paymentCompleted) {
      const { paymentIntentId } = req.body;

      if (!paymentIntentId) {
        return errorResponse(
          res, 
          'Payment required. Please provide paymentIntentId after completing payment.', 
          402 // Payment Required
        );
      }

      // Verify payment intent with Stripe
      let paymentIntent;
      try {
        paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      } catch (stripeError) {
        console.error('[BackgroundCheck] Stripe payment intent retrieval error:', stripeError);
        return errorResponse(res, 'Invalid payment intent. Please try again.', 400);
      }

      // Verify payment was successful
      if (paymentIntent.status !== 'succeeded') {
        return errorResponse(
          res, 
          `Payment not completed. Status: ${paymentIntent.status}. Please complete payment first.`, 
          402
        );
      }

      // Verify payment amount matches background check fee
      const paidAmount = paymentIntent.amount / 100; // Convert from cents to dollars
      if (paidAmount < BACKGROUND_CHECK_FEE) {
        return errorResponse(
          res, 
          `Invalid payment amount. Expected $${BACKGROUND_CHECK_FEE}, received $${paidAmount}`, 
          400
        );
      }

      // Check if this payment has already been used
      const paymentAlreadyUsed = await BackgroundCheck.findOne({ 
        stripePaymentIntentId: paymentIntentId 
      });
      
      if (paymentAlreadyUsed) {
        return errorResponse(res, 'This payment has already been used for a background check submission', 400);
      }

      // Create transaction record for this payment
      existingTransaction = await Transaction.create({
        user: providerId,
        amount: BACKGROUND_CHECK_FEE,
        platformCommission: BACKGROUND_CHECK_FEE, // Full amount goes to platform for background checks
        providerAmount: 0, // No provider payout for background check fees
        paymentMethod: 'card',
        stripePaymentIntentId: paymentIntentId,
        stripeChargeId: paymentIntent.latest_charge,
        status: 'completed',
        paidAt: new Date(),
        completedAt: new Date(),
        metadata: {
          type: 'background_check_fee',
          providerId: providerId.toString()
        }
      });

      paymentCompleted = true;
      console.log('[BackgroundCheck] Payment verified and transaction created:', existingTransaction._id);
    }
    // ============ PAYMENT GATING - END ============

    // Check if files are uploaded
    if (!req.files || !req.files.idFront || !req.files.idBack) {
      return errorResponse(res, 'Please upload all required documents: ID Front and ID Back', 400);
    }

    // Validate file types
    const idFront = req.files.idFront[0];
    const idBack = req.files.idBack[0];

    // ID documents must be images
    if (!idFront.mimetype.startsWith('image/') || !idBack.mimetype.startsWith('image/')) {
      return errorResponse(res, 'ID documents must be images (JPG, PNG)', 400);
    }

    // Consent form is optional
    let consentForm = null;
    if (req.files.consentForm && req.files.consentForm[0]) {
      consentForm = req.files.consentForm[0];
      // Consent form can be image or PDF
      if (!consentForm.mimetype.startsWith('image/') && consentForm.mimetype !== 'application/pdf') {
        return errorResponse(res, 'Consent form must be an image or PDF', 400);
      }
    }

    // Upload files to Cloudinary
    const uploadPromises = [
      uploadToCloudinary(idFront.buffer, 'raza-home-quote/background-checks/id-front'),
      uploadToCloudinary(idBack.buffer, 'raza-home-quote/background-checks/id-back')
    ];

    // Add consent form upload if provided
    if (consentForm) {
      uploadPromises.push(
        uploadToCloudinary(consentForm.buffer, 'raza-home-quote/background-checks/consent-forms')
      );
    }

    const uploadResults = await Promise.all(uploadPromises);
    const idFrontResult = uploadResults[0];
    const idBackResult = uploadResults[1];
    const consentFormResult = consentForm ? uploadResults[2] : null;

    // If resubmitting after rejection, delete old files
    if (existingCheck && existingCheck.status === 'rejected') {
      try {
        const deletePromises = [
          existingCheck.idFront?.public_id && deleteFromCloudinary(existingCheck.idFront.public_id),
          existingCheck.idBack?.public_id && deleteFromCloudinary(existingCheck.idBack.public_id)
        ];

        // Add consent form deletion if it exists
        if (existingCheck.consentForm?.public_id) {
          deletePromises.push(deleteFromCloudinary(existingCheck.consentForm.public_id));
        }

        await Promise.all(deletePromises.filter(Boolean));
      } catch (error) {
        console.error('Error deleting old files:', error);
        // Continue even if deletion fails
      }
    }

    // Create or update background check
    const backgroundCheckData = {
      provider: providerId,
      idFront: {
        public_id: idFrontResult.public_id,
        url: idFrontResult.secure_url,
        uploadedAt: new Date()
      },
      idBack: {
        public_id: idBackResult.public_id,
        url: idBackResult.secure_url,
        uploadedAt: new Date()
      },
      status: 'pending',
      submittedAt: new Date(),
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: null,
      rejectionReason: null,
      // Payment information
      paymentStatus: 'paid',
      paymentAmount: BACKGROUND_CHECK_FEE,
      paidAt: new Date(),
      stripePaymentIntentId: req.body.paymentIntentId,
      transaction: existingTransaction ? existingTransaction._id : null
    };

    // Add consent form if provided
    if (consentFormResult) {
      backgroundCheckData.consentForm = {
        public_id: consentFormResult.public_id,
        url: consentFormResult.secure_url,
        uploadedAt: new Date()
      };
    }

    let backgroundCheck;
    if (existingCheck) {
      // Update existing record (resubmission)
      backgroundCheckData.resubmittedAt = new Date();
      backgroundCheck = await BackgroundCheck.findByIdAndUpdate(
        existingCheck._id,
        backgroundCheckData,
        { new: true }
      ).populate('provider', 'name email phone photo');
    } else {
      // Create new record
      backgroundCheck = await BackgroundCheck.create(backgroundCheckData);
      backgroundCheck = await BackgroundCheck.findById(backgroundCheck._id).populate('provider', 'name email phone photo');
    }

    // Notify admins about new submission
    try {
      const admins = await User.find({ role: 'admin' });
      const io = req.app.get('io');
      
      for (const admin of admins) {
        const providerDisplayName = provider.fullName || provider.name || provider.email;
        // Create notification (use existing enum type)
        const notification = await Notification.create({
          user: admin._id,
          title: 'Background Check Submission',
          message: `${providerDisplayName} has submitted a background check for review`,
          type: 'user_verification_request',
          data: {
            backgroundCheckId: backgroundCheck._id,
            providerId: providerId,
            providerName: providerDisplayName
          },
          priority: 'high'
        });

        // Send real-time notification to the expected room name
        if (io) {
          io.to(`notifications_${admin._id}`).emit('new-notification', {
            ...notification.toObject(),
            createdAt: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error('Error sending admin notifications:', error);
      // Continue even if notifications fail
    }

    return successResponse(
      res,
      backgroundCheck,
      existingCheck ? 'Background check resubmitted successfully. Our team will review it shortly.' : 'Background check submitted successfully. Our team will review it shortly.',
      201
    );
  } catch (error) {
    console.error('Error submitting background check:', error);
    return errorResponse(res, error.message || 'Error submitting background check');
  }
};

/**
 * @desc    Get my background check status (Provider)
 * @route   GET /api/background-check/status
 * @access  Private (Provider only)
 */
const getMyBackgroundCheckStatus = async (req, res) => {
  try {
    const providerId = req.user.id;

    const backgroundCheck = await BackgroundCheck.findOne({ provider: providerId })
      .populate('provider', 'name email phone photo')
      .populate('reviewedBy', 'name email')
      .populate('transaction')
      .lean();

    if (!backgroundCheck) {
      return successResponse(res, null, 'No background check found. Please submit your documents.');
    }

    return successResponse(res, backgroundCheck, 'Background check status retrieved successfully');
  } catch (error) {
    console.error('Error getting background check status:', error);
    return errorResponse(res, error.message || 'Error retrieving background check status');
  }
};

/**
 * @desc    Create payment intent for background check
 * @route   POST /api/background-check/create-payment-intent
 * @access  Private (Provider only)
 */
const createBackgroundCheckPaymentIntent = async (req, res) => {
  try {
    // Ensure request is authenticated
    if (!req.user || !req.user.id) {
      return errorResponse(res, 'Authentication required', 401);
    }

    const providerId = req.user.id;

    // Check if user is a provider
    const provider = await User.findById(providerId);
    if (!provider) {
      return errorResponse(res, 'User not found', 404);
    }

    if (provider.role !== 'provider') {
      return errorResponse(res, 'Only provider accounts can request background check payments', 403);
    }

    // Check for existing background check
    const existingCheck = await BackgroundCheck.findOne({ provider: providerId });

    // If already approved, don't allow payment
    if (existingCheck && existingCheck.status === 'approved') {
      return errorResponse(res, 'Your background check has already been approved', 400);
    }

    // If pending, don't allow new payment
    if (existingCheck && existingCheck.status === 'pending') {
      return errorResponse(res, 'Your background check is currently under review', 400);
    }

    // Check if payment already completed
    if (existingCheck && existingCheck.paymentStatus === 'paid') {
      return errorResponse(res, 'Payment has already been completed for your background check', 400);
    }

    // Create Stripe payment intent
    const paymentIntent = await createPaymentIntent(
      BACKGROUND_CHECK_FEE, 
      'usd', 
      {
        providerId: providerId.toString(),
        type: 'background_check_fee',
        providerName: provider.fullName || provider.name || provider.email
      }
    );

    return successResponse(
      res,
      {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: BACKGROUND_CHECK_FEE,
        currency: 'usd'
      },
      'Payment intent created successfully. Complete payment to submit background check.',
      200
    );

  } catch (error) {
    console.error('Error creating background check payment intent:', error);
    return errorResponse(res, error.message || 'Error creating payment intent');
  }
};

module.exports = {
  submitBackgroundCheck,
  getMyBackgroundCheckStatus,
  createBackgroundCheckPaymentIntent
};
