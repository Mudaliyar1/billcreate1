const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { ensureAdmin } = require('../middleware/auth');

// Product routes
router.get('/products', ensureAdmin, productController.getProducts);
router.get('/products/add', ensureAdmin, productController.getAddProduct);
router.post('/products/add', ensureAdmin, productController.postAddProduct);
router.get('/products/edit/:id', ensureAdmin, productController.getEditProduct);
router.post('/products/edit/:id', ensureAdmin, productController.postEditProduct);
router.get('/products/delete/:id', ensureAdmin, productController.deleteProduct);

// API routes
router.get('/api/products/category/:category', ensureAdmin, productController.getProductsByCategory);

// Special route for bill creation - doesn't require authentication check
router.get('/api/bill-products/category/:category', productController.getProductsByCategory);

module.exports = router;
