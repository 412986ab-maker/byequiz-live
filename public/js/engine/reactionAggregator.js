/**
 * Reaction Aggregator
 * Batches high-volume incoming live streams (Likes, Shares, Follows) within a sliding time window.
 * Prevents UI freezing by producing concise aggregated bursts (e.g., '+250 LIKES').
 */
class ReactionAggregator {
  constructor(eventManager, gameState) {
    this.events = eventManager;
    this.state = gameState;

    this.pendingLikes = 0;
    this.latestTotalLikes = 0;
    this.pendingShares = 0;
    this.pendingFollows = [];
    this.timer = null;

    this.setupListeners();
  }

  setupListeners() {
    this.events.on('engagement:like_raw', (data) => {
      const settings = this.state.get('settings');
      if (!settings.aggregationEnabled) {
        this.events.emit('reaction:like_burst', {
          count: data.likeCount || 1,
          total: data.totalLikeCount
        });
        return;
      }

      this.pendingLikes += (data.likeCount || 1);
      if (data.totalLikeCount) {
        this.latestTotalLikes = data.totalLikeCount;
      }
      this.scheduleFlush();
    });

    this.events.on('engagement:share_raw', (data) => {
      const settings = this.state.get('settings');
      if (!settings.aggregationEnabled) {
        this.events.emit('reaction:share_burst', {
          count: data.shareCount || 1,
          user: data
        });
        return;
      }

      this.pendingShares += (data.shareCount || 1);
      this.scheduleFlush();
    });

    this.events.on('engagement:follow_raw', (data) => {
      const settings = this.state.get('settings');
      if (!settings.aggregationEnabled) {
        this.events.emit('reaction:follow_burst', { user: data });
        return;
      }

      this.pendingFollows.push(data);
      this.scheduleFlush();
    });
  }

  scheduleFlush() {
    if (this.timer) return;
    const windowMs = this.state.get('settings').aggregationWindow || 600;
    this.timer = setTimeout(() => {
      this.flush();
    }, windowMs);
  }

  flush() {
    this.timer = null;

    if (this.pendingLikes > 0) {
      this.events.emit('reaction:like_burst', {
        count: this.pendingLikes,
        total: this.latestTotalLikes
      });
      this.pendingLikes = 0;
    }

    if (this.pendingShares > 0) {
      this.events.emit('reaction:share_burst', {
        count: this.pendingShares
      });
      this.pendingShares = 0;
    }

    if (this.pendingFollows.length > 0) {
      const batch = [...this.pendingFollows];
      this.pendingFollows = [];
      this.events.emit('reaction:follow_batch', {
        count: batch.length,
        users: batch,
        latestUser: batch[batch.length - 1]
      });
    }
  }

  clear() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingLikes = 0;
    this.pendingShares = 0;
    this.pendingFollows = [];
  }
}

if (typeof window !== 'undefined') {
  window.ReactionAggregator = ReactionAggregator;
}
if (typeof globalThis !== 'undefined') {
  globalThis.ReactionAggregator = ReactionAggregator;
}
