/**
 * Advanced Answer Processing Engine
 * Normalizes Arabic text, maps choice letters/numbers for MULTIPLE_CHOICE & TRUE_FALSE,
 * evaluates correctness, response speed, and updates participant answers.
 */
class AnswerEngine {
  constructor(eventManager, gameState, participantManager) {
    this.events = eventManager;
    this.state = gameState;
    this.participants = participantManager;
    this.answeredInCurrentQuestion = new Set();
    this.firstCorrectUser = null;

    this.setupListeners();
  }

  setupListeners() {
    this.events.on('question:started', () => {
      this.answeredInCurrentQuestion.clear();
      this.firstCorrectUser = null;
    });
  }

  normalizeArabic(text = '') {
    if (!text) return '';
    return text
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, '') // Remove Arabic tashkeel / harakat
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/[^\u0621-\u064A0-9a-zA-Z\s]/g, '') // Strip punctuation & symbols
      .replace(/\s+/g, ' ')
      .trim();
  }

  checkMatch(userComment, question) {
    if (!userComment || !question) return false;

    const cleanInput = this.normalizeArabic(userComment);
    if (!cleanInput) return false;

    const qType = question.type || 'TEXT';

    // 1. MULTIPLE_CHOICE Handling (A/B/C/D, 1/2/3/4, أ/ب/ج/د, or option text)
    if (qType === 'MULTIPLE_CHOICE' && Array.isArray(question.options) && question.options.length > 0) {
      const correctText = this.normalizeArabic(question.correctAnswer || (question.answers ? question.answers[0] : ''));
      const correctIdx = question.options.findIndex(opt => this.normalizeArabic(opt) === correctText);

      // Letter / Index mapping
      const letterMap = {
        'a': 0, '1': 0, 'أ': 0, 'ا': 0,
        'b': 1, '2': 1, 'ب': 1,
        'c': 2, '3': 2, 'ج': 2,
        'd': 3, '4': 3, 'د': 3
      };

      if (correctIdx !== -1 && letterMap[cleanInput] === correctIdx) {
        return true;
      }

      // Check if user wrote the full option text
      if (cleanInput === correctText) {
        return true;
      }
    }

    // 2. TRUE_FALSE Handling (صح / خطأ / 1 / 2)
    if (qType === 'TRUE_FALSE') {
      const isCorrectTrue = this.normalizeArabic(question.correctAnswer).includes('صح') || question.correctAnswer === 'true' || question.correctAnswer === '1';
      const userSaysTrue = cleanInput === 'صح' || cleanInput === 'صحيح' || cleanInput === 'نعم' || cleanInput === 'true' || cleanInput === '1';
      const userSaysFalse = cleanInput === 'خطا' || cleanInput === 'خطأ' || cleanInput === 'لا' || cleanInput === 'false' || cleanInput === '2';

      if (isCorrectTrue && userSaysTrue) return true;
      if (!isCorrectTrue && userSaysFalse) return true;
    }

    // 3. TEXT & Synonym array comparison
    const validAnswers = Array.isArray(question.answers) ? question.answers : [question.correctAnswer || question.displayAnswer];
    for (const ans of validAnswers) {
      const cleanAns = this.normalizeArabic(ans);
      if (cleanAns && cleanInput === cleanAns) {
        return true;
      }
    }

    return false;
  }

  processAnswer(commentData) {
    const rawComment = commentData.comment || commentData.text || '';
    const userId = (commentData.id || commentData.uniqueId || commentData.userId || '').toString();

    // 1. If currently in REGISTRATION or WAITING scene, check registration keywords
    const scene = this.state.get('scene');
    if (scene === 'REGISTRATION' || scene === 'WAITING') {
      const keywords = this.state.get('settings').registrationKeywords || ['تم', '1', 'انضمام', 'شارك', 'انا'];
      const cleanComment = this.normalizeArabic(rawComment);
      const isKeyword = keywords.some(k => this.normalizeArabic(k) === cleanComment);

      if (isKeyword) {
        return this.participants.registerParticipant({
          userId,
          uniqueId: commentData.uniqueId || userId,
          nickname: commentData.nickname || commentData.displayName || userId,
          avatar: commentData.avatar || commentData.profilePictureUrl,
          comment: rawComment
        });
      }
      return null;
    }

    // 2. If in QUESTION scene, evaluate answer
    if (scene === 'QUESTION') {
      const currentQ = this.state.get('currentQuestion');
      if (!currentQ) return null;

      // Only registered participants can answer
      let user = this.participants.get(userId);
      if (!user) {
        // Auto-register viewer if setting allows
        const regRes = this.participants.registerParticipant({
          userId,
          uniqueId: commentData.uniqueId || userId,
          nickname: commentData.nickname || commentData.displayName || userId,
          avatar: commentData.avatar || commentData.profilePictureUrl,
          comment: rawComment
        });
        user = regRes ? regRes.user : null;
      }

      if (!user) return null;

      // One valid answer recorded per participant per question
      if (this.answeredInCurrentQuestion.has(user.id)) {
        return { type: 'ALREADY_ANSWERED', user };
      }

      this.answeredInCurrentQuestion.add(user.id);

      const isCorrect = this.checkMatch(rawComment, currentQ);
      const timer = this.state.get('timer');
      const responseTimeMs = timer && timer.startTime ? (Date.now() - timer.startTime) : 0;
      const speedSeconds = (responseTimeMs / 1000).toFixed(2);

      let isFirstCorrect = false;
      if (isCorrect && !this.firstCorrectUser) {
        this.firstCorrectUser = user;
        isFirstCorrect = true;
      }

      // Record answer metrics
      user.answers.push({
        questionId: currentQ.id,
        comment: rawComment,
        isCorrect,
        speedSeconds,
        timestamp: Date.now()
      });

      if (isCorrect) {
        user.correctAnswers = (user.correctAnswers || 0) + 1;
        user.streak = (user.streak || 0) + 1;
        this.events.emit('answer:correct', { user, comment: rawComment, isFirstCorrect, speedSeconds });
      } else {
        user.wrongAnswers = (user.wrongAnswers || 0) + 1;
        user.streak = 0;
        this.events.emit('answer:wrong', { user, comment: rawComment });
      }

      const answerRecord = {
        user,
        comment: rawComment,
        isCorrect,
        isFirstCorrect,
        speedSeconds
      };

      this.events.emit('ANSWER_RECORDED', answerRecord);
      return { type: 'ANSWER', record: answerRecord };
    }

    return null;
  }

  processComment(user, comment) {
    return this.processAnswer({ ...user, comment });
  }
}

if (typeof window !== 'undefined') {
  window.AnswerEngine = AnswerEngine;
}
if (typeof globalThis !== 'undefined') {
  globalThis.AnswerEngine = AnswerEngine;
}
