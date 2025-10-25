// utils/cloudinary.js
const cloudinary = require('cloudinary').v2;
const { 
  CLOUDINARY_CLOUD_NAME, 
  CLOUDINARY_API_KEY, 
  CLOUDINARY_API_SECRET 
} = require('../config/env');

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET
});

/**
 * Upload file to Cloudinary.
 * Supports both file path (string) and Buffer (from Multer memoryStorage).
 * @param {Buffer|string} file - Buffer or file path
 * @param {string} folder - Cloudinary folder
 * @returns {Promise<object>} - Cloudinary upload result
 */
const uploadToCloudinary = async (file, folder = 'raza-home-quote') => {
  try {
    let uploadResult;

    if (Buffer.isBuffer(file)) {
      // Convert buffer to base64 data URI
      const base64 = `data:image/jpeg;base64,${file.toString('base64')}`;
      uploadResult = await cloudinary.uploader.upload(base64, {
        folder,
        resource_type: 'auto'
      });
    } else if (typeof file === 'string') {
      // file is a path or URL
      uploadResult = await cloudinary.uploader.upload(file, {
        folder,
        resource_type: 'auto'
      });
    } else {
      throw new Error('Invalid file type for upload');
    }

    return uploadResult;
  } catch (error) {
    throw new Error(`Cloudinary upload error: ${error.message}`);
  }
};

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Cloudinary public_id
 * @returns {Promise<object>} - Cloudinary delete result
 */
const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    throw new Error(`Cloudinary delete error: ${error.message}`);
  }
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
  cloudinary
};
