/**
 * Milestone Engine
 * Evaluates live metrics (likes, shares, follows, gifts, win streaks)
 * and triggers milestone events with zero raw emojis.
 */
class MilestoneEngine {
  constructor(eventManager, gameState) {
    this.events = eventManager;
    this.state = gameState;

    this.likeMilestones = [
      { threshold: 1000, reached: false, tier: 1 },
      { threshold: 5000, reached: false, tier: 2 },
      { threshold: 10000, reached: false, tier: 3 },
      { threshold: 50000, reached: false, tier: 4 },
      { threshold: 100000, reached: false, tier: 5 }
    ];

    this.shareMilestones = [
      { threshold: 50, reached: false },
      { threshold: 200, reached: false },
      { threshold: 1000, reached: false }
    ];

    this.unlockedAchievements = new Set();
    this.setupListeners();
  }

  setupListeners() {
    this.events.on("stats:updated", (stats) => {
      this.checkLiveStats(stats);
    });

    this.events.on("gift:received", (giftData) => {
      this.checkGiftMilestone(giftData);
    });

    this.events.on("game:winner", (winnerData) => {
      this.checkWinnerMilestones(winnerData);
    });
  }

  checkWinnerMilestones(winner) {
    if (!winner) return;

    if (!this.unlockedAchievements.has("FIRST_WIN")) {
      this.unlockedAchievements.add("FIRST_WIN");
      this.events.emit("achievement:unlocked", {
        id: "FIRST_WIN",
        title: "الفائز الأول في البث",
        description: `حقّق ${winner.nickname || 'البطل'} أول فوز في هذا البث!`,
        icon: "crown"
      });
    }

    if (winner.streak >= 3) {
      const achKey = `STREAK_${winner.id}_${winner.streak}`;
      if (!this.unlockedAchievements.has(achKey)) {
        this.unlockedAchievements.add(achKey);
        this.events.emit("achievement:unlocked", {
          id: achKey,
          title: "سلسلة انتصارات خارقة",
          description: `حقّق ${winner.nickname || 'البطل'} سلسلة ${winner.streak} انتصارات متتالية!`,
          icon: "flame"
        });
      }
    }
  }

  checkLiveStats(stats) {
    if (!stats) return;

    // 1. Likes Milestones
    const likes = stats.totalLikes || stats.likes || 0;
    for (const m of this.likeMilestones) {
      if (likes >= m.threshold && !m.reached) {
        m.reached = true;
        this.events.emit("milestone:reached", {
          type: "LIKE_MILESTONE",
          threshold: m.threshold,
          tier: m.tier,
          total: likes
        });

        if (m.threshold >= 10000) {
          this.events.emit("achievement:unlocked", {
            id: `LIKES_${m.threshold}`,
            title: "عشرة آلاف تفاعل حي",
            description: `وصل البث المباشر إلى ${m.threshold.toLocaleString()} لايك وتفاعل!`,
            icon: "flame"
          });
        }
      }
    }

    // 2. Share Milestones
    const shares = stats.totalShares || stats.shares || 0;
    for (const s of this.shareMilestones) {
      if (shares >= s.threshold && !s.reached) {
        s.reached = true;
        this.events.emit("milestone:reached", {
          type: "SHARE_MILESTONE",
          threshold: s.threshold,
          total: shares
        });

        if (s.threshold >= 200) {
          this.events.emit("achievement:unlocked", {
            id: `SHARES_${s.threshold}`,
            title: "انتشار فضائي واسع",
            description: `تجاوز البث ${s.threshold} مشاركة بين المتابعين!`,
            icon: "rocket"
          });
        }
      }
    }
  }

  checkGiftMilestone(gift) {
    if (!gift) return;

    const diamonds = gift.diamonds || ((gift.diamondCount || 1) * (gift.giftCount || 1)) || 1;

    if (!this.unlockedAchievements.has("FIRST_SUPPORTER")) {
      this.unlockedAchievements.add("FIRST_SUPPORTER");
      this.events.emit("achievement:unlocked", {
        id: "FIRST_SUPPORTER",
        title: "أول داعم في البث",
        description: `قدّم ${gift.nickname || 'داعم'} أول هدية في البث!`,
        icon: "gift"
      });
    }

    if (diamonds >= 1000 && !this.unlockedAchievements.has("LEGENDARY_GIFT")) {
      this.unlockedAchievements.add("LEGENDARY_GIFT");
      this.events.emit("achievement:unlocked", {
        id: "LEGENDARY_GIFT",
        title: "هدية كبرى أسطورية",
        description: `أرسل ${gift.nickname || 'داعم'} هدية بقيمة ${diamonds} ماسة!`,
        icon: "diamond"
      });
    }
  }
}

if (typeof window !== "undefined") {
  window.MilestoneEngine = MilestoneEngine;
}
if (typeof globalThis !== "undefined") {
  globalThis.MilestoneEngine = MilestoneEngine;
}
