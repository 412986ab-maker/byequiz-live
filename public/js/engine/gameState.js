/**
 * Central Reactive Game State Container
 * Single source of truth for the entire game lifecycle, rounds, scoring rules, engagement metrics and settings.
 */
class GameState {
  constructor(eventManager = null) {
    this.events = eventManager;
    this.observers = new Map();
    this.resetAll();
  }

  resetAll() {
    this.state = {
      scene: 'REGISTRATION', // WAITING, REGISTRATION, PARTICIPANTS, QUESTION, ANSWERS, DRAW, WINNER, STATS, PODIUM
      round: {
        roundNumber: 1,
        status: 'IDLE', // IDLE, ACTIVE, PAUSED, ENDED
        startTime: null,
        targetParticipants: 36,
        currentWinner: null,
        previousWinnerId: null
      },
      currentQuestion: null,
      usedQuestionIds: new Set(),
      timer: {
        duration: 15,
        remaining: 15,
        active: false
      },
      settings: {
        targetParticipants: 36,
        questionDuration: 15,
        resultsDuration: 4,
        winnerDisplayDuration: 5,
        nextRoundDelay: 4,
        autoMode: true,
        autoTransition: true,
        autoNextRound: true,
        excludePreviousWinner: false,
        registrationKeywords: ['تم', '1', 'انضمام', 'شارك', 'انا'],
        correctPoints: 100,
        speedBonus: 50,
        streakBonus: 25,
        giftPointsRate: 1, // 1 Diamond = 1 Game Point
        engagementEnabled: true,
        engagementIntensity: 'MEDIUM', // LOW, MEDIUM, HIGH
        engagementSound: true,
        aggregationEnabled: true,
        aggregationWindow: 600, // ms
        likeMilestoneStep: 1000, // Detect every 1,000 likes
        shareMilestones: [100, 500, 1000, 5000, 10000],
        giftLevels: [
          { level: 1, name: 'هدية صغيرة', minDiamonds: 1, maxDiamonds: 9, effect: 'glow', sound: 'GIFT_SMALL' },
          { level: 2, name: 'هدية متوسطة', minDiamonds: 10, maxDiamonds: 99, effect: 'banner', sound: 'GIFT_SMALL' },
          { level: 3, name: 'هدية كبيرة', minDiamonds: 100, maxDiamonds: 999, effect: 'screen', sound: 'GIFT_BIG' },
          { level: 4, name: 'هدية نادرة', minDiamonds: 1000, maxDiamonds: 4999, effect: 'rare', sound: 'GIFT_BIG' },
          { level: 5, name: 'هدية أسطورية', minDiamonds: 5000, maxDiamonds: Infinity, effect: 'legendary', sound: 'MAJOR_MILESTONE' }
        ],
        priorityOrder: [
          'CRITICAL_GIFT',
          'MAJOR_MILESTONE',
          'WINNER',
          'SPECIAL_GIFT',
          'LIKE_MILESTONE',
          'SHARE_MILESTONE',
          'FOLLOW',
          'NORMAL_GIFT'
        ]
      },
      engagement: {
        likes: 0,
        initialLikes: null,
        shares: 0,
        followers: 0,
        viewerCount: 0,
        peakViewers: 0,
        totalGifts: 0,
        totalDiamonds: 0,
        combo: {
          count: 0,
          multiplier: 1,
          lastAnswerTime: 0
        },
        achievements: []
      },
      session: {
        totalRounds: 0,
        totalQuestions: 0,
        totalAnswers: 0,
        totalCorrectAnswers: 0,
        totalGifts: 0,
        totalDiamonds: 0,
        leaderboard: []
      },
      answerFrequencies: {}
    };
  }

  get settings() {
    return this.state.settings;
  }

  get currentScene() {
    return this.state.scene;
  }

  get(key) {
    return key ? this.state[key] : this.state;
  }

  set(key, value) {
    const oldValue = this.state[key];
    this.state[key] = value;
    this.notify(key, value, oldValue);
  }

  update(patch) {
    Object.keys(patch).forEach(key => {
      this.set(key, patch[key]);
    });
  }

  updateSettings(newSettings) {
    this.state.settings = { ...this.state.settings, ...newSettings };
    this.notify('settings', this.state.settings);
    if (this.events) {
      this.events.emit('settings:updated', this.state.settings);
    }
  }

  updateEngagement(patch) {
    this.state.engagement = { ...this.state.engagement, ...patch };
    this.notify('engagement', this.state.engagement);
    if (this.events) {
      this.events.emit('engagement:updated', this.state.engagement);
    }
  }

  subscribe(key, callback) {
    if (!this.observers.has(key)) {
      this.observers.set(key, new Set());
    }
    this.observers.get(key).add(callback);
    return () => this.observers.get(key).delete(callback);
  }

  notify(key, newValue, oldValue) {
    if (this.observers.has(key)) {
      this.observers.get(key).forEach(cb => {
        try {
          cb(newValue, oldValue);
        } catch (e) {
          console.error(`[GameState] Observer error for key ${key}:`, e);
        }
      });
    }
  }

  resetRound() {
    this.state.round.status = 'ACTIVE';
    this.state.round.startTime = Date.now();
    this.state.round.currentWinner = null;
    this.state.currentQuestion = null;
    this.state.timer.active = false;
    this.state.timer.remaining = this.state.settings.questionDuration;
    this.state.answerFrequencies = {};
    this.notify('round', this.state.round);
  }
}

if (typeof window !== 'undefined') {
  window.GameState = GameState;
}
if (typeof globalThis !== 'undefined') {
  globalThis.GameState = GameState;
}
