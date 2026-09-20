const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const upload = require('../middleware/uploadMiddleware');
const { optionalAuth, requireAuth } = require('../middleware/authMiddleware');

// Upload file (supports both authenticated users and guests)
router.post('/upload', optionalAuth, upload.single('file'), fileController.uploadFile);

// Get file metadata
router.get('/:id', optionalAuth, fileController.getFileInfo);

// Inline PDF viewing for PDF.js
router.get('/:id/view', optionalAuth, fileController.streamFile);

// Download file
router.get('/:id/download', optionalAuth, fileController.downloadFile);

// Delete file
router.delete('/:id', optionalAuth, fileController.deleteFile);

module.exports = router;
