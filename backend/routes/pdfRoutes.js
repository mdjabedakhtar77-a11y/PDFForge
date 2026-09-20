const express = require('express');
const router = express.Router();
const pdfOperations = require('../controllers/pdfOperationsController');
const { optionalAuth } = require('../middleware/authMiddleware');

// 1. Merge
router.post('/merge', optionalAuth, pdfOperations.mergePdfs);

// 2. Extract
router.post('/extract', optionalAuth, pdfOperations.extractPages);

// 3. Split
router.post('/split', optionalAuth, pdfOperations.splitPdf);

// 4. Delete Pages
router.post('/delete-pages', optionalAuth, pdfOperations.deletePages);

// 5. Organize
router.post('/organize', optionalAuth, pdfOperations.organizePages);

// 6. Rotate
router.post('/rotate', optionalAuth, pdfOperations.rotatePages);

// 7. Crop
router.post('/crop', optionalAuth, pdfOperations.cropPages);

// 8. Resize
router.post('/resize', optionalAuth, pdfOperations.resizePages);

// 9. Split in Half
router.post('/split-half', optionalAuth, pdfOperations.splitInHalf);

module.exports = router;
