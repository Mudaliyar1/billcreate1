const express = require('express');
const router = express.Router();
const billController = require('../controllers/billController');
const { isAuthenticated } = require('../middleware/auth');

// Bill routes
router.get('/bills/create', isAuthenticated, billController.getCreateBill);
router.post('/bills/create', isAuthenticated, billController.postCreateBill);
router.get('/bills', isAuthenticated, billController.getBills);

// Bill edit and delete routes - must come before /:id route
router.get('/bills/:id/edit', isAuthenticated, billController.getEditBill);
router.post('/bills/:id/edit', isAuthenticated, billController.updateBill);
router.get('/bills/:id/delete', isAuthenticated, billController.deleteBill);
router.get('/bills/:id/download', isAuthenticated, billController.downloadBill);

// Bill details route
router.get('/bills/:id', isAuthenticated, billController.getBillDetails);

// API routes
router.get('/api/customer-purchases/:phone', isAuthenticated, billController.getCustomerPurchaseHistory);

module.exports = router;
