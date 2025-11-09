// controllers/projectGalleryController.js
const ProjectGallery = require('../models/ProjectGallery');
const Category = require('../models/Category');
const User = require('../models/User');
const { uploadMultipleImages, deleteMultipleFiles } = require('../utils/fileUtils');

// @desc    Create project gallery
// @route   POST /api/project-gallery
// @access  Private (Provider only)
const createProjectGallery = async (req, res) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({
        success: false,
        message: 'Only providers can create project galleries'
      });
    }

    const {
      title,
      description,
      serviceCategory,
      specializations,
      projectDate,
      location,
      budget,
      duration,
      clientName,
      clientRating,
      clientReview,
      isPublic = true
    } = req.body;

    // Validate service category exists
    const category = await Category.findById(serviceCategory);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Service category not found'
      });
    }

    // Parse location if provided as string
    let locationData = {};
    if (location) {
      locationData = typeof location === 'string' ? JSON.parse(location) : location;
    }

    // Parse duration if provided
    let durationData = {};
    if (duration) {
      durationData = typeof duration === 'string' ? JSON.parse(duration) : duration;
    }

    // Upload project images
    let images = [];
    if (req.files && req.files.length > 0) {
      images = await uploadMultipleImages(req.files, 'raza-home-quote/project-gallery');
      
      // Add image type and order
      images = images.map((image, index) => ({
        ...image,
        imageType: 'during', // Default type
        order: index
      }));
    }

    const project = await ProjectGallery.create({
      provider: req.user._id,
      title,
      description,
      serviceCategory,
      specializations: Array.isArray(specializations) ? specializations : JSON.parse(specializations || '[]'),
      images,
      projectDate: new Date(projectDate),
      location: locationData,
      budget: budget ? parseFloat(budget) : undefined,
      duration: durationData,
      clientName,
      clientRating: clientRating ? parseInt(clientRating) : undefined,
      clientReview,
      isPublic
    });

    const populatedProject = await ProjectGallery.findById(project._id)
      .populate('serviceCategory', 'title image')
      .populate('specializations', 'title')
      .populate('provider', 'fullName profilePhoto businessName');

    res.status(201).json({
      success: true,
      message: 'Project gallery created successfully',
      data: { project: populatedProject }
    });

  } catch (error) {
    console.error('Create project gallery error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating project gallery',
      error: error.message
    });
  }
};

// @desc    Get provider's project gallery
// @route   GET /api/project-gallery/my-projects
// @access  Private (Provider only)
const getMyProjectGallery = async (req, res) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({
        success: false,
        message: 'Only providers can access their project gallery'
      });
    }

    const { 
      page = 1, 
      limit = 12, 
      serviceCategory, 
      featured, 
      hasBeforeAfter,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = { provider: req.user._id, isActive: true };
    
    if (serviceCategory) filter.serviceCategory = serviceCategory;
    if (featured !== undefined) filter.featured = featured === 'true';
    
    // Filter for projects with before/after images
    if (hasBeforeAfter === 'true') {
      filter['images.imageType'] = { $all: ['before', 'after'] };
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const projects = await ProjectGallery.find(filter)
      .populate('serviceCategory', 'title image')
      .populate('specializations', 'title')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ProjectGallery.countDocuments(filter);

    // Get gallery statistics
    const stats = await ProjectGallery.getProviderStats(req.user._id);

    res.status(200).json({
      success: true,
      data: {
        projects,
        statistics: stats,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get my project gallery error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching project gallery',
      error: error.message
    });
  }
};

// @desc    Get public project gallery (for clients)
// @route   GET /api/project-gallery
// @access  Public
const getPublicProjectGallery = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      providerId,
      serviceCategory,
      specializations,
      hasBeforeAfter,
      featured,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = { isActive: true, isPublic: true };
    
    if (providerId) filter.provider = providerId;
    if (serviceCategory) filter.serviceCategory = serviceCategory;
    if (featured !== undefined) filter.featured = featured === 'true';
    
    if (specializations) {
      const specArray = Array.isArray(specializations) ? specializations : specializations.split(',');
      filter.specializations = { $in: specArray };
    }
    
    if (hasBeforeAfter === 'true') {
      filter['images.imageType'] = { $all: ['before', 'after'] };
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const projects = await ProjectGallery.find(filter)
      .populate('provider', 'fullName profilePhoto businessName averageRating totalReviews verificationStatus')
      .populate('serviceCategory', 'title image')
      .populate('specializations', 'title')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ProjectGallery.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        projects,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get public project gallery error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching project gallery',
      error: error.message
    });
  }
};

// @desc    Get single project details
// @route   GET /api/project-gallery/:id
// @access  Public
const getProjectDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await ProjectGallery.findById(id)
      .populate('provider', 'fullName profilePhoto businessName averageRating totalReviews verificationStatus experienceLevel')
      .populate('serviceCategory', 'title image')
      .populate('specializations', 'title');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Check if project is public or user owns it
    if (!project.isPublic && (!req.user || project.provider._id.toString() !== req.user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to private project'
      });
    }

    // Increment view count for public access
    if (project.isPublic) {
      await project.incrementViewCount();
    }

    // Get related projects
    const relatedProjects = await ProjectGallery.find({
      _id: { $ne: project._id },
      provider: project.provider._id,
      isActive: true,
      isPublic: true
    })
    .populate('serviceCategory', 'title')
    .limit(4)
    .select('title images serviceCategory viewCount likeCount');

    res.status(200).json({
      success: true,
      data: {
        project,
        relatedProjects
      }
    });

  } catch (error) {
    console.error('Get project details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching project details',
      error: error.message
    });
  }
};

// @desc    Update project gallery
// @route   PUT /api/project-gallery/:id
// @access  Private (Provider only)
const updateProjectGallery = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await ProjectGallery.findOne({
      _id: id,
      provider: req.user._id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    const {
      title,
      description,
      serviceCategory,
      specializations,
      projectDate,
      location,
      budget,
      duration,
      clientName,
      clientRating,
      clientReview,
      isPublic,
      featured,
      // Image management fields
      updatedImages, // Array of image updates
      deletedImageIndexes // Array of indexes to delete
    } = req.body;

    // Update basic fields
    if (title) project.title = title;
    if (description !== undefined) project.description = description;
    if (serviceCategory) project.serviceCategory = serviceCategory;
    if (specializations) {
      project.specializations = Array.isArray(specializations) ? specializations : JSON.parse(specializations);
    }
    if (projectDate) project.projectDate = new Date(projectDate);
    if (location) {
      project.location = typeof location === 'string' ? JSON.parse(location) : location;
    }
    if (budget !== undefined) project.budget = budget === '' ? null : parseFloat(budget);
    if (duration) {
      project.duration = typeof duration === 'string' ? JSON.parse(duration) : duration;
    }
    if (clientName !== undefined) project.clientName = clientName;
    if (clientRating !== undefined) project.clientRating = clientRating === '' ? null : parseInt(clientRating);
    if (clientReview !== undefined) project.clientReview = clientReview;
    if (isPublic !== undefined) project.isPublic = isPublic;
    if (featured !== undefined) project.featured = featured;

    // Handle image deletions
    if (deletedImageIndexes && Array.isArray(deletedImageIndexes)) {
      const indexesToDelete = deletedImageIndexes.map(idx => parseInt(idx)).sort((a, b) => b - a);
      
      for (const index of indexesToDelete) {
        if (index >= 0 && index < project.images.length) {
          const imageToDelete = project.images[index];
          
          // Delete from Cloudinary
          await deleteMultipleFiles([imageToDelete.public_id]);
          
          // Remove from array
          project.images.splice(index, 1);
        }
      }
    }

    // Handle image metadata updates
    if (updatedImages && Array.isArray(updatedImages)) {
      for (const update of updatedImages) {
        const { index, imageType, caption, isFeatured } = update;
        const imgIndex = parseInt(index);
        
        if (imgIndex >= 0 && imgIndex < project.images.length) {
          if (imageType) project.images[imgIndex].imageType = imageType;
          if (caption !== undefined) project.images[imgIndex].caption = caption;
          if (isFeatured !== undefined) {
            if (isFeatured) {
              // Set all others to not featured and this one to featured
              project.images.forEach((img, idx) => {
                img.isFeatured = idx === imgIndex;
              });
            } else {
              project.images[imgIndex].isFeatured = false;
            }
          }
        }
      }
    }

    // Reorder images after deletions
    project.images.forEach((img, idx) => {
      img.order = idx;
    });

    // Handle new image uploads
    if (req.files && req.files.length > 0) {
      const newImages = await uploadMultipleImages(req.files, 'raza-home-quote/project-gallery');
      
      const imagesToAdd = newImages.map((image, index) => ({
        ...image,
        imageType: 'during', // Default type
        caption: '',
        order: project.images.length + index,
        uploadedAt: new Date(),
        isFeatured: project.images.length === 0 && index === 0 // First image becomes featured if no images
      }));

      project.images.push(...imagesToAdd);
    }

    project.updatedAt = new Date();
    await project.save();

    const populatedProject = await ProjectGallery.findById(project._id)
      .populate('serviceCategory', 'title image')
      .populate('specializations', 'title')
      .populate('provider', 'fullName profilePhoto businessName');

    res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data: { project: populatedProject }
    });

  } catch (error) {
    console.error('Update project gallery error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating project gallery',
      error: error.message
    });
  }
};

const reorderProjectImages = async (req, res) => {
  try {
    const { id } = req.params;
    const { newOrder } = req.body; // Array of image indexes in new order

    const project = await ProjectGallery.findOne({
      _id: id,
      provider: req.user._id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    if (!Array.isArray(newOrder) || newOrder.length !== project.images.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image order array'
      });
    }

    // Create new images array based on new order
    const reorderedImages = newOrder.map((oldIndex, newIndex) => ({
      ...project.images[oldIndex].toObject(),
      order: newIndex
    }));

    project.images = reorderedImages;
    project.updatedAt = new Date();
    await project.save();

    res.status(200).json({
      success: true,
      message: 'Images reordered successfully',
      data: { images: project.images }
    });

  } catch (error) {
    console.error('Reorder project images error:', error);
    res.status(500).json({
      success: false,
      message: 'Error reordering images',
      error: error.message
    });
  }
};


const setFeaturedImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { imageIndex } = req.body;

    const project = await ProjectGallery.findOne({
      _id: id,
      provider: req.user._id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    const index = parseInt(imageIndex);
    if (index < 0 || index >= project.images.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image index'
      });
    }

    // Set all images to not featured, then set the specified one to featured
    project.images.forEach((img, idx) => {
      img.isFeatured = idx === index;
    });

    project.updatedAt = new Date();
    await project.save();

    res.status(200).json({
      success: true,
      message: 'Featured image set successfully',
      data: { featuredImage: project.images[index] }
    });

  } catch (error) {
    console.error('Set featured image error:', error);
    res.status(500).json({
      success: false,
      message: 'Error setting featured image',
      error: error.message
    });
  }
};

const deleteMultipleProjectImages = async (req, res) => {
  try {
    const { id } = req.params;
    const { imageIndexes } = req.body; // Array of indexes to delete

    const project = await ProjectGallery.findOne({
      _id: id,
      provider: req.user._id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    if (!Array.isArray(imageIndexes) || imageIndexes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide image indexes to delete'
      });
    }

    const indexesToDelete = imageIndexes.map(idx => parseInt(idx)).sort((a, b) => b - a);
    const deletedPublicIds = [];

    // Delete images from Cloudinary and remove from array
    for (const index of indexesToDelete) {
      if (index >= 0 && index < project.images.length) {
        const imageToDelete = project.images[index];
        deletedPublicIds.push(imageToDelete.public_id);
        project.images.splice(index, 1);
      }
    }

    // Delete from Cloudinary
    if (deletedPublicIds.length > 0) {
      await deleteMultipleFiles(deletedPublicIds);
    }

    // Reorder remaining images
    project.images.forEach((img, idx) => {
      img.order = idx;
    });

    // If featured image was deleted, set new featured image
    const hasFeatured = project.images.some(img => img.isFeatured);
    if (!hasFeatured && project.images.length > 0) {
      project.images[0].isFeatured = true;
    }

    project.updatedAt = new Date();
    await project.save();

    res.status(200).json({
      success: true,
      message: `${deletedPublicIds.length} images deleted successfully`,
      data: { 
        remainingImages: project.images.length,
        deletedCount: deletedPublicIds.length
      }
    });

  } catch (error) {
    console.error('Delete multiple project images error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting images',
      error: error.message
    });
  }
};

const updateProjectVisibility = async (req, res) => {
  try {
    const { id } = req.params;
    const { isPublic } = req.body;

    const project = await ProjectGallery.findOne({
      _id: id,
      provider: req.user._id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    project.isPublic = isPublic;
    project.updatedAt = new Date();
    await project.save();

    res.status(200).json({
      success: true,
      message: `Project ${isPublic ? 'published' : 'unpublished'} successfully`,
      data: { isPublic: project.isPublic }
    });

  } catch (error) {
    console.error('Update project visibility error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating project visibility',
      error: error.message
    });
  }
};


const toggleProjectFeatured = async (req, res) => {
  try {
    const { id } = req.params;
    const { featured } = req.body;

    const project = await ProjectGallery.findOne({
      _id: id,
      provider: req.user._id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    project.featured = featured;
    project.updatedAt = new Date();
    await project.save();

    res.status(200).json({
      success: true,
      message: `Project ${featured ? 'featured' : 'unfeatured'} successfully`,
      data: { featured: project.featured }
    });

  } catch (error) {
    console.error('Toggle project featured error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating project featured status',
      error: error.message
    });
  }
};


// @desc    Add images to project
// @route   POST /api/project-gallery/:id/images
// @access  Private (Provider only)
const addProjectImages = async (req, res) => {
  try {
    const { id } = req.params;
    const { imageType = 'during', captions = [] } = req.body;

    const project = await ProjectGallery.findOne({
      _id: id,
      provider: req.user._id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please upload at least one image'
      });
    }

    // Upload new images
    const newImages = await uploadMultipleImages(req.files, 'raza-home-quote/project-gallery');
    
    // Add images to project with proper metadata
    const imagesToAdd = newImages.map((image, index) => ({
      ...image,
      imageType,
      caption: Array.isArray(captions) ? (captions[index] || '') : '',
      order: project.images.length + index,
      uploadedAt: new Date()
    }));

    project.images.push(...imagesToAdd);
    await project.save();

    res.status(200).json({
      success: true,
      message: 'Images added successfully',
      data: { 
        images: imagesToAdd,
        totalImages: project.images.length
      }
    });

  } catch (error) {
    console.error('Add project images error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding images to project',
      error: error.message
    });
  }
};

// @desc    Update image metadata (type, caption, featured)
// @route   PUT /api/project-gallery/:id/images/:imageIndex
// @access  Private (Provider only)
const updateImageMetadata = async (req, res) => {
  try {
    const { id, imageIndex } = req.params;
    const { imageType, caption, isFeatured } = req.body;

    const project = await ProjectGallery.findOne({
      _id: id,
      provider: req.user._id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    const index = parseInt(imageIndex);
    if (index < 0 || index >= project.images.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image index'
      });
    }

    // Update image metadata
    if (imageType) project.images[index].imageType = imageType;
    if (caption !== undefined) project.images[index].caption = caption;
    if (isFeatured !== undefined) {
      // If setting as featured, remove featured from other images
      if (isFeatured) {
        project.images.forEach((img, idx) => {
          img.isFeatured = idx === index;
        });
      } else {
        project.images[index].isFeatured = false;
      }
    }

    await project.save();

    res.status(200).json({
      success: true,
      message: 'Image metadata updated successfully',
      data: { image: project.images[index] }
    });

  } catch (error) {
    console.error('Update image metadata error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating image metadata',
      error: error.message
    });
  }
};

// @desc    Delete project image
// @route   DELETE /api/project-gallery/:id/images/:imageIndex
// @access  Private (Provider only)
const deleteProjectImage = async (req, res) => {
  try {
    const { id, imageIndex } = req.params;

    const project = await ProjectGallery.findOne({
      _id: id,
      provider: req.user._id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    const index = parseInt(imageIndex);
    if (index < 0 || index >= project.images.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image index'
      });
    }

    const imageToDelete = project.images[index];

    // Delete from Cloudinary
    await deleteMultipleFiles([imageToDelete.public_id]);

    // Remove from array
    project.images.splice(index, 1);

    // Reorder remaining images
    project.images.forEach((img, idx) => {
      img.order = idx;
    });

    await project.save();

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
      data: { remainingImages: project.images.length }
    });

  } catch (error) {
    console.error('Delete project image error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting project image',
      error: error.message
    });
  }
};

// @desc    Delete project gallery
// @route   DELETE /api/project-gallery/:id
// @access  Private (Provider only)
const deleteProjectGallery = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await ProjectGallery.findOne({
      _id: id,
      provider: req.user._id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    // Delete all images from Cloudinary
    const publicIds = project.images.map(img => img.public_id);
    if (publicIds.length > 0) {
      await deleteMultipleFiles(publicIds);
    }

    // Soft delete by setting isActive to false
    project.isActive = false;
    await project.save();

    res.status(200).json({
      success: true,
      message: 'Project gallery deleted successfully'
    });

  } catch (error) {
    console.error('Delete project gallery error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting project gallery',
      error: error.message
    });
  }
};

// @desc    Like a project
// @route   POST /api/project-gallery/:id/like
// @access  Private
const likeProject = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await ProjectGallery.findById(id);

    if (!project || !project.isActive || !project.isPublic) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    await project.addLike();

    res.status(200).json({
      success: true,
      message: 'Project liked successfully',
      data: { likeCount: project.likeCount }
    });

  } catch (error) {
    console.error('Like project error:', error);
    res.status(500).json({
      success: false,
      message: 'Error liking project',
      error: error.message
    });
  }
};

const bulkDeleteProjects = async (req, res) => {
  try {
    const { projectIds } = req.body;

    if (!Array.isArray(projectIds) || projectIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide project IDs to delete'
      });
    }

    const projects = await ProjectGallery.find({
      _id: { $in: projectIds },
      provider: req.user._id
    });

    if (projects.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No projects found or access denied'
      });
    }

    // Collect all image public IDs for deletion
    const allPublicIds = [];
    for (const project of projects) {
      project.images.forEach(img => {
        allPublicIds.push(img.public_id);
      });
    }

    // Delete all images from Cloudinary
    if (allPublicIds.length > 0) {
      await deleteMultipleFiles(allPublicIds);
    }

    // Soft delete all projects
    await ProjectGallery.updateMany(
      { _id: { $in: projectIds }, provider: req.user._id },
      { 
        isActive: false,
        updatedAt: new Date()
      }
    );

    res.status(200).json({
      success: true,
      message: `${projects.length} projects deleted successfully`,
      data: { deletedCount: projects.length }
    });

  } catch (error) {
    console.error('Bulk delete projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting projects',
      error: error.message
    });
  }
};

module.exports = {
  createProjectGallery,
  getMyProjectGallery,
  getPublicProjectGallery,
  getProjectDetails,
  updateProjectGallery,
  addProjectImages,
  updateImageMetadata,
  deleteProjectImage,
  deleteProjectGallery,
  likeProject,
   reorderProjectImages,
  setFeaturedImage,
  deleteMultipleProjectImages,
  updateProjectVisibility,
  toggleProjectFeatured,
  bulkDeleteProjects
};