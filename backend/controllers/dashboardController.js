const bcrypt = require('bcryptjs');
const DashboardService = require('../services/dashboardService');
const FileModel = require('../models/File');
const ProcessingJob = require('../models/ProcessingJob');
const User = require('../models/User');

class DashboardController {
  /**
   * GET /api/dashboard/summary
   */
  static async getSummary(req, res) {
    try {
      const summary = await DashboardService.getDashboardSummary(req.user.id);
      return res.status(200).json({
        success: true,
        summary
      });
    } catch (err) {
      console.error('[DashboardController.getSummary] Error:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve dashboard summary'
      });
    }
  }

  /**
   * GET /api/dashboard/history
   */
  static async getHistory(req, res) {
    try {
      const { page = 1, limit = 10, status, tool } = req.query;
      const history = await ProcessingJob.findByUserIdWithDetails(req.user.id, {
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 10,
        status,
        tool
      });

      return res.status(200).json({
        success: true,
        ...history
      });
    } catch (err) {
      console.error('[DashboardController.getHistory] Error:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve processing history'
      });
    }
  }

  /**
   * GET /api/dashboard/files
   */
  static async getFiles(req, res) {
    try {
      const { page = 1, limit = 10, search = '' } = req.query;
      const result = await FileModel.findByUserIdPaginated(req.user.id, {
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 10,
        search
      });

      const formattedFiles = result.files.map(f => ({
        id: f.id,
        original_name: f.original_name,
        file_size: f.file_size,
        mime_type: f.mime_type,
        page_count: f.page_count,
        is_temporary: f.is_temporary,
        created_at: f.created_at,
        download_url: `/api/files/download/${f.id}`
      }));

      return res.status(200).json({
        success: true,
        files: formattedFiles,
        pagination: result.pagination
      });
    } catch (err) {
      console.error('[DashboardController.getFiles] Error:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve files'
      });
    }
  }

  /**
   * DELETE /api/dashboard/files/:id
   */
  static async deleteFile(req, res) {
    try {
      const { id } = req.params;
      const isAdmin = req.user.role === 'ADMIN';
      const result = await FileModel.deleteByIdAndUserId(id, req.user.id, isAdmin);

      if (result.notFound) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }

      if (result.forbidden) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: You do not have permission to delete this file'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'File deleted successfully'
      });
    } catch (err) {
      console.error('[DashboardController.deleteFile] Error:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete file'
      });
    }
  }

  /**
   * GET /api/dashboard/favorites
   */
  static async getFavorites(req, res) {
    try {
      const favorites = await User.getFavorites(req.user.id);
      return res.status(200).json({
        success: true,
        favorites
      });
    } catch (err) {
      console.error('[DashboardController.getFavorites] Error:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve favorites'
      });
    }
  }

  /**
   * POST /api/dashboard/favorites/toggle
   */
  static async toggleFavorite(req, res) {
    try {
      const { toolId } = req.body;
      if (!toolId || typeof toolId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'toolId is required'
        });
      }

      const result = await User.toggleFavorite(req.user.id, toolId.trim());
      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (err) {
      console.error('[DashboardController.toggleFavorite] Error:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to toggle favorite'
      });
    }
  }

  /**
   * GET /api/dashboard/profile
   */
  static async getProfile(req, res) {
    try {
      const [user, settings] = await Promise.all([
        User.findById(req.user.id),
        User.getSettings(req.user.id)
      ]);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      return res.status(200).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          created_at: user.created_at
        },
        settings
      });
    } catch (err) {
      console.error('[DashboardController.getProfile] Error:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve profile'
      });
    }
  }

  /**
   * PUT /api/dashboard/profile
   */
  static async updateProfile(req, res) {
    try {
      const { theme = 'system', language = 'en' } = req.body;
      const validThemes = ['light', 'dark', 'system'];
      const chosenTheme = validThemes.includes(theme.toLowerCase()) ? theme.toLowerCase() : 'system';

      const updatedSettings = await User.updateSettings(req.user.id, {
        theme: chosenTheme,
        language: (language || 'en').substring(0, 10)
      });

      return res.status(200).json({
        success: true,
        settings: updatedSettings
      });
    } catch (err) {
      console.error('[DashboardController.updateProfile] Error:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to update settings'
      });
    }
  }

  /**
   * POST /api/dashboard/change-password
   */
  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Both currentPassword and newPassword are required'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'New password must be at least 6 characters long'
        });
      }

      const user = await User.findWithPasswordById(req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const matches = await bcrypt.compare(currentPassword, user.password_hash);
      if (!matches) {
        return res.status(400).json({
          success: false,
          error: 'Current password is incorrect'
        });
      }

      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(newPassword, salt);

      await User.updatePassword(req.user.id, newHash);

      return res.status(200).json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (err) {
      console.error('[DashboardController.changePassword] Error:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to change password'
      });
    }
  }

  /**
   * POST /api/dashboard/cleanup
   */
  static async cleanup(req, res) {
    try {
      const { expiryHours = 24 } = req.body;
      const result = await DashboardService.cleanupExpiredFiles(Number(expiryHours) || 24);
      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (err) {
      console.error('[DashboardController.cleanup] Error:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to clean up files'
      });
    }
  }
}

module.exports = DashboardController;
