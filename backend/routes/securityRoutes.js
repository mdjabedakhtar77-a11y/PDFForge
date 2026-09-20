const express = require('express');
const router = express.Router();
const securityController = require('../controllers/securityController');
const { optionalAuth } = require('../middleware/authMiddleware');

// Check encryption status
router.get('/status/:id', optionalAuth, securityController.checkStatus);

// Protect PDF with password
router.post('/protect', optionalAuth, securityController.protect);

// Unlock PDF with password
router.post('/unlock', optionalAuth, securityController.unlock);

// Watermark PDF
router.post('/watermark', optionalAuth, securityController.watermark);

module.exports = router;
