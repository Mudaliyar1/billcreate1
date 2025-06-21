const mongoose = require('mongoose');

// Schema for individual items in quotation 2.0
const quotation2ItemSchema = new mongoose.Schema({
  itemName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    required: true,
    trim: true,
    default: 'Sqf'
  },
  rate: {
    type: Number,
    required: true,
    min: 0
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  taxPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  }
});

// Main Quotation 2.0 Schema
const quotation2Schema = new mongoose.Schema({
  quotationNumber: {
    type: String,
    required: true,
    unique: true
  },
  
  // Customer Information
  customer: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      default: ''
    },
    address: {
      type: String,
      required: true,
      trim: true
    },
    place: {
      type: String,
      required: true,
      trim: true
    },
    gstNo: {
      type: String,
      trim: true,
      default: ''
    }
  },

  // Items array with direct entry
  items: [quotation2ItemSchema],

  // Quotation Details
  date: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'],
    default: 'Draft'
  },

  // Totals
  subtotal: {
    type: Number,
    default: 0
  },
  totalDiscount: {
    type: Number,
    default: 0
  },
  totalTax: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    default: 0
  },

  // Additional Information
  notes: {
    type: String,
    default: '',
    trim: true
  },
  termsAndConditions: {
    type: String,
    default: 'Thank you for your business! Sold products cannot be returned.',
    trim: true
  },

  // Metadata
  createdBy: {
    type: String,
    default: 'Admin'
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

// Pre-save middleware to calculate totals
quotation2Schema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Calculate totals
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  this.items.forEach(item => {
    // Use the amount directly (no calculation needed)
    const amount = item.amount || 0;

    // Apply discount
    const discountAmount = (amount * item.discount) / 100;
    const afterDiscount = amount - discountAmount;

    // Calculate tax
    const taxAmount = (afterDiscount * item.taxPercent) / 100;

    subtotal += amount;
    totalDiscount += discountAmount;
    totalTax += taxAmount;
  });

  this.subtotal = subtotal;
  this.totalDiscount = totalDiscount;
  this.totalTax = totalTax;
  this.totalAmount = subtotal - totalDiscount + totalTax;

  next();
});

// Static method to generate quotation number
quotation2Schema.statics.generateQuotationNumber = async function() {
  const currentYear = new Date().getFullYear();
  const prefix = `Q2-${currentYear}-`;
  
  // Find the latest quotation number for this year
  const latestQuotation = await this.findOne({
    quotationNumber: { $regex: `^${prefix}` }
  }).sort({ quotationNumber: -1 });

  let nextNumber = 1;
  if (latestQuotation) {
    const lastNumber = parseInt(latestQuotation.quotationNumber.split('-')[2]);
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
};

// Instance method to calculate totals
quotation2Schema.methods.calculateTotals = function() {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  this.items.forEach(item => {
    const amount = item.amount || 0;
    const discountAmount = (amount * item.discount) / 100;
    const afterDiscount = amount - discountAmount;
    const taxAmount = (afterDiscount * item.taxPercent) / 100;

    subtotal += amount;
    totalDiscount += discountAmount;
    totalTax += taxAmount;
  });

  this.subtotal = subtotal;
  this.totalDiscount = totalDiscount;
  this.totalTax = totalTax;
  this.totalAmount = subtotal - totalDiscount + totalTax;

  return this;
};

module.exports = mongoose.model('Quotation2', quotation2Schema);
