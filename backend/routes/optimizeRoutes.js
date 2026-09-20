const express = require('express');
const router = express.Router();
const optimizeController = require('../controllers/optimizeController');
const { optionalAuth } = require('../middleware/authMiddleware');

// 1. Compression
router.post('/compress', optionalAuth, optimizeController.compress);

// 2. OCR Searchable PDF
router.post('/ocr', optionalAuth, optimizeController.ocr);

// 3. Deskew scanned pages
router.post('/deskew', optionalAuth, optimizeController.deskew);

// 4. Grayscale
router.post('/grayscale', optionalAuth, optimizeController.grayscale);

// 5. Flatten form fields & annotations
router.post('/flatten', optionalAuth, optimizeController.flatten);

// 6. Job status check
router.get('/jobs/:jobId', optionalAuth, optimizeController.getJobStatus);

module.exports = router;
