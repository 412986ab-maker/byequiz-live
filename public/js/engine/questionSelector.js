/**
 * Smart Question Selector
 * Selects questions using customizable strategies (Random, Category, Difficulty Curve, Question Sets, Mixed Mode)
 * with robust session history tracking and graceful auto-broadening fallback.
 */
class QuestionSelector {
  constructor(questions = []) {
    this.questions = questions;
    this.usedQuestionIds = new Set();
    this.sessionHistory = []; // { roundNumber, questionId, startedAt, endedAt, stats }
  }

  setQuestions(list = []) {
    this.questions = list;
  }

  markUsed(questionId, roundNumber = 1) {
    if (!questionId) return;
    const strId = questionId.toString();
    this.usedQuestionIds.add(strId);

    const q = this.questions.find(item => item.id.toString() === strId);
    if (q) {
      q.usageCount = (q.usageCount || 0) + 1;
      q.lastUsedAt = Date.now();
    }

    this.sessionHistory.push({
      roundNumber,
      questionId: strId,
      questionText: q ? q.question : '',
      category: q ? q.category : '',
      difficulty: q ? q.difficulty : '',
      startedAt: Date.now()
    });
  }

  resetHistory() {
    this.usedQuestionIds.clear();
    this.sessionHistory = [];
  }

  select(criteria = {}) {
    const {
      mode = 'RANDOM', // RANDOM, CATEGORY, DIFFICULTY, QUESTION_SET, MIXED, DIFFICULTY_CURVE
      category = null,
      difficulty = null,
      type = null,
      questionSet = null,
      roundNumber = 1,
      mixedRatios = null,
      excludeIds = []
    } = criteria;

    let pool = this.questions.filter(q => q && q.enabled !== false);
    if (pool.length === 0) return null;

    // Filter out already used questions in this session
    const excluded = new Set([...this.usedQuestionIds, ...excludeIds]);
    let available = pool.filter(q => !excluded.has(q.id.toString()));

    // If all questions have been used in this session, reset session pool safely
    if (available.length === 0) {
      this.usedQuestionIds.clear();
      available = pool;
    }

    // Mode 1: QUESTION_SET
    if (mode === 'QUESTION_SET' && questionSet && Array.isArray(questionSet.questionIds)) {
      const setIds = new Set(questionSet.questionIds.map(id => id.toString()));
      const setAvailable = available.filter(q => setIds.has(q.id.toString()));
      if (setAvailable.length > 0) {
        return this.pickRandom(setAvailable);
      }
    }

    // Mode 2: DIFFICULTY CURVE (Adaptive Round progression)
    if (mode === 'DIFFICULTY_CURVE') {
      let targetDiff = 'EASY';
      if (roundNumber >= 11) {
        targetDiff = null; // Mixed
      } else if (roundNumber >= 7) {
        targetDiff = 'HARD';
      } else if (roundNumber >= 4) {
        targetDiff = 'MEDIUM';
      } else {
        targetDiff = 'EASY';
      }

      if (targetDiff) {
        const diffAvailable = available.filter(q => q.difficulty === targetDiff);
        if (diffAvailable.length > 0) {
          return this.pickRandom(diffAvailable);
        }
      }
    }

    // Mode 3: MIXED MODE (Weighted category distribution)
    if (mode === 'MIXED' && mixedRatios && typeof mixedRatios === 'object') {
      const targetCategory = this.selectCategoryByRatio(mixedRatios);
      if (targetCategory) {
        const catAvailable = available.filter(q => q.category === targetCategory);
        if (catAvailable.length > 0) {
          return this.pickRandom(catAvailable);
        }
      }
    }

    // Mode 4: CATEGORY Filter
    if (category) {
      const catAvailable = available.filter(q => q.category === category);
      if (catAvailable.length > 0) {
        return this.pickRandom(catAvailable);
      }
    }

    // Mode 5: DIFFICULTY Filter
    if (difficulty) {
      const diffAvailable = available.filter(q => q.difficulty === difficulty);
      if (diffAvailable.length > 0) {
        return this.pickRandom(diffAvailable);
      }
    }

    // Mode 6: TYPE Filter
    if (type) {
      const typeAvailable = available.filter(q => q.type === type);
      if (typeAvailable.length > 0) {
        return this.pickRandom(typeAvailable);
      }
    }

    // Fallback: Pick randomly from available pool
    return this.pickRandom(available) || pool[0];
  }

  selectCategoryByRatio(ratios) {
    const entries = Object.entries(ratios);
    if (entries.length === 0) return null;

    const totalWeight = entries.reduce((sum, [, weight]) => sum + (Number(weight) || 0), 0);
    if (totalWeight <= 0) return entries[0][0];

    let random = Math.random() * totalWeight;
    for (const [cat, weight] of entries) {
      random -= (Number(weight) || 0);
      if (random <= 0) return cat;
    }
    return entries[0][0];
  }

  pickRandom(list) {
    if (!list || list.length === 0) return null;
    const idx = Math.floor(Math.random() * list.length);
    return list[idx];
  }
}

if (typeof window !== 'undefined') {
  window.QuestionSelector = QuestionSelector;
}
if (typeof globalThis !== 'undefined') {
  globalThis.QuestionSelector = QuestionSelector;
}
