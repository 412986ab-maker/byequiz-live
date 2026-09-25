/**
 * Core Game Engine
 * Orchestrates all subsystem engines, round lifecycle, engagement feeds, and network events.
 */
class GameEngine {
  constructor() {
    this.events = new EventManager();
    this.state = new GameState(this.events);
    this.participants = new ParticipantManager(this.events, this.state);
    this.questions = new QuestionEngine(this.events, this.state);
    this.answers = new AnswerEngine(this.events, this.state, this.participants);
    this.draw = new DrawEngine(this.events, this.state, this.participants);
    this.score = new ScoreEngine(this.events, this.state, this.participants);
    this.statistics = new StatisticsEngine(this.events, this.state);
    this.milestones = new MilestoneEngine(this.events, this.state, this.participants);
    this.reactions = new ReactionEngine(this.events);

    // Phase 3 Engagement Engines
    this.aggregator = new ReactionAggregator(this.events, this.state);
    this.queue = new ReactionQueue(this.events, this.state);
    this.effects = new EffectManager(this.events, this.state);

    this.scenes = new SceneManager(
      this.events,
      this.state,
      this.participants,
      this.questions,
      this.statistics
    );
    this.round = new RoundManager(
      this.events,
      this.state,
      this.participants,
      this.questions,
      this.draw,
      this.scenes
    );

    this.init();
  }

  async init() {
    if (typeof fetch !== "undefined") {
      await this.questions.loadQuestions("/data/questions.json").catch(() => {});
    }
    const pool = this.participants.getDrawPoolUsers();
    if (pool.length === 0) {
      this.scenes.transitionTo("WAITING");
    } else {
      this.scenes.transitionTo("REGISTRATION");
    }
    this.connectServerEvents();
  }

  connectServerEvents() {
    if (typeof EventSource === "undefined") return;

    const evtSource = new EventSource("/api/events");

    evtSource.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleIncomingMessage(msg);
      } catch (err) {
        console.error("[GameEngine] SSE Parse error:", err);
      }
    };

    evtSource.onerror = (err) => {
      // Automatic reconnection handled by browser EventSource
    };
  }

  updateLiveIndicator(status) {
    const pill = document.getElementById("live-status-pill");
    if (!pill) return;

    if (status === "CONNECTED" || status === true) {
      pill.classList.remove("offline", "connecting");
      pill.classList.add("connected");
    } else if (status === "CONNECTING" || status === "RECONNECTING") {
      pill.classList.remove("connected", "offline");
      pill.classList.add("connecting");
    } else {
      pill.classList.remove("connected", "connecting");
      pill.classList.add("offline");
    }
  }

  handleIncomingMessage(msg) {
    const { type } = msg;
    const payload = { ...(msg && msg.payload ? msg.payload : {}), ...(msg && msg.user ? msg.user : {}) };

    // Update LIVE status indicator on real TikTok status events
    if (type === "INIT_SNAPSHOT" && payload && payload.tiktok) {
      this.updateLiveIndicator(payload.tiktok.status);
    } else if (type === "TIKTOK_STATUS" && payload) {
      this.updateLiveIndicator(payload.status);
    } else if (type === "STREAM_START") {
      this.updateLiveIndicator("CONNECTED");
    } else if (type === "STREAM_END" || type === "DISCONNECT") {
      this.updateLiveIndicator("OFFLINE");
    } else if (["CHAT", "GIFT", "LIKE", "SHARE", "FOLLOW", "ROOM_USER"].includes(type)) {
      this.updateLiveIndicator("CONNECTED");
    }

    switch (type) {
      case "INIT_SNAPSHOT": {
        const game = msg && msg.payload && msg.payload.game ? msg.payload.game : {};
        const settings = { ...(game.settings || {}), ...(game.targetSettings || {}) };
        if (game.targetParticipants !== undefined) settings.targetParticipants = game.targetParticipants;
        if (game.questionDuration !== undefined) settings.questionDuration = game.questionDuration;
        if (typeof game.autoMode === "boolean") settings.autoMode = game.autoMode;
        if (typeof game.autoTransition === "boolean") settings.autoTransition = game.autoTransition;
        if (typeof game.excludePreviousWinner === "boolean") settings.excludePreviousWinner = game.excludePreviousWinner;
        this.state.updateSettings(settings);
        if (Array.isArray(game.participants) || Array.isArray(game.drawPool)) this.participants.syncFromSnapshot(game.participants || [], game.drawPool || []);
        if (game.engagement) this.state.updateEngagement({
          likes: Number(game.engagement.likes || 0),
          shares: Number(game.engagement.shares || 0),
          comments: Number(game.engagement.comments || 0),
          followers: Number(game.engagement.followers || 0),
          viewerCount: Number(game.engagement.viewers || 0),
          totalGifts: Number(game.engagement.totalGifts || 0),
          totalDiamonds: Number(game.engagement.diamonds || 0)
        });
        if (game.roundNumber !== undefined) this.state.set("round", { ...this.state.get("round"), roundNumber: Number(game.roundNumber) || 1 });
        if (game.currentQuestion) this.state.set("currentQuestion", game.currentQuestion);
        if (game.remainingSeconds !== undefined) this.state.set("timer", {
          duration: settings.questionDuration || 15,
          remaining: Number(game.remainingSeconds) || 0,
          active: ["QUESTION", "ANSWERING"].includes(game.state)
        });
        this.syncSceneFromServerState(game.state);
        break;
      }

      case "GAME_STATE_CHANGED": {
        this.applyServerSnapshot(payload && payload.state ? payload : (msg.payload || {}));
        break;
      }

      case "PARTICIPANT_JOINED": {
        const p = payload && payload.participant ? payload.participant : payload;
        if (p && p.id) this.participants.syncFromSnapshot(
          [...this.participants.getAllParticipants().filter(u => u.id !== String(p.id)), p],
          [...this.participants.drawPool.filter(id => id !== String(p.id)), String(p.id)]
        );
        break;
      }

      case "QUESTION_STARTED": {
        if (payload.question) this.state.set("currentQuestion", payload.question);
        this.state.set("timer", { duration: Number(payload.duration || this.state.get("settings").questionDuration || 15), remaining: Number(payload.duration || this.state.get("settings").questionDuration || 15), active: true });
        this.scenes.transitionTo("QUESTION");
        break;
      }

      case "QUESTION_ENDED": {
        this.state.set("timer", { ...this.state.get("timer"), active: false, remaining: 0 });
        this.scenes.transitionTo("ANSWERS");
        break;
      }

      case "GAME_RESET": {
        this.participants.clearParticipants();
        this.state.resetAll();
        this.scenes.transitionTo("WAITING");
        break;
      }

      case "RESET_QUESTION_HISTORY": {
        this.questions.resetHistory();
        break;
      }

      case "SETTINGS_UPDATED":
      case "UPDATE_SETTINGS": {
        const settings = payload && payload.settings ? payload.settings : payload || {};
        this.state.updateSettings(settings);
        break;
      }

      // 1. Live Chat / Answers
      case "CHAT": {
        this.answers.processComment(payload, payload.comment || "");
        this.events.emit("chat:received", payload);
        this.renderChatMessage(payload);
        break;
      }
      case "COMMENT_COUNT_UPDATED": {
        const eng = this.state.get("engagement");
        eng.comments = payload.totalComments || 0;
        this.state.updateEngagement(eng);
        break;
      }

      // 2. Live Gifts
      case "GIFT": {
        this.events.emit("gift:received", payload);
        this.events.emit("engagement:gift_update", payload);
        const eng = this.state.get("engagement");
        const giftCount = Math.max(1, Number(payload.giftCount || payload.repeatCount || 1));
        const diamonds = Number(payload.diamonds || ((payload.diamondCount || 0) * giftCount) || 0);
        eng.totalGifts = Number(eng.totalGifts || 0) + giftCount;
        eng.totalDiamonds = Number(eng.totalDiamonds || 0) + diamonds;
        this.state.updateEngagement(eng);
        const giftType = diamonds >= 1000 ? "CRITICAL_GIFT" : (diamonds >= 100 ? "SPECIAL_GIFT" : "NORMAL_GIFT");

        this.events.emit("reaction:enqueue", {
          type: giftType,
          data: payload,
          duration: diamonds >= 1000 ? 4500 : (diamonds >= 100 ? 3500 : 2500)
        });
        break;
      }

      // 3. Live Likes
      case "LIKE": {
        const currentLikes = this.state.get("engagement").likes || 0;
        let newTotal = payload.totalLikeCount;
        if (!newTotal || newTotal < currentLikes) {
          newTotal = currentLikes + (payload.likeCount || 1);
        }

        const eng = this.state.get("engagement");
        eng.likes = newTotal;
        this.state.set("engagement", eng);

        this.events.emit("engagement:like_raw", payload);
        this.events.emit("engagement:like_update", {
          totalLikes: newTotal,
          count: payload.likeCount || 1
        });
        this.events.emit("LIKE_RECEIVED", { totalLikes: newTotal, ...payload });
        break;
      }

      // 4. Live Shares
      case "SHARE": {
        const currentShares = this.state.get("engagement").shares || 0;
        let newTotal = payload.totalShareCount;
        if (!newTotal || newTotal < currentShares) {
          newTotal = currentShares + (payload.shareCount || 1);
        }

        const eng = this.state.get("engagement");
        eng.shares = newTotal;
        this.state.set("engagement", eng);

        this.events.emit("engagement:share_raw", payload);
        this.events.emit("engagement:share_update", {
          totalShares: newTotal,
          count: payload.shareCount || 1
        });
        this.events.emit("SHARE_RECEIVED", { totalShares: newTotal, ...payload });
        break;
      }

      // 5. Live Follow
      case "FOLLOW": {
        const userId = (payload.id || payload.uniqueId || "").toString();
        const eng = this.state.get("engagement");
        eng.followers = (eng.followers || 0) + 1;
        this.state.set("engagement", eng);

        this.events.emit("engagement:follow_raw", payload);
        this.events.emit("FOLLOW_RECEIVED", payload);
        break;
      }

      // 6. Live Viewer Count Update
      case "ROOM_USER":
      case "VIEWER_UPDATE": {
        if (payload && payload.viewerCount !== undefined) {
          const eng = this.state.get("engagement");
          eng.viewerCount = payload.viewerCount;
          if (payload.viewerCount > (eng.peakViewers || 0)) {
            eng.peakViewers = payload.viewerCount;
          }
          this.state.set("engagement", eng);

          this.events.emit("engagement:viewer_update", payload);
        }
        break;
      }

      // Game Flow Controls
      case "START_GAME":
      case "START_REGISTRATION": {
        this.scenes.transitionTo("REGISTRATION");
        break;
      }

      case "PAUSE_GAME":
      case "PAUSE_ROUND": {
        this.round.pauseRound();
        break;
      }

      case "RESUME_GAME": {
        this.round.resumeRound();
        break;
      }

      case "STOP_GAME": {
        this.scenes.transitionTo("WAITING");
        break;
      }
      case "ROUND_RESET": {
        this.scenes.transitionTo("REGISTRATION");
        break;
      }

      case "START_ROUND":
      case "NEXT_ROUND": {
        this.round.startNewRound(payload ? payload.roundNumber : null);
        break;
      }

      case "START_QUESTION":
      case "NEXT_QUESTION": {
        this.startQuestion(payload ? payload.questionId : null, payload ? payload.duration : null);
        break;
      }

      case "END_QUESTION": {
        this.questions.stopTimer();
        this.scenes.transitionTo("ANSWERS");
        break;
      }

      case "START_DRAW": {
        this.scenes.transitionTo("DRAW");
        this.draw.spin(payload ? payload.winnerId : null);
        break;
      }

      case "SHOW_WINNER": {
        this.scenes.transitionTo("WINNER", payload || {});
        break;
      }

      case "SHOW_STATS": {
        this.scenes.transitionTo("STATS");
        break;
      }

      case "SET_PARTICIPANT_TARGET": {
        if (payload && payload.target !== undefined) {
          this.state.updateSettings({ targetParticipants: parseInt(payload.target, 10) });
        }
        break;
      }

      case "SET_QUESTION_TIME": {
        if (payload && payload.duration) {
          this.state.updateSettings({ questionDuration: parseInt(payload.duration, 10) });
        }
        break;
      }

      case "SET_AUTO_MODE": {
        if (payload && typeof payload.autoMode === "boolean") {
          this.state.updateSettings({ autoMode: payload.autoMode, autoTransition: payload.autoMode });
        }
        break;
      }

      case "UPDATE_SETTINGS": {
        this.state.updateSettings(payload);
        break;
      }

      case "SET_MODE": {
        const mode = payload.mode;
        if (mode === "DRAW" || mode === "REGISTRATION") {
          this.scenes.transitionTo("REGISTRATION");
        } else if (mode === "QUESTION") {
          this.startQuestion(payload.questionId);
        } else if (mode === "STATS") {
          this.scenes.transitionTo("STATS");
        } else if (mode === "PODIUM") {
          this.scenes.transitionTo("PODIUM");
        } else if (mode === "WAITING") {
          this.scenes.transitionTo("WAITING");
        } else if (mode === "PARTICIPANTS") {
          this.scenes.transitionTo("PARTICIPANTS");
        }
        break;
      }

      case "SET_SCENE": {
        this.scenes.transitionTo(payload.scene, payload);
        break;
      }

      case "RESET_ROUND": {
        this.round.resetRound();
        break;
      }

      case "RESET_ALL": {
        this.participants.clearParticipants();
        this.state.resetAll();
        this.scenes.transitionTo("REGISTRATION");
        break;
      }

      default:
        this.events.emit("network:" + type, payload);
        break;
    }
  }

  applyServerSnapshot(game = {}) {
    const settings = { ...(game.targetSettings || {}) };
    if (game.targetParticipants !== undefined) settings.targetParticipants = game.targetParticipants;
    if (game.questionDuration !== undefined) settings.questionDuration = game.questionDuration;
    if (typeof game.autoMode === "boolean") settings.autoMode = game.autoMode;
    if (typeof game.autoTransition === "boolean") settings.autoTransition = game.autoTransition;
    if (typeof game.excludePreviousWinner === "boolean") settings.excludePreviousWinner = game.excludePreviousWinner;
    if (Object.keys(settings).length) this.state.updateSettings(settings);
    if (Array.isArray(game.participants) || Array.isArray(game.drawPool)) this.participants.syncFromSnapshot(game.participants || [], game.drawPool || []);
    if (game.engagement) this.state.updateEngagement({
      likes: Number(game.engagement.likes || 0),
      shares: Number(game.engagement.shares || 0),
      comments: Number(game.engagement.comments || 0),
      followers: Number(game.engagement.followers || 0),
      viewerCount: Number(game.engagement.viewers || 0),
      totalGifts: Number(game.engagement.totalGifts || 0),
      totalDiamonds: Number(game.engagement.diamonds || 0)
    });
    if (game.roundNumber !== undefined) this.state.set("round", { ...this.state.get("round"), roundNumber: Number(game.roundNumber) || 1 });
    if (game.currentQuestion) this.state.set("currentQuestion", game.currentQuestion);
    if (game.remainingSeconds !== undefined) this.state.set("timer", {
      duration: this.state.get("settings").questionDuration || 15,
      remaining: Number(game.remainingSeconds) || 0,
      active: ["QUESTION", "ANSWERING"].includes(game.state)
    });
    this.syncSceneFromServerState(game.state);
  }

  syncSceneFromServerState(serverState) {
    switch (serverState) {
      case "LOBBY": this.scenes.transitionTo(this.participants.count() ? "REGISTRATION" : "WAITING"); break;
      case "PLAYER_SELECTION": this.scenes.transitionTo("PARTICIPANTS"); break;
      case "QUESTION":
      case "ANSWERING": this.scenes.transitionTo("QUESTION"); break;
      case "RESULT": this.scenes.transitionTo("ANSWERS"); break;
      case "WINNER": this.scenes.transitionTo("WINNER"); break;
      case "NEXT_ROUND": this.scenes.transitionTo("REGISTRATION"); break;
      case "ENDED": this.scenes.transitionTo("WAITING"); break;
      default: break;
    }
  }

  renderChatMessage(payload = {}) {
    const container = document.getElementById("live-chat-messages");
    if (!container) return;
    const comment = String(payload.comment || "").trim();
    if (!comment) return;
    const empty = document.getElementById("live-chat-empty");
    if (empty) empty.remove();
    const row = document.createElement("div");
    row.className = "live-chat-message animate-chat-in";
    const avatar = document.createElement("img");
    avatar.className = "live-chat-avatar";
    avatar.alt = "";
    avatar.src = String(payload.avatar || payload.profilePictureUrl || "");
    avatar.onerror = () => { avatar.src = ""; avatar.classList.add("avatar-fallback"); };
    const body = document.createElement("div");
    body.className = "live-chat-body";
    const name = document.createElement("strong");
    name.className = "live-chat-name";
    name.textContent = String(payload.displayName || payload.nickname || payload.uniqueId || payload.id || "مشارك");
    const msg = document.createElement("span");
    msg.className = "live-chat-text";
    msg.textContent = comment;
    body.append(name, msg);
    row.append(avatar, body);
    container.appendChild(row);
    while (container.children.length > 4) container.removeChild(container.firstElementChild);
    window.setTimeout(() => {
      row.classList.add("animate-chat-out");
      window.setTimeout(() => row.remove(), 450);
    }, 5200);
  }

  startQuestion(questionId = null, duration = null) {
    this.questions.next(questionId, duration);
    this.scenes.transitionTo("QUESTION");
  }
}

if (typeof window !== "undefined") {
  window.GameEngine = GameEngine;
}
if (typeof globalThis !== "undefined") {
  globalThis.GameEngine = GameEngine;
}
