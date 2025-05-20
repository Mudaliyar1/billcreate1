const express = require('express');
const router = express.Router();
const returnController = require('../controllers/returnController');
const { isAuthenticated } = require('../middleware/auth');

// Return management dashboard
router.get('/returns', isAuthenticated, returnController.getReturnManagement);

// Return statistics
router.get('/returns/statistics', isAuthenticated, returnController.getReturnStatistics);
router.get('/returns/statistics/api', isAuthenticated, returnController.getReturnStatisticsAPI);

// Bill selection for return creation
router.get('/returns/select-bill', isAuthenticated, returnController.getSelectBill);

// Return bill creation
router.get('/returns/create', isAuthenticated, returnController.getCreateReturnBill);
router.post('/returns/create', isAuthenticated, returnController.postCreateReturnBill);

// Return bill edit and delete routes - must come before /:id route
router.get('/returns/:id/edit', isAuthenticated, returnController.getEditReturnBill);
router.post('/returns/:id/edit', isAuthenticated, returnController.updateReturnBill);
router.get('/returns/:id/delete', isAuthenticated, returnController.deleteReturnBill);
router.get('/returns/:id/download', isAuthenticated, returnController.downloadReturnBill);

// Return bill details route
router.get('/returns/:id', isAuthenticated, returnController.getReturnBillDetails);

module.exports = router;
