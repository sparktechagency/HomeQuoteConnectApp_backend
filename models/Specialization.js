// models/Specialization.js
const mongoose = require('mongoose');

const specializationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Specialization title is required'],
    trim: true,
    maxlength: [100, 'Specialization title cannot be more than 100 characters']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required for specialization']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Compound index for unique specialization per category
specializationSchema.index({ title: 1, category: 1 }, { unique: true });

// Index for search
specializationSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Specialization', specializationSchema);