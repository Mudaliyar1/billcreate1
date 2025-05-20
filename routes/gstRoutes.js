const express = require('express');
const router = express.Router();
const gstController = require('../controllers/gstController');
const { isAuthenticated } = require('../middleware/auth');

// GST routes
router.get('/gst', isAuthenticated, gstController.getGstRates);
router.get('/gst/create', isAuthenticated, gstController.getCreateGstRate);
router.post('/gst/create', isAuthenticated, gstController.postCreateGstRate);
router.get('/gst/:id/edit', isAuthenticated, gstController.getEditGstRate);
router.post('/gst/:id/edit', isAuthenticated, gstController.updateGstRate);
router.get('/gst/:id/delete', isAuthenticated, gstController.deleteGstRate);

// API routes
router.get('/api/gst', isAuthenticated, gstController.apiGetGstRates);

module.exports = router;
