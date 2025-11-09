// controllers/contentController.js
const Content = require('../models/Content');
const { sendAdminNotification } = require('./adminNotificationController');

// @desc    Get all content
// @route   GET /api/admin/content
// @access  Private (Admin only)
const getContent = async (req, res) => {
  try {
    const content = await Content.find({ isActive: true })
      .populate('lastUpdatedBy', 'fullName profilePhoto')
      .sort({ type: 1 });

    res.status(200).json({
      success: true,
      data: { content }
    });

  } catch (error) {
    console.error('Get content error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching content',
      error: error.message
    });
  }
};

// @desc    Get content by type
// @route   GET /api/admin/content/:type
// @access  Public (for frontend display)
const getContentByType = async (req, res) => {
  try {
    const { type } = req.params;

    const content = await Content.findOne({ 
      type: type,
      isActive: true 
    }).populate('lastUpdatedBy', 'fullName');

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { content }
    });

  } catch (error) {
    console.error('Get content by type error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching content',
      error: error.message
    });
  }
};

// @desc    Create or update content
// @route   PUT /api/admin/content/:type
// @access  Private (Admin only)
const updateContent = async (req, res) => {
  try {
    const { type } = req.params;
    const { title, content, metaTitle, metaDescription, keywords } = req.body;

    // Validate content type
    const validTypes = ['about_us', 'privacy_policy', 'terms_conditions', 'faq', 'contact_info'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid content type'
      });
    }

    let contentDoc = await Content.findOne({ type });

    if (contentDoc) {
      // Update existing content
      contentDoc.title = title;
      contentDoc.content = content;
      contentDoc.metaTitle = metaTitle;
      contentDoc.metaDescription = metaDescription;
      contentDoc.keywords = keywords;
      contentDoc.lastUpdatedBy = req.user._id;
    } else {
      // Create new content
      contentDoc = new Content({
        type,
        title,
        content,
        metaTitle,
        metaDescription,
        keywords,
        lastUpdatedBy: req.user._id
      });
    }

    await contentDoc.save();

    const populatedContent = await Content.findById(contentDoc._id)
      .populate('lastUpdatedBy', 'fullName profilePhoto');

    // Send notification to other admins about content update
    if (req.app.get('io')) {
      await sendAdminNotification(req.app.get('io'), {
        type: 'content_updated',
        title: 'Content Updated',
        message: `${req.user.fullName} updated ${type.replace('_', ' ')}`,
        data: {
          contentType: type,
          updatedBy: req.user._id,
          version: contentDoc.version
        },
        category: 'system'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Content updated successfully',
      data: { content: populatedContent }
    });

  } catch (error) {
    console.error('Update content error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating content',
      error: error.message
    });
  }
};

// @desc    Get content history
// @route   GET /api/admin/content/:type/history
// @access  Private (Admin only)
const getContentHistory = async (req, res) => {
  try {
    const { type } = req.params;

    // In a real system, you might want to keep version history
    // For now, we'll return the current content with version info
    const content = await Content.findOne({ type })
      .populate('lastUpdatedBy', 'fullName profilePhoto');

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        current: content,
        // In a real implementation, you might return previous versions here
        history: []
      }
    });

  } catch (error) {
    console.error('Get content history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching content history',
      error: error.message
    });
  }
};

module.exports = {
  getContent,
  getContentByType,
  updateContent,
  getContentHistory
};