const mongoose = require('mongoose');

const QuotationSchema = new mongoose.Schema({
  customer: {
    name: {
      type: String,
      required: function() {
        return !this.isUnknown;
      },
      trim: true,
      default: function() {
        return this.isUnknown ? 'Unknown' : undefined;
      }
    },
    phone: {
      type: String,
      required: function() {
        return !this.isUnknown;
      },
      trim: true,
      default: function() {
        return this.isUnknown ? 'Unknown' : undefined;
      }
    },
    place: {
      type: String,
      required: function() {
        return !this.isUnknown;
      },
      trim: true,
      default: function() {
        return this.isUnknown ? 'Unknown' : undefined;
      }
    },
    email: {
      type: String,
      trim: true,
      default: ''
    },
    gstNo: {
      type: String,
      trim: true,
      default: ''
    }
  },
  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'QuotationProduct',
        required: true
      },
      name: String,
      price: Number,
      // For ft/rft measurements
      feet: {
        type: Number,
        default: 0
      },
      runningFeet: {
        type: Number,
        default: 0
      },
      unitType: {
        type: String,
        enum: ['ft', 'rft'],
        default: 'ft'
      },
      category: String
    }
  ],
  subTotal: {
    type: Number,
    required: true
  },
  gstEnabled: {
    type: Boolean,
    default: false
  },
  gstType: {
    type: String,
    required: function() {
      return this.gstEnabled === true;
    }
  },
  gstPercentage: {
    type: Number,
    min: 0,
    max: 100,
    required: function() {
      return this.gstEnabled === true;
    }
  },
  gstAmount: {
    type: Number,
    default: 0
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  quotationNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  isUnknown: {
    type: Boolean,
    default: false
  },
  quotationDate: {
    type: Date,
    default: Date.now,
    validate: {
      validator: function(value) {
        return value <= new Date();
      },
      message: 'Quotation date cannot be in the future'
    }
  },
  validUntil: {
    type: Date,
    default: function() {
      // Default validity is 30 days from quotation date
      const date = new Date(this.quotationDate || Date.now());
      date.setDate(date.getDate() + 30);
      return date;
    }
  },
  status: {
    type: String,
    enum: ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'],
    default: 'Draft'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Generate unique quotation number before saving
QuotationSchema.pre('save', async function(next) {
  if (this.isNew || !this.quotationNumber) {
    try {
      // Find the highest quotation number with the quotation date year prefix
      const quotationYear = this.quotationDate ? new Date(this.quotationDate).getFullYear() : new Date().getFullYear();
      const prefix = `QT-${quotationYear}-`;

      // Find the quotation with the highest number for this year
      const highestQuotation = await mongoose.model('Quotation')
        .findOne({ quotationNumber: new RegExp(`^${prefix}`) })
        .sort({ quotationNumber: -1 });

      let nextNumber = 1;

      if (highestQuotation) {
        // Extract the number part from the highest quotation number
        const currentNumber = parseInt(highestQuotation.quotationNumber.replace(prefix, ''));
        nextNumber = isNaN(currentNumber) ? 1 : currentNumber + 1;
      }

      // Generate the new quotation number with padded zeros
      this.quotationNumber = `${prefix}${nextNumber.toString().padStart(4, '0')}`;

      // Double-check that this quotation number doesn't already exist
      const existingQuotation = await mongoose.model('Quotation').findOne({ quotationNumber: this.quotationNumber });
      if (existingQuotation) {
        // If it exists, increment and try again
        nextNumber++;
        this.quotationNumber = `${prefix}${nextNumber.toString().padStart(4, '0')}`;
      }

      // Final check to ensure we have a quotation number
      if (!this.quotationNumber) {
        throw new Error('Failed to generate a unique quotation number');
      }

      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

module.exports = mongoose.model('Quotation', QuotationSchema);
