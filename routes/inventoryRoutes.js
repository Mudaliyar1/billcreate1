const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { isAuthenticated } = require('../middleware/auth');

// Inventory routes
router.get('/inventory', isAuthenticated, inventoryController.getInventoryDashboard);
router.get('/inventory/report', isAuthenticated, inventoryController.getInventoryReport);
router.post('/inventory/update-quantity/:id', isAuthenticated, inventoryController.updateProductQuantity);
router.get('/inventory/reset-financial-data', isAuthenticated, inventoryController.resetFinancialData);

module.exports = router;
