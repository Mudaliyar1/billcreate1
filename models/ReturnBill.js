const mongoose = require('mongoose');

const ReturnBillSchema = new mongoose.Schema({
  originalBill: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill',
    required: true,
    unique: true // Ensure only one return bill per original bill
  },
  originalBillNumber: {
    type: String,
    required: true
  },
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
    }
  },
  reason: {
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
      category: String,
      originalBill: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bill'
      },
      originalBillNumber: String
    }
  ],
  status: {
    type: String,
    required: true,
    enum: ['Pending', 'Resolved'],
    default: 'Pending'
  },
  resolution: {
    type: String,
    enum: ['Re-added to Inventory', 'Damaged', 'Replaced', 'Refunded', 'Other'],
    trim: true
  },
  resolutionNotes: {
    type: String,
    trim: true
  },
  returnNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: {
    type: Date
  }
});

// Generate unique return bill number before saving
ReturnBillSchema.pre('save', async function(next) {
  if (this.isNew || !this.returnNumber) {
    try {
      // Find the highest return number with the current year prefix
      const currentYear = new Date().getFullYear();
      const prefix = `KT-RET-${currentYear}-`;

      // Find the return bill with the highest number for this year
      const highestBill = await mongoose.model('ReturnBill')
        .findOne({ returnNumber: new RegExp(`^${prefix}`) })
        .sort({ returnNumber: -1 });

      let nextNumber = 1;

      if (highestBill) {
        // Extract the number part from the highest return bill number
        const currentNumber = parseInt(highestBill.returnNumber.replace(prefix, ''));
        nextNumber = isNaN(currentNumber) ? 1 : currentNumber + 1;
      }

      // Generate the new return bill number with padded zeros
      this.returnNumber = `${prefix}${nextNumber.toString().padStart(4, '0')}`;

      // Double-check that this return bill number doesn't already exist
      const existingBill = await mongoose.model('ReturnBill').findOne({ returnNumber: this.returnNumber });
      if (existingBill) {
        // If it exists, increment and try again
        nextNumber++;
        this.returnNumber = `${prefix}${nextNumber.toString().padStart(4, '0')}`;
      }

      // Final check to ensure we have a return bill number
      if (!this.returnNumber) {
        throw new Error('Failed to generate a unique return bill number');
      }

      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

module.exports = mongoose.model('ReturnBill', ReturnBillSchema);
