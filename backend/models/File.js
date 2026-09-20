const fs = require('fs');
const { query } = require('../config/db');

class FileModel {
  static async create({
    id,
    user_id = null,
    original_name,
    stored_name,
    mime_type = 'application/pdf',
    file_size,
    page_count = 1,
    storage_path,
    is_temporary = true,
    expires_at = null
  }) {
    const sql = `
      INSERT INTO files (
        id, user_id, original_name, stored_name, mime_type, file_size, page_count, storage_path, is_temporary, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await query(sql, [
      id, user_id, original_name, stored_name, mime_type, file_size, page_count, storage_path, is_temporary, expires_at
    ]);
    return this.findById(id);
  }

  static async findById(id) {
    const sql = `SELECT * FROM files WHERE id = ? LIMIT 1`;
    const [rows] = await query(sql, [id]);
    return rows && rows.length > 0 ? rows[0] : null;
  }

  static async findByUserId(userId) {
    const sql = `SELECT * FROM files WHERE user_id = ? ORDER BY created_at DESC`;
    const [rows] = await query(sql, [userId]);
    return rows || [];
  }

  static async findByUserIdPaginated(userId, { page = 1, limit = 10, search = '' } = {}) {
    const allFiles = await this.findByUserId(userId);
    let filtered = allFiles;
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(f => (f.original_name || '').toLowerCase().includes(q));
    }
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const total = filtered.length;
    const startIndex = (pageNum - 1) * limitNum;
    const files = filtered.slice(startIndex, startIndex + limitNum);

    return {
      files,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.max(1, Math.ceil(total / limitNum))
      }
    };
  }

  static async getStorageStats(userId) {
    const sql = `SELECT COALESCE(SUM(file_size), 0) AS total_bytes, COUNT(id) AS total_files FROM files WHERE user_id = ?`;
    const [rows] = await query(sql, [userId]);
    const totalBytes = rows && rows[0] ? Number(rows[0].total_bytes || 0) : 0;
    const totalFiles = rows && rows[0] ? Number(rows[0].total_files || 0) : 0;
    const quotaBytes = 500 * 1024 * 1024; // 500 MB default free quota
    const usagePercentage = quotaBytes > 0 ? Math.min(100, Math.round((totalBytes / quotaBytes) * 1000) / 10) : 0;

    return {
      totalBytes,
      totalFiles,
      quotaBytes,
      usagePercentage
    };
  }

  static async getGlobalStorageStats() {
    const sql = `SELECT COALESCE(SUM(file_size), 0) AS total_bytes, COUNT(id) AS total_files FROM files`;
    const [rows] = await query(sql, []);
    const totalBytes = rows && rows[0] ? Number(rows[0].total_bytes || 0) : 0;
    const totalFiles = rows && rows[0] ? Number(rows[0].total_files || 0) : 0;

    return {
      totalBytes,
      totalFiles,
      avgFileSize: totalFiles > 0 ? Math.round(totalBytes / totalFiles) : 0
    };
  }

  static async deleteByIdAndUserId(id, userId, isAdmin = false) {
    const file = await this.findById(id);
    if (!file) {
      return { success: false, notFound: true };
    }
    if (file.user_id !== userId && !isAdmin) {
      return { success: false, forbidden: true };
    }

    // Attempt to remove physical file from storage
    if (file.storage_path) {
      try {
        if (fs.existsSync(file.storage_path)) {
          fs.unlinkSync(file.storage_path);
        }
      } catch (err) {
        console.warn(`[FileModel] Could not unlink file ${file.storage_path}:`, err.message);
      }
    }

    await this.delete(id);
    return { success: true, file };
  }

  static async cleanupExpired(expiryHours = 24) {
    const cutoffDate = new Date(Date.now() - expiryHours * 60 * 60 * 1000);
    // Select all files for in-memory or MySQL checking
    const sql = `SELECT * FROM files WHERE is_temporary = 1 AND (expires_at < NOW() OR created_at < ?)`;
    let candidates = [];
    try {
      const [rows] = await query(sql, [cutoffDate]);
      candidates = rows || [];
    } catch (e) {
      // Fallback
      candidates = [];
    }

    let deletedCount = 0;
    for (const file of candidates) {
      try {
        if (file.storage_path && fs.existsSync(file.storage_path)) {
          fs.unlinkSync(file.storage_path);
        }
      } catch (err) {
        // ignore unlink error
      }
      await this.delete(file.id);
      deletedCount++;
    }

    return { deletedCount };
  }

  static async delete(id) {
    const sql = `DELETE FROM files WHERE id = ?`;
    await query(sql, [id]);
    return true;
  }
}

module.exports = FileModel;

