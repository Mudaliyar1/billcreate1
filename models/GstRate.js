const mongoose = require('mongoose');

const GstRateSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    unique: true
  },
  percentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Ensure only one default GST rate
GstRateSchema.pre('save', async function(next) {
  if (this.isDefault) {
    // If this document is being set as default, unset all others
    await mongoose.model('GstRate').updateMany(
      { _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }

  // Update the updatedAt timestamp
  this.updatedAt = Date.now();

  next();
});

module.exports = mongoose.model('GstRate', GstRateSchema);
