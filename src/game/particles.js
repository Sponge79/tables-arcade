// Petit système de particules Canvas 2D — formes simples uniquement (rectangles),
// pas d'assets, pas de moteur de particules externe.

let canvas, ctx2d;
let particles = [];

const COLORS = ['#f5f5f5', '#e6162d'];

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx2d = canvas.getContext('2d');
  ctx2d.scale(dpr, dpr);
}

function loop() {
  ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  particles = particles.filter((p) => p.life > 0);
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15;
    p.life -= 0.025;
    ctx2d.globalAlpha = Math.max(p.life, 0);
    ctx2d.fillStyle = p.color;
    ctx2d.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx2d.globalAlpha = 1;
  requestAnimationFrame(loop);
}

export function initParticles() {
  canvas = document.createElement('canvas');
  canvas.id = 'particleCanvas';
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '20',
  });
  document.body.appendChild(canvas);
  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(loop);
}

export function burst(x, y, { count = 18, colors = COLORS } = {}) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 4;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      size: 3 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }
}
