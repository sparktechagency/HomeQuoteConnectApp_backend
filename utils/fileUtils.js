// utils/fileUtils.js
const { uploadToCloudinary, deleteFromCloudinary } = require('./cloudinary');

// Upload multiple images for job posts
const uploadMultipleImages = async (files, folder = 'raza-home-quote/job-photos') => {
  try {
    const uploadPromises = files.map(file => 
      uploadToCloudinary(file.buffer, folder)
    );
    
    const results = await Promise.all(uploadPromises);
    
    return results.map(result => ({
      public_id: result.public_id,
      url: result.secure_url
    }));
  } catch (error) {
    throw new Error(`Error uploading multiple images: ${error.message}`);
  }
};

// Upload project gallery images
const uploadProjectGallery = async (files, folder = 'raza-home-quote/project-gallery') => {
  try {
    const uploadPromises = files.map(file => 
      uploadToCloudinary(file.buffer, folder)
    );
    
    const results = await Promise.all(uploadPromises);
    
    return results.map(result => ({
      public_id: result.public_id,
      url: result.secure_url,
      uploadedAt: new Date()
    }));
  } catch (error) {
    throw new Error(`Error uploading project gallery: ${error.message}`);
  }
};

// Delete multiple files from Cloudinary
const deleteMultipleFiles = async (publicIds) => {
  try {
    const deletePromises = publicIds.map(publicId =>
      deleteFromCloudinary(publicId)
    );
    
    await Promise.all(deletePromises);
    return true;
  } catch (error) {
    throw new Error(`Error deleting multiple files: ${error.message}`);
  }
};

// Validate file type
const validateFileType = (file, allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']) => {
  return allowedTypes.includes(file.mimetype);
};

// Validate file size
const validateFileSize = (file, maxSize = 5 * 1024 * 1024) => {
  return file.size <= maxSize;
};

module.exports = {
  uploadMultipleImages,
  uploadProjectGallery,
  deleteMultipleFiles,
  validateFileType,
  validateFileSize
};