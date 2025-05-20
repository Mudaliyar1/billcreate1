const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { isAuthenticated } = require('../middleware/auth');

// Product routes
router.get('/products', isAuthenticated, productController.getProducts);
router.get('/products/add', isAuthenticated, productController.getAddProduct);
router.post('/products/add', isAuthenticated, productController.postAddProduct);
router.get('/products/edit/:id', isAuthenticated, productController.getEditProduct);
router.post('/products/edit/:id', isAuthenticated, productController.postEditProduct);
router.get('/products/delete/:id', isAuthenticated, productController.deleteProduct);

// API routes
router.get('/api/products/category/:category', isAuthenticated, productController.getProductsByCategory);

// Special route for bill creation - doesn't require authentication check
router.get('/api/bill-products/category/:category', productController.getProductsByCategory);

module.exports = router;
