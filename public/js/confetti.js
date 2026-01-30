// Lightweight confetti effect on canvas
const confettiCanvas = document.getElementById('confetti-canvas');
const ctx = confettiCanvas.getContext('2d');

function resizeCanvas() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const COLORS = ['#a855f7', '#ec4899', '#06b6d4', '#f59e0b', '#22c55e', '#f43f5e'];

class Particle {
  constructor() {
    this.reset();
    this.y = Math.random() * -confettiCanvas.height;
  }

  reset() {
    this.x = Math.random() * confettiCanvas.width;
    this.y = -10;
    this.w = Math.random() * 8 + 4;
    this.h = Math.random() * 6 + 2;
    this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.vx = (Math.random() - 0.5) * 4;
    this.vy = Math.random() * 3 + 2;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = (Math.random() - 0.5) * 10;
    this.opacity = 1;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.05;
    this.rotation += this.rotationSpeed;
    this.opacity -= 0.003;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.globalAlpha = Math.max(0, this.opacity);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
    ctx.restore();
  }
}

let particles = [];
let animating = false;

function animate() {
  if (!animating) return;
  ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

  particles = particles.filter((p) => p.opacity > 0 && p.y < confettiCanvas.height + 20);
  particles.forEach((p) => {
    p.update();
    p.draw();
  });

  if (particles.length === 0) {
    animating = false;
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    return;
  }
  requestAnimationFrame(animate);
}

window.launchConfetti = function () {
  particles = [];
  for (let i = 0; i < 150; i++) {
    particles.push(new Particle());
  }
  animating = true;
  animate();
};
