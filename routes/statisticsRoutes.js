const express = require('express');
const router = express.Router();
const statisticsController = require('../controllers/statisticsController');
const { isAuthenticated } = require('../middleware/auth');

// Statistics routes
router.get('/statistics', isAuthenticated, statisticsController.getStatistics);

module.exports = router;
