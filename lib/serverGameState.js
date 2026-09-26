/**
 * Server-Authoritative Game Engine & State Machine
 * Central source of truth for round lifecycle, participants, questions, answers, and scores.
 */
import eventBus from './eventBus.js';
import db from './database.js';
import giftEngine from './giftEngine.js';
import commandParser from './commandParser.js';
import logger from './logger.js';

export const GAME_STATES = {
  LOBBY: 'LOBBY',
  PLAYER_SELECTION: 'PLAYER_SELECTION',
  QUESTION: 'QUESTION',
  ANSWERING: 'ANSWERING',
  RESULT: 'RESULT',
  WINNER: 'WINNER',
  NEXT_ROUND: 'NEXT_ROUND',
  PAUSED: 'PAUSED',
  ENDED: 'ENDED'
};

class ServerGameState {
  constructor() {
    this.state = GAME_STATES.LOBBY;
    this.roundNumber = 1;
    this.targetParticipants = 36;
    this.questionDuration = 15;
    this.autoTransition = true;
    this.autoNextRound = true;
    this.autoMode = true;
    this.pausedState = null;
    this.excludePreviousWinner = true;
    this.previousWinnerId = null;

    // Active session containers
    this.participants = new Map(); // id -> user object
    this.drawPool = []; // user IDs in current round
    this.currentQuestion = null;
    this.questionStartTime = null;
    this.answers = new Map(); // userId -> { attempts: [], firstAnswerTime, isCorrect, points }
    this.currentWinner = null;
    this.timerInterval = null;
    this.remainingSeconds = 0;

    // Engagement Metrics & Milestones
    this.engagement = {
      likes: 0,
      shares: 0,
      comments: 0,
      followers: 0,
      viewers: 0,
      diamonds: 0,
      totalGifts: 0
    };

    this.achievedMilestones = new Set();
    this.milestoneThresholds = [100, 500, 1000, 5000, 10000, 50000];

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // 1. Central Event Bus listener for incoming TikTok and Admin events
    eventBus.on('event', (envelope) => {
      this.handleIncomingEvent(envelope);
    });
  }

  handleIncomingEvent(envelope) {
    const { type, user, payload } = envelope;

    // Banned user filter
    if (user && user.id && db.isUserBanned(user.id)) {
      return;
    }

    switch (type) {
      case 'CHAT': {
        this.engagement.comments++;
        eventBus.dispatch('COMMENT_COUNT_UPDATED', {
          totalComments: this.engagement.comments
        }, 'GAME_ENGINE');
        this.handleChatMessage(user, payload.comment);
        break;
      }

      case 'GIFT': {
        this.handleGift(user, payload);
        break;
      }

      case 'LIKE': {
        const count = payload.likeCount || 1;
        const total = payload.totalLikeCount || (this.engagement.likes + count);
        this.engagement.likes = Math.max(this.engagement.likes + count, total);
        this.checkMilestones('LIKE', this.engagement.likes);
        break;
      }

      case 'SHARE': {
        const count = payload.shareCount || 1;
        const total = payload.totalShareCount || (this.engagement.shares + count);
        this.engagement.shares = Math.max(this.engagement.shares + count, total);
        this.checkMilestones('SHARE', this.engagement.shares);
        break;
      }

      case 'FOLLOW': {
        this.engagement.followers++;
        this.checkMilestones('FOLLOW', this.engagement.followers);
        break;
      }

      case 'ROOM_USER': {
        this.engagement.viewers = payload.viewerCount || 0;
        break;
      }
    }
  }

  handleChatMessage(user, rawComment) {
    const parsed = commandParser.parse(rawComment, user);
    if (!parsed) return;

    if (parsed.isCommand) {
      if (parsed.action === 'JOIN') {
        this.registerParticipant(user, rawComment);
      } else if (parsed.action === 'ANSWER') {
        this.processAnswer(user, parsed.value);
      } else if (parsed.action === 'SCORE') {
        const p = this.participants.get(user.id);
        const score = p ? p.score : 0;
        eventBus.dispatch('CHAT_RESPONSE', {
          user,
          text: `@${user.nickname} رصيدك الحالي: ${score} نقطة `
        }, 'GAME_ENGINE');
      } else if (parsed.action === 'RANK') {
        const leaderboard = this.getLeaderboard(10);
        const rankIdx = leaderboard.findIndex(u => u.id === user.id);
        const rankText = rankIdx !== -1 ? `#${rankIdx + 1}` : 'خارج أفضل 10';
        eventBus.dispatch('CHAT_RESPONSE', {
          user,
          text: `@${user.nickname} ترتيبك الحالي: ${rankText}`
        }, 'GAME_ENGINE');
      }
    } else {
      // Direct registration or answering if state matches
      if (this.state === GAME_STATES.LOBBY || this.state === GAME_STATES.PLAYER_SELECTION) {
        if (rawComment.includes('تم') || rawComment.includes('1') || rawComment.includes('انضمام')) {
          this.registerParticipant(user, rawComment);
        }
      } else if (this.state === GAME_STATES.QUESTION || this.state === GAME_STATES.ANSWERING) {
        this.processAnswer(user, rawComment);
      }
    }
  }

  registerParticipant(user, comment = 'تم') {
    if (this.state !== GAME_STATES.LOBBY && this.state !== GAME_STATES.PLAYER_SELECTION) {
      return { success: false, reason: 'REGISTRATION_CLOSED' };
    }

    const userId = user.id;
    if (this.drawPool.includes(userId)) {
      return { success: false, reason: 'ALREADY_REGISTERED' };
    }

    db.upsertUser(user);

    let participant = this.participants.get(userId);
    if (!participant) {
      participant = {
        id: userId,
        uniqueId: user.uniqueId,
        nickname: user.nickname,
        displayName: user.displayName,
        avatar: user.avatar,
        score: 0,
        points: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        wins: 0,
        attemptsLeft: 3,
        eligibleForDraw: true,
        joinedAt: Date.now()
      };
      this.participants.set(userId, participant);
    }

    this.drawPool.push(userId);

    eventBus.dispatch('PARTICIPANT_JOINED', {
      participant,
      count: this.drawPool.length,
      target: this.targetParticipants,
      roundNumber: this.roundNumber
    }, 'GAME_ENGINE');

    // Auto trigger when target reached
    if (this.targetParticipants > 0 && this.drawPool.length >= this.targetParticipants && this.autoTransition) {
      this.triggerCountdownToQuestion();
    }

    return { success: true, participant };
  }

  triggerCountdownToQuestion() {
    this.setState(GAME_STATES.PLAYER_SELECTION);
    eventBus.dispatch('TARGET_REACHED', {
      count: this.drawPool.length,
      target: this.targetParticipants
    }, 'GAME_ENGINE');

    setTimeout(() => {
      if (this.state === GAME_STATES.PLAYER_SELECTION) {
        this.startQuestion();
      }
    }, 4000);
  }

  startQuestion(questionId = null) {
    const questions = (typeof db.getQuestionsSync === 'function') ? db.getQuestionsSync() : db.collections.questions.filter(q => q.enabled !== false);
    if (!questions.length) {
      logger.warn('No questions available in question bank');
      return;
    }

    let q = null;
    if (questionId) {
      q = questions.find(item => item.id.toString() === questionId.toString());
    }
    if (!q) {
      q = questions[Math.floor(Math.random() * questions.length)];
    }

    this.currentQuestion = q;
    this.answers.clear();
    this.questionStartTime = Date.now();
    this.remainingSeconds = q.timeLimit || this.questionDuration;

    // Reset attempts per participant for this question
    for (const p of this.participants.values()) {
      p.attemptsLeft = 3;
    }

    this.setState(GAME_STATES.QUESTION);

    eventBus.dispatch('QUESTION_STARTED', {
      question: this.currentQuestion,
      roundNumber: this.roundNumber,
      duration: this.remainingSeconds,
      points: q.points || 100
    }, 'GAME_ENGINE');

    // Start Server Authoritative Timer
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.remainingSeconds--;

      eventBus.dispatch('TIMER_TICK', {
        remaining: this.remainingSeconds,
        duration: q.timeLimit || this.questionDuration
      }, 'GAME_ENGINE');

      if (this.remainingSeconds <= 0) {
        clearInterval(this.timerInterval);
        this.endQuestion();
      }
    }, 1000);
  }

  processAnswer(user, answerText) {
    if (this.state !== GAME_STATES.QUESTION && this.state !== GAME_STATES.ANSWERING) {
      return { success: false, reason: 'QUESTION_NOT_ACTIVE' };
    }

    const participant = this.participants.get(user.id);
    if (!participant || participant.attemptsLeft <= 0) {
      return { success: false, reason: 'NO_ATTEMPTS_LEFT' };
    }

    const cleanAnswer = (answerText || '').trim().toLowerCase();
    const correctAnswers = [
      (this.currentQuestion.correctAnswer || '').toLowerCase(),
      ...((this.currentQuestion.answers || []).map(a => a.toLowerCase()))
    ];

    const isCorrect = correctAnswers.some(ans => {
      return cleanAnswer === ans || cleanAnswer.includes(ans) || (cleanAnswer.length === 1 && ans.startsWith(cleanAnswer));
    });

    participant.attemptsLeft--;
    const speedSeconds = ((Date.now() - this.questionStartTime) / 1000);

    let userAnswers = this.answers.get(user.id);
    if (!userAnswers) {
      userAnswers = { attempts: [], firstSpeed: speedSeconds, isCorrect: false, points: 0 };
      this.answers.set(user.id, userAnswers);
    }

    userAnswers.attempts.push({ text: answerText, isCorrect, timestamp: Date.now() });

    if (isCorrect && !userAnswers.isCorrect) {
      userAnswers.isCorrect = true;
      participant.correctAnswers++;

      // Speed bonus calculation
      const basePoints = this.currentQuestion.points || 100;
      const speedBonus = Math.max(0, Math.round((this.questionDuration - speedSeconds) * 5));
      const totalPoints = basePoints + speedBonus;

      participant.score += totalPoints;
      participant.points = participant.score;
      userAnswers.points = totalPoints;

      eventBus.dispatch('ANSWER_CORRECT', {
        user,
        participant,
        speedSeconds: speedSeconds.toFixed(2),
        points: totalPoints,
        isFirst: this.answers.size === 1
      }, 'GAME_ENGINE');
    } else if (!isCorrect) {
      participant.wrongAnswers++;
      eventBus.dispatch('ANSWER_WRONG', {
        user,
        participant,
        attempt: 3 - participant.attemptsLeft
      }, 'GAME_ENGINE');
    }

    return { success: true, isCorrect, attemptsLeft: participant.attemptsLeft };
  }

  endQuestion() {
    if (!this.currentQuestion) {
      logger.warn('END_QUESTION ignored: no active question');
      return { success: false, reason: 'NO_ACTIVE_QUESTION' };
    }

    clearInterval(this.timerInterval);
    this.setState(GAME_STATES.RESULT);

    eventBus.dispatch('QUESTION_ENDED', {
      question: this.currentQuestion,
      correctAnswer: this.currentQuestion.correctAnswer,
      explanation: this.currentQuestion.explanation,
      totalAnswers: this.answers.size
    }, 'GAME_ENGINE');

    if (this.autoTransition) {
      setTimeout(() => {
        if (this.state === GAME_STATES.RESULT) {
          this.startLuckyDraw();
        }
      }, 4000);
    }
  }

  startLuckyDraw(forcedWinnerId = null) {
    this.setState(GAME_STATES.WINNER);

    // Filter eligible pool
    let candidateIds = this.drawPool.filter(id => {
      if (this.excludePreviousWinner && id === this.previousWinnerId) return false;
      const p = this.participants.get(id);
      return p && p.eligibleForDraw !== false;
    });

    if (!candidateIds.length) {
      candidateIds = [...this.drawPool];
    }

    let winnerId = forcedWinnerId;
    if (!winnerId || !candidateIds.includes(winnerId)) {
      winnerId = candidateIds[Math.floor(Math.random() * candidateIds.length)];
    }

    const winner = this.participants.get(winnerId) || { id: winnerId, nickname: 'الفائز المحظوظ', score: 0 };
    winner.wins = (winner.wins || 0) + 1;
    this.currentWinner = winner;
    this.previousWinnerId = winner.id;

    eventBus.dispatch('WINNER', {
      winner,
      roundNumber: this.roundNumber,
      participantsCount: this.drawPool.length
    }, 'GAME_ENGINE');

    if (this.autoTransition && this.autoMode && this.autoNextRound) {
      setTimeout(() => {
        if (this.state === GAME_STATES.WINNER) {
          this.startNewRound();
        }
      }, 5000);
    }

    return winner;
  }

  startNewRound(manualRoundNumber = null) {
    clearInterval(this.timerInterval);
    this.roundNumber = manualRoundNumber || (this.roundNumber + 1);
    this.drawPool = [];
    this.answers.clear();
    this.currentQuestion = null;
    this.currentWinner = null;
    this.setState(GAME_STATES.LOBBY);

    eventBus.dispatch('ROUND_STARTED', {
      roundNumber: this.roundNumber,
      target: this.targetParticipants
    }, 'GAME_ENGINE');
  }

  handleGift(user, rawGift) {
    const processed = giftEngine.processGift(rawGift);
    this.engagement.totalGifts += processed.giftCount;
    this.engagement.diamonds += processed.totalDiamonds;

    const participant = this.participants.get(user.id);
    if (participant) {
      participant.score += processed.pointsAwarded;
      participant.points = participant.score;

      if (processed.action === 'EXTRA_ATTEMPT') {
        participant.attemptsLeft += processed.actionValue;
      } else if (processed.action === 'INSTANT_ENTRY') {
        participant.eligibleForDraw = true;
      }
    }

    eventBus.dispatch('GIFT_PROCESSED', {
      user,
      ...processed
    }, 'GAME_ENGINE');

    this.checkMilestones('GIFT', this.engagement.diamonds);
  }

  checkMilestones(type, currentVal) {
    for (const threshold of this.milestoneThresholds) {
      const key = `${type}_${threshold}`;
      if (currentVal >= threshold && !this.achievedMilestones.has(key)) {
        this.achievedMilestones.add(key);
        logger.audit(`Milestone Reached: ${type} ${threshold}`, { currentVal });
        eventBus.dispatch('MILESTONE_REACHED', {
          type,
          threshold,
          currentVal
        }, 'GAME_ENGINE');
      }
    }
  }

  pauseGame() {
    if (this.state === GAME_STATES.PAUSED) return { success: true, state: this.state };
    this.pausedState = this.state;
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.setState(GAME_STATES.PAUSED);
    return { success: true, state: this.state, pausedFrom: this.pausedState };
  }

  resumeGame() {
    if (this.state !== GAME_STATES.PAUSED) return { success: false, reason: 'NOT_PAUSED', state: this.state };
    const restore = this.pausedState || GAME_STATES.LOBBY;
    this.pausedState = null;
    this.setState(restore);
    if (restore === GAME_STATES.QUESTION || restore === GAME_STATES.ANSWERING) {
      clearInterval(this.timerInterval);
      this.timerInterval = setInterval(() => {
        this.remainingSeconds--;
        eventBus.dispatch('TIMER_TICK', {
          remaining: this.remainingSeconds,
          duration: this.currentQuestion?.timeLimit || this.questionDuration
        }, 'GAME_ENGINE');
        if (this.remainingSeconds <= 0) {
          clearInterval(this.timerInterval);
          this.endQuestion();
        }
      }, 1000);
    }
    return { success: true, state: this.state };
  }

  stopGame() {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.remainingSeconds = 0;
    this.setState(GAME_STATES.ENDED);
    eventBus.dispatch('STOP_GAME', { state: GAME_STATES.ENDED }, 'GAME_ENGINE');
  }

  resetRound() {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.drawPool = [];
    this.answers.clear();
    this.currentQuestion = null;
    this.currentWinner = null;
    this.remainingSeconds = 0;
    this.setState(GAME_STATES.LOBBY);
    eventBus.dispatch('ROUND_RESET', {
      roundNumber: this.roundNumber,
      target: this.targetParticipants
    }, 'GAME_ENGINE');
  }

  setState(newState) {
    const old = this.state;
    this.state = newState;
    logger.info(`Game State Transition: ${old} -> ${newState} (Round ${this.roundNumber})`);
    eventBus.dispatch('GAME_STATE_CHANGED', this.getSnapshot(), 'GAME_ENGINE');
  }

  getLeaderboard(limit = 10) {
    return Array.from(this.participants.values())
      .sort((a, b) => (b.score || 0) - (a.score || 0) || (b.correctAnswers || 0) - (a.correctAnswers || 0))
      .slice(0, limit);
  }

  getSnapshot() {
    return {
      state: this.state,
      roundNumber: this.roundNumber,
      targetParticipants: this.targetParticipants,
      currentParticipantsCount: this.drawPool.length,
      drawPool: this.drawPool,
      currentQuestion: this.currentQuestion,
      remainingSeconds: this.remainingSeconds,
      currentWinner: this.currentWinner,
      engagement: this.engagement,
      targetSettings: {
        targetParticipants: this.targetParticipants,
        questionDuration: this.questionDuration,
        autoMode: this.autoMode,
        autoTransition: this.autoTransition,
        autoNextRound: this.autoNextRound,
        excludePreviousWinner: this.excludePreviousWinner
      },
      participants: Array.from(this.participants.values()),
      autoMode: this.autoMode,
      leaderboard: this.getLeaderboard(5)
    };
  }

  resetAll() {
    clearInterval(this.timerInterval);
    this.state = GAME_STATES.LOBBY;
    this.roundNumber = 1;
    this.participants.clear();
    this.drawPool = [];
    this.answers.clear();
    this.currentQuestion = null;
    this.currentWinner = null;
    this.pausedState = null;
    this.achievedMilestones.clear();
    this.engagement = { likes: 0, shares: 0, comments: 0, followers: 0, viewers: 0, diamonds: 0, totalGifts: 0 };
    eventBus.dispatch('GAME_RESET', this.getSnapshot(), 'GAME_ENGINE');
  }
}

export const serverGameState = new ServerGameState();
export default serverGameState;
