const express = require('express');
const router = express.Router();
const statisticsController = require('../controllers/statisticsController');
const { isAuthenticated } = require('../middleware/auth');

// Statistics routes
router.get('/statistics', isAuthenticated, statisticsController.getStatistics);
router.get('/statistics/export', isAuthenticated, statisticsController.exportStatistics);
router.get('/statistics/daily', isAuthenticated, statisticsController.getDailyStatistics);
router.get('/statistics/api/daterange', isAuthenticated, statisticsController.getDateRangeStatistics);

module.exports = router;
