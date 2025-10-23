// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Information
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  phoneNumber: {
    type: String,
    sparse: true
  },
  dateOfBirth: {
    type: Date
  },
  profilePhoto: {
    public_id: String,
    url: String
  },
  
  // Location Information
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    },
    address: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  
  // Role & Status
  role: {
    type: String,
    enum: ['client', 'provider', 'admin'],
    default: 'client'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  
  // Notification Settings
  notificationSettings: {
    general: { type: Boolean, default: true },
    sound: { type: Boolean, default: true },
    vibrate: { type: Boolean, default: true },
    newService: { type: Boolean, default: true },
    payment: { type: Boolean, default: true }
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

// Provider Specific Fields (only for providers)
userSchema.add({
  // Professional Information
  businessName: String,
  bio: String,
  experienceLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'expert']
  },
  specializations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Specialization'
  }],
  serviceAreas: [String],
  workingHours: {
    from: String, // Format: "09:00"
    to: String    // Format: "17:00"
  },
  
  // Verification
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  verificationDocuments: {
    businessLicense: {
      public_id: String,
      url: String,
      uploadedAt: Date,
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
      }
    },
    certificate: {
      public_id: String,
      url: String,
      uploadedAt: Date,
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
      }
    }
  },
  
  // Credits & Subscription
  credits: {
    type: Number,
    default: 0
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'monthly', '6months', 'yearly']
    },
    expiresAt: Date,
    isActive: {
      type: Boolean,
      default: false
    }
  },
  
  // Statistics
  totalCompletedJobs: {
    type: Number,
    default: 0
  },
  averageRating: {
    type: Number,
    default: 0
  },
  totalReviews: {
    type: Number,
    default: 0
  }
});

// Client Specific Fields (only for clients)
userSchema.add({
  // Client preferences can be added here
  favoriteProviders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
});

// Index for location-based queries
userSchema.index({ location: '2dsphere' });
// `email` field is declared with `unique: true` above which creates a unique index.
// Avoid declaring the same index again to prevent duplicate-index warnings.
userSchema.index({ role: 1 });

// Virtual for profile completion
userSchema.virtual('profileCompletion').get(function() {
  let completion = 0;
  const fields = ['fullName', 'email', 'phoneNumber', 'profilePhoto'];
  
  fields.forEach(field => {
    if (this[field]) completion += 25;
  });
  
  return completion;
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Update timestamp on save
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Compare password method
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Check if provider is verified
userSchema.methods.isProviderVerified = function() {
  return this.role === 'provider' && this.verificationStatus === 'verified';
};

module.exports = mongoose.model('User', userSchema);