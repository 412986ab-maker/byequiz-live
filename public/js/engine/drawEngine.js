/**
 * Draw Engine
 * Handles lucky draw roulette spinning, candidate filtering,
 * previous winner exclusion, and WINNER event dispatching.
 */
class DrawEngine {
  constructor(eventManager, gameState, participantManager) {
    this.events = eventManager;
    this.state = gameState;
    this.participants = participantManager;
    this.isSpinning = false;
    this.activeTimer = null;
  }

  reset() {
    this.isSpinning = false;
    if (this.activeTimer) {
      clearTimeout(this.activeTimer);
      this.activeTimer = null;
    }
  }

  spin(forcedWinnerId = null, options = {}) {
    if (this.isSpinning && !options.instant) return null;

    const settings = this.state.get('settings');
    const round = this.state.get('round');
    const previousWinnerId = settings.excludePreviousWinner ? round.previousWinnerId : null;

    // Get strictly eligible participants from current round
    const eligibleUsers = this.participants.getEligibleParticipants(previousWinnerId);

    if (!eligibleUsers || eligibleUsers.length === 0) {
      const fullPool = this.participants.getDrawPoolUsers();
      if (!fullPool || fullPool.length === 0) {
        this.events.emit('draw:empty');
        return null;
      }
    }

    const candidatePool = eligibleUsers.length > 0 ? eligibleUsers : this.participants.getDrawPoolUsers();
    this.isSpinning = true;

    let winner = null;
    if (forcedWinnerId) {
      winner = candidatePool.find(u => u.id === forcedWinnerId.toString()) || candidatePool[0];
    } else {
      winner = candidatePool[Math.floor(Math.random() * candidatePool.length)];
    }

    const finishDraw = () => {
      this.isSpinning = false;
      this.activeTimer = null;
      round.previousWinnerId = winner.id;
      this.state.set('currentWinner', winner);

      const winnerPayload = {
        type: "WINNER",
        participant: {
          id: winner.id,
          username: winner.username || winner.id,
          displayName: winner.displayName || winner.nickname,
          nickname: winner.nickname,
          avatar: winner.avatar,
          score: winner.points || 0
        },
        roundNumber: round.roundNumber
      };

      // Emit official WINNER event
      this.events.emit('WINNER', winnerPayload);
      this.events.emit('WINNER_SELECTED', winnerPayload);
      this.events.emit('draw:winner', {
        winner,
        payload: winnerPayload,
        participantsCount: candidatePool.length
      });
    };

    if (options.instant) {
      finishDraw();
      return winner;
    }

    let counter = 0;
    const totalSpins = 24;
    let speed = 60;

    this.events.emit('DRAW_STARTED', { totalSpins, participantsCount: candidatePool.length });
    this.events.emit('draw:started', { totalSpins, participantsCount: candidatePool.length });

    const step = () => {
      const candidate = candidatePool[Math.floor(Math.random() * candidatePool.length)];

      this.events.emit('DRAW_TICK', {
        candidate,
        step: counter,
        totalSpins
      });
      this.events.emit('draw:step', {
        candidate,
        step: counter,
        totalSpins
      });

      counter++;
      if (counter < totalSpins) {
        speed += 12;
        this.activeTimer = setTimeout(step, speed);
      } else {
        finishDraw();
      }
    };

    step();
    return winner;
  }

  spinInstant(forcedWinnerId = null) {
    return this.spin(forcedWinnerId, { instant: true });
  }
}

if (typeof window !== 'undefined') {
  window.DrawEngine = DrawEngine;
}
if (typeof globalThis !== 'undefined') {
  globalThis.DrawEngine = DrawEngine;
}
