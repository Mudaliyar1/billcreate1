const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Board', 'Chanel', 'Hardware', 'Bori']
  },
  quantity: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  totalSold: {
    type: Number,
    default: 0,
    min: 0
  },
  totalCreditAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalPaidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Product', ProductSchema);
