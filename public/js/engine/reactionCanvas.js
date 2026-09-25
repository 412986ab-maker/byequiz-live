/**
 * BYE QUIZ LIVE - High Performance Cyber Reaction & Particle Canvas Engine
 * GPU-Accelerated, Procedural Geometry, Zero Unicode Emojis, Zero Memory Leaks.
 */
class ReactionCanvasEngine {
  constructor(canvasId = 'confetti-canvas') {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.pool = [];
    this.active = false;
    this.maxParticles = 180;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement || document.body;
    this.canvas.width = parent.clientWidth || window.innerWidth;
    this.canvas.height = parent.clientHeight || window.innerHeight;
  }

  // Particle object pooling
  getParticle() {
    return this.pool.pop() || {};
  }

  releaseParticle(p) {
    if (this.pool.length < 300) {
      this.pool.push(p);
    }
  }

  // 1. Cyber Shard / Energy Burst (Celebration)
  launch(count = 70, type = 'SHARD') {
    this.resize();
    const colors = ['#00f2fe', '#4facfe', '#a855f7', '#ec4899', '#ffd700', '#10b981'];
    const actualCount = Math.min(count, this.maxParticles - this.particles.length);

    for (let i = 0; i < actualCount; i++) {
      const p = this.getParticle();
      p.x = this.canvas.width / 2 + (Math.random() - 0.5) * 160;
      p.y = this.canvas.height / 2 + (Math.random() - 0.5) * 100;
      p.vx = (Math.random() - 0.5) * 14;
      p.vy = (Math.random() - 1.2) * 14;
      p.size = Math.random() * 8 + 4;
      p.color = colors[Math.floor(Math.random() * colors.length)];
      p.rotation = Math.random() * Math.PI * 2;
      p.rotSpeed = (Math.random() - 0.5) * 0.2;
      p.gravity = 0.22;
      p.opacity = 1;
      p.decay = Math.random() * 0.015 + 0.009;
      p.type = type; // 'SHARD', 'DIAMOND', 'HEXAGON', 'RING', 'HEART'
      this.particles.push(p);
    }

    if (!this.active) {
      this.active = true;
      this.animate();
    }
  }

  // 2. Floating Cyber Reactions (Likes, Hearts, Energy Sparks)
  spawnFloatingReaction(startX, startY, type = 'NEON_HEART', color = '#ec4899') {
    this.resize();
    const p = this.getParticle();
    p.x = startX || (this.canvas.width * 0.75 + (Math.random() - 0.5) * 60);
    p.y = startY || (this.canvas.height * 0.85 + (Math.random() - 0.5) * 40);
    p.vx = (Math.random() - 0.5) * 2;
    p.vy = -(Math.random() * 3 + 3.5);
    p.size = Math.random() * 10 + 12;
    p.color = color;
    p.rotation = (Math.random() - 0.5) * 0.4;
    p.rotSpeed = (Math.random() - 0.5) * 0.04;
    p.gravity = -0.02; // floats upward
    p.opacity = 1;
    p.decay = Math.random() * 0.012 + 0.008;
    p.type = type;
    p.wobble = Math.random() * Math.PI * 2;
    p.wobbleSpeed = 0.08;

    this.particles.push(p);

    if (!this.active) {
      this.active = true;
      this.animate();
    }
  }

  // 3. Shockwave Ring
  spawnShockwave(x, y, color = '#00f2fe', maxRadius = 120) {
    this.resize();
    const p = this.getParticle();
    p.x = x || this.canvas.width / 2;
    p.y = y || this.canvas.height / 2;
    p.vx = 0;
    p.vy = 0;
    p.radius = 5;
    p.maxRadius = maxRadius;
    p.color = color;
    p.opacity = 1;
    p.decay = 0.025;
    p.type = 'SHOCKWAVE';
    this.particles.push(p);

    if (!this.active) {
      this.active = true;
      this.animate();
    }
  }

  burst() {
    this.launch(80, 'SHARD');
  }

  celebrateWinner() {
    this.launch(150, 'DIAMOND');
    setTimeout(() => this.launch(100, 'HEXAGON'), 300);
  }

  drawNeonHeart(ctx, size) {
    ctx.beginPath();
    const topCurveHeight = size * 0.3;
    ctx.moveTo(0, topCurveHeight);
    // top left curve
    ctx.bezierCurveTo(-size / 2, -topCurveHeight, -size, size / 3, 0, size);
    // top right curve
    ctx.bezierCurveTo(size, size / 3, size / 2, -topCurveHeight, 0, topCurveHeight);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  drawCyberDiamond(ctx, size) {
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.7, 0);
    ctx.lineTo(0, size);
    ctx.lineTo(-size * 0.7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  drawHexagon(ctx, size) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const hx = Math.cos(angle) * size;
      const hy = Math.sin(angle) * size;
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  animate() {
    if (!this.particles.length) {
      this.active = false;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      if (p.type === 'SHOCKWAVE') {
        p.radius += (p.maxRadius - p.radius) * 0.12 + 1;
        p.opacity -= p.decay;

        if (p.opacity <= 0 || p.radius >= p.maxRadius) {
          this.releaseParticle(p);
          this.particles.splice(i, 1);
          continue;
        }

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        this.ctx.strokeStyle = p.color;
        this.ctx.lineWidth = 3 * p.opacity;
        this.ctx.shadowColor = p.color;
        this.ctx.shadowBlur = 15;
        this.ctx.globalAlpha = Math.max(0, p.opacity);
        this.ctx.stroke();
        this.ctx.restore();
        continue;
      }

      // Physics
      if (p.wobble !== undefined) {
        p.wobble += p.wobbleSpeed;
        p.x += Math.sin(p.wobble) * 1.5 + p.vx;
      } else {
        p.x += p.vx;
      }
      p.y += p.vy;
      p.vy += p.gravity;
      p.rotation += p.rotSpeed;
      p.opacity -= p.decay;

      if (p.opacity <= 0 || p.y > this.canvas.height + 40 || p.y < -40) {
        this.releaseParticle(p);
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.rotation);
      this.ctx.globalAlpha = Math.max(0, p.opacity);
      this.ctx.fillStyle = p.color;
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 8;

      if (p.type === 'NEON_HEART') {
        this.drawNeonHeart(this.ctx, p.size);
      } else if (p.type === 'DIAMOND') {
        this.drawCyberDiamond(this.ctx, p.size);
      } else if (p.type === 'HEXAGON') {
        this.drawHexagon(this.ctx, p.size);
      } else {
        // Standard Cyber Shard (Rhombus/Rectangle)
        this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.5);
      }

      this.ctx.restore();
    }

    requestAnimationFrame(() => this.animate());
  }
}

// Global hook & backward compatibility
if (typeof window !== 'undefined') {
  window.ReactionCanvasEngine = ReactionCanvasEngine;
  const canvasInstance = new ReactionCanvasEngine('confetti-canvas');
  window.confettiEngine = canvasInstance;
  window.confettiFX = canvasInstance;
}
