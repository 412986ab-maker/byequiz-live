/**
 * Main Game Controller (Entry point)
 * Boots the new Modular Game Engine Architecture while maintaining complete backward compatibility.
 */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize the central Game Engine
  window.gameEngine = new GameEngine();

  // Backward compatibility alias for legacy scripts
  window.gameApp = {
    mode: 'DRAW',
    get participants() { return window.gameEngine.participants.participants; },
    get drawPool() { return window.gameEngine.participants.drawPool; },
    setMode: (mode) => window.gameEngine.scenes.transitionTo(mode),
    startQuestion: (id) => window.gameEngine.startQuestion(id),
    triggerLuckyDraw: (id) => {
      window.gameEngine.scenes.transitionTo('DRAW');
      window.gameEngine.draw.spin(id);
    },
    resetGame: () => window.gameEngine.handleIncomingMessage({ type: 'RESET_ALL' })
  };
});
