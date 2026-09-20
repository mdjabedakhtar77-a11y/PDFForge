const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const DashboardController = require('../controllers/dashboardController');

// All dashboard endpoints require strict authentication
router.use(requireAuth);

// Summary metrics & overview
router.get('/summary', DashboardController.getSummary);

// Processing job history (paginated, filterable)
router.get('/history', DashboardController.getHistory);

// User files (paginated, searchable)
router.get('/files', DashboardController.getFiles);

// Secure file deletion with user ownership check
router.delete('/files/:id', DashboardController.deleteFile);

// User favorites
router.get('/favorites', DashboardController.getFavorites);
router.post('/favorites/toggle', DashboardController.toggleFavorite);

// User profile & preferences
router.get('/profile', DashboardController.getProfile);
router.put('/profile', DashboardController.updateProfile);

// Password update with BCrypt verification
router.post('/change-password', DashboardController.changePassword);

// Automated cleanup of expired temporary files
router.post('/cleanup', DashboardController.cleanup);

module.exports = router;
