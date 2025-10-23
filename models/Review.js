// models/Review.js
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  // Review Information
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Rating (1-5 stars)
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  
  // Review Content
  comment: {
    type: String,
    maxlength: [1000, 'Comment cannot be more than 1000 characters']
  },
  
  // Review Type
  reviewType: {
    type: String,
    enum: ['client_to_provider', 'provider_to_client'],
    required: true
  },
  
  // Response from reviewed user
  response: {
    comment: String,
    respondedAt: Date
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
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
  timestamps: true
});

// Compound index for one review per job per reviewer
reviewSchema.index({ job: 1, reviewer: 1 }, { unique: true });

// Indexes for performance
reviewSchema.index({ reviewedUser: 1, reviewType: 1 });
reviewSchema.index({ rating: -1 });
reviewSchema.index({ createdAt: -1 });

// Pre-save middleware to update user's average rating
reviewSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('rating')) {
    await this.constructor.updateUserRating(this.reviewedUser);
  }
  next();
});

// Static method to update user's average rating
reviewSchema.statics.updateUserRating = async function(userId) {
  const User = require('./User');
  
  const stats = await this.aggregate([
    {
      $match: {
        reviewedUser: userId,
        isActive: true
      }
    },
    {
      $group: {
        _id: '$reviewedUser',
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      }
    }
  ]);

  if (stats.length > 0) {
    await User.findByIdAndUpdate(userId, {
      averageRating: Math.round(stats[0].averageRating * 10) / 10, // Round to 1 decimal
      totalReviews: stats[0].totalReviews
    });
  }
};

module.exports = mongoose.model('Review', reviewSchema);