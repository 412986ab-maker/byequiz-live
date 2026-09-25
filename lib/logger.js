/**
 * Structured Logger
 * Provides sanitized, structured logging with in-memory buffer for diagnostics.
 */

const MAX_LOG_ENTRIES = 500;
const logBuffer = [];

function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('password') || lowerKey.includes('token') || lowerKey.includes('secret') || lowerKey.includes('auth')) {
      clean[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitize(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export function log(level, message, metadata = {}) {
  const entry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(4, 9)}`,
    timestamp: new Date().toISOString(),
    epoch: Date.now(),
    level: level.toUpperCase(),
    message,
    metadata: sanitize(metadata)
  };

  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer.shift();
  }

  const prefix = `[${entry.timestamp}] [${entry.level}]`;
  const metaStr = Object.keys(metadata).length ? JSON.stringify(entry.metadata) : '';

  if (entry.level === 'ERROR') {
    console.error(prefix, message, metaStr);
  } else if (entry.level === 'WARN') {
    console.warn(prefix, message, metaStr);
  } else {
    console.log(prefix, message, metaStr);
  }

  return entry;
}

export const logger = {
  info: (msg, meta) => log('INFO', msg, meta),
  warn: (msg, meta) => log('WARN', msg, meta),
  error: (msg, meta) => log('ERROR', msg, meta),
  event: (msg, meta) => log('EVENT', msg, meta),
  audit: (msg, meta) => log('AUDIT', msg, meta),
  getRecentLogs: (limit = 100, level = null) => {
    let list = logBuffer;
    if (level) {
      list = list.filter(l => l.level === level.toUpperCase());
    }
    return list.slice(-limit);
  },
  clear: () => {
    logBuffer.length = 0;
  }
};

export default logger;
