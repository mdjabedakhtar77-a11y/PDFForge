const AdminService = require('../services/adminService');
const ProcessingJob = require('../models/ProcessingJob');

class AdminController {
  /**
   * GET /api/admin/metrics
   */
  static async getMetrics(req, res) {
    try {
      const metrics = await AdminService.getOverviewMetrics();
      return res.status(200).json({
        success: true,
        metrics
      });
    } catch (err) {
      console.error('[AdminController.getMetrics] Error:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve administrative metrics'
      });
    }
  }

  /**
   * GET /api/admin/users
   */
  static async getUsers(req, res) {
    try {
      const { page = 1, limit = 10, search = '', role = '', status = '' } = req.query;
      const result = await AdminService.getUsersList({
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 10,
        search,
        role,
        status
      });

      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (err) {
      console.error('[AdminController.getUsers] Error:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve users'
      });
    }
  }

  /**
   * GET /api/admin/users/:id
   */
  static async getUserDetails(req, res) {
    try {
      const { id } = req.params;
      const details = await AdminService.getUserDetails(id);
      if (!details) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      return res.status(200).json({
        success: true,
        details
      });
    } catch (err) {
      console.error('[AdminController.getUserDetails] Error:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve user details'
      });
    }
  }

  /**
   * PUT /api/admin/users/:id/status
   */
  static async updateUserStatus(req, res) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      if (isActive === undefined) {
        return res.status(400).json({
          success: false,
          error: 'isActive boolean is required'
        });
      }

      const updatedUser = await AdminService.setUserStatus(
        req.user,
        id,
        Boolean(isActive),
        req.ip || req.connection.remoteAddress
      );

      return res.status(200).json({
        success: true,
        message: `User account successfully ${isActive ? 'enabled' : 'disabled'}`,
        user: updatedUser
      });
    } catch (err) {
      console.error('[AdminController.updateUserStatus] Error:', err);
      const statusCode = err.message.includes('cannot change their own') ? 400 : 500;
      return res.status(statusCode).json({
        success: false,
        error: err.message || 'Failed to update user status'
      });
    }
  }

  /**
   * PUT /api/admin/users/:id/role
   */
  static async updateUserRole(req, res) {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!role || !['USER', 'ADMIN'].includes(role.toUpperCase())) {
        return res.status(400).json({
          success: false,
          error: 'Valid role (USER or ADMIN) is required'
        });
      }

      const updatedUser = await AdminService.setUserRole(
        req.user,
        id,
        role.toUpperCase(),
        req.ip || req.connection.remoteAddress
      );

      return res.status(200).json({
        success: true,
        message: `User role successfully updated to ${role.toUpperCase()}`,
        user: updatedUser
      });
    } catch (err) {
      console.error('[AdminController.updateUserRole] Error:', err);
      const statusCode = err.message.includes('cannot alter their own') ? 400 : 500;
      return res.status(statusCode).json({
        success: false,
        error: err.message || 'Failed to update user role'
      });
    }
  }

  /**
   * GET /api/admin/jobs
   */
  static async getJobs(req, res) {
    try {
      const { page = 1, limit = 20, status, tool, search } = req.query;
      const result = await AdminService.getJobsExplorer({
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 20,
        status,
        tool,
        search
      });

      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (err) {
      console.error('[AdminController.getJobs] Error:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve processing jobs'
      });
    }
  }

  /**
   * GET /api/admin/jobs/failed
   */
  static async getRecentFailures(req, res) {
    try {
      const limit = parseInt(req.query.limit, 10) || 10;
      const failures = await ProcessingJob.getRecentFailures(limit);
      return res.status(200).json({
        success: true,
        failures
      });
    } catch (err) {
      console.error('[AdminController.getRecentFailures] Error:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve recent failures'
      });
    }
  }

  /**
   * GET /api/admin/audit-logs
   */
  static async getAuditLogs(req, res) {
    try {
      const { page = 1, limit = 20, action, userId } = req.query;
      const result = await AdminService.getAuditTrail({
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 20,
        action,
        userId
      });

      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (err) {
      console.error('[AdminController.getAuditLogs] Error:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve audit logs'
      });
    }
  }

  /**
   * GET /api/admin/system-health
   */
  static async getSystemHealth(req, res) {
    try {
      const health = AdminService.getSystemHealth();
      return res.status(200).json({
        success: true,
        health
      });
    } catch (err) {
      console.error('[AdminController.getSystemHealth] Error:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve system health'
      });
    }
  }
}

module.exports = AdminController;
