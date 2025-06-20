const mongoose = require('mongoose');

const QuotationProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true
  },

  // Feet pricing (for products sold by feet)
  pricePerFt: {
    type: Number,
    default: 0
  },
  // Running feet pricing (for products sold by running feet)
  pricePerRft: {
    type: Number,
    default: 0
  },
  // Unit type for this product
  unitType: {
    type: String,
    enum: ['ft', 'rft'],
    default: 'ft'
  },
  totalSold: {
    type: Number,
    default: 0,
    min: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('QuotationProduct', QuotationProductSchema);
