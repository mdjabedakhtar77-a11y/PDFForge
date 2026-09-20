const { query } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class AuditLog {
  /**
   * Recursively sanitize sensitive keys from details object
   */
  static sanitizeDetails(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeDetails(item));
    }
    const sensitiveKeys = ['password', 'password_hash', 'currentpassword', 'newpassword', 'token', 'jwt', 'secret', 'authorization'];
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveKeys.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else if (value && typeof value === 'object') {
        sanitized[key] = this.sanitizeDetails(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * Log an administrative or sensitive system action
   */
  static async log({
    userId = null,
    action,
    entityType = null,
    entityId = null,
    details = {},
    ipAddress = null
  }) {
    const id = uuidv4();
    const cleanDetails = this.sanitizeDetails(details);
    const sql = `
      INSERT INTO audit_logs (
        id, user_id, action, entity_type, entity_id, details, ip_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await query(sql, [
      id,
      userId,
      action,
      entityType,
      entityId,
      JSON.stringify(cleanDetails),
      ipAddress
    ]);
    return this.findById(id);
  }

  static async logEvent({
    user_id = null,
    userId = null,
    action,
    resource_type = null,
    entityType = null,
    resource_id = null,
    entityId = null,
    details = {},
    ip_address = null,
    ipAddress = null
  }) {
    return this.log({
      userId: userId || user_id,
      action,
      entityType: entityType || resource_type,
      entityId: entityId || resource_id,
      details,
      ipAddress: ipAddress || ip_address
    });
  }

  static async findById(id) {
    const sql = `SELECT * FROM audit_logs WHERE id = ? LIMIT 1`;
    const [rows] = await query(sql, [id]);
    if (!rows || rows.length === 0) return null;
    const item = rows[0];
    if (typeof item.details === 'string') {
      try {
        item.details = JSON.parse(item.details);
      } catch (e) {
        item.details = {};
      }
    }
    return item;
  }

  static async findAllPaginated({ page = 1, limit = 20, action = null, userId = null } = {}) {
    const sql = `SELECT * FROM audit_logs ORDER BY created_at DESC`;
    const [rows] = await query(sql, []);
    let filtered = rows || [];

    if (action && action.trim()) {
      const q = action.trim().toLowerCase();
      filtered = filtered.filter(l => (l.action || '').toLowerCase().includes(q));
    }
    if (userId && userId.trim()) {
      filtered = filtered.filter(l => l.user_id === userId.trim());
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const total = filtered.length;
    const startIndex = (pageNum - 1) * limitNum;
    const paged = filtered.slice(startIndex, startIndex + limitNum).map(item => {
      let details = item.details;
      if (typeof details === 'string') {
        try {
          details = JSON.parse(details);
        } catch (e) {
          details = {};
        }
      }
      return {
        ...item,
        details
      };
    });

    return {
      logs: paged,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.max(1, Math.ceil(total / limitNum))
      }
    };
  }
}

module.exports = AuditLog;
