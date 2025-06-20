const express = require('express');
const router = express.Router();
const billController = require('../controllers/billController');
const { ensureAdmin } = require('../middleware/auth');

// Bill routes
router.get('/bills/create', ensureAdmin, billController.getCreateBill);
router.post('/bills/create', ensureAdmin, billController.postCreateBill);
router.get('/bills', ensureAdmin, billController.getBills);
router.get('/bills/unknown', ensureAdmin, billController.getUnknownBills);

// Bill edit and delete routes - must come before /:id route
router.get('/bills/:id/edit', ensureAdmin, billController.getEditBill);
router.post('/bills/:id/edit', ensureAdmin, billController.updateBill);
router.get('/bills/:id/delete', ensureAdmin, billController.deleteBill);
router.get('/bills/:id/download', ensureAdmin, billController.downloadBill);

// Bill details route
router.get('/bills/:id', ensureAdmin, billController.getBillDetails);

// API routes
router.get('/api/customer-purchases/:phone', ensureAdmin, billController.getCustomerPurchaseHistory);

module.exports = router;
