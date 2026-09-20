const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const AdminController = require('../controllers/adminController');

// Every admin route strictly requires valid JWT + ADMIN role
router.use(requireAuth);
router.use(requireAdmin);

// Overview metrics & KPIs
router.get('/metrics', AdminController.getMetrics);
router.get('/overview', AdminController.getMetrics);
router.get('/analytics', AdminController.getMetrics);

// User Governance
router.get('/users', AdminController.getUsers);
router.get('/users/:id', AdminController.getUserDetails);
router.put('/users/:id/status', AdminController.updateUserStatus);
router.patch('/users/:id/status', AdminController.updateUserStatus);
router.put('/users/:id/role', AdminController.updateUserRole);
router.patch('/users/:id/role', AdminController.updateUserRole);

// Operations & Failure Explorer
router.get('/jobs', AdminController.getJobs);
router.get('/jobs/failed', AdminController.getRecentFailures);

// Audit Logging Trail
router.get('/audit-logs', AdminController.getAuditLogs);
router.get('/audit', AdminController.getAuditLogs);

// System Telemetry & Health
router.get('/system-health', AdminController.getSystemHealth);
router.get('/system', AdminController.getSystemHealth);

module.exports = router;
