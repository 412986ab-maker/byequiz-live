/**
 * Reaction Engine
 * Triggers audio synthesizer sounds, canvas confetti fireworks, and visual floating chips.
 */
class ReactionEngine {
  constructor(eventManager) {
    this.events = eventManager;
    this.setupListeners();
  }

  setupListeners() {
    this.events.on('registration:joined', () => {
      if (typeof window !== 'undefined' && window.soundFX) window.soundFX.playJoin();
    });

    this.events.on('answer:correct', ({ user }) => {
      if (typeof window !== 'undefined' && window.soundFX) window.soundFX.playCorrect();
    });

    this.events.on('timer:tick', () => {
      if (typeof window !== 'undefined' && window.soundFX) window.soundFX.playTick();
    });

    this.events.on('draw:step', () => {
      if (typeof window !== 'undefined' && window.soundFX) window.soundFX.playSpin();
    });

    this.events.on('draw:winner', () => {
      if (typeof window !== 'undefined' && window.soundFX) window.soundFX.playWinner();
      if (typeof window !== 'undefined' && window.confettiEngine) window.confettiEngine.launch(120);
    });

    this.events.on('gift:received', () => {
      if (typeof window !== 'undefined' && window.soundFX) window.soundFX.playWinner();
      if (typeof window !== 'undefined' && window.confettiEngine) window.confettiEngine.launch(35);
    });

    this.events.on('scene:podium', () => {
      if (typeof window !== 'undefined' && window.soundFX) window.soundFX.playWinner();
      if (typeof window !== 'undefined' && window.confettiEngine) window.confettiEngine.launch(150);
    });
  }
}

if (typeof window !== 'undefined') {
  window.ReactionEngine = ReactionEngine;
}
if (typeof globalThis !== 'undefined') {
  globalThis.ReactionEngine = ReactionEngine;
}
