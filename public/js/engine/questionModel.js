/**
 * Question Data Model & Normalizer
 * Standardizes question schema, provides compatibility for legacy questions,
 * and handles question serialization.
 */
class QuestionModel {
  static normalize(raw, index = 1) {
    if (!raw) return null;

    const id = (raw.id !== undefined && raw.id !== null) ? raw.id.toString() : `q_${Date.now()}_${index}`;
    const category = (raw.category || raw.cat || 'ثقافة عامة').trim();
    const subcategory = (raw.subcategory || '').trim();
    
    // Normalize difficulty: EASY, MEDIUM, HARD, EXPERT
    let diff = (raw.difficulty || 'MEDIUM').toString().toUpperCase();
    if (diff.includes('سهل') || diff.includes('EASY')) diff = 'EASY';
    else if (diff.includes('متوسط') || diff.includes('MEDIUM')) diff = 'MEDIUM';
    else if (diff.includes('صعب') || diff.includes('HARD') || diff.includes('تحدي')) diff = 'HARD';
    else if (diff.includes('خبير') || diff.includes('EXPERT') || diff.includes('عبقري')) diff = 'EXPERT';
    else if (!['EASY', 'MEDIUM', 'HARD', 'EXPERT'].includes(diff)) diff = 'MEDIUM';

    // Normalize type: MULTIPLE_CHOICE, TRUE_FALSE, TEXT, IMAGE_QUESTION, FASTEST_ANSWER
    let type = (raw.type || '').toString().toUpperCase();
    if (!type) {
      if (raw.image || raw.img) type = 'IMAGE_QUESTION';
      else if (raw.options && raw.options.length > 0) type = 'MULTIPLE_CHOICE';
      else if (raw.choices && raw.choices.length > 0) type = 'MULTIPLE_CHOICE';
      else type = 'TEXT';
    }

    const questionText = (raw.question || raw.q || '').trim();

    // Options array (for MULTIPLE_CHOICE or TRUE_FALSE)
    let options = [];
    if (Array.isArray(raw.options)) options = raw.options.map(o => o.toString().trim());
    else if (Array.isArray(raw.choices)) options = raw.choices.map(c => c.toString().trim());

    if (type === 'TRUE_FALSE' && options.length === 0) {
      options = ['صح', 'خطأ'];
    }

    // Answers array (synonyms / accepted answers)
    let answers = [];
    if (Array.isArray(raw.answers)) answers = raw.answers.map(a => a.toString().trim());
    else if (Array.isArray(raw.alts)) answers = raw.alts.map(a => a.toString().trim());
    else if (raw.displayAnswer) answers = [raw.displayAnswer.toString().trim()];
    else if (raw.correctAnswer) answers = [raw.correctAnswer.toString().trim()];
    else if (raw.a) answers = [raw.a.toString().trim()];

    const correctAnswer = (raw.correctAnswer || raw.displayAnswer || raw.a || (answers.length > 0 ? answers[0] : '')).toString().trim();
    if (correctAnswer && !answers.includes(correctAnswer)) {
      answers.unshift(correctAnswer);
    }

    const explanation = (raw.explanation || '').trim();
    const timeLimit = raw.timeLimit ? parseInt(raw.timeLimit, 10) : null;
    const points = raw.points ? parseInt(raw.points, 10) : null;
    const image = (raw.image || raw.img || '').trim();
    const audio = (raw.audio || '').trim();

    let tags = [];
    if (Array.isArray(raw.tags)) tags = raw.tags.map(t => t.toString().trim());
    else if (typeof raw.tags === 'string') tags = raw.tags.split(',').map(t => t.trim()).filter(Boolean);
    else tags = [category];

    const language = raw.language || 'ar';
    const enabled = raw.enabled !== undefined ? Boolean(raw.enabled) : true;
    const usageCount = parseInt(raw.usageCount || 0, 10);
    const lastUsedAt = raw.lastUsedAt || null;
    const createdAt = raw.createdAt || Date.now();
    const updatedAt = raw.updatedAt || Date.now();

    const stats = raw.stats || {
      correct: 0,
      wrong: 0,
      totalAnswers: 0,
      avgSpeed: 0,
      timesWon: 0
    };

    return {
      id,
      category,
      subcategory,
      difficulty: diff,
      type,
      question: questionText,
      options,
      answers,
      correctAnswer,
      displayAnswer: correctAnswer, // Backward compatibility alias
      explanation,
      timeLimit,
      points,
      image,
      audio,
      tags,
      language,
      enabled,
      usageCount,
      lastUsedAt,
      createdAt,
      updatedAt,
      stats
    };
  }

  static normalizeArray(list = []) {
    if (!Array.isArray(list)) return [];
    return list.map((item, idx) => QuestionModel.normalize(item, idx + 1)).filter(Boolean);
  }
}

if (typeof window !== 'undefined') {
  window.QuestionModel = QuestionModel;
}
if (typeof globalThis !== 'undefined') {
  globalThis.QuestionModel = QuestionModel;
}
