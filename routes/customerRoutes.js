const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { isAuthenticated } = require('../middleware/auth');

// Customer routes
router.get('/customers', isAuthenticated, customerController.getCustomers);

// Add customer routes - must come before /:id route
router.get('/customers/add', isAuthenticated, customerController.getAddCustomer);
router.post('/customers/add', isAuthenticated, customerController.postAddCustomer);

// Customer edit and delete routes - must come before /:id route
router.get('/customers/:id/edit', isAuthenticated, customerController.getEditCustomer);
router.post('/customers/:id/edit', isAuthenticated, customerController.updateCustomer);
router.get('/customers/:id/delete', isAuthenticated, customerController.getDeleteCustomerConfirmation);
router.post('/customers/:id/delete', isAuthenticated, customerController.deleteCustomer);

// Customer details route
router.get('/customers/:id', isAuthenticated, customerController.getCustomerDetails);

// API routes
router.get('/api/customers/search', isAuthenticated, customerController.searchCustomers);

module.exports = router;
