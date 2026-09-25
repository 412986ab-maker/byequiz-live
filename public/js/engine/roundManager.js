/**
 * Round Manager
 * Coordinates the automated round lifecycle:
 * REGISTRATION (Target reached) -> Countdown (3,2,1) -> QUESTION -> Timer End -> ANSWERS -> DRAW -> WINNER -> STATS -> NEXT ROUND.
 */
class RoundManager {
  constructor(eventManager, gameState, participantManager, questionEngine, drawEngine, sceneManager) {
    this.events = eventManager;
    this.state = gameState;
    this.participants = participantManager;
    this.questions = questionEngine;
    this.draw = drawEngine;
    this.scenes = sceneManager;
    this.isCountdownActive = false;
    this.transitionTimeout = null;

    this.setupListeners();
  }

  setupListeners() {
    // 1. When target participants count is reached during registration
    this.events.on('participants:target_reached', ({ count, target }) => {
      const settings = this.state.get('settings');
      if (settings.autoTransition && !this.isCountdownActive) {
        this.runParticipantsCompleteSequence();
      }
    });

    // 2. When question timer ends
    this.events.on('timer:ended', () => {
      const settings = this.state.get('settings');
      this.events.emit('QUESTION_ENDED', { question: this.state.get('currentQuestion') });

      if (settings.autoTransition) {
        this.scenes.transitionTo('ANSWERS');

        const delay = (settings.resultsDuration || 4) * 1000;
        clearTimeout(this.transitionTimeout);
        this.transitionTimeout = setTimeout(() => {
          if (this.state.get('scene') === 'ANSWERS') {
            this.scenes.transitionTo('DRAW');
            this.draw.spin();
          }
        }, delay);
      }
    });

    // 3. When a lucky draw winner is chosen
    this.events.on('WINNER', (winnerData) => {
      const settings = this.state.get('settings');
      if (settings.autoTransition) {
        clearTimeout(this.transitionTimeout);
        this.transitionTimeout = setTimeout(() => {
          if (this.state.get('scene') === 'WINNER') {
            this.scenes.transitionTo('STATS');

            // If autoMode is ON, schedule Next Round
            if (settings.autoMode && settings.autoNextRound) {
              setTimeout(() => {
                if (this.state.get('scene') === 'STATS') {
                  this.startNewRound();
                }
              }, 4000);
            }
          }
        }, (settings.winnerDuration || 4) * 1000);
      }
    });
  }

  // Sequence: PARTICIPANTS COMPLETE -> Celebration -> 3 -> 2 -> 1 -> QUESTION
  runParticipantsCompleteSequence() {
    this.isCountdownActive = true;
    this.events.emit('round:target_completed');

    this.scenes.transitionTo('PARTICIPANTS');
    this.scenes.renderParticipantsCompleteCelebration(() => {
      let count = 3;
      this.scenes.renderCountdownOverlay(count);

      const interval = setInterval(() => {
        count--;
        if (count > 0) {
          this.scenes.renderCountdownOverlay(count);
          if (typeof window !== 'undefined' && window.soundFX) window.soundFX.playTick();
        } else {
          clearInterval(interval);
          this.isCountdownActive = false;
          this.startQuestionPhase();
        }
      }, 1000);
    });
  }

  startQuestionPhase() {
    const q = this.questions.next();
    this.scenes.transitionTo('QUESTION');
    this.events.emit('QUESTION_STARTED', { question: q, roundNumber: this.state.get('round').roundNumber });
  }

  startNewRound(manualRoundNumber = null) {
    clearTimeout(this.transitionTimeout);
    this.isCountdownActive = false;

    const round = this.state.get('round');
    round.roundNumber = manualRoundNumber || (round.roundNumber + 1);
    round.status = 'REGISTRATION';
    round.startTime = Date.now();

    // Clean participants draw pool for new round
    if (this.draw && typeof this.draw.reset === "function") this.draw.reset();
    this.participants.clearParticipants();
    this.state.resetRound();

    this.scenes.transitionTo('REGISTRATION');
    this.events.emit('ROUND_STARTED', { roundNumber: round.roundNumber });
    this.events.emit('round:started', { roundNumber: round.roundNumber });
  }

  pauseRound() {
    this.questions.stopTimer();
    clearTimeout(this.transitionTimeout);
    this.isCountdownActive = false;
    this.state.get('round').status = 'PAUSED';
    this.events.emit('round:paused');
  }

  resumeRound() {
    this.state.get('round').status = 'ACTIVE';
    this.events.emit('round:resumed');
  }

  resetRound() {
    clearTimeout(this.transitionTimeout);
    this.isCountdownActive = false;
    this.participants.clearParticipants();
    this.state.resetRound();
    this.scenes.transitionTo('REGISTRATION');
    this.events.emit('round:reset');
  }
}

if (typeof window !== 'undefined') {
  window.RoundManager = RoundManager;
}
if (typeof globalThis !== 'undefined') {
  globalThis.RoundManager = RoundManager;
}
