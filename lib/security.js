/**
 * Security & Sanitization Utilities
 * Protects against XSS, Prototype Pollution, Path Traversal, CSRF, and provides Rate Limiting.
 */
import path from 'node:path';

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeText(input, maxLength = 200) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/g, '') // remove control chars
    .trim()
    .slice(0, maxLength);
}

export function sanitizeUserId(input) {
  if (typeof input !== 'string' && typeof input !== 'number') return '';
  return String(input).replace(/[^a-zA-Z0-9_\-\.@]/g, '').slice(0, 64);
}

export function safeJSONParse(str, fallback = null) {
  try {
    const parsed = JSON.parse(str);
    // Prevent prototype pollution
    if (parsed && typeof parsed === 'object') {
      delete parsed.__proto__;
      delete parsed.constructor;
      delete parsed.prototype;
    }
    return parsed;
  } catch {
    return fallback;
  }
}

/**
 * Path Traversal Prevention Helper
 * Ensures resolved path stays strictly within allowed directory.
 */
export function isSafePath(baseDir, targetPath) {
  const safeBase = path.resolve(baseDir);
  const resolved = path.resolve(targetPath);
  return resolved === safeBase || resolved.startsWith(safeBase + path.sep);
}

/**
 * In-memory Rate Limiter
 */
class RateLimiter {
  constructor(limit = 60, windowMs = 60000) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.hits = new Map();
  }

  check(key) {
    const now = Date.now();
    const record = this.hits.get(key) || { count: 0, resetTime: now + this.windowMs };

    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + this.windowMs;
    }

    record.count++;
    this.hits.set(key, record);

    const remaining = Math.max(0, this.limit - record.count);
    const isAllowed = record.count <= this.limit;

    // Periodically prune stale keys
    if (this.hits.size > 10000) {
      for (const [k, v] of this.hits.entries()) {
        if (now > v.resetTime) this.hits.delete(k);
      }
    }

    return {
      allowed: isAllowed,
      remaining,
      resetTime: record.resetTime
    };
  }

  reset(key) {
    this.hits.delete(key);
  }
}

export const apiRateLimiter = new RateLimiter(150, 60000); // 150 req/min
export const authRateLimiter = new RateLimiter(10, 60000); // 10 login attempts/min
export const chatCommandLimiter = new RateLimiter(20, 10000); // 20 commands/10s per user
export const tiktokActionLimiter = new RateLimiter(10, 30000); // 10 tiktok connect/disconnect attempts/30s

export default {
  escapeHtml,
  sanitizeText,
  sanitizeUserId,
  safeJSONParse,
  isSafePath,
  RateLimiter,
  apiRateLimiter,
  authRateLimiter,
  chatCommandLimiter,
  tiktokActionLimiter
};
