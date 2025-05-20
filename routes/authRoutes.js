const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { isAuthenticated, isNotAuthenticated } = require('../middleware/auth');

// Login routes
router.get('/login', isNotAuthenticated, authController.getLogin);
router.post('/login', isNotAuthenticated, authController.postLogin);

// Logout route
router.get('/logout', isAuthenticated, authController.logout);

// Dashboard route
router.get('/dashboard', isAuthenticated, authController.getDashboard);

module.exports = router;
