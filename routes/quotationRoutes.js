const express = require('express');
const router = express.Router();
const quotationController = require('../controllers/quotationController');
const quotationProductController = require('../controllers/quotationProductController');
const { isAuthenticated } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(isAuthenticated);

// Quotation management routes
router.get('/quotations', quotationController.getQuotations);
router.get('/quotations/create', quotationController.getCreateQuotation);
router.post('/quotations/create', quotationController.postCreateQuotation);
router.get('/quotations/:id/edit', quotationController.getEditQuotation);
router.post('/quotations/:id/edit', quotationController.updateQuotation);
router.get('/quotations/:id/delete', quotationController.deleteQuotation);
router.get('/quotations/:id/download', quotationController.downloadQuotation);
router.get('/quotations/:id', quotationController.getQuotationDetails);

// Quotation product management routes
router.get('/quotation-products', quotationProductController.getQuotationProducts);
router.get('/quotation-products/create', quotationProductController.getCreateQuotationProduct);
router.post('/quotation-products/create', quotationProductController.postCreateQuotationProduct);
router.get('/quotation-products/:id/edit', quotationProductController.getEditQuotationProduct);
router.post('/quotation-products/:id/edit', quotationProductController.updateQuotationProduct);
router.get('/quotation-products/:id/delete', quotationProductController.deleteQuotationProduct);

// API routes for quotation products
router.get('/api/quotation-products/all', quotationProductController.getAllQuotationProducts);
router.post('/api/quotation-products/seed', quotationProductController.seedTestProducts);

// Migration route (temporary - for fixing existing quotations)
router.get('/migrate/gst-field', quotationController.migrateGstField);

module.exports = router;
