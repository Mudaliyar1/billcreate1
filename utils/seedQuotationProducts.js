const mongoose = require('mongoose');
const QuotationProduct = require('../models/QuotationProduct');
const connectDB = require('../config/db');

// Sample quotation products data
const sampleQuotationProducts = [
  // Board category
  {
    name: 'Plywood Sheet 8x4',
    price: 2500,
    pricePerFt: 0,
    pricePerRft: 0,
    category: 'Board',
    unitType: 'piece',
    quantity: 50
  },
  {
    name: 'MDF Board',
    price: 0,
    pricePerFt: 45,
    pricePerRft: 0,
    category: 'Board',
    unitType: 'ft',
    quantity: 200
  },
  {
    name: 'Particle Board',
    price: 1800,
    pricePerFt: 0,
    pricePerRft: 0,
    category: 'Board',
    unitType: 'piece',
    quantity: 30
  },

  // Chanel category
  {
    name: 'Aluminum Channel',
    price: 0,
    pricePerFt: 0,
    pricePerRft: 120,
    category: 'Chanel',
    unitType: 'rft',
    quantity: 500
  },
  {
    name: 'Steel Channel',
    price: 0,
    pricePerFt: 0,
    pricePerRft: 85,
    category: 'Chanel',
    unitType: 'rft',
    quantity: 300
  },
  {
    name: 'PVC Channel',
    price: 0,
    pricePerFt: 0,
    pricePerRft: 65,
    category: 'Chanel',
    unitType: 'rft',
    quantity: 400
  },

  // Hardware category
  {
    name: 'Door Handle Set',
    price: 450,
    pricePerFt: 0,
    pricePerRft: 0,
    category: 'Hardware',
    unitType: 'piece',
    quantity: 25
  },
  {
    name: 'Cabinet Hinges',
    price: 35,
    pricePerFt: 0,
    pricePerRft: 0,
    category: 'Hardware',
    unitType: 'piece',
    quantity: 100
  },
  {
    name: 'Drawer Slides',
    price: 180,
    pricePerFt: 0,
    pricePerRft: 0,
    category: 'Hardware',
    unitType: 'piece',
    quantity: 40
  },

  // Bori category
  {
    name: 'Decorative Bori Strip',
    price: 0,
    pricePerFt: 25,
    pricePerRft: 0,
    category: 'Bori',
    unitType: 'ft',
    quantity: 150
  },
  {
    name: 'Edge Banding',
    price: 0,
    pricePerFt: 0,
    pricePerRft: 15,
    category: 'Bori',
    unitType: 'rft',
    quantity: 800
  },
  {
    name: 'Veneer Strip',
    price: 0,
    pricePerFt: 35,
    pricePerRft: 0,
    category: 'Bori',
    unitType: 'ft',
    quantity: 200
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
      console.log(`- ${product.name} (${product.category}) - ${product.unitType}`);
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
