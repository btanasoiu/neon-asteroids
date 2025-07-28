/* ---------- Web-Audio “chip” sounds ---------- */
const actx = new (window.AudioContext || window.webkitAudioContext)();
const S = {
  thrust: 220, fire: 800, bangL: 150, bangS: 400
};
function play(freq, dur = 0.15, type = 'square') {
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, actx.currentTime);
  gain.gain.setValueAtTime(0.25, actx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
  osc.connect(gain).connect(actx.destination);
  osc.start(); osc.stop(actx.currentTime + dur);
}

/* ---------- Persistent high-score ---------- */
const HS_KEY = 'neonAsteroidsHS';
function loadHS() {
  try { return JSON.parse(localStorage.getItem(HS_KEY) || '[]'); }
  catch { return []; }
}
function saveHS(list) { localStorage.setItem(HS_KEY, JSON.stringify(list.slice(0, 5))); }
function addScore(score) { saveHS([...loadHS(), score].sort((a, b) => b - a)); }

/* ---------- Vector helper ---------- */
class Vec {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  mul(s) { this.x *= s; this.y *= s; return this; }
  len() { return Math.hypot(this.x, this.y); }
  clone() { return new Vec(this.x, this.y); }
  static fromAngle(a) { return new Vec(Math.cos(a), Math.sin(a)); }
}

/* ---------- Particle ---------- */
class Particle {
  constructor(pos, color) {
    this.pos = pos.clone();
    this.vel = Vec.fromAngle(Math.random() * Math.PI * 2).mul(2 + Math.random() * 4);
    this.life = 40;
    this.color = color;
  }
  update() { this.pos.add(this.vel); this.vel.mul(0.97); this.life--; }
  draw() {
    ctx.fillStyle = this.color;
    ctx.globalAlpha = this.life / 40;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.fillRect(this.pos.x - 1, this.pos.y - 1, 2, 2);
    ctx.globalAlpha = 1;
  }
}

/* ---------- Asteroid (random, non-intersecting) ---------- */
class Asteroid {
  constructor(pos, r) {
    this.pos = pos;
    this.r = r || 30 + Math.random() * 40;
    this.vel = new Vec(Math.random() - 0.5, Math.random() - 0.5).mul(1 + Math.random() * 2);
    this.color = ['#00faff', '#ff00e6', '#00ff8f', '#ffe600'][Math.floor(Math.random() * 4)];
    // 6–12 evenly-spaced vertices for a simple convex polygon
    const edgeCount = 6 + Math.floor(Math.random() * 7);
    const step = (Math.PI * 2) / edgeCount;
    this.vertices = Array.from({ length: edgeCount }, (_, i) => {
      const jitter = 0.25;
      const radius = this.r * (1 + (Math.random() - 0.5) * jitter);
      const angle = i * step;
      return new Vec(Math.cos(angle) * radius, Math.sin(angle) * radius);
    });
  }
  update() { this.pos.add(this.vel); screenWrap(this); }
  draw() {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.beginPath();
    ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
    this.vertices.forEach(v => ctx.lineTo(v.x, v.y));
    ctx.closePath();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.restore();
  }
}

/* ---------- Bullet ---------- */
class Bullet {
  constructor(pos, dir) {
    this.pos = pos.clone();
    this.vel = dir.clone().mul(8);
    this.life = 60;
    this.color = '#fff';
  }
  update() { this.pos.add(this.vel); this.life--; }
  draw() {
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.fillRect(this.pos.x - 2, this.pos.y - 2, 4, 4);
  }
}

/* ---------- Ship ---------- */
class Ship {
  constructor() {
    this.pos = new Vec(400, 300);
    this.vel = new Vec();
    this.angle = 0;
    this.thrusting = false;
    this.size = 15;
    this.inv = 0;
  }
  update() {
    if (keys['ArrowUp']) {
      const thrust = new Vec(Math.cos(this.angle), Math.sin(this.angle)).mul(0.2);
      this.vel.add(thrust);
      this.thrusting = true;
      play(S.thrust, 0.1, 'sawtooth');
    } else this.thrusting = false;
    this.vel.mul(0.99);
    this.pos.add(this.vel);
    screenWrap(this);
    if (this.inv > 0) this.inv--;
  }
  draw() {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.angle);
    ctx.beginPath();
    ctx.moveTo(this.size, 0);
    ctx.lineTo(-this.size, -this.size * 0.8);
    ctx.lineTo(-this.size * 0.5, 0);
    ctx.lineTo(-this.size, this.size * 0.8);
    ctx.closePath();
    ctx.strokeStyle = this.inv % 6 < 3 ? '#fff' : '#ff00e6';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ff00e6';
    ctx.shadowBlur = 20;
    ctx.stroke();
    if (this.thrusting) {
      ctx.beginPath();
      ctx.moveTo(-this.size * 0.5, 0);
      ctx.lineTo(-this.size * 1.5, 0);
      ctx.strokeStyle = '#00faff';
      ctx.stroke();
    }
    ctx.restore();
  }
}

/* ---------- Globals ---------- */
const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');
const W = 800, H = 600;
const keys = {};
['keydown', 'keyup'].forEach(ev =>
  window.addEventListener(ev, e => keys[e.code] = ev === 'keydown')
);

let gameState = 'playing';
let score = 0;
let lives = 3;
let ship, asteroids, bullets, particles;

function resetGame() {
  score = 0;
  lives = 3;
  ship = new Ship();
  asteroids = Array.from({ length: 5 }, () =>
    new Asteroid(new Vec(Math.random() * W, Math.random() * H))
  );
  bullets = [];
  particles = [];
}

/* ---------- Controls ---------- */
window.addEventListener('keydown', e => {
  if (e.code === 'KeyP' && gameState !== 'help') togglePause();
  if (e.code === 'KeyH') toggleHelp();
  if (e.code === 'KeyQ') quitGame();
  if (e.code === 'KeyR' && gameState === 'gameOver') {
    resetGame();
    gameState = 'playing';
  }
});
function togglePause() { gameState = gameState === 'paused' ? 'playing' : 'paused'; }
function toggleHelp() { gameState = gameState === 'help' ? 'playing' : 'help'; }
function quitGame() { gameState = 'gameOver'; addScore(score); }

/* ---------- Helpers ---------- */
function screenWrap(obj) {
  if (obj.pos.x < 0) obj.pos.x = W;
  if (obj.pos.x > W) obj.pos.x = 0;
  if (obj.pos.y < 0) obj.pos.y = H;
  if (obj.pos.y > H) obj.pos.y = 0;
}
function explode(pos, color, count = 25) {
  play(pos.len() > 60 ? S.bangL : S.bangS, 0.2, 'sawtooth');
  for (let i = 0; i < count; i++) particles.push(new Particle(pos, color));
}

/* ---------- SAFE collision handling ---------- */
function handleCollisions() {
  /* bullets vs asteroids (backwards loops to avoid mutation issues) */
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    for (let j = asteroids.length - 1; j >= 0; j--) {
      const a = asteroids[j];
      const dx = b.pos.x - a.pos.x;
      const dy = b.pos.y - a.pos.y;
      if (Math.sqrt(dx * dx + dy * dy) < a.r) {
        bullets.splice(i, 1);
        explode(a.pos, a.color, Math.floor(a.r));
        score += Math.floor(1000 / a.r);
        if (a.r > 20) {
          asteroids.push(new Asteroid(a.pos.clone(), a.r * 0.6));
          asteroids.push(new Asteroid(a.pos.clone(), a.r * 0.6));
        }
        asteroids.splice(j, 1);
        break;
      }
    }
  }

  /* ship vs asteroids (radius check) */
  if (ship.inv <= 0) {
    for (const a of asteroids) {
      const dx = ship.pos.x - a.pos.x;
      const dy = ship.pos.y - a.pos.y;
      if (Math.sqrt(dx * dx + dy * dy) < a.r + ship.size) {
        explode(ship.pos, '#ff00e6', 40);
        lives--;
        if (lives <= 0) {
          quitGame();
        } else {
          ship.pos.set(W / 2, H / 2);
          ship.vel.set(0, 0);
          ship.inv = 120;
        }
        return;
      }
    }
  }
}

/* ---------- Game loop ---------- */
let lastShot = 0;
function update() {
  if (keys['ArrowLeft']) ship.angle -= 0.08;
  if (keys['ArrowRight']) ship.angle += 0.08;
  if (keys['Space']) {
    if (Date.now() - lastShot > 150) {
      bullets.push(new Bullet(ship.pos, new Vec(Math.cos(ship.angle), Math.sin(ship.angle))));
      play(S.fire, 0.05, 'square');
      lastShot = Date.now();
    }
  }

  ship.update();
  asteroids.forEach(a => a.update());
  bullets.forEach(b => b.update());
  particles.forEach(p => p.update());

  bullets = bullets.filter(b => b.life > 0);
  particles = particles.filter(p => p.life > 0);

  handleCollisions();
}

function drawHUD() {
  ctx.fillStyle = '#00faff';
  ctx.font = '20px Orbitron';
  ctx.fillText(`Score: ${score}`, 20, 30);
  const hs = loadHS();
  if (hs.length) ctx.fillText(`Best: ${hs[0]}`, 20, 60);
  ctx.fillText(`Lives: ${lives}`, 20, 90);
}

function drawCenterText(text) {
  ctx.fillStyle = '#ff00e6';
  ctx.font = 'bold 24px Orbitron';
  ctx.textAlign = 'center';
  text.split('\n').forEach((line, i) =>
    ctx.fillText(line, W / 2, H / 2 - 60 + i * 30)
  );
  ctx.textAlign = 'left';
}

function draw() {
  ctx.fillStyle = '#0c0c0c';
  ctx.fillRect(0, 0, W, H);

  if (gameState === 'playing') {
    ship.draw();
    asteroids.forEach(a => a.draw());
    bullets.forEach(b => b.draw());
    particles.forEach(p => p.draw());
    drawHUD();
  } else if (gameState === 'paused') {
    drawCenterText('PAUSED\nPress P to resume');
  } else if (gameState === 'help') {
    drawCenterText(
      'HELP\n' +
      'Arrow keys : steer\n' +
      'Up         : thrust\n' +
      'Space      : fire\n' +
      'P          : pause / resume\n' +
      'H          : this help\n' +
      'Q          : quit to menu\n' +
      'R          : restart (after game over)\n\n' +
      'Press H to close'
    );
  } else if (gameState === 'gameOver') {
    drawCenterText(`GAME OVER\nScore: ${score}\nPress R to restart`);
  }
}

function loop() {
  if (gameState === 'playing') update();
  draw();
  requestAnimationFrame(loop);
}

resetGame();
loop();
