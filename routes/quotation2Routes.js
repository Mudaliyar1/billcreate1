const express = require('express');
const router = express.Router();
const quotation2Controller = require('../controllers/quotation2Controller');
const { isAuthenticated } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(isAuthenticated);

// Quotation 2.0 management routes
router.get('/quotations2', quotation2Controller.getQuotations2);
router.get('/quotations2/create', quotation2Controller.getCreateQuotation2);
router.post('/quotations2/create', quotation2Controller.postCreateQuotation2);
router.get('/quotations2/:id/edit', quotation2Controller.getEditQuotation2);
router.post('/quotations2/:id/edit', quotation2Controller.updateQuotation2);
router.get('/quotations2/:id/delete', quotation2Controller.deleteQuotation2);
router.get('/quotations2/:id/download', quotation2Controller.downloadQuotation2);
router.get('/quotations2/:id', quotation2Controller.getQuotation2Details);

module.exports = router;
