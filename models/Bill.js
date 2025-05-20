const mongoose = require('mongoose');

const BillSchema = new mongoose.Schema({
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
    place: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      trim: true
    }
  },
  work: {
    type: String,
    required: true,
    trim: true
  },
  pickedBy: {
    type: String,
    required: true,
    trim: true
  },
  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      name: String,
      price: Number,
      quantity: {
        type: Number,
        required: true,
        default: 1
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
  totalAmount: {
    type: Number,
    required: true
  },
  paymentType: {
    type: String,
    required: true,
    enum: ['Cash', 'Credit']
  },
  creditType: {
    type: String,
    enum: ['Full Credit', 'Half Credit', 'Custom Credit'],
    required: function() {
      return this.paymentType === 'Credit';
    }
  },
  paidAmount: {
    type: Number,
    default: function() {
      if (this.paymentType === 'Cash') {
        return this.totalAmount;
      } else if (this.paymentType === 'Credit' && this.creditType === 'Half Credit') {
        return this.totalAmount / 2;
      } else if (this.paymentType === 'Credit' && this.creditType === 'Custom Credit') {
        // For custom credit, the paid amount will be set directly
        return this.paidAmount || 0;
      } else {
        return 0;
      }
    }
  },
  customPaidAmount: {
    type: Number,
    default: 0
  },
  remainingAmount: {
    type: Number,
    default: function() {
      if (this.paymentType === 'Cash') {
        // For cash payments, calculate remaining amount based on paid amount
        return this.totalAmount - (this.paidAmount || 0);
      } else if (this.paymentType === 'Credit' && this.creditType === 'Half Credit') {
        return this.totalAmount / 2;
      } else if (this.paymentType === 'Credit' && this.creditType === 'Custom Credit') {
        return this.totalAmount - (this.customPaidAmount || 0);
      } else {
        return this.totalAmount;
      }
    }
  },
  billNumber: {
    type: String,
    unique: true,
    sparse: true // This allows the field to be undefined during document creation
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Generate unique bill number before saving
BillSchema.pre('save', async function(next) {
  if (this.isNew || !this.billNumber) {
    try {
      // Find the highest bill number with the current year prefix
      const currentYear = new Date().getFullYear();
      const prefix = `KT-${currentYear}-`;

      // Find the bill with the highest number for this year
      const highestBill = await mongoose.model('Bill')
        .findOne({ billNumber: new RegExp(`^${prefix}`) })
        .sort({ billNumber: -1 });

      let nextNumber = 1;

      if (highestBill) {
        // Extract the number part from the highest bill number
        const currentNumber = parseInt(highestBill.billNumber.replace(prefix, ''));
        nextNumber = isNaN(currentNumber) ? 1 : currentNumber + 1;
      }

      // Generate the new bill number with padded zeros
      this.billNumber = `${prefix}${nextNumber.toString().padStart(4, '0')}`;

      // Double-check that this bill number doesn't already exist
      const existingBill = await mongoose.model('Bill').findOne({ billNumber: this.billNumber });
      if (existingBill) {
        // If it exists, increment and try again
        nextNumber++;
        this.billNumber = `${prefix}${nextNumber.toString().padStart(4, '0')}`;
      }

      // Final check to ensure we have a bill number
      if (!this.billNumber) {
        throw new Error('Failed to generate a unique bill number');
      }

      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

module.exports = mongoose.model('Bill', BillSchema);
