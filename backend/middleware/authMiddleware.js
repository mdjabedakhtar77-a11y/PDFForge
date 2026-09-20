const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'pdfforge_jwt_secret_key_change_in_production_2026';

/**
 * Strict authentication: requires valid JWT in Authorization header
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please sign in.'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session. User not found.'
      });
    }

    if (user.is_active === false) {
      return res.status(403).json({
        success: false,
        message: 'Account is disabled. Please contact an administrator.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.',
      error: error.message
    });
  }
}

/**
 * Optional authentication: attaches user if token is present, else continues as guest
 */
async function optionalAuth(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      let user = await User.findById(decoded.id);
      if (user && user.is_active !== false) {
        req.user = user;
      } else if (!user && decoded.id) {
        req.user = { id: decoded.id, email: decoded.email, role: decoded.role || 'USER', is_active: true };
      }
    }
  } catch (err) {
    // Ignore invalid token for optional auth, user remains guest
    req.user = null;
  }
  next();
}

/**
 * Admin role check
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden. Administrator privileges required.'
    });
  }
  next();
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireAdmin
};
