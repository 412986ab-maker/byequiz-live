/**
 * BYE QUIZ LIVE - Proprietary Cinematic Gift Event Engine
 * Zero Unicode Emojis | GPU-Friendly Vector Artifacts | Multi-Tier Choreography
 */
class GiftEventEngine {
  constructor(eventManager, gameState) {
    this.events = eventManager;
    this.state = gameState;
    this.queue = [];
    this.isProcessing = false;
    this.comboCount = 0;
    this.comboTimer = null;
    this.lastSender = null;
    this.rootContainer = null;

    this.initDOM();
    this.setupListeners();
  }

  initDOM() {
    if (typeof document === 'undefined') return;

    let overlay = document.getElementById('gift-cinematic-root');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'gift-cinematic-root';
      overlay.className = 'gift-cinematic-root';
      const streamContainer = document.querySelector('.stream-container') || document.body;
      streamContainer.appendChild(overlay);
    }
    this.rootContainer = overlay;
  }

  setupListeners() {
    if (!this.events) return;

    this.events.on('reaction:gift_event', (giftData) => {
      this.enqueueGift(giftData);
    });
  }

  getTier(diamonds) {
    if (diamonds >= 1000) return 'LEGENDARY';
    if (diamonds >= 200) return 'EPIC';
    if (diamonds >= 20) return 'PREMIUM';
    return 'COMMON';
  }

  getPriorityWeight(tier) {
    switch (tier) {
      case 'LEGENDARY': return 4;
      case 'EPIC': return 3;
      case 'PREMIUM': return 2;
      default: return 1;
    }
  }

  enqueueGift(data) {
    const diamonds = data.diamonds || ((data.diamondCount || 1) * (data.giftCount || 1)) || 1;
    const tier = this.getTier(diamonds);
    const item = {
      data,
      diamonds,
      tier,
      priority: this.getPriorityWeight(tier),
      timestamp: Date.now()
    };

    // Maintain Combo Meter
    this.updateCombo(data);

    // Insert into priority queue
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

    this.processQueue();
  }

  updateCombo(data) {
    const sender = data.nickname || data.sender || 'anon';
    if (this.lastSender === sender) {
      this.comboCount++;
    } else {
      this.comboCount = 1;
      this.lastSender = sender;
    }

    clearTimeout(this.comboTimer);
    this.comboTimer = setTimeout(() => {
      this.comboCount = 0;
      this.lastSender = null;
      this.hideComboBadge();
    }, 4500);

    if (this.comboCount >= 2) {
      this.renderComboBadge(this.comboCount);
    }
  }

  renderComboBadge(count) {
    let badge = document.getElementById('gift-combo-badge');
    if (!badge && this.rootContainer) {
      badge = document.createElement('div');
      badge.id = 'gift-combo-badge';
      badge.className = 'gift-combo-badge animate-pop';
      this.rootContainer.appendChild(badge);
    }
    if (badge) {
      const flameIcon = (typeof IconSystem !== 'undefined') ? IconSystem.get('flame', { size: 16, color: '#f59e0b' }) : '';
      badge.innerHTML = `
        <span class="combo-icon-wrap">${flameIcon}</span>
        <span class="combo-text">COMBO <b class="combo-num">×${count}</b></span>
      `;
      badge.classList.remove('animate-pop');
      void badge.offsetWidth; // trigger reflow
      badge.classList.add('animate-pop');
    }
  }

  hideComboBadge() {
    const badge = document.getElementById('gift-combo-badge');
    if (badge && badge.parentNode) {
      badge.classList.add('animate-fade-out');
      setTimeout(() => {
        if (badge.parentNode) badge.parentNode.removeChild(badge);
      }, 300);
    }
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    const item = this.queue.shift();
    await this.executeCinematicSequence(item);

    this.isProcessing = false;
    if (this.queue.length > 0) {
      setTimeout(() => this.processQueue(), 200);
    }
  }

  /**
   * Custom Procedural Vector Artifact Generators
   */
  getGiftArtifactSVG(tier, size = 120) {
    switch (tier) {
      case 'LEGENDARY':
        // Celestial Sovereign Apex Crown & Diamond Ray
        return `
          <div class="gift-artifact-wrapper artifact-legendary">
            <svg class="artifact-svg" width="${size}" height="${size}" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="goldAura" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#ffd700" />
                  <stop offset="50%" stop-color="#ff9900" />
                  <stop offset="100%" stop-color="#ff007f" />
                </linearGradient>
                <filter id="goldGlow">
                  <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <circle cx="50" cy="50" r="44" fill="none" stroke="url(#goldAura)" stroke-width="2" stroke-dasharray="8 4" class="spin-ring" />
              <circle cx="50" cy="50" r="34" fill="rgba(255,215,0,0.15)" stroke="#ffd700" stroke-width="1.5" />
              <!-- Crown Motif -->
              <path d="M26 65 L32 38 L42 50 L50 30 L58 50 L68 38 L74 65 Z" fill="url(#goldAura)" filter="url(#goldGlow)" />
              <polygon points="50,18 54,26 46,26" fill="#ffffff" />
              <circle cx="50" cy="54" r="6" fill="#ffffff" />
              <rect x="28" y="67" width="44" height="6" rx="2" fill="#ffd700" />
            </svg>
          </div>
        `;

      case 'EPIC':
        // Supernova Core / Phoenix Shard
        return `
          <div class="gift-artifact-wrapper artifact-epic">
            <svg class="artifact-svg" width="${size}" height="${size}" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="epicAura" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#00f2fe" />
                  <stop offset="50%" stop-color="#a855f7" />
                  <stop offset="100%" stop-color="#ec4899" />
                </linearGradient>
              </defs>
              <ellipse cx="50" cy="50" rx="42" ry="16" fill="none" stroke="url(#epicAura)" stroke-width="2" transform="rotate(30 50 50)" class="spin-ring" />
              <ellipse cx="50" cy="50" rx="42" ry="16" fill="none" stroke="url(#epicAura)" stroke-width="2" transform="rotate(-30 50 50)" class="spin-ring-rev" />
              <polygon points="50,15 62,38 85,50 62,62 50,85 38,62 15,50 38,38" fill="url(#epicAura)" opacity="0.85" />
              <circle cx="50" cy="50" r="10" fill="#ffffff" />
            </svg>
          </div>
        `;

      case 'PREMIUM':
        // Hyper Crystal / Plasma Capsule
        return `
          <div class="gift-artifact-wrapper artifact-premium">
            <svg class="artifact-svg" width="${size}" height="${size}" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="premGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#00f2fe" />
                  <stop offset="100%" stop-color="#4facfe" />
                </linearGradient>
              </defs>
              <polygon points="50,12 80,32 80,68 50,88 20,68 20,32" fill="rgba(0,242,254,0.15)" stroke="url(#premGrad)" stroke-width="2.5" />
              <polygon points="50,22 70,36 70,64 50,78 30,64 30,36" fill="url(#premGrad)" opacity="0.75" />
              <line x1="50" y1="22" x2="50" y2="78" stroke="#ffffff" stroke-width="1.5" />
            </svg>
          </div>
        `;

      default:
        // Quantum Cyber Blossom / Light Shard
        return `
          <div class="gift-artifact-wrapper artifact-common">
            <svg class="artifact-svg" width="${size}" height="${size}" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="28" fill="rgba(16,185,129,0.15)" stroke="#10b981" stroke-width="2" />
              <polygon points="50,26 56,44 74,50 56,56 50,74 44,56 26,50 44,44" fill="#10b981" />
              <circle cx="50" cy="50" r="5" fill="#ffffff" />
            </svg>
          </div>
        `;
    }
  }

  /**
   * The 9-Stage Cinematic Sequence Execution
   */
  async executeCinematicSequence(item) {
    const { data, diamonds, tier } = item;
    const scene = this.state.get('scene');
    const isQuestionScene = scene === 'QUESTION' || scene === 'ANSWERING';

    const senderName = data.nickname || data.displayName || data.sender || 'داعم مجهول';
    const avatar = data.avatar || data.senderAvatar || (`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(senderName)}`);
    const giftName = data.giftName || 'هدية';
    const count = data.giftCount || data.repeatCount || 1;

    // 1. GIFT DETECTED & 2. EVENT SIGNAL (Audio & Frame Pulse)
    if (typeof window !== 'undefined' && window.soundFX) {
      if (tier === 'LEGENDARY') window.soundFX.playWinner();
      else if (tier === 'EPIC') window.soundFX.playMajorMilestone();
      else if (tier === 'PREMIUM') window.soundFX.playGiftBig();
      else window.soundFX.playGiftSmall();
    }

    // 3. ENERGY WAVE & 5. PARTICLE TRAIL (Via Canvas)
    if (typeof window !== 'undefined' && window.confettiEngine) {
      const pCount = (tier === 'LEGENDARY') ? 120 : (tier === 'EPIC') ? 70 : (tier === 'PREMIUM') ? 35 : 15;
      window.confettiEngine.launch(pCount, tier === 'LEGENDARY' ? 'DIAMOND' : 'SHARD');
      if (tier === 'LEGENDARY' || tier === 'EPIC') {
        window.confettiEngine.spawnShockwave(window.innerWidth / 2, window.innerHeight / 2, tier === 'LEGENDARY' ? '#ffd700' : '#00f2fe', 220);
      }
    }

    // 4. CUSTOM GIFT OBJECT & 8. USER NAME / VALUE BADGE
    const eventCard = document.createElement('div');
    eventCard.className = `cinematic-gift-card tier-${tier.toLowerCase()} ${isQuestionScene ? 'compact-position' : 'hero-position'} animate-gift-entry`;

    const diamondIcon = (typeof IconSystem !== 'undefined') ? IconSystem.get('diamond', { size: 14, color: '#00f2fe' }) : '';
    const trophyIcon = (typeof IconSystem !== 'undefined') ? IconSystem.get('trophy', { size: 14, color: '#ffd700' }) : '';

    eventCard.innerHTML = `
      <div class="gift-card-ambient-aura"></div>
      <div class="gift-card-body">
        <div class="gift-visual-core">
          ${this.getGiftArtifactSVG(tier, isQuestionScene ? 70 : 100)}
        </div>
        <div class="gift-details-core">
          <div class="gift-sender-row">
            <img src="${avatar}" class="gift-avatar-img" alt="" />
            <div class="gift-user-meta">
              <div class="gift-sender-title">${senderName}</div>
              <div class="gift-rank-pill">${tier} SUPPORTER</div>
            </div>
          </div>
          <div class="gift-name-row">
            <span class="gift-action-verb">أرسل</span>
            <span class="gift-item-title">${giftName}</span>
            ${count > 1 ? `<span class="gift-repeat-pill">×${count}</span>` : ''}
            <span class="gift-diamonds-pill">${diamondIcon} <b>${diamonds}</b></span>
          </div>
        </div>
      </div>
    `;

    if (this.rootContainer) {
      this.rootContainer.appendChild(eventCard);
    }

    // 6. LIGHTING EVENT & 7. IMPACT (Controlled screen shake on Legendary)
    if (tier === 'LEGENDARY' && !isQuestionScene) {
      const container = document.querySelector('.stream-container');
      if (container) {
        container.classList.add('screen-pulse-shake');
        setTimeout(() => container.classList.remove('screen-pulse-shake'), 600);
      }
    }

    // Display duration
    const displayDuration = (tier === 'LEGENDARY') ? 4000 : (tier === 'EPIC') ? 3000 : 2200;

    await new Promise((resolve) => setTimeout(resolve, displayDuration));

    // 9. EVENT RESOLUTION & Cleanup
    eventCard.classList.remove('animate-gift-entry');
    eventCard.classList.add('animate-gift-exit');

    await new Promise((resolve) => setTimeout(resolve, 400));
    if (eventCard.parentNode) {
      eventCard.parentNode.removeChild(eventCard);
    }
  }
}

if (typeof window !== 'undefined') {
  window.GiftEventEngine = GiftEventEngine;
}
if (typeof globalThis !== 'undefined') {
  globalThis.GiftEventEngine = GiftEventEngine;
}
