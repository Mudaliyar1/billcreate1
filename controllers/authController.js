const Admin = require('../models/Admin');
const jwt = require('jsonwebtoken');

// Login page
exports.getLogin = (req, res) => {
  res.render('auth/login', {
    title: 'Login - Kushi Trader',
    error: req.flash('error'),
    success: req.flash('success')
  });
};

// Login process
exports.postLogin = async (req, res) => {
  const { username, password } = req.body;

  try {
    // Check if admin exists
    const admin = await Admin.findOne({ username });

    if (!admin) {
      req.flash('error', 'Invalid credentials');
      return res.redirect('/login');
    }

    // Check if password matches
    const isMatch = await admin.matchPassword(password);

    if (!isMatch) {
      req.flash('error', 'Invalid credentials');
      return res.redirect('/login');
    }

    // Create JWT token
    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, {
      expiresIn: '1d'
    });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });

    // Set session
    req.session.isAuthenticated = true;
    req.session.adminId = admin._id;

    req.flash('success', 'Logged in successfully');
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    req.flash('error', 'An error occurred during login');
    res.redirect('/login');
  }
};

// Logout
exports.logout = (req, res) => {
  // Clear cookie
  res.clearCookie('token');

  // Clear session
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/login');
  });
};

// Dashboard
exports.getDashboard = async (req, res) => {
  try {
    // Get admin user
    const admin = await Admin.findById(req.session.adminId);

    res.render('dashboard', {
      title: 'Dashboard - Kushi Trader',
      user: { ...admin.toObject(), isAdmin: true },
      error: req.flash('error'),
      success: req.flash('success')
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    req.flash('error', 'An error occurred while loading the dashboard');
    res.redirect('/login');
  }
};
