const express = require('express');
const router = express.Router();
const editorController = require('../controllers/editorController');
const { optionalAuth } = require('../middleware/authMiddleware');

// Apply visual additions (text, shapes, whiteout, signatures)
router.post('/apply', optionalAuth, editorController.applyElements);

// Create interactive AcroForm fields
router.post('/create-forms', optionalAuth, editorController.createForms);

// Strip document annotations
router.post('/remove-annotations', optionalAuth, editorController.removeAnnotations);

module.exports = router;
