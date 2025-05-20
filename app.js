const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');
const session = require('express-session');
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB();

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(methodOverride('_method'));

// Security headers middleware
app.use((req, res, next) => {
  // Protect against XSS attacks
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // Strict Transport Security (when using HTTPS)
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' https://code.jquery.com https://cdn.jsdelivr.net 'unsafe-inline'; style-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com 'unsafe-inline'; font-src 'self' https://cdnjs.cloudflare.com; img-src 'self' data:; connect-src 'self'"
  );
  next();
});

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'kushitrader_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    httpOnly: true, // Prevents client-side JS from reading the cookie
    secure: process.env.NODE_ENV === 'production', // Requires HTTPS in production
    sameSite: 'strict' // Prevents the cookie from being sent in cross-site requests
  }
}));

// Flash messages middleware
app.use(flash());

// Import routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const customerRoutes = require('./routes/customerRoutes');
const billRoutes = require('./routes/billRoutes');
const statisticsRoutes = require('./routes/statisticsRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const returnRoutes = require('./routes/returnRoutes');
const gstRoutes = require('./routes/gstRoutes');
const testRoutes = require('./routes/testRoutes');

// Use routes
app.use('/', authRoutes);
app.use('/', productRoutes);
app.use('/', customerRoutes);
app.use('/', billRoutes);
app.use('/', statisticsRoutes);
app.use('/', inventoryRoutes);
app.use('/', returnRoutes);
app.use('/', gstRoutes);
app.use('/test', testRoutes);

// Root route redirect to login or dashboard
app.get('/', (req, res) => {
  if (req.session.isAuthenticated || req.cookies.token) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/login');
  }
});

// 404 route
app.use((req, res) => {
  res.status(404).render('404', {
    title: '404 - Page Not Found',
    error: 'Page not found',
    success: ''
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    title: 'Error',
    error: 'Something went wrong',
    success: ''
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
