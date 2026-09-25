/**
 * Central Event Normalizer & Event Bus
 * Standardizes raw events into uniform event envelopes.
 */
import { EventEmitter } from 'node:events';
import logger from './logger.js';
import { sanitizeText, sanitizeUserId } from './security.js';

export class EventNormalizer {
  static normalize(rawType, rawData, source = 'TIKTOK_LIVE') {
    const id = `evt_${Date.now()}_${Math.random().toString(36).substring(4, 9)}`;
    const timestamp = Date.now();

    // User details extraction
    const rawUser = rawData?.user || rawData || {};
    const userId = sanitizeUserId(rawUser.id || rawUser.userId || rawUser.uniqueId || '');
    const uniqueId = sanitizeText(rawUser.uniqueId || rawUser.username || userId, 64);
    const nickname = sanitizeText(rawUser.nickname || rawUser.displayName || uniqueId || 'مجهول', 64);
    const displayName = nickname;
    const avatar = rawUser.avatar || rawUser.profilePictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(uniqueId || 'guest')}`;

    const user = {
      id: userId || `u_${uniqueId}`,
      uniqueId,
      nickname,
      displayName,
      avatar
    };

    let type = rawType.toUpperCase();
    let payload = { ...rawData };

    switch (type) {
      case 'CHAT':
      case 'COMMENT': {
        type = 'CHAT';
        payload = {
          comment: sanitizeText(rawData.comment || rawData.text || '', 300),
          msgId: rawData.msgId || `msg_${Date.now()}_${Math.random().toString(36).substring(4)}`,\n          id: user.id, uniqueId: user.uniqueId, nickname: user.nickname, displayName: user.displayName, avatar: user.avatar
        };
        break;
      }

      case 'GIFT': {
        const giftCount = parseInt(rawData.giftCount || rawData.repeatCount || 1, 10);
        const diamondCount = parseInt(rawData.diamondCount || 0, 10);
        const diamonds = rawData.diamonds || (diamondCount * giftCount);
        payload = {
          giftId: rawData.giftId || 'gift_custom',
          giftName: sanitizeText(rawData.giftName || 'هدية', 64),
          giftCount,
          diamondCount,
          diamonds,
          repeatEnd: rawData.repeatEnd !== undefined ? rawData.repeatEnd : true,\n          id: user.id, uniqueId: user.uniqueId, nickname: user.nickname, displayName: user.displayName, avatar: user.avatar
        };
        break;
      }

      case 'LIKE': {
        payload = {
          likeCount: parseInt(rawData.likeCount || 1, 10),
          totalLikeCount: parseInt(rawData.totalLikeCount || 0, 10),\n          id: user.id, uniqueId: user.uniqueId, nickname: user.nickname, displayName: user.displayName, avatar: user.avatar
        };
        break;
      }

      case 'SHARE': {
        payload = {
          shareCount: parseInt(rawData.shareCount || 1, 10),
          totalShareCount: parseInt(rawData.totalShareCount || 0, 10),\n          id: user.id, uniqueId: user.uniqueId, nickname: user.nickname, displayName: user.displayName, avatar: user.avatar
        };
        break;
      }

      case 'FOLLOW': {
        payload = { id: user.id, uniqueId: user.uniqueId, nickname: user.nickname, displayName: user.displayName, avatar: user.avatar };
        break;
      }

      case 'ROOM_USER':
      case 'VIEWER_UPDATE': {
        type = 'ROOM_USER';
        payload = {
          viewerCount: parseInt(rawData.viewerCount || 0, 10)
        };
        break;
      }

      case 'STREAM_START':
      case 'STREAM_END':
      case 'DISCONNECT':
      case 'ERROR': {
        payload = {
          message: sanitizeText(rawData.message || '', 200),
          reason: rawData.reason || ''
        };
        break;
      }

      default:
        break;
    }

    return {
      id,
      type,
      timestamp,
      source,
      user,
      payload
    };
  }
}

class CentralEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
  }

  dispatch(rawType, rawData, source = 'TIKTOK_LIVE') {
    const envelope = EventNormalizer.normalize(rawType, rawData, source);
    
    // Structured log
    if (envelope.type === 'CHAT' || envelope.type === 'GIFT' || envelope.type === 'ERROR') {
      logger.event(`Event dispatched: ${envelope.type}`, {
        id: envelope.id,
        user: envelope.user.uniqueId,
        type: envelope.type
      });
    }

    // Emit generic and specific events
    this.emit('event', envelope);
    this.emit(`event:${envelope.type}`, envelope);
    return envelope;
  }
}

export const eventBus = new CentralEventBus();
export default eventBus;
