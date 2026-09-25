/**
 * Production-Ready TikTok LIVE Connector
 * Manages real connection lifecycle, auto-reconnection with exponential backoff,
 * room metadata, timeout safety, and event routing.
 */
import eventBus from './eventBus.js';
import logger from './logger.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(envPath); } catch (_) {}
}

export const CONNECTION_STATES = {
  OFFLINE: 'OFFLINE',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  RECONNECTING: 'RECONNECTING',
  ERROR: 'ERROR'
};

class TikTokConnector {
  constructor() {
    this.state = CONNECTION_STATES.OFFLINE;
    this.username = process.env.TIKTOK_USERNAME || null;
    this.roomId = null;
    this.client = null;
    this.connectedAt = null;
    this.streamStartTime = null;
    this.lastEventTime = null;
    this.lastSuccessfulConnection = null;
    this.lastError = null;
    this.viewerCount = 0;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.baseDelayMs = 2000;
    this.maxDelayMs = 30000;
    this.reconnectTimer = null;
    this.connectionTimeoutTimer = null;
    this.connectionTimeoutMs = Number(process.env.TIKTOK_CONNECT_TIMEOUT_MS || 30000);
    this.isManualDisconnect = false;
    this.reconnectScheduled = false;
  }

  getStatus() {
    const currentUsername = this.username || process.env.TIKTOK_USERNAME || null;
    return {
      status: this.state,
      username: currentUsername,
      roomId: this.roomId,
      connectedAt: this.connectedAt,
      streamStartTime: this.streamStartTime,
      lastEventTime: this.lastEventTime,
      lastSuccessfulConnection: this.lastSuccessfulConnection,
      viewerCount: this.viewerCount,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      lastError: this.lastError
    };
  }

  setState(newState, errorMsg = null) {
    const oldState = this.state;
    this.state = newState;
    if (errorMsg) this.lastError = errorMsg;
    logger.info(`TikTok Connection State Changed: ${oldState} -> ${newState}`, {
      username: this.username, roomId: this.roomId, error: errorMsg
    });
    eventBus.dispatch('TIKTOK_STATUS', this.getStatus(), 'TIKTOK_CONNECTOR');
  }

  async connect(username = this.username) {
    if (!username || typeof username !== 'string') {
      const err = 'اسم مستخدم تيك توك غير صالح';
      this.setState(CONNECTION_STATES.ERROR, err);
      return { success: false, error: err };
    }

    this.username = this.normalizeUsername(username);
    if (!this.username) {
      const err = 'اسم مستخدم TikTok غير صالح. استخدم @username أو رابط الحساب أو username فقط';
      this.setState(CONNECTION_STATES.ERROR, err);
      return { success: false, error: err, status: this.state };
    }
    this.isManualDisconnect = false;
    this.clearTimers();
    this.setState(CONNECTION_STATES.CONNECTING);

    this.connectionTimeoutTimer = setTimeout(() => {
      if (this.state === CONNECTION_STATES.CONNECTING) {
        const timeoutErr = 'انتهت مهلة محاولة الاتصال بـ TikTok LIVE (Connection Timeout)';
        logger.warn(timeoutErr, { username: this.username });
        this.handleDisconnectOrError(new Error(timeoutErr));
      }
    }, this.connectionTimeoutMs);

    try {
      const { WebcastPushConnection } = await import('tiktok-live-connector/legacy');
      if (this.client) {
        try { this.client.disconnect(); } catch (e) {}
      }

      // Railway production uses EULERSTREAM_API_KEY. Keep SIGN_API_KEY as a
      // backward-compatible fallback for local/older deployments.
      const signApiKey = process.env.EULERSTREAM_API_KEY || process.env.SIGN_API_KEY || undefined;

      this.client = new WebcastPushConnection(this.username, {
        processInitialData: false,
        // Do not call Euler's premium/business-only gift enrichment route.
        // Basic TikTok gift events remain enabled through the normal stream.
        enableExtendedGiftInfo: false,
        signApiKey
      });

      this.setupClientListeners();
      const connectionState = await this.client.connect();
      clearTimeout(this.connectionTimeoutTimer);

      this.roomId = connectionState.roomId;
      this.connectedAt = Date.now();
      this.lastSuccessfulConnection = Date.now();
      this.streamStartTime = Date.now();
      this.reconnectAttempts = 0;
      this.reconnectScheduled = false;
      this.lastError = null;
      this.setState(CONNECTION_STATES.CONNECTED);
      logger.audit(`Successfully connected to TikTok LIVE Room: ${this.roomId} (@${this.username})`);
      eventBus.dispatch('STREAM_START', {
        roomId: this.roomId, username: this.username, timestamp: this.connectedAt
      }, 'TIKTOK_LIVE');
      return { success: true, status: this.state, roomId: this.roomId };
    } catch (err) {
      clearTimeout(this.connectionTimeoutTimer);
      logger.warn(`Failed to connect to TikTok LIVE for @${this.username}: ${err.message}`);
      this.handleDisconnectOrError(err);
      return { success: false, error: err.message, status: this.state };
    }
  }

  setupClientListeners() {
    if (!this.client) return;
    this.client.on('chat', data => {
      this.lastEventTime = Date.now();
      eventBus.dispatch('CHAT', {
        id: data.userId || data.uniqueId, uniqueId: data.uniqueId,
        nickname: data.nickname || data.uniqueId, avatar: data.profilePictureUrl,
        comment: data.comment, msgId: data.msgId
      }, 'TIKTOK_LIVE');
    });
    this.client.on('gift', data => {
      this.lastEventTime = Date.now();
      eventBus.dispatch('GIFT', {
        id: data.userId || data.uniqueId, uniqueId: data.uniqueId,
        nickname: data.nickname || data.uniqueId, avatar: data.profilePictureUrl,
        giftId: data.giftId, giftName: data.giftName,
        giftCount: data.repeatCount || 1, diamondCount: data.diamondCount || 0,
        repeatEnd: data.repeatEnd !== undefined ? data.repeatEnd : true
      }, 'TIKTOK_LIVE');
    });
    this.client.on('like', data => {
      this.lastEventTime = Date.now();
      eventBus.dispatch('LIKE', {
        id: data.userId || data.uniqueId, uniqueId: data.uniqueId,
        nickname: data.nickname || data.uniqueId, avatar: data.profilePictureUrl,
        likeCount: data.likeCount || 1, totalLikeCount: data.totalLikeCount || 0
      }, 'TIKTOK_LIVE');
    });
    this.client.on('share', data => {
      this.lastEventTime = Date.now();
      eventBus.dispatch('SHARE', {
        id: data.userId || data.uniqueId, uniqueId: data.uniqueId,
        nickname: data.nickname || data.uniqueId, avatar: data.profilePictureUrl,
        shareCount: data.shareCount || 1, totalShareCount: data.totalShareCount || 0
      }, 'TIKTOK_LIVE');
    });
    this.client.on('follow', data => {
      this.lastEventTime = Date.now();
      eventBus.dispatch('FOLLOW', {
        id: data.userId || data.uniqueId, uniqueId: data.uniqueId,
        nickname: data.nickname || data.uniqueId, avatar: data.profilePictureUrl
      }, 'TIKTOK_LIVE');
    });
    this.client.on('roomUser', data => {
      this.lastEventTime = Date.now();
      this.viewerCount = data.viewerCount || 0;
      eventBus.dispatch('ROOM_USER', { viewerCount: this.viewerCount }, 'TIKTOK_LIVE');
    });
    this.client.on('streamEnd', () => {
      logger.info('TikTok Live broadcast has ended');
      this.setState(CONNECTION_STATES.OFFLINE, 'انتهى البث المباشر');
      eventBus.dispatch('STREAM_END', { timestamp: Date.now() }, 'TIKTOK_LIVE');
    });
    this.client.on('disconnected', () => {
      if (!this.isManualDisconnect) this.handleDisconnectOrError(new Error('انقطع اتصال البث المباشر بشكل مفاجئ'));
    });
    this.client.on('error', err => this.handleDisconnectOrError(err));
  }

  handleDisconnectOrError(err) {
    if (this.isManualDisconnect) {
      this.setState(CONNECTION_STATES.OFFLINE);
      return;
    }
    this.lastError = err.message || 'Unknown error';
    if (this.state === CONNECTION_STATES.RECONNECTING || this.reconnectScheduled) return;
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.setState(CONNECTION_STATES.RECONNECTING, this.lastError);
      this.reconnectScheduled = true;
      const delay = Math.min(this.baseDelayMs * Math.pow(1.5, this.reconnectAttempts - 1), this.maxDelayMs);
      logger.warn(`Scheduling auto-reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`);
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.reconnectScheduled = false;
        this.connect(this.username);
      }, delay);
    } else {
      logger.error(`Max reconnect attempts reached (${this.maxReconnectAttempts}). Setting state to ERROR.`);
      this.setState(CONNECTION_STATES.ERROR, `فشل الاتصال بعد ${this.maxReconnectAttempts} محاولات: ${this.lastError}`);
    }
  }

  disconnect() {
    this.isManualDisconnect = true;
    this.reconnectScheduled = false;
    this.clearTimers();
    if (this.client) {
      try { this.client.disconnect(); } catch (e) {}
      this.client = null;
    }
    this.roomId = null;
    this.connectedAt = null;
    this.setState(CONNECTION_STATES.OFFLINE);
    eventBus.dispatch('DISCONNECT', { timestamp: Date.now() }, 'TIKTOK_CONNECTOR');
    return { success: true, status: this.state };
  }

  reconnect() {
    this.disconnect();
    this.reconnectAttempts = 0;
    return this.connect(this.username);
  }

  normalizeUsername(input) {
    let value = String(input || '').trim();
    if (!value) return null;
    try {
      if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('www.')) {
        const url = new URL(value.startsWith('www.') ? `https://${value}` : value);
        value = url.pathname.split('/').filter(Boolean)[0] || '';
      }
    } catch (_) {}
    value = value.replace(/^@+/, '').split(/[/?#]/)[0].trim();
    return value || null;
  }

  clearTimers() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connectionTimeoutTimer) {
      clearTimeout(this.connectionTimeoutTimer);
      this.connectionTimeoutTimer = null;
    }
  }
}

export const tiktokConnector = new TikTokConnector();
export default tiktokConnector;
