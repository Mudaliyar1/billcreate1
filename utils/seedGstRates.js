require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const GstRate = require('../models/GstRate');

// Connect to MongoDB
connectDB();

// GST rates to seed
const gstRates = [
  {
    type: 'CGST+SGST 5%',
    percentage: 5,
    description: 'Standard Rate (2.5% CGST + 2.5% SGST)',
    isDefault: false
  },
  {
    type: 'CGST+SGST 12%',
    percentage: 12,
    description: 'Standard Rate (6% CGST + 6% SGST)',
    isDefault: true
  },
  {
    type: 'CGST+SGST 18%',
    percentage: 18,
    description: 'Standard Rate (9% CGST + 9% SGST)',
    isDefault: false
  },
  {
    type: 'CGST+SGST 28%',
    percentage: 28,
    description: 'Standard Rate (14% CGST + 14% SGST)',
    isDefault: false
  },
  {
    type: 'IGST 5%',
    percentage: 5,
    description: 'Integrated GST (5%)',
    isDefault: false
  },
  {
    type: 'IGST 12%',
    percentage: 12,
    description: 'Integrated GST (12%)',
    isDefault: false
  },
  {
    type: 'IGST 18%',
    percentage: 18,
    description: 'Integrated GST (18%)',
    isDefault: false
  },
  {
    type: 'IGST 28%',
    percentage: 28,
    description: 'Integrated GST (28%)',
    isDefault: false
  }
];

// Seed GST rates
async function seedGstRates() {
  try {
    // Clear existing GST rates
    await GstRate.deleteMany({});
    console.log('Cleared existing GST rates');

    // Insert new GST rates
    const result = await GstRate.insertMany(gstRates);
    console.log(`Seeded ${result.length} GST rates`);

    // Disconnect from MongoDB
    mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error seeding GST rates:', error);
    mongoose.disconnect();
    process.exit(1);
  }
}

// Run the seed function
seedGstRates();
