/**
 * Central Event Manager (Pub/Sub Event Bus with Deduplication)
 * Coordinates all events across engines, scenes, and incoming network feeds.
 */
class EventManager {
  constructor() {
    this.listeners = new Map();
    this.dedupCache = new Map(); // key -> expireTimestamp
    this.cleanupInterval = null;

    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanupCache(), 30000);
      if (this.cleanupInterval.unref) this.cleanupInterval.unref();
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
      if (this.listeners.get(event).size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit(event, payload) {
    // If payload contains msgId, automatically deduplicate with 5 second TTL
    if (payload && payload.msgId) {
      if (this.isDuplicate(payload.msgId)) {
        return false;
      }
      this.markSeen(payload.msgId, 5000);
    }

    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try {
          cb(payload);
        } catch (e) {
          console.error(`[EventManager] Error in listener for event ${event}:`, e);
        }
      });
    }

    // Global wildcard listener
    if (this.listeners.has('*')) {
      this.listeners.get('*').forEach(cb => {
        try {
          cb(event, payload);
        } catch (e) {
          console.error(`[EventManager] Error in wildcard listener for event ${event}:`, e);
        }
      });
    }
    return true;
  }

  emitDedup(event, payload, key, ttlMs = 5000) {
    const dedupKey = key || (payload ? (payload.msgId || `${event}_${payload.id}_${payload.timestamp || Date.now()}`) : null);
    if (dedupKey && this.isDuplicate(dedupKey)) {
      return false;
    }
    if (dedupKey) {
      this.markSeen(dedupKey, ttlMs);
    }
    return this.emit(event, payload);
  }

  isDuplicate(key) {
    const expires = this.dedupCache.get(key);
    if (!expires) return false;
    if (Date.now() > expires) {
      this.dedupCache.delete(key);
      return false;
    }
    return true;
  }

  markSeen(key, ttlMs = 5000) {
    this.dedupCache.set(key, Date.now() + ttlMs);
  }

  cleanupCache() {
    const now = Date.now();
    for (const [key, expireTime] of this.dedupCache.entries()) {
      if (now > expireTime) {
        this.dedupCache.delete(key);
      }
    }
  }

  clear() {
    this.listeners.clear();
    this.dedupCache.clear();
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

if (typeof window !== 'undefined') {
  window.EventManager = EventManager;
}
if (typeof globalThis !== 'undefined') {
  globalThis.EventManager = EventManager;
}
