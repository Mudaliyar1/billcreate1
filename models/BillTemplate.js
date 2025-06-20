const mongoose = require('mongoose');

const billElementSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'company_header',
      'company_address', 
      'bill_number',
      'bill_date',
      'customer_info',
      'work_details',
      'items_table',
      'subtotal',
      'gst_details',
      'discount',
      'total_amount',
      'payment_details',
      'qr_code',
      'footer',
      'terms_conditions',
      'custom_text'
    ]
  },
  label: {
    type: String,
    required: true
  },
  position: {
    x: {
      type: Number,
      required: true,
      default: 0
    },
    y: {
      type: Number,
      required: true,
      default: 0
    }
  },
  size: {
    width: {
      type: Number,
      required: true,
      default: 200
    },
    height: {
      type: Number,
      required: true,
      default: 50
    }
  },
  style: {
    fontSize: {
      type: Number,
      default: 12
    },
    fontWeight: {
      type: String,
      default: 'normal',
      enum: ['normal', 'bold']
    },
    textAlign: {
      type: String,
      default: 'left',
      enum: ['left', 'center', 'right']
    },
    color: {
      type: String,
      default: '#000000'
    },
    backgroundColor: {
      type: String,
      default: 'transparent'
    },
    borderWidth: {
      type: Number,
      default: 0
    },
    borderColor: {
      type: String,
      default: '#000000'
    }
  },
  visible: {
    type: Boolean,
    default: true
  },
  customText: {
    type: String,
    default: ''
  },
  order: {
    type: Number,
    default: 0
  }
});

const billTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  pageSettings: {
    width: {
      type: Number,
      default: 595 // A4 width in points
    },
    height: {
      type: Number,
      default: 842 // A4 height in points
    },
    margin: {
      top: {
        type: Number,
        default: 40
      },
      bottom: {
        type: Number,
        default: 40
      },
      left: {
        type: Number,
        default: 40
      },
      right: {
        type: Number,
        default: 40
      }
    }
  },
  elements: [billElementSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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

// Update the updatedAt field before saving
billTemplateSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Ensure only one default template exists
billTemplateSchema.pre('save', async function(next) {
  if (this.isDefault) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  next();
});

module.exports = mongoose.model('BillTemplate', billTemplateSchema);
