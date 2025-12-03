// models/Job.js
const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
    maxlength: [200, 'Job title cannot be more than 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Job description is required'],
    maxlength: [2000, 'Description cannot be more than 2000 characters']
  },
  isDirectBooking: {
  type: Boolean,
  default: false
},
provider: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  default: null
},
  // Client Information
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Service Information
  serviceCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  specializations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Specialization'
  }],
  
  // Location Information
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    },
    address: {
    type: String, // <- change from object to string
    default: ''
  }
    ,
    details: 
    {
      houseNumber: String,
      streetNumber: String,
      completeAddress: String,
      city: String,
      state: String,
      country: String,
      zipCode: String
    }
  },
  
  // Timing Information
  urgency: {
    type: String,
    enum: ['urgent', 'asap', 'next_week'],
    required: true
  },
  preferredDate: Date,
  preferredTime: String,
  
  // Price Information
  priceRange: {
    from: {
      type: Number,
      min: 0
    },
    to: {
      type: Number,
      min: 0
    },
    isPersonalized: {
      type: Boolean,
      default: false
    }
  },
  
  // Media
  photos: [{
    public_id: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Job Status
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled', 'expired'],
    default: 'pending'
  },
  
  // Quote Information
  quotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quote'
  }],
  acceptedQuote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quote'
  },
  
  // Statistics
  viewCount: {
    type: Number,
    default: 0
  },
  quoteCount: {
    type: Number,
    default: 0
  },
  
  // Expiry
  expiresAt: {
    type: Date,
    index: { expires: 0 } // TTL index for auto-expiry
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
jobSchema.index({ location: '2dsphere' });
jobSchema.index({ client: 1 });
jobSchema.index({ serviceCategory: 1 });
jobSchema.index({ status: 1 });
jobSchema.index({ urgency: 1 });
jobSchema.index({ createdAt: -1 });
jobSchema.index({ 'location.coordinates': '2dsphere' });

// Virtual for time ago
jobSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diffInSeconds = Math.floor((now - this.createdAt) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
});

// Virtual for isExpired
jobSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

// Pre-save middleware to set expiry based on urgency
jobSchema.pre('save', function(next) {
  if (this.isModified('urgency') || this.isNew) {
    const now = new Date();
    switch (this.urgency) {
      case 'urgent':
        this.expiresAt = new Date(now.setDate(now.getDate() + 1)); // 1 day
        break;
      case 'asap':
        this.expiresAt = new Date(now.setDate(now.getDate() + 7)); // 1 week
        break;
      case 'next_week':
        this.expiresAt = new Date(now.setDate(now.getDate() + 14)); // 2 weeks
        break;
    }
  }
  next();
});

// Method to update quote count
jobSchema.methods.updateQuoteCount = async function() {
  const Quote = require('./Quote');
  this.quoteCount = await Quote.countDocuments({ job: this._id, status: { $ne: 'cancelled' } });
  await this.save();
};

// Static method to find nearby jobs
jobSchema.statics.findNearby = function(coordinates, maxDistance = 20000) { // 20km default
  return this.find({
    'location.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates
        },
        $maxDistance: maxDistance
      }
    },
    status: 'pending',
    expiresAt: { $gt: new Date() }
  });
};

module.exports = mongoose.model('Job', jobSchema);