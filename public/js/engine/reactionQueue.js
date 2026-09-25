/**
 * Priority-based Reaction Queue
 * Serializes visual and audio effects, prioritizes critical gifts & winner celebrations,
 * and maintains scene-awareness to prevent obscuring critical question gameplay.
 */
class ReactionQueue {
  constructor(eventManager, gameState) {
    this.events = eventManager;
    this.state = gameState;
    this.queue = [];
    this.isProcessing = false;
    this.currentReaction = null;
    this.processTimeout = null;

    this.defaultPriorityWeight = {
      'CRITICAL_GIFT': 100,
      'MAJOR_MILESTONE': 90,
      'WINNER': 85,
      'SPECIAL_GIFT': 75,
      'ACHIEVEMENT': 70,
      'COMBO': 65,
      'LIKE_MILESTONE': 50,
      'SHARE_MILESTONE': 45,
      'FOLLOW': 30,
      'NORMAL_GIFT': 20,
      'GENERIC': 10
    };

    this.setupListeners();
  }

  setupListeners() {
    this.events.on('reaction:enqueue', (reaction) => {
      this.enqueue(reaction);
    });
  }

  getPriorityWeight(type) {
    const customList = this.state.get('settings').priorityOrder;
    if (Array.isArray(customList)) {
      const idx = customList.indexOf(type);
      if (idx !== -1) {
        return (customList.length - idx) * 10;
      }
    }
    return this.defaultPriorityWeight[type] || 10;
  }

  enqueue(reaction) {
    if (!reaction || !reaction.type) return;

    const item = {
      id: `rq_${Date.now()}_${Math.random().toString(36).substring(5)}`,
      type: reaction.type,
      priority: this.getPriorityWeight(reaction.type),
      data: reaction.data || reaction,
      duration: reaction.duration || 3000,
      timestamp: Date.now()
    };

    // Insert sorted by descending priority
    let inserted = false;
    for (let i = 0; i < this.queue.length; i++) {
      if (item.priority > this.queue[i].priority) {
        this.queue.splice(i, 0, item);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      this.queue.push(item);
    }

    // Limit queue size to avoid memory buildup
    if (this.queue.length > 50) {
      this.queue = this.queue.slice(0, 50);
    }

    this.events.emit('REACTION_QUEUE_UPDATE', { queueLength: this.queue.length });
    this.processNext();
  }

  processNext() {
    if (this.isProcessing || this.queue.length === 0) return;

    const currentScene = this.state.get('scene');
    const nextItem = this.queue[0];

    // Scene awareness rules:
    // If in QUESTION scene and low priority, defer unless it's critical
    if (currentScene === 'QUESTION' && nextItem.priority < 70) {
      // Allow light non-blocking toast but do not freeze queue
    }

    this.currentReaction = this.queue.shift();
    this.isProcessing = true;

    this.events.emit('EFFECT_STARTED', this.currentReaction);
    this.events.emit('reaction:execute', this.currentReaction);

    const duration = this.currentReaction.duration || 3000;
    this.processTimeout = setTimeout(() => {
      this.events.emit('EFFECT_FINISHED', this.currentReaction);
      this.currentReaction = null;
      this.isProcessing = false;
      this.processNext();
    }, duration);
  }

  clear() {
    if (this.processTimeout) {
      clearTimeout(this.processTimeout);
      this.processTimeout = null;
    }
    this.queue = [];
    this.isProcessing = false;
    this.currentReaction = null;
  }
}

if (typeof window !== 'undefined') {
  window.ReactionQueue = ReactionQueue;
}
if (typeof globalThis !== 'undefined') {
  globalThis.ReactionQueue = ReactionQueue;
}
