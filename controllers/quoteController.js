// controllers/quoteController.js
const Quote = require('../models/Quote');
const Job = require('../models/Job');
const User = require('../models/User');
const { sendNotificationToUser } = require('../socket/socketHandler');

// @desc    Submit a quote for a job
// @route   POST /api/quotes
// @access  Private (Providers only)
const submitQuote = async (req, res) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({
        success: false,
        message: 'Only providers can submit quotes'
      });
    }

    const {
      jobId,
      price,
      description,
      isAvailable,
      proposedDate,
      proposedTime,
      warranty,
      guarantee
    } = req.body;

    // Check if provider has enough credits
    if (req.user.credits < 1) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient credits. Please purchase more credits to submit quotes.'
      });
    }

    // Check if job exists and is active
    const job = await Job.findOne({
      _id: jobId,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found or no longer accepting quotes'
      });
    }

    // Check if provider has already quoted on this job
    const existingQuote = await Quote.findOne({
      job: jobId,
      provider: req.user._id,
      status: { $in: ['pending', 'updated'] }
    });

    if (existingQuote) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted a quote for this job'
      });
    }

    // Parse warranty and guarantee data
    let warrantyData = {};
    let guaranteeData = {};

    if (warranty) {
      warrantyData = typeof warranty === 'string' ? JSON.parse(warranty) : warranty;
    }

    if (guarantee) {
      guaranteeData = typeof guarantee === 'string' ? JSON.parse(guarantee) : guarantee;
    }

    // Create quote
    const quote = await Quote.create({
      job: jobId,
      provider: req.user._id,
      price: parseFloat(price),
      description,
      isAvailable,
      proposedDate: proposedDate ? new Date(proposedDate) : undefined,
      proposedTime,
      warranty: warrantyData,
      guarantee: guaranteeData
    });

    // Deduct credit from provider
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { credits: -1 }
    });

    // Populate the quote with provider and job details
    const populatedQuote = await Quote.findById(quote._id)
      .populate('provider', 'fullName profilePhoto businessName averageRating totalReviews experienceLevel specializations')
      .populate('job', 'title client serviceCategory');

    // Notify client about new quote
    if (req.app.get('io')) {
      sendNotificationToUser(req.app.get('io'), job.client, {
        type: 'new_quote',
        title: 'New Quote Received',
        message: `You have received a new quote for "${job.title}"`,
        jobId: job._id,
        quoteId: quote._id,
        providerName: req.user.fullName
      });
    }

    // Add credit usage to recent activity (we'll implement this later)
    await addCreditActivity(req.user._id, -1, `Quote submitted for job: ${job.title}`, job._id);

    res.status(201).json({
      success: true,
      message: 'Quote submitted successfully',
      data: { quote: populatedQuote }
    });

  } catch (error) {
    console.error('Submit quote error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting quote',
      error: error.message
    });
  }
};

// @desc    Update a quote
// @route   PUT /api/quotes/:id
// @access  Private (Provider only)
const updateQuote = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      price,
      description,
      isAvailable,
      proposedDate,
      proposedTime,
      warranty,
      guarantee,
      updateReason
    } = req.body;

    // Find the quote
    const quote = await Quote.findOne({
      _id: id,
      provider: req.user._id
    }).populate('job');

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found or you are not authorized to update it'
      });
    }

    if (quote.status !== 'pending' && quote.status !== 'updated') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update quote that has been accepted or declined'
      });
    }

    // Create updated quote
    const updateData = {
      price: price ? parseFloat(price) : quote.price,
      description: description || quote.description,
      isAvailable: isAvailable !== undefined ? isAvailable : quote.isAvailable,
      proposedDate: proposedDate ? new Date(proposedDate) : quote.proposedDate,
      proposedTime: proposedTime || quote.proposedTime,
      warranty: warranty ? (typeof warranty === 'string' ? JSON.parse(warranty) : warranty) : quote.warranty,
      guarantee: guarantee ? (typeof guarantee === 'string' ? JSON.parse(guarantee) : guarantee) : quote.guarantee,
      updateReason
    };

    const updatedQuote = await quote.createUpdatedQuote(updateData);

    // Populate the updated quote
    const populatedQuote = await Quote.findById(updatedQuote._id)
      .populate('provider', 'fullName profilePhoto businessName averageRating totalReviews experienceLevel')
      .populate('job', 'title client serviceCategory');

    // Notify client about updated quote
    if (req.app.get('io')) {
      sendNotificationToUser(req.app.get('io'), quote.job.client, {
        type: 'quote_updated',
        title: 'Quote Updated',
        message: `Your quote for "${quote.job.title}" has been updated`,
        jobId: quote.job._id,
        quoteId: updatedQuote._id,
        providerName: req.user.fullName
      });
    }

    res.status(200).json({
      success: true,
      message: 'Quote updated successfully',
      data: { quote: populatedQuote }
    });

  } catch (error) {
    console.error('Update quote error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating quote',
      error: error.message
    });
  }
};

// @desc    Accept a quote (Client only)
// @route   PUT /api/quotes/:id/accept
// @access  Private (Client only)
const acceptQuote = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the quote and populate job details
    const quote = await Quote.findById(id)
      .populate('job')
      .populate('provider');

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    // Check if client owns the job
    if (quote.job.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to accept quotes for this job'
      });
    }

    if (quote.status !== 'pending' && quote.status !== 'updated') {
      return res.status(400).json({
        success: false,
        message: 'Quote cannot be accepted in its current status'
      });
    }

    // Check if job already has an accepted quote
    if (quote.job.acceptedQuote) {
      return res.status(400).json({
        success: false,
        message: 'This job already has an accepted quote'
      });
    }

    // Update quote status
    quote.status = 'accepted';
    await quote.save();

    // Update job status and set accepted quote
    const job = await Job.findByIdAndUpdate(
      quote.job._id,
      {
        status: 'in_progress',
        acceptedQuote: quote._id
      },
      { new: true }
    );

    // Decline all other quotes for this job
    await Quote.updateMany(
      {
        job: quote.job._id,
        _id: { $ne: quote._id },
        status: { $in: ['pending', 'updated'] }
      },
      { status: 'declined' }
    );

    // Notify provider about accepted quote
    if (req.app.get('io')) {
      sendNotificationToUser(req.app.get('io'), quote.provider._id, {
        type: 'quote_accepted',
        title: 'Quote Accepted!',
        message: `Your quote for "${quote.job.title}" has been accepted`,
        jobId: quote.job._id,
        quoteId: quote._id,
        clientName: req.user.fullName
      });

      // Notify other providers about declined quotes
      const declinedQuotes = await Quote.find({
        job: quote.job._id,
        _id: { $ne: quote._id },
        status: 'declined'
      }).populate('provider');

      declinedQuotes.forEach(declinedQuote => {
        sendNotificationToUser(req.app.get('io'), declinedQuote.provider._id, {
          type: 'quote_declined',
          title: 'Quote Not Selected',
          message: `Your quote for "${quote.job.title}" was not selected`,
          jobId: quote.job._id
        });
      });
    }

    res.status(200).json({
      success: true,
      message: 'Quote accepted successfully',
      data: { 
        quote,
        job 
      }
    });

  } catch (error) {
    console.error('Accept quote error:', error);
    res.status(500).json({
      success: false,
      message: 'Error accepting quote',
      error: error.message
    });
  }
};

// @desc    Decline a quote (Client only)
// @route   PUT /api/quotes/:id/decline
// @access  Private (Client only)
const declineQuote = async (req, res) => {
  try {
    const { id } = req.params;

    const quote = await Quote.findById(id).populate('job');

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    // Check if client owns the job
    if (quote.job.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to decline quotes for this job'
      });
    }

    if (quote.status !== 'pending' && quote.status !== 'updated') {
      return res.status(400).json({
        success: false,
        message: 'Quote cannot be declined in its current status'
      });
    }

    // Update quote status
    quote.status = 'declined';
    await quote.save();

    // Notify provider about declined quote
    if (req.app.get('io')) {
      sendNotificationToUser(req.app.get('io'), quote.provider, {
        type: 'quote_declined',
        title: 'Quote Declined',
        message: `Your quote for "${quote.job.title}" has been declined`,
        jobId: quote.job._id,
        quoteId: quote._id
      });
    }

    res.status(200).json({
      success: true,
      message: 'Quote declined successfully',
      data: { quote }
    });

  } catch (error) {
    console.error('Decline quote error:', error);
    res.status(500).json({
      success: false,
      message: 'Error declining quote',
      error: error.message
    });
  }
};

// @desc    Cancel a quote (Provider only)
// @route   PUT /api/quotes/:id/cancel
// @access  Private (Provider only)
const cancelQuote = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancellationReason } = req.body;

    const quote = await Quote.findOne({
      _id: id,
      provider: req.user._id
    }).populate('job');

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found or you are not authorized to cancel it'
      });
    }

    if (quote.status !== 'pending' && quote.status !== 'updated') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel quote that has been accepted or declined'
      });
    }

    // Update quote status
    quote.status = 'cancelled';
    if (cancellationReason) {
      quote.updateReason = cancellationReason;
    }
    await quote.save();

    // Notify client about cancelled quote
    if (req.app.get('io')) {
      sendNotificationToUser(req.app.get('io'), quote.job.client, {
        type: 'quote_cancelled',
        title: 'Quote Cancelled',
        message: `Quote for "${quote.job.title}" has been cancelled by the provider`,
        jobId: quote.job._id,
        quoteId: quote._id,
        reason: cancellationReason
      });
    }

    res.status(200).json({
      success: true,
      message: 'Quote cancelled successfully',
      data: { quote }
    });

  } catch (error) {
    console.error('Cancel quote error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling quote',
      error: error.message
    });
  }
};

// @desc    Get provider's quotes
// @route   GET /api/quotes/my-quotes
// @access  Private (Provider only)
const getMyQuotes = async (req, res) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({
        success: false,
        message: 'Only providers can access their quotes'
      });
    }

    const { status, page = 1, limit = 10 } = req.query;

    const filter = { provider: req.user._id };
    if (status) filter.status = status;

    const quotes = await Quote.find(filter)
      .populate({
        path: 'job',
        populate: [
          { path: 'client', select: 'fullName profilePhoto email phoneNumber averageRating' },
          { path: 'serviceCategory', select: 'title image' },
          { path: 'specializations', select: 'title' }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Quote.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        quotes,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get my quotes error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching your quotes',
      error: error.message
    });
  }
};

// @desc    Get quotes for a specific job
// @route   GET /api/quotes/job/:jobId
// @access  Private (Client only - job owner)
const getQuotesByJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    // Verify client owns the job
    const job = await Job.findOne({
      _id: jobId,
      client: req.user._id
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found or you are not authorized to view its quotes'
      });
    }

    const quotes = await Quote.find({ job: jobId })
      .populate('provider', 'fullName profilePhoto businessName averageRating totalReviews experienceLevel specializations verificationStatus')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: { quotes }
    });

  } catch (error) {
    console.error('Get quotes by job error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching quotes for this job',
      error: error.message
    });
  }
};

// Helper function to add credit activity (to be implemented in User model)
const addCreditActivity = async (userId, creditChange, description, jobId = null) => {
  // This will be implemented when we create the CreditActivity model
  console.log(`Credit activity: User ${userId}, Change: ${creditChange}, Desc: ${description}, Job: ${jobId}`);
};

module.exports = {
  submitQuote,
  updateQuote,
  acceptQuote,
  declineQuote,
  cancelQuote,
  getMyQuotes,
  getQuotesByJob
};