const os = require('os');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const ProcessingJob = require('../models/ProcessingJob');
const FileModel = require('../models/File');
const AuditLog = require('../models/AuditLog');
const { UPLOAD_DIR, RESULTS_DIR } = require('./storageService');

class AdminService {
  /**
   * Get comprehensive dashboard metrics & KPI analytics
   */
  static async getOverviewMetrics() {
    const [userStats, jobStats, storageStats, recentFailures] = await Promise.all([
      User.getGlobalStats(),
      ProcessingJob.getGlobalStats(),
      FileModel.getGlobalStorageStats(),
      ProcessingJob.getRecentFailures(5)
    ]);

    return {
      totalUsers: userStats.totalUsers,
      totalJobs: jobStats.totalJobs,
      users: userStats,
      jobs: jobStats,
      storage: storageStats,
      recentFailures
    };
  }

  /**
   * Get real-time system and process health telemetry
   */
  static getSystemHealth() {
    const memUsage = process.memoryUsage();
    const uptimeSeconds = Math.floor(process.uptime());
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    // Calculate temp folder storage footprint
    let uploadFilesCount = 0;
    let resultsFilesCount = 0;
    try {
      if (fs.existsSync(UPLOAD_DIR)) uploadFilesCount = fs.readdirSync(UPLOAD_DIR).length;
      if (fs.existsSync(RESULTS_DIR)) resultsFilesCount = fs.readdirSync(RESULTS_DIR).length;
    } catch (e) {}

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      process: {
        nodeVersion: process.version,
        uptimeSeconds,
        uptimeFormatted: this.formatUptime(uptimeSeconds),
        pid: process.pid,
        platform: process.platform,
        arch: process.arch
      },
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
        external: memUsage.external,
        heapUsedFormatted: this.formatBytes(memUsage.heapUsed),
        rssFormatted: this.formatBytes(memUsage.rss)
      },
      system: {
        cpus: os.cpus() ? os.cpus().length : 1,
        totalMemory: totalMem,
        freeMemory: freeMem,
        memoryUsagePercentage: Math.round(((totalMem - freeMem) / totalMem) * 100),
        loadAverage: os.loadavg ? os.loadavg() : [0, 0, 0]
      },
      storage: {
        uploadFilesCount,
        resultsFilesCount
      }
    };
  }

  /**
   * Format uptime into human-readable string
   */
  static formatUptime(seconds) {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  }

  /**
   * Format byte count
   */
  static formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Paginated user list with search & filters
   */
  static async getUsersList(query) {
    return User.findAllPaginated(query);
  }

  /**
   * Get detailed profile for a single user
   */
  static async getUserDetails(userId) {
    const user = await User.findById(userId);
    if (!user) return null;

    const [storage, userFiles, recentJobs, favorites, settings] = await Promise.all([
      FileModel.getStorageStats(userId),
      FileModel.findByUserId(userId),
      ProcessingJob.findByUserIdWithDetails(userId, { page: 1, limit: 10 }),
      User.getFavorites(userId),
      User.getSettings(userId)
    ]);

    return {
      user,
      storage,
      filesCount: userFiles.length,
      recentFiles: userFiles.slice(0, 5),
      recentJobs: recentJobs.jobs,
      favorites,
      settings
    };
  }

  /**
   * Toggle user active/disabled status
   */
  static async setUserStatus(adminUser, targetUserId, isActive, ipAddress) {
    if (adminUser.id === targetUserId) {
      throw new Error('Administrators cannot change their own account status.');
    }

    const target = await User.findById(targetUserId);
    if (!target) {
      throw new Error('Target user not found.');
    }

    const updated = await User.updateStatus(targetUserId, isActive);

    await AuditLog.log({
      userId: adminUser.id,
      action: isActive ? 'USER_ACCOUNT_ENABLED' : 'USER_ACCOUNT_DISABLED',
      entityType: 'USER',
      entityId: targetUserId,
      details: {
        adminEmail: adminUser.email,
        targetEmail: target.email,
        previousStatus: target.is_active,
        newStatus: isActive
      },
      ipAddress
    });

    return updated;
  }

  /**
   * Update user role (USER / ADMIN)
   */
  static async setUserRole(adminUser, targetUserId, newRole, ipAddress) {
    if (adminUser.id === targetUserId) {
      throw new Error('Administrators cannot alter their own role.');
    }

    const target = await User.findById(targetUserId);
    if (!target) {
      throw new Error('Target user not found.');
    }

    const updated = await User.updateRole(targetUserId, newRole);

    await AuditLog.log({
      userId: adminUser.id,
      action: 'USER_ROLE_CHANGED',
      entityType: 'USER',
      entityId: targetUserId,
      details: {
        adminEmail: adminUser.email,
        targetEmail: target.email,
        previousRole: target.role,
        newRole
      },
      ipAddress
    });

    return updated;
  }

  /**
   * Searchable operations explorer across all users
   */
  static async getJobsExplorer(query) {
    return ProcessingJob.findAllAdminPaginated(query);
  }

  /**
   * Audit log feed
   */
  static async getAuditTrail(query) {
    return AuditLog.findAllPaginated(query);
  }
}

module.exports = AdminService;
