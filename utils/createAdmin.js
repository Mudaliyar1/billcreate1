const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const connectDB = require('../config/db');
require('dotenv').config();

// Connect to MongoDB
connectDB();

const createAdmin = async () => {
  try {
    // Check if admin already exists
    const adminExists = await Admin.findOne({ username: 'admin' });
    
    if (adminExists) {
      console.log('Admin user already exists');
      process.exit(0);
    }
    
    // Create admin user
    const admin = new Admin({
      username: 'admin',
      password: 'admin123'
    });
    
    await admin.save();
    
    console.log('Admin user created successfully');
    console.log('Username: admin');
    console.log('Password: admin123');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
};

createAdmin();
