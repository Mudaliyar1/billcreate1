const mongoose = require('mongoose');
const QuotationProduct = require('../models/QuotationProduct');
const connectDB = require('../config/db');

// Sample quotation products data
const sampleQuotationProducts = [
  // Gypsum products (feet-based)
  {
    name: 'Gypsum ceiling (khushbu)',
    price: 0,
    pricePerFt: 85,
    pricePerRft: 0,
    unitType: 'ft'
  },
  {
    name: 'Gypsum ceiling gyblock (Expert)',
    price: 0,
    pricePerFt: 95,
    pricePerRft: 0,
    unitType: 'ft'
  },
  {
    name: 'Gypsum ceiling indraprastha',
    price: 0,
    pricePerFt: 75,
    pricePerRft: 0,
    unitType: 'ft'
  },
  {
    name: 'Gypsum ceiling gyproc',
    price: 0,
    pricePerFt: 90,
    pricePerRft: 0,
    unitType: 'ft'
  },
  {
    name: 'Gypsum running',
    price: 0,
    pricePerFt: 45,
    pricePerRft: 0,
    unitType: 'ft'
  },
  {
    name: 'Gypsum running (expert)',
    price: 0,
    pricePerFt: 55,
    pricePerRft: 0,
    unitType: 'ft'
  },
  {
    name: 'Gypsum running (gypframe)',
    price: 0,
    pricePerFt: 50,
    pricePerRft: 0,
    unitType: 'ft'
  },
  {
    name: 'Gypsum running (khushbu)',
    price: 0,
    pricePerFt: 48,
    pricePerRft: 0,
    unitType: 'ft'
  },

  // Running feet products
  {
    name: 'Hint ceiling (2×2)',
    price: 0,
    pricePerFt: 0,
    pricePerRft: 120,
    unitType: 'rft'
  },
  {
    name: 'P.V.C ceiling',
    price: 0,
    pricePerFt: 0,
    pricePerRft: 85,
    unitType: 'rft'
  },
  {
    name: 'Aluminum Channel',
    price: 0,
    pricePerFt: 0,
    pricePerRft: 110,
    unitType: 'rft'
  },
  {
    name: 'Steel Channel',
    price: 0,
    pricePerFt: 0,
    pricePerRft: 95,
    unitType: 'rft'
  },
  {
    name: 'PVC Channel',
    price: 0,
    pricePerFt: 0,
    pricePerRft: 75,
    unitType: 'rft'
  },
  {
    name: 'Edge Banding',
    price: 0,
    pricePerFt: 0,
    pricePerRft: 25,
    unitType: 'rft'
  },

  // More feet-based products
  {
    name: 'MDF Board',
    price: 0,
    pricePerFt: 65,
    pricePerRft: 0,
    unitType: 'ft'
  },
  {
    name: 'Decorative Bori Strip',
    price: 0,
    pricePerFt: 35,
    pricePerRft: 0,
    unitType: 'ft'
  },
  {
    name: 'Veneer Strip',
    price: 0,
    pricePerFt: 45,
    pricePerRft: 0,
    unitType: 'ft'
  },
  {
    name: 'Wooden Molding',
    price: 0,
    pricePerFt: 55,
    pricePerRft: 0,
    unitType: 'ft'
  }
];

async function seedQuotationProducts() {
  try {
    // Connect to database
    await connectDB();

    // Clear existing quotation products
    await QuotationProduct.deleteMany({});
    console.log('Cleared existing quotation products');

    // Insert sample quotation products
    const createdProducts = await QuotationProduct.insertMany(sampleQuotationProducts);
    console.log(`Created ${createdProducts.length} quotation products:`);
    
    createdProducts.forEach(product => {
      console.log(`- ${product.name} - ${product.unitType}`);
    });

    console.log('Quotation products seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding quotation products:', error);
    process.exit(1);
  }
}

// Run the seeding function if this file is executed directly
if (require.main === module) {
  seedQuotationProducts();
}

module.exports = seedQuotationProducts;
