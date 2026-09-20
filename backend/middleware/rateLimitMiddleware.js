/**
 * In-memory sliding-window rate limiting middleware.
 * Zero external dependencies, self-cleaning, and sets standard HTTP rate limit headers.
 */

function createRateLimiter({
  windowMs = 60 * 1000,
  max = 100,
  message = 'Too many requests, please try again later.',
  statusCode = 429
} = {}) {
  const hits = new Map();

  // Periodic cleanup of stale entries every 2 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(key);
      }
    }
  }, 2 * 60 * 1000);

  // Do not hold Node event loop open just for cleanup
  if (cleanupInterval.unref) cleanupInterval.unref();

  return function rateLimit(req, res, next) {
    // Determine client identifier: proxy-aware IP or socket IP
    const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1')
      .split(',')[0]
      .trim();

    const now = Date.now();
    let record = hits.get(clientIp);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs
      };
      hits.set(clientIp, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const resetSec = Math.ceil((record.resetTime - now) / 1000);

    // Set standard RateLimit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSec);

    if (record.count > max) {
      res.setHeader('Retry-After', resetSec);
      return res.status(statusCode).json({
        success: false,
        message,
        retryAfter: resetSec
      });
    }

    next();
  };
}

// Strict limiter for authentication endpoints (prevent brute force)
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 30 : 500, // higher limit in test/dev
  message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.'
});

// General limiter for public API endpoints
const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 requests per minute
  message: 'API rate limit exceeded. Please slow down your requests.'
});

module.exports = {
  createRateLimiter,
  authLimiter,
  apiLimiter
};
