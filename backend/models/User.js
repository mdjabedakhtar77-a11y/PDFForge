const { query } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class User {
  static async create({ email, password_hash, role = 'USER', is_active = true }) {
    const id = uuidv4();
    const sql = `INSERT INTO users (id, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)`;
    await query(sql, [id, email, password_hash, role, is_active]);
    return this.findById(id);
  }

  static async findByEmail(email) {
    const sql = `SELECT * FROM users WHERE email = ? LIMIT 1`;
    const [rows] = await query(sql, [email]);
    if (!rows || rows.length === 0) return null;
    const u = rows[0];
    return {
      ...u,
      is_active: u.is_active !== undefined ? Boolean(u.is_active) : true
    };
  }

  static async findById(id) {
    const sql = `SELECT id, email, role, is_active, created_at, updated_at FROM users WHERE id = ? LIMIT 1`;
    const [rows] = await query(sql, [id]);
    if (!rows || rows.length === 0) return null;
    const u = rows[0];
    return {
      ...u,
      is_active: u.is_active !== undefined ? Boolean(u.is_active) : true
    };
  }

  static async findWithPasswordById(id) {
    const sql = `SELECT id, email, password_hash, role, is_active, created_at, updated_at FROM users WHERE id = ? LIMIT 1`;
    const [rows] = await query(sql, [id]);
    if (!rows || rows.length === 0) return null;
    const u = rows[0];
    return {
      ...u,
      is_active: u.is_active !== undefined ? Boolean(u.is_active) : true
    };
  }

  static async updatePassword(id, password_hash) {
    const sql = `UPDATE users SET password_hash = ? WHERE id = ?`;
    await query(sql, [password_hash, id]);
    return true;
  }

  static async updateStatus(id, isActive) {
    const sql = `UPDATE users SET is_active = ? WHERE id = ?`;
    await query(sql, [isActive ? 1 : 0, id]);
    return this.findById(id);
  }

  static async updateRole(id, role) {
    const validRoles = ['USER', 'ADMIN'];
    const assignedRole = validRoles.includes(role) ? role : 'USER';
    const sql = `UPDATE users SET role = ? WHERE id = ?`;
    await query(sql, [assignedRole, id]);
    return this.findById(id);
  }

  static async findAllPaginated({ page = 1, limit = 10, search = '', role = '', status = '' } = {}) {
    const FileModel = require('./File');
    const sql = `SELECT id, email, role, is_active, created_at, updated_at FROM users ORDER BY created_at DESC`;
    const [rows] = await query(sql, []);
    let filtered = (rows || []).map(u => ({
      ...u,
      is_active: u.is_active !== undefined ? Boolean(u.is_active) : true
    }));

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(u => (u.email || '').toLowerCase().includes(q));
    }
    if (role && role.trim()) {
      filtered = filtered.filter(u => (u.role || '').toUpperCase() === role.trim().toUpperCase());
    }
    if (status && status.trim()) {
      const isAct = status.trim().toLowerCase() === 'active';
      filtered = filtered.filter(u => u.is_active === isAct);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const total = filtered.length;
    const startIndex = (pageNum - 1) * limitNum;
    const paged = filtered.slice(startIndex, startIndex + limitNum);

    // Enrich users with storage metrics
    const enrichedUsers = await Promise.all(paged.map(async (u) => {
      const storage = await FileModel.getStorageStats(u.id);
      return {
        ...u,
        storage: {
          totalBytes: storage.totalBytes,
          totalFiles: storage.totalFiles,
          usagePercentage: storage.usagePercentage
        }
      };
    }));

    return {
      users: enrichedUsers,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.max(1, Math.ceil(total / limitNum))
      }
    };
  }

  static async getGlobalStats() {
    const sql = `SELECT id, email, role, is_active FROM users`;
    const [rows] = await query(sql, []);
    const users = (rows || []).map(u => ({
      ...u,
      is_active: u.is_active !== undefined ? Boolean(u.is_active) : true
    }));

    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.is_active).length;
    const disabledUsers = users.filter(u => !u.is_active).length;
    const adminUsers = users.filter(u => u.role === 'ADMIN').length;

    return {
      totalUsers,
      activeUsers,
      disabledUsers,
      adminUsers
    };
  }

  static async getFavorites(userId) {
    const sql = `SELECT tool_id FROM user_favorites WHERE user_id = ? ORDER BY created_at ASC`;
    const [rows] = await query(sql, [userId]);
    return (rows || []).map(r => r.tool_id);
  }

  static async toggleFavorite(userId, toolId) {
    const favs = await this.getFavorites(userId);
    const exists = favs.includes(toolId);
    if (exists) {
      const sql = `DELETE FROM user_favorites WHERE user_id = ? AND tool_id = ?`;
      await query(sql, [userId, toolId]);
      return { toolId, isFavorite: false };
    } else {
      const id = uuidv4();
      const sql = `INSERT INTO user_favorites (id, user_id, tool_id) VALUES (?, ?, ?)`;
      await query(sql, [id, userId, toolId]);
      return { toolId, isFavorite: true };
    }
  }

  static async getSettings(userId) {
    const sql = `SELECT theme, language FROM user_settings WHERE user_id = ? LIMIT 1`;
    const [rows] = await query(sql, [userId]);
    if (rows && rows.length > 0) {
      return rows[0];
    }
    return { theme: 'system', language: 'en' };
  }

  static async updateSettings(userId, { theme = 'system', language = 'en' }) {
    const sql = `REPLACE INTO user_settings (user_id, theme, language) VALUES (?, ?, ?)`;
    await query(sql, [userId, theme, language]);
    return { theme, language };
  }
}

module.exports = User;

