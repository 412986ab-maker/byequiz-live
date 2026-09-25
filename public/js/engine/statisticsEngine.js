/**
 * Statistics Engine
 * Computes accuracy percentages, fastest times, response distributions and session statistics.
 */
class StatisticsEngine {
  constructor(eventManager, gameState) {
    this.events = eventManager;
    this.state = gameState;
    this.setupListeners();
  }

  setupListeners() {
    this.events.on('timer:ended', () => {
      this.calculateRoundStats();
    });

    this.events.on('answer:received', () => {
      this.calculateLiveStats();
    });
  }

  calculateLiveStats() {
    const answers = this.state.get('roundAnswers') || [];
    const correct = answers.filter(a => a.isCorrect);

    let fastest = '--';
    let avg = '--';

    if (correct.length > 0) {
      const times = correct.map(a => a.responseTime);
      fastest = Math.min(...times).toFixed(2) + 's';
      const sum = times.reduce((a, b) => a + b, 0);
      avg = (sum / times.length).toFixed(2) + 's';
    }

    const accuracy = answers.length > 0 ? Math.round((correct.length / answers.length) * 100) : 0;

    const stats = {
      accuracy,
      fastestTime: fastest,
      averageTime: avg,
      totalAnswersInRound: answers.length,
      correctAnswersInRound: correct.length
    };

    this.state.set('stats', stats);
    this.events.emit('stats:updated', stats);
    return stats;
  }

  calculateRoundStats() {
    return this.calculateLiveStats();
  }

  getTopAnswerFrequencies(limit = 4) {
    const freqs = this.state.get('answerFrequencies') || {};
    return Object.entries(freqs)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  }
}

if (typeof window !== 'undefined') {
  window.StatisticsEngine = StatisticsEngine;
}
if (typeof globalThis !== 'undefined') {
  globalThis.StatisticsEngine = StatisticsEngine;
}
