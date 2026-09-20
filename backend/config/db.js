const mysql = require('mysql2/promise');
require('dotenv').config();

let pool = null;
let isConnected = false;

const inMemoryStore = {
  users: new Map(),
  files: new Map(),
  processing_jobs: new Map(),
  user_favorites: new Map(), // userId -> Set of tool_ids
  user_settings: new Map(),  // userId -> { theme, language }
  audit_logs: new Map()      // logId -> { id, user_id, action, ... }
};

async function initDB() {
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'pdfforge',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 2000
    });

    const connection = await pool.getConnection();
    console.log('[Database] Connected to MySQL database:', process.env.DB_NAME || 'pdfforge');
    isConnected = true;

    // Run auto-migration / create tables
    const schemaSql = `
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('USER', 'ADMIN') DEFAULT 'USER',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS files (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NULL,
        original_name VARCHAR(255) NOT NULL,
        stored_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
        file_size BIGINT NOT NULL,
        page_count INT DEFAULT 0,
        storage_path VARCHAR(500) NOT NULL,
        is_temporary BOOLEAN DEFAULT TRUE,
        expires_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS processing_jobs (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NULL,
        tool_name VARCHAR(100) NOT NULL,
        status ENUM('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED') DEFAULT 'QUEUED',
        input_file_id VARCHAR(36) NULL,
        output_file_id VARCHAR(36) NULL,
        error_message TEXT NULL,
        metadata JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (input_file_id) REFERENCES files(id) ON DELETE SET NULL,
        FOREIGN KEY (output_file_id) REFERENCES files(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS user_favorites (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        tool_id VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_tool (user_id, tool_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS user_settings (
        user_id VARCHAR(36) PRIMARY KEY,
        theme VARCHAR(20) DEFAULT 'system',
        language VARCHAR(10) DEFAULT 'en',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50) NULL,
        entity_id VARCHAR(36) NULL,
        details JSON NULL,
        ip_address VARCHAR(45) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `;

    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      await connection.query(statement);
    }
    console.log('[Database] MySQL tables verified/initialized.');
    connection.release();
  } catch (err) {
    console.warn('[Database] MySQL connection notice: ' + err.message);
    console.warn('[Database] Running with in-memory resilient data store. MySQL features will be simulated seamlessly.');
    isConnected = false;
  }
}

async function query(sql, params = []) {
  if (isConnected && pool) {
    return pool.query(sql, params);
  }
  return executeInMemoryQuery(sql, params);
}

// Fallback in-memory query handler for development without MySQL dependencies
function executeInMemoryQuery(sql, params = []) {
  const cleanSql = sql.trim().toLowerCase();

  // Users insert
  if (cleanSql.startsWith('insert into users')) {
    const [id, email, password_hash, role, is_active] = params;
    const user = {
      id,
      email,
      password_hash,
      role: role || 'USER',
      is_active: is_active !== undefined ? Boolean(is_active) : true,
      created_at: new Date()
    };
    inMemoryStore.users.set(id, user);
    return [{ insertId: id, affectedRows: 1 }];
  }

  // Users select by email
  if (cleanSql.includes('from users where email')) {
    const email = params[0];
    const user = Array.from(inMemoryStore.users.values()).find(u => u.email.toLowerCase() === email.toLowerCase());
    return [user ? [user] : []];
  }

  // Users select by id
  if (cleanSql.includes('from users where id')) {
    const id = params[0];
    const user = inMemoryStore.users.get(id);
    return [user ? [user] : []];
  }

  // Users update password
  if (cleanSql.startsWith('update users set password_hash')) {
    const [password_hash, id] = params;
    const user = inMemoryStore.users.get(id);
    if (user) {
      user.password_hash = password_hash;
      user.updated_at = new Date();
      return [{ affectedRows: 1 }];
    }
    return [{ affectedRows: 0 }];
  }

  // Users update is_active
  if (cleanSql.startsWith('update users set is_active')) {
    const [is_active, id] = params;
    const user = inMemoryStore.users.get(id);
    if (user) {
      user.is_active = Boolean(is_active);
      user.updated_at = new Date();
      return [{ affectedRows: 1 }];
    }
    return [{ affectedRows: 0 }];
  }

  // Users update role
  if (cleanSql.startsWith('update users set role')) {
    const [role, id] = params;
    const user = inMemoryStore.users.get(id);
    if (user) {
      user.role = role;
      user.updated_at = new Date();
      return [{ affectedRows: 1 }];
    }
    return [{ affectedRows: 0 }];
  }

  // Users select all (Admin)
  if (cleanSql.startsWith('select') && cleanSql.includes('from users') && !cleanSql.includes('where id') && !cleanSql.includes('where email')) {
    const allUsers = Array.from(inMemoryStore.users.values()).map(u => ({
      id: u.id,
      email: u.email,
      role: u.role,
      is_active: u.is_active !== undefined ? u.is_active : true,
      created_at: u.created_at,
      updated_at: u.updated_at
    })).sort((a, b) => b.created_at - a.created_at);
    return [allUsers];
  }

  // Files insert
  if (cleanSql.startsWith('insert into files')) {
    const [id, user_id, original_name, stored_name, mime_type, file_size, page_count, storage_path, is_temporary, expires_at] = params;
    const file = {
      id, user_id, original_name, stored_name, mime_type, file_size, page_count, storage_path,
      is_temporary: is_temporary !== undefined ? is_temporary : true,
      expires_at: expires_at || null,
      created_at: new Date()
    };
    inMemoryStore.files.set(id, file);
    return [{ insertId: id, affectedRows: 1 }];
  }

  // Files select by id
  if (cleanSql.startsWith('select') && cleanSql.includes('from files where id')) {
    const id = params[0];
    const file = inMemoryStore.files.get(id);
    return [file ? [file] : []];
  }

  // Files storage stats (per user)
  if (cleanSql.includes('sum(file_size)') && cleanSql.includes('from files where user_id')) {
    const userId = params[0];
    const userFiles = Array.from(inMemoryStore.files.values()).filter(f => f.user_id === userId);
    const total_bytes = userFiles.reduce((sum, f) => sum + (Number(f.file_size) || 0), 0);
    const total_files = userFiles.length;
    return [[{ total_bytes, total_files }]];
  }

  // Global files storage stats
  if (cleanSql.includes('sum(file_size)') && !cleanSql.includes('where user_id')) {
    const allFiles = Array.from(inMemoryStore.files.values());
    const total_bytes = allFiles.reduce((sum, f) => sum + (Number(f.file_size) || 0), 0);
    const total_files = allFiles.length;
    return [[{ total_bytes, total_files }]];
  }

  // Files select by user_id
  if (cleanSql.includes('from files where user_id')) {
    const userId = params[0];
    const userFiles = Array.from(inMemoryStore.files.values())
      .filter(f => f.user_id === userId)
      .sort((a, b) => b.created_at - a.created_at);
    return [userFiles];
  }

  // Files delete
  if (cleanSql.includes('delete from files where id')) {
    const id = params[0];
    inMemoryStore.files.delete(id);
    return [{ affectedRows: 1 }];
  }

  // Files delete expired
  if (cleanSql.includes('delete from files where is_temporary = true and expires_at <')) {
    const now = new Date();
    let count = 0;
    for (const [id, f] of inMemoryStore.files.entries()) {
      if (f.is_temporary && f.expires_at && new Date(f.expires_at) < now) {
        inMemoryStore.files.delete(id);
        count++;
      }
    }
    return [{ affectedRows: count }];
  }

  // Processing jobs insert
  if (cleanSql.includes('insert into processing_jobs')) {
    const [id, user_id, tool_name, status, input_file_id, output_file_id, metadata] = params;
    const job = {
      id, user_id, tool_name, status: status || 'QUEUED',
      input_file_id, output_file_id, error_message: null,
      metadata: typeof metadata === 'string' ? JSON.parse(metadata) : metadata,
      created_at: new Date()
    };
    inMemoryStore.processing_jobs.set(id, job);
    return [{ insertId: id, affectedRows: 1 }];
  }

  // Processing jobs select by id
  if (cleanSql.includes('from processing_jobs where id')) {
    const id = params[0];
    const job = inMemoryStore.processing_jobs.get(id);
    return [job ? [job] : []];
  }

  // Processing jobs update status
  if (cleanSql.includes('update processing_jobs')) {
    const [status, output_file_id, error_message, completed_at, id] = params;
    const job = inMemoryStore.processing_jobs.get(id);
    if (job) {
      job.status = status;
      if (output_file_id) job.output_file_id = output_file_id;
      if (error_message) job.error_message = error_message;
      if (completed_at) job.completed_at = completed_at;
    }
    return [{ affectedRows: job ? 1 : 0 }];
  }

  // Processing jobs select by user_id
  if (cleanSql.includes('from processing_jobs where user_id')) {
    const userId = params[0];
    const userJobs = Array.from(inMemoryStore.processing_jobs.values())
      .filter(j => j.user_id === userId)
      .sort((a, b) => b.created_at - a.created_at);
    return [userJobs];
  }

  // Processing jobs select all (Admin)
  if (cleanSql.startsWith('select') && cleanSql.includes('from processing_jobs') && !cleanSql.includes('where id') && !cleanSql.includes('where user_id')) {
    const allJobs = Array.from(inMemoryStore.processing_jobs.values())
      .sort((a, b) => b.created_at - a.created_at);
    return [allJobs];
  }

  // User Favorites
  if (cleanSql.includes('insert into user_favorites')) {
    const [id, userId, toolId] = params;
    if (!inMemoryStore.user_favorites.has(userId)) {
      inMemoryStore.user_favorites.set(userId, new Set());
    }
    inMemoryStore.user_favorites.get(userId).add(toolId);
    return [{ affectedRows: 1 }];
  }

  if (cleanSql.includes('delete from user_favorites where user_id = ? and tool_id = ?')) {
    const [userId, toolId] = params;
    if (inMemoryStore.user_favorites.has(userId)) {
      inMemoryStore.user_favorites.get(userId).delete(toolId);
    }
    return [{ affectedRows: 1 }];
  }

  if (cleanSql.includes('from user_favorites where user_id')) {
    const userId = params[0];
    const favSet = inMemoryStore.user_favorites.get(userId) || new Set();
    const rows = Array.from(favSet).map(tool_id => ({ user_id: userId, tool_id }));
    return [rows];
  }

  // User Settings
  if (cleanSql.includes('insert into user_settings') || cleanSql.includes('replace into user_settings')) {
    const [userId, theme, language] = params;
    inMemoryStore.user_settings.set(userId, {
      user_id: userId,
      theme: theme || 'system',
      language: language || 'en',
      updated_at: new Date()
    });
    return [{ affectedRows: 1 }];
  }

  if (cleanSql.includes('from user_settings where user_id')) {
    const userId = params[0];
    const settings = inMemoryStore.user_settings.get(userId) || {
      user_id: userId,
      theme: 'system',
      language: 'en'
    };
    return [[settings]];
  }

  // Audit Logs insert
  if (cleanSql.startsWith('insert into audit_logs')) {
    const [id, user_id, action, entity_type, entity_id, details, ip_address] = params;
    const log = {
      id,
      user_id: user_id || null,
      action,
      entity_type: entity_type || null,
      entity_id: entity_id || null,
      details: typeof details === 'string' ? JSON.parse(details) : (details || {}),
      ip_address: ip_address || null,
      created_at: new Date()
    };
    inMemoryStore.audit_logs.set(id, log);
    return [{ insertId: id, affectedRows: 1 }];
  }

  // Audit Logs select
  if (cleanSql.startsWith('select') && cleanSql.includes('from audit_logs')) {
    const logs = Array.from(inMemoryStore.audit_logs.values())
      .sort((a, b) => b.created_at - a.created_at);
    return [logs];
  }

  return [[]];
}

module.exports = {
  initDB,
  query,
  getPool: () => pool,
  getDB: () => ({ query }),
  isDBConnected: () => isConnected,
  inMemoryStore
};

