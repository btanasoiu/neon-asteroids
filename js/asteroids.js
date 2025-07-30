/* ---------- Web-Audio "chip" sounds ---------- */
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
  set(x, y) { this.x = x; this.y = y; return this; }
  normalize() { const l = this.len(); if (l > 0) { this.x /= l; this.y /= l; } return this; }
  static fromAngle(a) { return new Vec(Math.cos(a), Math.sin(a)); }
}

/* ---------- Particle ---------- */
class Particle {
  constructor(pos, color) {
    this.pos = pos.clone();
    this.vel = Vec.fromAngle(Math.random() * Math.PI * 2).mul(2 + Math.random() * 4);
    this.life = 30 + Math.random() * 20;
    this.maxLife = this.life;
    this.color = color;
    this.size = 1 + Math.random() * 2;
  }
  update() { 
    this.pos.add(this.vel); 
    this.vel.mul(0.98); 
    this.life--; 
  }
  draw() {
    ctx.fillStyle = this.color;
    ctx.globalAlpha = this.life / this.maxLife;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.fillRect(this.pos.x - this.size/2, this.pos.y - this.size/2, this.size, this.size);
    ctx.globalAlpha = 1;
  }
}

/* ---------- Improved Asteroid ---------- */
class Asteroid {
  constructor(pos, r, generation = 0) {
    this.pos = pos;
    this.generation = generation;
    
    // Better size distribution based on generation
    if (r) {
      this.r = r;
    } else {
      const baseSizes = [60, 35, 18]; // Large, medium, small
      this.r = baseSizes[Math.min(generation, 2)] + Math.random() * 10 - 5;
    }
    
    const speedMultiplier = 1 + generation * 0.3; // Smaller asteroids move faster
    this.vel = new Vec(Math.random() - 0.5, Math.random() - 0.5)
      .normalize()
      .mul((0.5 + Math.random() * 1.5) * speedMultiplier);
    
    this.rotationSpeed = (Math.random() - 0.5) * 0.02;
    this.rotation = 0;
    
    this.color = ['#00faff', '#ff00e6', '#00ff8f', '#ffe600'][Math.floor(Math.random() * 4)];
    
    // More varied shapes
    const edgeCount = 6 + Math.floor(Math.random() * 6); // 6-11 edges
    const step = (Math.PI * 2) / edgeCount;
    this.vertices = Array.from({ length: edgeCount }, (_, i) => {
      const jitter = 0.3 + Math.random() * 0.4; // More variation
      const radius = this.r * (0.6 + jitter);
      const angle = i * step + (Math.random() - 0.5) * 0.3; // Slight angle variation
      return new Vec(Math.cos(angle) * radius, Math.sin(angle) * radius);
    });
  }
  
  update() { 
    this.pos.add(this.vel); 
    this.rotation += this.rotationSpeed;
    screenWrap(this); 
    
    // Asteroid-asteroid collision (simple repulsion)
    asteroids.forEach(other => {
      if (other === this) return;
      const dx = this.pos.x - other.pos.x;
      const dy = this.pos.y - other.pos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = this.r + other.r;
      
      if (distance < minDistance && distance > 0) {
        const overlap = minDistance - distance;
        const force = overlap * 0.01;
        const pushX = (dx / distance) * force;
        const pushY = (dy / distance) * force;
        
        this.vel.add(new Vec(pushX, pushY));
        other.vel.add(new Vec(-pushX, -pushY));
      }
    });
  }
  
  draw() {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.rotation);
    
    ctx.beginPath();
    ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
    this.vertices.forEach(v => ctx.lineTo(v.x, v.y));
    ctx.closePath();
    
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;
    ctx.stroke();
    
    // Optional: fill with slight transparency for depth
    ctx.fillStyle = this.color + '10';
    ctx.fill();
    
    ctx.restore();
  }
}

/* ---------- Bullet ---------- */
class Bullet {
  constructor(pos, dir) {
    this.pos = pos.clone();
    this.vel = dir.clone().mul(10); // Slightly faster bullets
    this.life = 80; // Longer range
    this.color = '#fff';
    this.trail = []; // Add bullet trail
  }
  
  update() { 
    this.trail.unshift(this.pos.clone());
    if (this.trail.length > 5) this.trail.pop();
    
    this.pos.add(this.vel); 
    this.life--; 
    screenWrap(this); // Bullets wrap around screen
  }
  
  draw() {
    // Draw trail
    this.trail.forEach((pos, i) => {
      ctx.fillStyle = `rgba(255, 255, 255, ${(this.trail.length - i) / this.trail.length * 0.5})`;
      ctx.fillRect(pos.x - 1, pos.y - 1, 2, 2);
    });
    
    // Draw bullet
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
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
    this.cooldown = 0;
    this.thrustParticles = [];
  }
  
  update() {
    if (keys['ArrowUp']) {
      const thrust = new Vec(Math.cos(this.angle), Math.sin(this.angle)).mul(0.25);
      this.vel.add(thrust);
      this.thrusting = true;
      
      // Add thrust particles
      const thrustPos = new Vec(
        this.pos.x - Math.cos(this.angle) * this.size * 0.8,
        this.pos.y - Math.sin(this.angle) * this.size * 0.8
      );
      this.thrustParticles.push(new Particle(thrustPos, '#00faff'));
      
      play(S.thrust, 0.1, 'sawtooth');
    } else {
      this.thrusting = false;
    }
    
    // Cap maximum velocity
    const maxSpeed = 8;
    if (this.vel.len() > maxSpeed) {
      this.vel.normalize().mul(maxSpeed);
    }
    
    this.vel.mul(0.99);
    this.pos.add(this.vel);
    screenWrap(this);
    
    if (this.inv > 0) this.inv--;
    if (this.cooldown > 0) this.cooldown--;
    
    // Update thrust particles
    this.thrustParticles = this.thrustParticles.filter(p => {
      p.update();
      return p.life > 0;
    });
  }
  
  draw() {
    // Draw thrust particles
    this.thrustParticles.forEach(p => p.draw());
    
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
    ctx.shadowBlur = 15;
    ctx.stroke();
    
    // Enhanced thrust visual
    if (this.thrusting) {
      ctx.beginPath();
      const flameLength = this.size * (1.2 + Math.random() * 0.5);
      ctx.moveTo(-this.size * 0.5, -3);
      ctx.lineTo(-flameLength, 0);
      ctx.lineTo(-this.size * 0.5, 3);
      ctx.strokeStyle = '#00faff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#00faff';
      ctx.shadowBlur = 10;
      ctx.stroke();
    }
    
    ctx.restore();
  }
  
  respawn() {
    this.pos.set(W / 2, H / 2);
    this.vel.set(0, 0);
    this.angle = 0;
    this.inv = 120;
    this.cooldown = 30;
    this.thrustParticles = [];
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
let wave = 1;
let ship, asteroids, bullets, particles;

function resetGame() {
  score = 0;
  lives = 3;
  wave = 1;
  ship = new Ship();
  spawnAsteroids(4 + wave); // Start with more asteroids in later waves
  bullets = [];
  particles = [];
}

function spawnAsteroids(count) {
  asteroids = [];
  for (let i = 0; i < count; i++) {
    let pos;
    let attempts = 0;
    do {
      pos = new Vec(Math.random() * W, Math.random() * H);
      attempts++;
    } while (attempts < 50 && Math.hypot(pos.x - ship.pos.x, pos.y - ship.pos.y) < 150);
    
    asteroids.push(new Asteroid(pos));
  }
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
  if (obj.pos.x < -obj.r) obj.pos.x = W + obj.r;
  if (obj.pos.x > W + obj.r) obj.pos.x = -obj.r;
  if (obj.pos.y < -obj.r) obj.pos.y = H + obj.r;
  if (obj.pos.y > H + obj.r) obj.pos.y = -obj.r;
}

function explode(pos, color, count = 25) {
  play(pos.len() > 60 ? S.bangL : S.bangS, 0.2, 'sawtooth');
  for (let i = 0; i < count; i++) particles.push(new Particle(pos, color));
}

function clearSpaceAroundShip() {
  const safeRadius = 100;
  const shipX = W / 2;
  const shipY = H / 2;
  
  asteroids.forEach(ast => {
    const dx = ast.pos.x - shipX;
    const dy = ast.pos.y - shipY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < safeRadius + ast.r) {
      const angle = Math.atan2(dy, dx);
      const newDistance = safeRadius + ast.r + 20;
      ast.pos.x = shipX + Math.cos(angle) * newDistance;
      ast.pos.y = shipY + Math.sin(angle) * newDistance;
      screenWrap(ast);
    }
  });
}

/* ---------- Collision handling ---------- */
function handleCollisions() {
  // Bullet-asteroid collisions
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    let bulletHit = false;
    
    for (let j = asteroids.length - 1; j >= 0; j--) {
      const asteroid = asteroids[j];
      const dx = bullet.pos.x - asteroid.pos.x;
      const dy = bullet.pos.y - asteroid.pos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < asteroid.r) {
        bullets.splice(i, 1);
        bulletHit = true;
        
        // Better scoring system
        const baseScore = [100, 50, 25][asteroid.generation] || 25;
        score += baseScore * wave;
        
        explode(asteroid.pos, asteroid.color, Math.floor(asteroid.r / 2));
        
        // Split asteroid if not the smallest
        if (asteroid.generation < 2) {
          const newGeneration = asteroid.generation + 1;
          const newSize = asteroid.r * 0.6;
          const splitCount = 2;
          
          for (let k = 0; k < splitCount; k++) {
            const splitPos = asteroid.pos.clone();
            const splitAsteroid = new Asteroid(splitPos, newSize, newGeneration);
            // Give split asteroids some initial velocity away from impact
            const angle = Math.random() * Math.PI * 2;
            splitAsteroid.vel.add(Vec.fromAngle(angle).mul(1 + Math.random()));
            asteroids.push(splitAsteroid);
          }
        }
        
        asteroids.splice(j, 1);
        break;
      }
    }
    
    if (bulletHit) break;
  }

  // Ship-asteroid collisions
  if (ship.inv <= 0 && ship.cooldown <= 0) {
    for (const asteroid of asteroids) {
      const dx = ship.pos.x - asteroid.pos.x;
      const dy = ship.pos.y - asteroid.pos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < asteroid.r + ship.size) {
        explode(ship.pos, '#ff00e6', 50);
        lives--;
        
        if (lives <= 0) {
          quitGame();
          return;
        }
        
        clearSpaceAroundShip();
        ship.respawn();
        break;
      }
    }
  }
  
  // Wave progression
  if (asteroids.length === 0) {
    wave++;
    const newCount = Math.min(10, 4 + wave);
    spawnAsteroids(newCount);
    
    // Bonus points for completing wave
    score += wave * 1000;
  }
}

/* ---------- Game loop ---------- */
let lastShot = 0;
function update() {
  if (keys['ArrowLeft']) ship.angle -= 0.1;
  if (keys['ArrowRight']) ship.angle += 0.1;
  if (keys['Space']) {
    if (Date.now() - lastShot > 120) { // Faster firing
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
  ctx.shadowColor = '#00faff';
  ctx.shadowBlur = 5;
  ctx.fillText(`Score: ${score}`, 20, 30);
  
  const hs = loadHS();
  if (hs.length) ctx.fillText(`Best: ${hs[0]}`, 20, 60);
  
  ctx.fillText(`Lives: ${lives}`, 20, 90);
  ctx.fillText(`Wave: ${wave}`, 20, 120);
  
  // Lives indicator (small ships)
  for (let i = 0; i < lives - 1; i++) {
    ctx.save();
    ctx.translate(W - 40 - i * 25, 30);
    ctx.scale(0.6, 0.6);
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-10, -8);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, 8);
    ctx.closePath();
    ctx.strokeStyle = '#00faff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

function drawCenterText(text) {
  ctx.fillStyle = '#ff00e6';
  ctx.font = 'bold 24px Orbitron';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#ff00e6';
  ctx.shadowBlur = 10;
  text.split('\n').forEach((line, i) =>
    ctx.fillText(line, W / 2, H / 2 - 60 + i * 30)
  );
  ctx.textAlign = 'left';
}

function draw() {
  // Subtle background gradient
  const gradient = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W, H));
  gradient.addColorStop(0, '#0f0f0f');
  gradient.addColorStop(1, '#050505');
  ctx.fillStyle = gradient;
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
    drawCenterText(`GAME OVER\nScore: ${score}\nWave: ${wave}\nPress R to restart`);
  }
}

function loop() {
  if (gameState === 'playing') update();
  draw();
  requestAnimationFrame(loop);
}

resetGame();
loop();
