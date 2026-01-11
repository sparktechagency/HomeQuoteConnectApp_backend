// models/SystemSettings.js
const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
  // Singleton pattern - only one document should exist
  key: {
    type: String,
    default: 'system_settings',
    unique: true,
    immutable: true
  },
  
  // Credit Settings
  creditSettings: {
    signupCredits: {
      type: Number,
      default: 50,
      min: [0, 'Signup credits cannot be negative'],
      max: [1000, 'Signup credits cannot exceed 1000']
    },
    verificationCredits: {
      type: Number,
      default: 0,
      min: [0, 'Verification credits cannot be negative'],
      max: [1000, 'Verification credits cannot exceed 1000']
    }
  },
  
  // Platform Settings (for future use)
  platformSettings: {
    commissionRate: {
      type: Number,
      default: 10,
      min: [0, 'Commission rate cannot be negative'],
      max: [100, 'Commission rate cannot exceed 100']
    },
    maintenanceMode: {
      type: Boolean,
      default: false
    }
  },
  
  // Timestamps
  updatedAt: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Static method to get or create settings
systemSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne({ key: 'system_settings' });
  
  if (!settings) {
    // Create default settings if none exist
    settings = await this.create({
      key: 'system_settings',
      creditSettings: {
        signupCredits: 50,
        verificationCredits: 0
      }
    });
  }
  
  return settings;
};

// Static method to update settings
systemSettingsSchema.statics.updateSettings = async function(updates, adminId) {
  let settings = await this.getSettings();
  
  if (updates.creditSettings) {
    if (updates.creditSettings.signupCredits !== undefined) {
      settings.creditSettings.signupCredits = updates.creditSettings.signupCredits;
    }
    if (updates.creditSettings.verificationCredits !== undefined) {
      settings.creditSettings.verificationCredits = updates.creditSettings.verificationCredits;
    }
  }
  
  if (updates.platformSettings) {
    if (updates.platformSettings.commissionRate !== undefined) {
      settings.platformSettings.commissionRate = updates.platformSettings.commissionRate;
    }
    if (updates.platformSettings.maintenanceMode !== undefined) {
      settings.platformSettings.maintenanceMode = updates.platformSettings.maintenanceMode;
    }
  }
  
  settings.updatedBy = adminId;
  settings.updatedAt = new Date();
  
  await settings.save();
  return settings;
};

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
