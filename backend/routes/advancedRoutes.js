const express = require('express');
const router = express.Router();
const advancedController = require('../controllers/advancedController');
const { optionalAuth } = require('../middleware/authMiddleware');

// 1. Alternate & Mix
router.post('/alternate-mix', optionalAuth, advancedController.alternateAndMix);

// 2. Split By Bookmarks
router.post('/split-bookmarks', optionalAuth, advancedController.splitByBookmarks);

// 3. Split By Size
router.post('/split-by-size', optionalAuth, advancedController.splitBySize);

// 4. Split By Text
router.post('/split-by-text', optionalAuth, advancedController.splitByText);

// 5. Bates Numbering
router.post('/bates', optionalAuth, advancedController.bates);

// 6. Create Bookmarks
router.post('/bookmarks', optionalAuth, advancedController.bookmarks);

// 7. Edit Metadata
router.post('/metadata', optionalAuth, advancedController.metadata);

// 8. Extract Images
router.post('/extract-images', optionalAuth, advancedController.extractImages);

// 9. Flip Pages
router.post('/flip', optionalAuth, advancedController.flip);

// 10. Header & Footer
router.post('/header-footer', optionalAuth, advancedController.headerFooter);

// 11. N-Up
router.post('/n-up', optionalAuth, advancedController.nUp);

// 12. Page Numbers
router.post('/page-numbers', optionalAuth, advancedController.pageNumbers);

// 13. Rename
router.post('/suggest-name', optionalAuth, advancedController.suggestName);
router.post('/rename', optionalAuth, advancedController.rename);

// 14. Repair
router.post('/repair', optionalAuth, advancedController.repair);

module.exports = router;
