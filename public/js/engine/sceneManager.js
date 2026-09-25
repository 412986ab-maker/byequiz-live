/**
 * BYE QUIZ LIVE - Scene & UI Manager
 * Controls all scene architectures, animated vector HUD, circular radial countdown,
 * dynamic roulette, podium leaderboards, and safe user data rendering.
 */
class SceneManager {
  constructor(eventManager, gameState, participantManager, questionEngine, statisticsEngine) {
    this.events = eventManager;
    this.state = gameState;
    this.participants = participantManager;
    this.questions = questionEngine;
    this.stats = statisticsEngine;

    this.currentScene = 'JOIN';
    this.seatPage = 0;
    this.seatPageTimer = null;
    this.rouletteInterval = null;
    this.dom = {
      stage: typeof document !== 'undefined' ? document.getElementById('stage-area') : null,
      headerCategory: typeof document !== 'undefined' ? document.getElementById('header-category') : null,
      timerContainer: typeof document !== 'undefined' ? document.getElementById('timer-container') : null,
      timerBar: typeof document !== 'undefined' ? document.getElementById('timer-bar') : null,
      timerText: typeof document !== 'undefined' ? document.getElementById('timer-text') : null,
      statParticipants: typeof document !== 'undefined' ? document.getElementById('stat-participants') : null,
      valViewers: typeof document !== 'undefined' ? document.getElementById('val-viewers') : null,
      valLikes: typeof document !== 'undefined' ? document.getElementById('val-likes') : null,
      valShares: typeof document !== 'undefined' ? document.getElementById('val-shares') : null,
      valGifts: typeof document !== 'undefined' ? document.getElementById('val-gifts') : null,
      valComments: typeof document !== 'undefined' ? document.getElementById('val-comments') : null,
      valDiamonds: typeof document !== 'undefined' ? document.getElementById('val-diamonds') : null,
      valRound: typeof document !== 'undefined' ? document.getElementById('val-round') : null,
      leaderboardList: typeof document !== 'undefined' ? document.getElementById('footer-leaderboard-items') : null
    };

    this.setupListeners();
    this.initAudioUnlock();
  }

  setupListeners() {
    this.state.subscribe('scene', (scene) => this.render(scene));
    this.state.subscribe('engagement', () => this.updateHeaderStats());
    this.state.subscribe('timer', (timer) => this.updateTimerDisplay(timer));

    this.events.on('PARTICIPANT_JOINED', (participant) => {
      this.updateHeaderStats();
      if (this.currentScene === 'WAITING') {
        this.triggerFirstParticipantCinematic(participant);
      } else if (this.currentScene === 'JOIN' || this.currentScene === 'REGISTRATION') {
        this.renderRegistrationGrid();
      }
    });

    this.events.on('PARTICIPANTS_UPDATED', () => {
      this.updateHeaderStats();
      if (this.currentScene === 'JOIN' || this.currentScene === 'REGISTRATION') {
        this.renderRegistrationGrid();
      }
    });

    this.events.on('score:updated', () => this.updateLeaderboard());
  }

  initAudioUnlock() {
    if (typeof document === 'undefined') return;

    const isUnlocked = localStorage.getItem('byequiz_audio_unlocked');
    if (!isUnlocked) {
      const banner = document.createElement('div');
      banner.className = 'audio-unlock-banner';
      banner.innerHTML = `${IconSystem.get('sound', { size: 16 })} <span>اضغط لتفعيل الصوت والتأثيرات</span>`;
      banner.onclick = () => {
        if (window.soundFX) window.soundFX.init();
        localStorage.setItem('byequiz_audio_unlocked', 'true');
        banner.remove();
      };
      document.body.appendChild(banner);
    }
  }

  transitionTo(sceneName, payload = {}) {
    this.currentScene = sceneName;
    this.state.set('scene', sceneName);
    this.events.emit(`scene:${sceneName.toLowerCase()}`, payload);
    this.events.emit('SCENE_CHANGED', { scene: sceneName, payload });
  }

  render(sceneName) {
    if (!this.dom.stage) return;
    this.currentScene = sceneName;

    if (this.rouletteInterval) {
      clearInterval(this.rouletteInterval);
      this.rouletteInterval = null;
    }
    if (this.seatPageTimer && !['JOIN', 'REGISTRATION'].includes(sceneName)) {
      clearInterval(this.seatPageTimer);
      this.seatPageTimer = null;
    }

    // Timer visibility: Active during QUESTION, ANSWERING, LOCK
    if (this.dom.timerContainer) {
      const showTimer = ['QUESTION', 'ANSWERING', 'LOCK'].includes(sceneName);
      this.dom.timerContainer.style.visibility = showTimer ? 'visible' : 'hidden';
    }

    switch (sceneName) {
      case 'WAITING':
        this.renderWaitingScene();
        break;
      case 'JOIN':
      case 'REGISTRATION':
        this.renderRegistrationScene();
        break;
      case 'COUNTDOWN':
      case 'PARTICIPANTS':
        this.renderParticipantsScene();
        break;
      case 'QUESTION':
      case 'ANSWERING':
        this.renderQuestionScene();
        break;
      case 'LOCK':
        this.renderLockScene();
        break;
      case 'REVEAL':
      case 'RESULTS':
      case 'ANSWERS':
        this.renderAnswersScene();
        break;
      case 'DRAW':
        this.renderDrawScene();
        break;
      case 'WINNER':
        this.renderWinnerScene();
        break;
      case 'LEADERBOARD':
      case 'PODIUM':
      case 'STATS':
        this.renderPodiumScene();
        break;
      default:
        this.renderRegistrationScene();
        break;
    }
  }

  // 1. WAITING SCENE (Interactive Events Stage)
  renderWaitingScene() {
    if (this.dom.headerCategory) {
      this.dom.headerCategory.innerHTML = `${IconSystem.get('live', { size: 16 })} <span>منصة الفعاليات المباشرة</span>`;
    }

    this.dom.stage.innerHTML = `
      <div class="scene-frame">
        <div class="scene-title-badge">
          ${IconSystem.get('timer', { size: 14 })} <span>الاستعداد المباشر • الفعاليات</span>
        </div>
        <div class="waiting-hero-box">
          <div class="radar-spinner-box">
            <div class="radar-ring"></div>
            <div class="radar-ring-inner"></div>
            <div class="radar-center-icon">
              ${IconSystem.get('live', { size: 36, color: 'var(--cyber-cyan)' })}
            </div>
          </div>
          <h2 class="waiting-title">BYE QUIZ LIVE</h2>
          <p class="waiting-subtitle">المسابقة التفاعلية الكبرى للبث المباشر. استعد للتحدي والجوائز الفورية!</p>

          <div class="waiting-features-grid">
            <div class="waiting-feature-card">
              ${IconSystem.get('star', { size: 20 })}
              <span class="waiting-feature-title">تحديات وأسئلة</span>
            </div>
            <div class="waiting-feature-card">
              ${IconSystem.get('draw', { size: 20 })}
              <span class="waiting-feature-title">سحب الحظ</span>
            </div>
            <div class="waiting-feature-card">
              ${IconSystem.get('trophy', { size: 20 })}
              <span class="waiting-feature-title">جوائز المتصدرين</span>
            </div>
          </div>
        </div>
        <div class="join-callout-box">
          <span class="join-instruction">اكتب في التعليقات لفتح مقاعد الجولة:</span>
          <span class="join-keyword-pill">!join أو تم</span>
        </div>
      </div>
    `;
  }

  // First Participant Cinematic Shot
  triggerFirstParticipantCinematic(participant = {}) {
    this.currentScene = 'FIRST_JOIN';

    if (this.dom.headerCategory) {
      this.dom.headerCategory.innerHTML = `${IconSystem.get('live', { size: 16 })} <span>انضم أول مشترك!</span>`;
    }

    if (typeof window !== 'undefined' && window.soundFX) {
      if (window.soundFX.playFanfare) window.soundFX.playFanfare();
      else if (window.soundFX.playWinner) window.soundFX.playWinner();
    }
    if (typeof window !== 'undefined' && window.confettiFX && window.confettiFX.burst) {
      window.confettiFX.burst();
    }

    const avatarUrl = participant.avatar || ParticipantCard.getFallbackAvatar(participant.displayName || participant.nickname || 'VIP');
    const name = participant.displayName || participant.nickname || 'المتسابق الأول';

    if (this.dom.stage) {
      this.dom.stage.innerHTML = `
        <div class="scene-frame">
          <div class="scene-title-badge">
            ${IconSystem.get('star', { size: 14, color: 'var(--luxury-gold)' })} <span>افتتاح مقاعد الجولة!</span>
          </div>
          <div class="first-join-cinematic-frame">
            <div class="first-join-halo-aura"></div>
            <div class="first-join-badge-tag">
              ${IconSystem.get('crown', { size: 14, color: '#34d399' })} <span>المشترك الأول • مقعد رقم #1</span>
            </div>
            <div class="first-join-avatar-box">
              <div class="first-join-ring-spinner"></div>
              <img src="${avatarUrl}" class="first-join-avatar-img" alt="${name}" />
              <span class="first-join-slot-pill">VIP #1</span>
            </div>
            <div class="first-join-name">${name}</div>
            <div class="first-join-desc">انضم إلى المنافسة! جارٍ فتح مقاعد الجولة...</div>
          </div>
          <div class="join-callout-box">
            <span class="join-instruction">اكتب في الشات لحجز مقعدك الآن:</span>
            <span class="join-keyword-pill">!join</span>
          </div>
        </div>
      `;
    }

    setTimeout(() => {
      this.transitionTo('REGISTRATION');
    }, 2200);
  }

  // 2. JOIN / REGISTRATION SCENE
  renderRegistrationScene() {
    if (this.dom.headerCategory) {
      this.dom.headerCategory.innerHTML = `${IconSystem.get('participants', { size: 16 })} <span>مرحلة الانضمام والتسجيل</span>`;
    }

    const targetRaw = Number(this.state.get('settings').targetParticipants);
    const target = Number.isFinite(targetRaw) && targetRaw >= 0 ? targetRaw : 36;
    const pool = this.participants.getDrawPoolUsers();
    const targetLabel = target > 0 ? String(target) : '∞';

    this.dom.stage.innerHTML = `
      <div class="scene-frame">
        <div class="scene-title-badge">
          ${IconSystem.get('participants', { size: 14 })} <span>مقاعد المتسابقين (<bdi dir="ltr">${pool.length} / ${targetLabel}</bdi>)</span>
        </div>
        <div class="join-grid-container" id="reg-grid">
          <!-- Filled dynamically -->
        </div>
        <div class="join-callout-box">
          <span class="join-instruction">اكتب في الشات للانضمام فوراً:</span>
          <span class="join-keyword-pill">!join أو "تم"</span>
        </div>
      </div>
    `;

    this.renderRegistrationGrid();
  }

  renderRegistrationGrid() {
    const gridEl = document.getElementById('reg-grid');
    if (!gridEl) return;

    const targetRaw = Number(this.state.get('settings').targetParticipants);
    const target = Number.isFinite(targetRaw) && targetRaw >= 0 ? targetRaw : 36;
    const pool = this.participants.getDrawPoolUsers();

    // The mobile broadcast stage has 36 visible seats (6x6).
    // Larger rounds are paged automatically so cards never overlap or shrink into unusable tiles.
    const visibleSeats = 36;
    const pageCount = Math.max(1, Math.ceil(pool.length / visibleSeats));
    this.seatPage = Math.min(this.seatPage, pageCount - 1);

    const start = this.seatPage * visibleSeats;
    const visiblePool = pool.slice(start, start + visibleSeats);

    let html = '';
    for (let i = 0; i < visibleSeats; i++) {
      const globalIndex = start + i;
      const user = visiblePool[i] || null;
      html += ParticipantCard.renderSlot(user, globalIndex, target);
    }
    gridEl.innerHTML = html;
    gridEl.dataset.page = String(this.seatPage + 1);
    gridEl.dataset.pages = String(pageCount);

    if (this.seatPageTimer) {
      clearInterval(this.seatPageTimer);
      this.seatPageTimer = null;
    }
    if (pageCount > 1) {
      this.seatPageTimer = setInterval(() => {
        const currentPool = this.participants.getDrawPoolUsers();
        const currentPages = Math.max(1, Math.ceil(currentPool.length / visibleSeats));
        this.seatPage = (this.seatPage + 1) % currentPages;
        this.renderRegistrationGrid();
      }, 4500);
    }
  }

  // 3. COUNTDOWN & PARTICIPANTS COMPLETE SCENE
  renderParticipantsScene() {
    if (this.dom.headerCategory) {
      this.dom.headerCategory.innerHTML = `${IconSystem.get('correct', { size: 16 })} <span>اكتملت مقاعد الجولة!</span>`;
    }

    this.dom.stage.innerHTML = `
      <div class="scene-frame">
        <div class="scene-title-badge">
          ${IconSystem.get('trophy', { size: 14 })} <span>الاستعداد لطرح السؤال</span>
        </div>
        <div class="countdown-hero">
          <div class="countdown-big-num" id="countdown-num">3</div>
          <div style="font-size: 14px; font-weight: 800; color: var(--text-dim); margin-top: 8px;">
            تجهّز للإجابة بأسرع وقت!
          </div>
        </div>
        <div class="join-callout-box">
          <span class="join-instruction">طريقة الإجابة في الشات:</span>
          <span class="join-keyword-pill">!answer A أو أ / ب / ج / د</span>
        </div>
      </div>
    `;
  }

  // 4. QUESTION & ANSWERING SCENE
  renderQuestionScene() {
    const q = this.state.get('currentQuestion') || {
      category: 'ثقافة عامة',
      question: 'في انتظار طرح السؤال...',
      options: ['أ', 'ب', 'ج', 'د'],
      points: 100
    };

    if (this.dom.headerCategory) {
      this.dom.headerCategory.innerHTML = `${IconSystem.get('question', { size: 16 })} <span>${q.category || 'ثقافة عامة'}</span>`;
    }

    const letters = ['A', 'B', 'C', 'D'];
    const arabicLetters = ['أ', 'ب', 'ج', 'د'];
    let optionsHtml = '';

    if (Array.isArray(q.options) && q.options.length > 0) {
      optionsHtml = q.options.map((opt, idx) => `
        <div class="option-btn" id="opt-btn-${idx}">
          <div class="opt-letter-tag">${letters[idx] || (idx + 1)}</div>
          <span class="opt-text">${opt}</span>
          <span class="opt-counter" id="opt-count-${idx}">0</span>
        </div>
      `).join('');
    }

    this.dom.stage.innerHTML = `
      <div class="scene-frame">
        <div class="question-card-box">
          <div class="q-badge-row">
            <span class="scene-title-badge" style="margin-bottom:0;">
              ${IconSystem.get('question', { size: 12 })} <span>${q.category || 'عام'}</span>
            </span>
            <span class="q-points-badge">
              ${IconSystem.get('winner', { size: 12 })} +${q.points || 100} نقطة
            </span>
          </div>
          <div class="question-text">${q.question}</div>
          ${q.image ? `<img src="${q.image}" class="question-media-img" alt="Question" />` : ''}
        </div>
        <div class="options-grid">
          ${optionsHtml}
        </div>
        <div class="join-callout-box">
          <span class="join-instruction">اكتب إجابتك الآن في التعليقات:</span>
          <span class="join-keyword-pill">!answer [الحرف]</span>
        </div>
      </div>
    `;
  }

  // 5. LOCK SCENE (When Timer Ends)
  renderLockScene() {
    if (this.dom.headerCategory) {
      this.dom.headerCategory.innerHTML = `${IconSystem.get('lock', { size: 16 })} <span>تم إغلاق استقبال الإجابات</span>`;
    }

    const q = this.state.get('currentQuestion');
    if (!q) return;

    this.renderQuestionScene();
    const callout = this.dom.stage.querySelector('.join-callout-box');
    if (callout) {
      callout.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:center; gap:8px; width:100%; color:var(--luxury-gold); font-weight:900;">
          ${IconSystem.get('lock', { size: 18 })} <span>انتهى الوقت! جارٍ مراجعة الإجابات وكشف النتيجة...</span>
        </div>
      `;
    }
  }

  // 6. REVEAL & RESULTS SCENE
  renderAnswersScene() {
    const q = this.state.get('currentQuestion');
    if (!q) return;

    if (this.dom.headerCategory) {
      this.dom.headerCategory.innerHTML = `${IconSystem.get('correct', { size: 16 })} <span>الإجابة الصحيحة</span>`;
    }

    const correctAnswer = q.correctAnswer || (q.answers ? q.answers[0] : '');
    const letters = ['A', 'B', 'C', 'D'];

    let optionsHtml = '';
    if (Array.isArray(q.options)) {
      optionsHtml = q.options.map((opt, idx) => {
        const isCorrect = (opt === correctAnswer || letters[idx] === correctAnswer);
        return `
          <div class="option-btn ${isCorrect ? 'state-correct' : 'state-wrong'}">
            <div class="opt-letter-tag">${letters[idx]}</div>
            <span class="opt-text">${opt}</span>
            ${isCorrect ? IconSystem.get('correct', { size: 18 }) : ''}
          </div>
        `;
      }).join('');
    }

    this.dom.stage.innerHTML = `
      <div class="scene-frame">
        <div class="question-card-box">
          <div class="q-badge-row">
            <span class="scene-title-badge" style="margin-bottom:0;">
              ${IconSystem.get('correct', { size: 12 })} <span>تم كشف الإجابة</span>
            </span>
            <span class="q-points-badge">
              ${IconSystem.get('winner', { size: 12 })} الإجابة النموذجية
            </span>
          </div>
          <div class="question-text">${q.question}</div>
          ${q.explanation ? `<div style="font-size:12px; color:var(--cyber-teal); margin-top:6px;">${q.explanation}</div>` : ''}
        </div>
        <div class="options-grid">
          ${optionsHtml}
        </div>
        <div class="join-callout-box">
          <span class="join-instruction">تجهّز لعجلة السحب العشوائي:</span>
          <span class="join-keyword-pill">سحب القرعة المباشر</span>
        </div>
      </div>
    `;
  }

  // 7. DRAW / ROULETTE SCENE
  renderDrawScene() {
    if (this.dom.headerCategory) {
      this.dom.headerCategory.innerHTML = `${IconSystem.get('draw', { size: 16 })} <span>عجلة السحب العشوائي</span>`;
    }

    const pool = this.participants.getDrawPoolUsers();
    const candidate = pool[0] || { nickname: 'مشارك', avatar: ParticipantCard.getFallbackAvatar('P') };

    this.dom.stage.innerHTML = `
      <div class="scene-frame">
        <div class="scene-title-badge">
          ${IconSystem.get('draw', { size: 14 })} <span>سحب الحظ المباشر</span>
        </div>
        <div class="draw-stage-box">
          <div class="roulette-viewport">
            <div class="roulette-glow-ring"></div>
            <img src="${candidate.avatar}" class="roulette-candidate-avatar" id="roulette-img" alt="" />
          </div>
          <div class="draw-candidate-name" id="roulette-name">${candidate.nickname}</div>
          <div class="draw-pool-count">المؤهلون للسحب: <b>${pool.length}</b> متسابق</div>
        </div>
        <div class="join-callout-box">
          <span class="join-instruction">جارٍ اختيار بطل الجولة عشوائياً...</span>
          <span class="join-keyword-pill">Lucky Draw</span>
        </div>
      </div>
    `;

    // Listen to draw steps from draw engine
    this.events.on('draw:step', ({ candidate }) => {
      const img = document.getElementById('roulette-img');
      const name = document.getElementById('roulette-name');
      if (img && candidate.avatar) img.src = candidate.avatar;
      if (name) name.textContent = candidate.nickname || candidate.displayName || 'مشارك';
    });
  }

  // 8. WINNER SCENE
  renderWinnerScene(winnerData = {}) {
    const winner = winnerData.participant || winnerData.winner || this.state.get('currentWinner') || {
      nickname: 'بطل الجولة',
      displayName: 'بطل الجولة',
      score: 500,
      avatar: ParticipantCard.getFallbackAvatar('Winner')
    };

    if (this.dom.headerCategory) {
      this.dom.headerCategory.innerHTML = `${IconSystem.get('trophy', { size: 16 })} <span>بطل الجولة الفائز!</span>`;
    }

    if (window.soundFX) window.soundFX.playWinner();
    if (window.confettiFX) window.confettiFX.celebrateWinner();

    this.dom.stage.innerHTML = `
      <div class="scene-frame">
        <div class="scene-title-badge">
          ${IconSystem.get('trophy', { size: 14 })} <span>مبروك الفوز والتتويج!</span>
        </div>
        <div class="winner-hero-box">
          <div class="winner-avatar-frame">
            <div class="winner-crown-icon">
              ${IconSystem.get('trophy', { size: 28, color: 'var(--luxury-gold)' })}
            </div>
            <img src="${winner.avatar}" class="winner-avatar-img" alt="${winner.displayName}" />
          </div>
          <div class="winner-title">WINNER!</div>
          <div class="winner-name">${winner.displayName || winner.nickname}</div>
          <div class="winner-score-pill">
            ${IconSystem.get('winner', { size: 16 })} +${winner.score || 500} نقطة
          </div>
        </div>
        <div class="join-callout-box">
          <span class="join-instruction">تجهّز للجولة التالية فوراً:</span>
          <span class="join-keyword-pill">Next Round</span>
        </div>
      </div>
    `;
  }

  // 9. LEADERBOARD & PODIUM SCENE
  renderPodiumScene() {
    if (this.dom.headerCategory) {
      this.dom.headerCategory.innerHTML = `${IconSystem.get('ranking', { size: 16 })} <span>منصة المتصدرين الكبرى</span>`;
    }

    const leaders = this.participants.getLeaderboard(10);
    const top1 = leaders[0] || null;
    const top2 = leaders[1] || null;
    const top3 = leaders[2] || null;

    let restHtml = '';
    for (let i = 3; i < leaders.length; i++) {
      const u = leaders[i];
      restHtml += `
        <div class="leader-item-card">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-family:'Orbitron'; font-weight:900; font-size:12px; color:var(--text-dim);">#${i + 1}</span>
            <img src="${u.avatar}" style="width:28px; height:28px; border-radius:50%;" alt="" />
            <span style="font-size:12px; font-weight:700;">${u.displayName || u.nickname}</span>
          </div>
          <span style="font-family:'Orbitron'; font-weight:800; font-size:12px; color:var(--cyber-cyan);">${u.score || u.points || 0} pts</span>
        </div>
      `;
    }

    this.dom.stage.innerHTML = `
      <div class="scene-frame">
        <div class="scene-title-badge">
          ${IconSystem.get('ranking', { size: 14 })} <span>لوحة شرف الأبطال</span>
        </div>
        <div class="leaderboard-stage-box">
          <div class="podium-row">
            <!-- Rank 2 -->
            <div class="podium-card rank-2">
              <span style="font-size:11px; font-weight:900; color:#94a3b8;">#2</span>
              ${top2 ? `<img src="${top2.avatar}" style="width:36px; height:36px; border-radius:50%; margin:4px 0;" alt="" /><span style="font-size:10px; font-weight:700;">${top2.nickname}</span><span style="font-family:'Orbitron'; font-size:10px; color:var(--cyber-teal);">${top2.score} pts</span>` : '<span style="font-size:10px; color:var(--text-dim);">-</span>'}
            </div>
            <!-- Rank 1 -->
            <div class="podium-card rank-1">
              ${IconSystem.get('trophy', { size: 18, color: 'var(--luxury-gold)' })}
              <span style="font-size:12px; font-weight:900; color:var(--luxury-gold);">#1</span>
              ${top1 ? `<img src="${top1.avatar}" style="width:46px; height:46px; border-radius:50%; border:2px solid var(--luxury-gold); margin:4px 0;" alt="" /><span style="font-size:11px; font-weight:800;">${top1.nickname}</span><span style="font-family:'Orbitron'; font-size:11px; color:var(--luxury-gold); font-weight:900;">${top1.score} pts</span>` : '<span style="font-size:10px; color:var(--text-dim);">-</span>'}
            </div>
            <!-- Rank 3 -->
            <div class="podium-card rank-3">
              <span style="font-size:11px; font-weight:900; color:#d97706;">#3</span>
              ${top3 ? `<img src="${top3.avatar}" style="width:36px; height:36px; border-radius:50%; margin:4px 0;" alt="" /><span style="font-size:10px; font-weight:700;">${top3.nickname}</span><span style="font-family:'Orbitron'; font-size:10px; color:var(--cyber-teal);">${top3.score} pts</span>` : '<span style="font-size:10px; color:var(--text-dim);">-</span>'}
            </div>
          </div>
          <div class="leaderboard-scroll-list">
            ${restHtml || '<div style="color:var(--text-dim); text-align:center; font-size:11px;">في انتظار بقية النتائج...</div>'}
          </div>
        </div>
        <div class="join-callout-box">
          <span class="join-instruction">تحديثات الصدارة مستمرة طوال البث:</span>
          <span class="join-keyword-pill">Live Leaderboard</span>
        </div>
      </div>
    `;
  }

  updateHeaderStats() {
    const eng = this.state.get('engagement') || {};
    const round = this.state.get('round') || { roundNumber: 1 };
    const pool = this.participants.getDrawPoolUsers();

    if (this.dom.statParticipants) this.dom.statParticipants.textContent = pool.length;
    if (this.dom.valViewers) this.dom.valViewers.textContent = eng.viewerCount || 0;
    if (this.dom.valLikes) this.dom.valLikes.textContent = eng.likes || 0;
    if (this.dom.valShares) this.dom.valShares.textContent = eng.shares || 0;
    if (this.dom.valGifts) this.dom.valGifts.textContent = eng.totalGifts || 0;
    if (this.dom.valComments) this.dom.valComments.textContent = eng.comments || 0;
    if (this.dom.valRound) this.dom.valRound.textContent = `ROUND ${String(round.roundNumber || 1).padStart(2, '0')}`;
  }

  updateTimerDisplay(timer) {
    if (!this.dom.timerText || !this.dom.timerBar) return;
    const remaining = timer.remaining !== undefined ? timer.remaining : 15;
    const duration = timer.duration || 15;

    this.dom.timerText.textContent = remaining;

    const totalDash = 188.4;
    const offset = totalDash - (remaining / duration) * totalDash;
    this.dom.timerBar.style.strokeDashoffset = offset;

    if (remaining <= 5) {
      this.dom.timerBar.classList.add('timer-urgent');
    } else {
      this.dom.timerBar.classList.remove('timer-urgent');
    }
  }

  updateLeaderboard() {
    if (!this.dom.leaderboardList) return;
    const leaders = this.participants.getLeaderboard(5);
    if (!leaders.length) return;

    this.dom.leaderboardList.innerHTML = leaders.map((u, i) => ParticipantCard.renderChip(u, i + 1)).join('');
  }
}

if (typeof window !== 'undefined') {
  window.SceneManager = SceneManager;
}
if (typeof globalThis !== 'undefined') {
  globalThis.SceneManager = SceneManager;
}
