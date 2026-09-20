const { query } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class ProcessingJob {
  static async create({
    user_id = null,
    tool_name,
    status = 'QUEUED',
    input_file_id = null,
    output_file_id = null,
    metadata = {}
  }) {
    const id = uuidv4();
    const sql = `
      INSERT INTO processing_jobs (
        id, user_id, tool_name, status, input_file_id, output_file_id, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await query(sql, [
      id,
      user_id,
      tool_name,
      status,
      input_file_id,
      output_file_id,
      JSON.stringify(metadata)
    ]);
    return this.findById(id);
  }

  static async findById(id) {
    const sql = `SELECT * FROM processing_jobs WHERE id = ? LIMIT 1`;
    const [rows] = await query(sql, [id]);
    if (!rows || rows.length === 0) return null;
    const job = rows[0];
    if (typeof job.metadata === 'string') {
      try {
        job.metadata = JSON.parse(job.metadata);
      } catch (e) {
        job.metadata = {};
      }
    }
    return job;
  }

  static async updateStatus(id, { status, output_file_id = null, error_message = null }) {
    const completed_at = ['COMPLETED', 'FAILED'].includes(status) ? new Date() : null;
    const sql = `
      UPDATE processing_jobs 
      SET status = ?, output_file_id = COALESCE(?, output_file_id), error_message = ?, completed_at = ?
      WHERE id = ?
    `;
    await query(sql, [status, output_file_id, error_message, completed_at, id]);
    return this.findById(id);
  }

  static async findByUserId(userId) {
    const sql = `SELECT * FROM processing_jobs WHERE user_id = ? ORDER BY created_at DESC`;
    const [rows] = await query(sql, [userId]);
    return rows || [];
  }

  static async findByUserIdWithDetails(userId, { page = 1, limit = 10, status = null, tool = null } = {}) {
    const FileModel = require('./File');
    const allJobs = await this.findByUserId(userId);
    let filtered = allJobs;
    if (status && status.trim()) {
      filtered = filtered.filter(j => (j.status || '').toUpperCase() === status.trim().toUpperCase());
    }
    if (tool && tool.trim()) {
      filtered = filtered.filter(j => (j.tool_name || '').toLowerCase() === tool.trim().toLowerCase());
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const total = filtered.length;
    const startIndex = (pageNum - 1) * limitNum;
    const paged = filtered.slice(startIndex, startIndex + limitNum);

    const detailedJobs = await Promise.all(paged.map(async (job) => {
      let inputFile = null;
      let outputFile = null;
      if (job.input_file_id) {
        inputFile = await FileModel.findById(job.input_file_id);
      }
      if (job.output_file_id) {
        outputFile = await FileModel.findById(job.output_file_id);
      }

      let parsedMeta = job.metadata;
      if (typeof parsedMeta === 'string') {
        try {
          parsedMeta = JSON.parse(parsedMeta);
        } catch (e) {
          parsedMeta = {};
        }
      }

      return {
        id: job.id,
        tool_name: job.tool_name,
        status: job.status,
        error_message: job.error_message,
        metadata: parsedMeta || {},
        created_at: job.created_at,
        completed_at: job.completed_at,
        input_file: inputFile ? {
          id: inputFile.id,
          original_name: inputFile.original_name,
          file_size: inputFile.file_size,
          mime_type: inputFile.mime_type
        } : null,
        output_file: outputFile ? {
          id: outputFile.id,
          original_name: outputFile.original_name,
          file_size: outputFile.file_size,
          mime_type: outputFile.mime_type,
          download_url: `/api/files/download/${outputFile.id}`
        } : null
      };
    }));

    return {
      jobs: detailedJobs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.max(1, Math.ceil(total / limitNum))
      }
    };
  }

  static async getGlobalStats() {
    const sql = `SELECT * FROM processing_jobs`;
    const [rows] = await query(sql, []);
    const allJobs = rows || [];

    const totalJobs = allJobs.length;
    const completedJobs = allJobs.filter(j => j.status === 'COMPLETED').length;
    const failedJobs = allJobs.filter(j => j.status === 'FAILED').length;
    const activeJobs = allJobs.filter(j => ['QUEUED', 'PROCESSING'].includes(j.status)).length;
    const successRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 1000) / 10 : 100;

    // Tool frequency aggregation
    const toolCounts = {};
    for (const j of allJobs) {
      const tool = j.tool_name || 'unknown';
      toolCounts[tool] = (toolCounts[tool] || 0) + 1;
    }

    const mostUsedTools = Object.entries(toolCounts)
      .map(([tool_name, count]) => ({ tool_name, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalJobs,
      completedJobs,
      failedJobs,
      activeJobs,
      successRate,
      mostUsedTools
    };
  }

  static async findAllAdminPaginated({ page = 1, limit = 20, status = null, tool = null, search = '' } = {}) {
    const FileModel = require('./File');
    const User = require('./User');
    const sql = `SELECT * FROM processing_jobs ORDER BY created_at DESC`;
    const [rows] = await query(sql, []);
    let filtered = rows || [];

    if (status && status.trim()) {
      filtered = filtered.filter(j => (j.status || '').toUpperCase() === status.trim().toUpperCase());
    }
    if (tool && tool.trim()) {
      filtered = filtered.filter(j => (j.tool_name || '').toLowerCase() === tool.trim().toLowerCase());
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(j =>
        (j.id || '').toLowerCase().includes(q) ||
        (j.tool_name || '').toLowerCase().includes(q) ||
        (j.error_message || '').toLowerCase().includes(q)
      );
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const total = filtered.length;
    const startIndex = (pageNum - 1) * limitNum;
    const paged = filtered.slice(startIndex, startIndex + limitNum);

    const detailedJobs = await Promise.all(paged.map(async (job) => {
      let inputFile = null;
      let outputFile = null;
      let userEmail = 'Guest / Anonymous';

      if (job.input_file_id) {
        inputFile = await FileModel.findById(job.input_file_id);
      }
      if (job.output_file_id) {
        outputFile = await FileModel.findById(job.output_file_id);
      }
      if (job.user_id) {
        const u = await User.findById(job.user_id);
        if (u) userEmail = u.email;
      }

      let parsedMeta = job.metadata;
      if (typeof parsedMeta === 'string') {
        try {
          parsedMeta = JSON.parse(parsedMeta);
        } catch (e) {
          parsedMeta = {};
        }
      }

      return {
        id: job.id,
        user_id: job.user_id,
        user_email: userEmail,
        tool_name: job.tool_name,
        status: job.status,
        error_message: job.error_message,
        metadata: parsedMeta || {},
        created_at: job.created_at,
        completed_at: job.completed_at,
        input_file: inputFile ? {
          id: inputFile.id,
          original_name: inputFile.original_name,
          file_size: inputFile.file_size
        } : null,
        output_file: outputFile ? {
          id: outputFile.id,
          original_name: outputFile.original_name,
          file_size: outputFile.file_size,
          download_url: `/api/files/download/${outputFile.id}`
        } : null
      };
    }));

    return {
      jobs: detailedJobs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.max(1, Math.ceil(total / limitNum))
      }
    };
  }

  static async getRecentFailures(limit = 10) {
    const User = require('./User');
    const sql = `SELECT * FROM processing_jobs ORDER BY created_at DESC`;
    const [rows] = await query(sql, []);
    const failedJobs = (rows || []).filter(j => j.status === 'FAILED').slice(0, limit);

    return Promise.all(failedJobs.map(async (job) => {
      let userEmail = 'Guest';
      if (job.user_id) {
        const u = await User.findById(job.user_id);
        if (u) userEmail = u.email;
      }
      return {
        id: job.id,
        tool_name: job.tool_name,
        user_id: job.user_id,
        user_email: userEmail,
        error_message: job.error_message || 'Unknown processing failure',
        created_at: job.created_at
      };
    }));
  }
}

module.exports = ProcessingJob;
