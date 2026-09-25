/**
 * Question Validator & Duplicate Detector
 * Validates question schema integrity, choices sufficiency, and identifies potential duplicate questions.
 */
class QuestionValidator {
  static normalizeTextForComparison(text = '') {
    return text
      .toString()
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, '') // Remove Arabic tashkeel
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/[^\u0621-\u064A0-9a-zA-Z\s]/g, ' ') // Strip punctuation
      .replace(/\s+/g, ' ')
      .trim();
  }

  static validate(q, existingList = [], checkDuplicates = true) {
    const errors = [];
    const warnings = [];

    if (!q) {
      return { valid: false, errors: ['السؤال فارغ تماماً'], warnings: [] };
    }

    // 1. Question text validation
    if (!q.question || q.question.trim().length < 3) {
      errors.push('نص السؤال يجب ألا يقل عن 3 أحرف.');
    }

    // 2. Category validation
    if (!q.category || q.category.trim().length === 0) {
      errors.push('يجب تحديد تصنيف للسؤال.');
    }

    // 3. Type & Choices validation
    if (q.type === 'MULTIPLE_CHOICE') {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        errors.push('أسئلة الخيارات المتعددة تتطلب على الأقل خيارين.');
      } else {
        const emptyOptions = q.options.filter(o => !o || o.trim() === '');
        if (emptyOptions.length > 0) {
          errors.push('توجد خيارات إجابة فارغة في السؤال.');
        }
      }
    }

    // 4. Correct answer validation
    if (!q.correctAnswer && (!Array.isArray(q.answers) || q.answers.length === 0)) {
      errors.push('يجب تحديد إجابة صحيحة واحدة على الأقل.');
    }

    // 5. Time and points bounds
    if (q.timeLimit !== null && q.timeLimit !== undefined) {
      const t = Number(q.timeLimit);
      if (isNaN(t) || t < 3 || t > 180) {
        errors.push('مدة السؤال يجب أن تكون بين 3 و 180 ثانية.');
      }
    }

    if (q.points !== null && q.points !== undefined) {
      const p = Number(q.points);
      if (isNaN(p) || p < 1 || p > 5000) {
        errors.push('نقاط السؤال يجب أن تكون بين 1 و 5000 نقطة.');
      }
    }

    // 6. Duplicate ID check
    if (q.id && Array.isArray(existingList)) {
      const sameId = existingList.find(item => item.id && item.id.toString() === q.id.toString() && item !== q);
      if (sameId) {
        errors.push(`معرف السؤال (${q.id}) مكرر ومستخدم بالفعل.`);
      }
    }

    // 7. Text Similarity Duplicate Detection
    if (checkDuplicates && q.question && Array.isArray(existingList) && existingList.length > 0) {
      const duplicates = QuestionValidator.findSimilarQuestions(q, existingList);
      if (duplicates.length > 0) {
        warnings.push(`يوجد سؤال مشابه جداً مسجل مسبقاً: "${duplicates[0].question}"`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  static findSimilarQuestions(targetQuestion, questionsList = [], threshold = 0.75) {
    const targetNorm = QuestionValidator.normalizeTextForComparison(targetQuestion.question);
    const targetWords = new Set(targetNorm.split(' ').filter(w => w.length > 1));
    if (targetWords.size === 0) return [];

    const similar = [];

    questionsList.forEach(item => {
      if (item.id && targetQuestion.id && item.id.toString() === targetQuestion.id.toString()) return;
      if (!item.question) return;

      const itemNorm = QuestionValidator.normalizeTextForComparison(item.question);
      if (itemNorm === targetNorm) {
        similar.push({ ...item, similarityScore: 1.0 });
        return;
      }

      const itemWords = new Set(itemNorm.split(' ').filter(w => w.length > 1));
      if (itemWords.size === 0) return;

      // Jaccard similarity between word sets
      let intersection = 0;
      targetWords.forEach(w => {
        if (itemWords.has(w)) intersection++;
      });
      const union = new Set([...targetWords, ...itemWords]).size;
      const score = union > 0 ? (intersection / union) : 0;

      if (score >= threshold) {
        similar.push({ ...item, similarityScore: score });
      }
    });

    return similar.sort((a, b) => b.similarityScore - a.similarityScore);
  }
}

if (typeof window !== 'undefined') {
  window.QuestionValidator = QuestionValidator;
}
if (typeof globalThis !== 'undefined') {
  globalThis.QuestionValidator = QuestionValidator;
}
