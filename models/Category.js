// models/Category.js
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Category title is required'],
    trim: true,
    maxlength: [100, 'Category title cannot be more than 100 characters'],
    unique: true
  },
  image: {
    public_id: String,
    url: String
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  popularity: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for search and sorting
categorySchema.index({ title: 'text', description: 'text' });
categorySchema.index({ popularity: -1 });
categorySchema.index({ isActive: 1 });

// Virtual for specializations count
categorySchema.virtual('specializationsCount', {
  ref: 'Specialization',
  localField: '_id',
  foreignField: 'category',
  count: true
});

// Update popularity based on job posts
categorySchema.methods.updatePopularity = async function() {
  const Job = require('./Job');
  const jobCount = await Job.countDocuments({ 
    serviceCategory: this._id,
    status: { $in: ['pending', 'in_progress'] }
  });
  
  this.popularity = jobCount;
  await this.save();
};

module.exports = mongoose.model('Category', categorySchema);