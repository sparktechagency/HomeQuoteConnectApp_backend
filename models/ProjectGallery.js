// models/ProjectGallery.js
const mongoose = require('mongoose');

const projectGallerySchema = new mongoose.Schema({
  // Gallery Information
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    // required: [true, 'Project title is required'],
    // trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  
  // Project Details
  serviceCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    // required: true
  },
  specializations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Specialization'
  }],
  
  // Project Images
  images: [{
    public_id: String,
    url: String,
    caption: String,
    imageType: {
      type: String,
      enum: ['before', 'after', 'during', 'completion'],
      default: 'during'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    isFeatured: {
      type: Boolean,
      default: false
    },
    order: {
      type: Number,
      default: 0
    }
  }],
  
  // Project Metadata
  projectDate: {
    type: Date,
    // required: true
  },
  location: {
    address: String,
    city: String,
    state: String
  },
  budget: {
    type: Number,
    min: 0
  },
  duration: {
    value: Number,
    unit: {
      type: String,
      enum: ['hours', 'days', 'weeks', 'months']
    }
  },
  
  // Client Information (optional)
  clientName: String,
  clientRating: {
    type: Number,
    min: 1,
    max: 5
  },
  clientReview: String,
  
  // Status & Visibility
  isActive: {
    type: Boolean,
    default: true
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  featured: {
    type: Boolean,
    default: false
  },
  
  // Statistics
  viewCount: {
    type: Number,
    default: 0
  },
  likeCount: {
    type: Number,
    default: 0
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
projectGallerySchema.index({ provider: 1 });
projectGallerySchema.index({ serviceCategory: 1 });
projectGallerySchema.index({ featured: -1 });
projectGallerySchema.index({ createdAt: -1 });
projectGallerySchema.index({ 'images.imageType': 1 });

// Virtual for before/after image pairs
projectGallerySchema.virtual('beforeAfterPairs').get(function() {
  const beforeImages = this.images.filter(img => img.imageType === 'before');
  const afterImages = this.images.filter(img => img.imageType === 'after');
  
  return beforeImages.map((beforeImg, index) => ({
    before: beforeImg,
    after: afterImages[index] || null
  }));
});

// Virtual for featured image
projectGallerySchema.virtual('featuredImage').get(function() {
  const featured = this.images.find(img => img.isFeatured);
  return featured || this.images[0];
});

// Method to increment view count
projectGallerySchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  return this.save();
};

// Method to add like
projectGallerySchema.methods.addLike = function() {
  this.likeCount += 1;
  return this.save();
};

// Method to remove like
projectGallerySchema.methods.removeLike = function() {
  if (this.likeCount > 0) {
    this.likeCount -= 1;
  }
  return this.save();
};

// Static method to get provider's gallery stats
projectGallerySchema.statics.getProviderStats = async function(providerId) {
  const stats = await this.aggregate([
    {
      $match: {
        provider: new mongoose.Types.ObjectId(providerId),
        isActive: true
      }
    },
    {
      $group: {
        _id: '$provider',
        totalProjects: { $sum: 1 },
        totalViews: { $sum: '$viewCount' },
        totalLikes: { $sum: '$likeCount' },
        featuredProjects: {
          $sum: { $cond: [{ $eq: ['$featured', true] }, 1, 0] }
        },
        beforeAfterProjects: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ['before', '$images.imageType'] },
                  { $in: ['after', '$images.imageType'] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    }
  ]);
  
  return stats.length > 0 ? stats[0] : {
    totalProjects: 0,
    totalViews: 0,
    totalLikes: 0,
    featuredProjects: 0,
    beforeAfterProjects: 0
  };
};

module.exports = mongoose.model('ProjectGallery', projectGallerySchema);