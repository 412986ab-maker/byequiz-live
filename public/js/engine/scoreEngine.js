/**
 * Score Engine
 * Calculates player points for correct answers, speed bonuses, streaks,
 * configurable gift diamond multipliers, and combo bonuses.
 */
class ScoreEngine {
  constructor(eventManager, gameState, participantManager) {
    this.events = eventManager;
    this.state = gameState;
    this.participants = participantManager;

    this.setupListeners();
  }

  setupListeners() {
    // 1. Score for Correct Answers
    this.events.on("answer:correct", ({ user, isFirstCorrect, speedSeconds }) => {
      const settings = this.state.get("settings");
      const basePoints = settings.correctPoints || 100;
      let awarded = basePoints;

      // Speed bonus for first correct responder
      if (isFirstCorrect) {
        awarded += (settings.speedBonus || 50);
      }

      // Streak bonus
      if (user.streak >= 3) {
        awarded += (settings.streakBonus || 25);
      }

      // Check active combo multiplier
      const comboCount = (this.state.get("engagement") && this.state.get("engagement").combo) ? this.state.get("engagement").combo.count : 0;
      if (comboCount >= 5) {
        awarded = Math.round(awarded * 1.5);
      }

      user.score += awarded;
      user.points += awarded;

      this.events.emit("score:updated", {
        user,
        pointsAwarded: awarded,
        total: user.score,
        isFirstCorrect
      });
    });

    // 2. Score for Gifts (Diamond conversion)
    this.events.on("gift:received", (giftData) => {
      const settings = this.state.get("settings");
      const rate = settings.giftPointsRate !== undefined ? settings.giftPointsRate : 1;
      const diamonds = giftData.diamonds || ((giftData.diamondCount || 1) * (giftData.giftCount || 1)) || 0;
      const points = Math.round(diamonds * rate);

      const userId = (giftData.id || giftData.uniqueId || giftData.userId || "").toString();
      const user = this.participants.get(userId);

      if (user) {
        user.gifts = (user.gifts || 0) + (giftData.giftCount || 1);
        user.score += points;
        user.points += points;

        this.events.emit("score:updated", {
          user,
          pointsAwarded: points,
          total: user.score,
          isGift: true
        });
      }

      // Update session metrics
      const session = this.state.get("session");
      session.totalGifts = (session.totalGifts || 0) + (giftData.giftCount || 1);
      session.totalDiamonds = (session.totalDiamonds || 0) + diamonds;

      // Update engagement metrics
      const eng = this.state.get("engagement");
      eng.totalGifts = (eng.totalGifts || 0) + (giftData.giftCount || 1);
      eng.totalDiamonds = (eng.totalDiamonds || 0) + diamonds;
      this.state.set("engagement", eng);
    });
  }

    addPoints(userId, points = 100, reason = 'CUSTOM') {
    const user = this.participants.get(userId);
    if (!user) return 0;
    user.score = (user.score || 0) + points;
    user.points = user.score;
    this.events.emit("score:updated", {
      user,
      pointsAwarded: points,
      total: user.score,
      reason
    });
    return user.score;
  }

  addScore(userId, points = 100, reason = 'CUSTOM') {
    return this.addPoints(userId, points, reason);
  }

  calculateUserScore(userId) {
    const user = this.participants.get(userId);
    return user ? user.score : 0;
  }
}

if (typeof window !== "undefined") {
  window.ScoreEngine = ScoreEngine;
}
if (typeof globalThis !== "undefined") {
  globalThis.ScoreEngine = ScoreEngine;
}
