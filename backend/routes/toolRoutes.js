const express = require('express');
const router = express.Router();
const toolController = require('../controllers/toolController');

// List all tools or filter by category
router.get('/', toolController.getAllTools);

// Get specific tool metadata
router.get('/:id', toolController.getToolById);

module.exports = router;
