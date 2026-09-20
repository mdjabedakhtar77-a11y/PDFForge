const FileModel = require('../models/File');
const ProcessingJob = require('../models/ProcessingJob');
const User = require('../models/User');

class DashboardService {
  /**
   * Aggregate all metrics, recent files, recent jobs, and favorites for user dashboard
   * @param {string} userId 
   */
  static async getDashboardSummary(userId) {
    const [allJobs, storage, allFiles, favorites] = await Promise.all([
      ProcessingJob.findByUserId(userId),
      FileModel.getStorageStats(userId),
      FileModel.findByUserId(userId),
      User.getFavorites(userId)
    ]);

    const completedOps = allJobs.filter(j => j.status === 'COMPLETED').length;
    const failedOps = allJobs.filter(j => j.status === 'FAILED').length;
    const queuedOps = allJobs.filter(j => j.status === 'QUEUED' || j.status === 'PROCESSING').length;

    // Recent 5 files
    const recentFiles = allFiles.slice(0, 5).map(f => ({
      id: f.id,
      original_name: f.original_name,
      file_size: f.file_size,
      mime_type: f.mime_type,
      page_count: f.page_count,
      is_temporary: f.is_temporary,
      created_at: f.created_at,
      download_url: `/api/files/download/${f.id}`
    }));

    // Recent 5 jobs with details
    const recentJobsResult = await ProcessingJob.findByUserIdWithDetails(userId, { page: 1, limit: 5 });

    return {
      stats: {
        totalOperations: allJobs.length,
        completedOperations: completedOps,
        failedOperations: failedOps,
        activeOperations: queuedOps,
        totalFiles: storage.totalFiles,
        totalStorageBytes: storage.totalBytes,
        quotaBytes: storage.quotaBytes,
        usagePercentage: storage.usagePercentage
      },
      recentFiles,
      recentJobs: recentJobsResult.jobs,
      favoriteTools: favorites
    };
  }

  /**
   * Purge expired temporary files
   * @param {number} expiryHours 
   */
  static async cleanupExpiredFiles(expiryHours = 24) {
    return FileModel.cleanupExpired(expiryHours);
  }
}

module.exports = DashboardService;
