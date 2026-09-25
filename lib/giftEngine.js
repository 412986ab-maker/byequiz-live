/**
 * Gift Engine & Actions
 * Maps incoming TikTok gifts to in-game actions, score multipliers, and attempts.
 */
import logger from './logger.js';

export const DEFAULT_GIFT_RULES = [
  { giftId: 'rose', name: 'وردة', diamonds: 1, action: 'SCORE_BONUS', value: 50, enabled: true },
  { giftId: 'tiktok', name: 'شعار تيك توك', diamonds: 1, action: 'SCORE_BONUS', value: 50, enabled: true },
  { giftId: 'ice_cream', name: 'آيس كريم', diamonds: 1, action: 'EXTRA_ATTEMPT', value: 1, enabled: true },
  { giftId: 'doughnut', name: 'دونات', diamonds: 30, action: 'SCORE_MULTIPLIER', value: 2, enabled: true },
  { giftId: 'confetti', name: 'احتفال', diamonds: 100, action: 'INSTANT_ENTRY', value: 1, enabled: true },
  { giftId: 'galaxy', name: 'المجرة', diamonds: 1000, action: 'SPECIAL_EVENT', value: 5000, enabled: true },
  { giftId: 'lion', name: 'الأسد', diamonds: 29999, action: 'JACKPOT_BONUS', value: 50000, enabled: true }
];

export class GiftEngine {
  constructor() {
    this.rules = new Map(DEFAULT_GIFT_RULES.map(r => [r.giftId, r]));
    this.defaultPointsPerDiamond = 10;
  }

  processGift(giftData) {
    const giftId = (giftData.giftId || '').toString().toLowerCase();
    const giftName = giftData.giftName || 'هدية';
    const giftCount = parseInt(giftData.giftCount || 1, 10);
    const diamondCount = parseInt(giftData.diamondCount || 0, 10);
    const totalDiamonds = giftData.diamonds || (diamondCount * giftCount) || 1;

    let rule = this.rules.get(giftId);
    if (!rule) {
      rule = {
        giftId,
        name: giftName,
        diamonds: diamondCount || 1,
        action: 'SCORE_BONUS',
        value: totalDiamonds * this.defaultPointsPerDiamond,
        enabled: true
      };
    }

    const calculatedPoints = Math.max(rule.value * giftCount, totalDiamonds * this.defaultPointsPerDiamond);

    logger.event(`Processed Gift: ${giftName} x${giftCount} (${totalDiamonds} Diamonds) -> Action: ${rule.action}`);

    return {
      giftId,
      giftName,
      giftCount,
      totalDiamonds,
      action: rule.action,
      actionValue: rule.value,
      pointsAwarded: calculatedPoints
    };
  }

  getRules() {
    return Array.from(this.rules.values());
  }

  updateRule(giftId, patch) {
    const r = this.rules.get(giftId.toLowerCase());
    if (!r) return null;
    Object.assign(r, patch);
    return r;
  }
}

export const giftEngine = new GiftEngine();
export default giftEngine;
