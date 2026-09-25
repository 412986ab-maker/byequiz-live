/**
 * Advanced Question Engine
 * Manages question bank, smart selection strategies, time limits, question scoring,
 * and explanation reveals with robust session history tracking.
 */
class QuestionEngine {
  constructor(eventManager, gameState) {
    this.events = eventManager;
    this.state = gameState;
    this.questions = [];
    this.questionSets = [];
    this.selector = new QuestionSelector([]);
    this.currentQuestion = null;
    this.timerInterval = null;

    this.setupListeners();
  }

  setupListeners() {
    this.events.on('timer:stop', () => this.stopTimer());

    this.events.on('settings:updated', (settings) => {
      // Refresh selector parameters if needed
    });
  }

  async loadQuestions(input = '/data/questions.json') {
    try {
      let data = [];
      if (Array.isArray(input)) {
        data = input;
      } else if (typeof input === 'string') {
        const res = await fetch(input);
        data = await res.json();
      }

      // Standardize schema via QuestionModel
      const normalized = (typeof QuestionModel !== 'undefined')
        ? QuestionModel.normalizeArray(data)
        : data.map((q, idx) => ({
            id: (q.id || idx + 1).toString(),
            category: q.category || 'ثقافة عامة',
            subcategory: q.subcategory || '',
            difficulty: q.difficulty || 'MEDIUM',
            type: q.type || (q.image ? 'IMAGE_QUESTION' : 'MULTIPLE_CHOICE'),
            question: q.question || q.q || '',
            options: q.options || [],
            answers: q.answers || [q.displayAnswer || q.correctAnswer],
            correctAnswer: q.correctAnswer || q.displayAnswer || (q.answers ? q.answers[0] : ''),
            explanation: q.explanation || '',
            timeLimit: q.timeLimit || 15,
            points: q.points || 100,
            image: q.image || '',
            enabled: q.enabled !== undefined ? q.enabled : true,
            usageCount: 0
          }));

      this.questions = normalized;
      this.selector.setQuestions(normalized);
      this.events.emit('questions:loaded', this.questions);
      return this.questions;
    } catch (err) {
      console.warn('[QuestionEngine] Questions load error:', err.message);
      return [];
    }
  }

  async loadQuestionSets(input = '/data/questionSets.json') {
    try {
      if (typeof fetch !== 'undefined') {
        const res = await fetch(input);
        this.questionSets = await res.json();
        return this.questionSets;
      }
    } catch (e) {}
    return [];
  }

  next(questionId = null, manualDuration = null) {
    let selected = null;
    const settings = this.state.get('settings');
    const round = this.state.get('round');

    if (questionId) {
      selected = this.questions.find(q => q.id.toString() === questionId.toString());
    }

    if (!selected) {
      // Use Smart Selector
      selected = this.selector.select({
        mode: settings.questionSelectionMode || 'RANDOM', // RANDOM, CATEGORY, DIFFICULTY, QUESTION_SET, MIXED, DIFFICULTY_CURVE
        category: settings.selectedCategory || null,
        difficulty: settings.selectedDifficulty || null,
        questionSet: this.questionSets.find(s => s.id === settings.selectedQuestionSet),
        roundNumber: round.roundNumber || 1,
        mixedRatios: settings.mixedCategoryRatios || null
      });
    }

    // Ultimate fallback if selector pool is empty
    if (!selected && this.questions.length > 0) {
      selected = this.questions[0];
    }

    if (!selected) return null;

    this.currentQuestion = selected;
    this.selector.markUsed(selected.id, round.roundNumber);

    // Question duration resolution (question-specific > manual > global setting)
    const duration = manualDuration || selected.timeLimit || settings.questionDuration || 15;
    
    // Question points resolution
    const points = selected.points || settings.correctPoints || 100;

    this.state.set('currentQuestion', {
      ...selected,
      duration,
      points
    });

    this.events.emit('question:started', this.currentQuestion);
    this.events.emit('QUESTION_STARTED', {
      question: this.currentQuestion,
      roundNumber: round.roundNumber,
      duration,
      points
    });

    this.startTimer(duration);
    return this.currentQuestion;
  }

  injectCustomQuestion(customQuestion) {
    const q = (typeof QuestionModel !== 'undefined')
      ? QuestionModel.normalize(customQuestion)
      : customQuestion;

    this.questions.unshift(q);
    this.selector.setQuestions(this.questions);
    this.next(q.id);
  }

  startTimer(seconds) {
    this.stopTimer();

    const timerState = {
      duration: seconds,
      remaining: seconds,
      active: true,
      startTime: Date.now()
    };
    this.state.set('timer', timerState);

    this.timerInterval = setInterval(() => {
      const current = this.state.get('timer');
      if (!current.active) return;

      current.remaining = Math.max(0, current.remaining - 1);
      this.state.set('timer', { ...current });
      this.events.emit('timer:tick', current.remaining);

      if (current.remaining <= 0) {
        this.stopTimer();
        this.events.emit('timer:ended');
      }
    }, 1000);

    if (this.timerInterval && this.timerInterval.unref) {
      this.timerInterval.unref();
    }
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    const timerState = this.state.get('timer');
    if (timerState) {
      timerState.active = false;
      this.state.set('timer', timerState);
    }
  }

  get current() {
    return this.currentQuestion;
  }

  get usedQuestionIds() {
    return this.selector.usedQuestionIds;
  }

  resetHistory() {
    this.selector.resetHistory();
    this.events.emit('question:history_reset');
  }
}

if (typeof window !== 'undefined') {
  window.QuestionEngine = QuestionEngine;
}
if (typeof globalThis !== 'undefined') {
  globalThis.QuestionEngine = QuestionEngine;
}
