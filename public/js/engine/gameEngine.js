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
      // 1. Live Chat / Answers
      case "CHAT": {
        this.answers.processComment(payload, payload.comment || "");
        this.events.emit("chat:received", payload);
        this.renderChatMessage(payload);
        break;
      }

      // 2. Live Gifts
      case "GIFT": {
        this.events.emit("gift:received", payload);
        this.events.emit("engagement:gift_update", payload);

        const diamonds = payload.diamonds || ((payload.diamondCount || 1) * (payload.giftCount || 1)) || 0;
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

  renderChatMessage(payload = {}) {
    const container = document.getElementById("live-chat-messages");
    if (!container) return;
    const comment = String(payload.comment || "").trim();
    if (!comment) return;
    const empty = document.getElementById("live-chat-empty");
    if (empty) empty.remove();
    const row = document.createElement("div");
    row.className = "live-chat-message";
    const name = document.createElement("strong");
    name.className = "live-chat-name";
    name.textContent = String(payload.nickname || payload.uniqueId || payload.id || "مشارك");
    const msg = document.createElement("span");
    msg.className = "live-chat-text";
    msg.textContent = comment;
    const body = document.createElement("div");
    body.className = "live-chat-body";
    body.append(name, msg);
    row.appendChild(body);
    container.appendChild(row);
    while (container.children.length > 20) container.removeChild(container.firstElementChild);
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
