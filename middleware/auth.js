const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

// Middleware to check if user is authenticated
exports.isAuthenticated = async (req, res, next) => {
  try {
    // Check if user is authenticated via session
    if (req.session.isAuthenticated && req.session.adminId) {
      return next();
    }

    // Check if user is authenticated via JWT token in cookie
    const token = req.cookies.token;

    if (!token) {
      req.flash('error', 'Please log in to access this resource');
      return res.redirect('/login');
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Find admin by id
      const admin = await Admin.findById(decoded.id);

      if (!admin) {
        // Clear invalid token
        res.clearCookie('token');
        req.flash('error', 'User not found');
        return res.redirect('/login');
      }

      // Set session variables
      req.session.isAuthenticated = true;
      req.session.adminId = admin._id;

      next();
    } catch (jwtError) {
      // Clear invalid token
      res.clearCookie('token');
      req.flash('error', 'Your session has expired. Please log in again.');
      return res.redirect('/login');
    }
  } catch (error) {
    console.error('Auth error:', error);
    // Clear any potentially invalid token
    res.clearCookie('token');
    req.flash('error', 'Authentication failed');
    res.redirect('/login');
  }
};

// Middleware to check if user is already logged in
exports.isNotAuthenticated = (req, res, next) => {
  if (req.session.isAuthenticated) {
    return res.redirect('/dashboard');
  }

  // Check token validity if present
  const token = req.cookies.token;
  if (token) {
    try {
      jwt.verify(token, process.env.JWT_SECRET);
      return res.redirect('/dashboard');
    } catch (error) {
      // Clear invalid token and continue
      res.clearCookie('token');
    }
  }

  next();
};

// Middleware to check if user is an admin
exports.ensureAdmin = async (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.session.isAuthenticated || !req.session.adminId) {
      req.flash('error', 'Please log in to access this resource');
      return res.redirect('/login');
    }

    // Find admin by id
    const admin = await Admin.findById(req.session.adminId);

    if (!admin) {
      req.flash('error', 'User not found');
      return res.redirect('/login');
    }

    // All admins have admin privileges in this application
    // If you need to check for specific admin roles, add that logic here

    // Set user object for views
    req.user = admin;
    req.user.isAdmin = true;

    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    req.flash('error', 'Authentication failed');
    res.redirect('/login');
  }
};
