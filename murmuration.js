// Starling Murmuration — Canvas flocking simulation
(() => {
  const canvas = document.getElementById('murmuration');
  const ctx = canvas.getContext('2d');

  let W, H;
  const NUM_BOIDS = 3500;
  const boids = [];

  // Flocking parameters — tighter, more cohesive
  const VISUAL_RANGE = 90;
  const SEPARATION_DIST = 18;
  const SEPARATION_FACTOR = 0.05;
  const ALIGNMENT_FACTOR = 0.065;
  const COHESION_FACTOR = 0.008;
  const MAX_SPEED = 4;
  const MIN_SPEED = 2;
  const EDGE_MARGIN = 80;
  const EDGE_TURN = 0.4;

  // Mouse interaction
  let mouse = { x: -1000, y: -1000, active: false };

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  // Start in a tight swirling cyclone around center
  function createBoid(i) {
    const cx = W * 0.5;
    const cy = H * 0.45;
    const angle = (i / NUM_BOIDS) * Math.PI * 6 + Math.random() * 0.5;
    const radius = 30 + Math.random() * 120;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;

    // Tangential velocity — creates the swirl
    const speed = 2.5 + Math.random() * 2;
    const vx = -Math.sin(angle) * speed + (Math.random() - 0.5) * 0.5;
    const vy = Math.cos(angle) * speed + (Math.random() - 0.5) * 0.5;

    return {
      x, y, vx, vy,
      size: 1 + Math.random() * 1.2,
      opacity: 0.4 + Math.random() * 0.5,
    };
  }

  function init() {
    resize();
    boids.length = 0;
    for (let i = 0; i < NUM_BOIDS; i++) {
      boids.push(createBoid(i));
    }
  }

  function limitSpeed(b) {
    const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (speed > MAX_SPEED) {
      b.vx = (b.vx / speed) * MAX_SPEED;
      b.vy = (b.vy / speed) * MAX_SPEED;
    }
    if (speed < MIN_SPEED) {
      b.vx = (b.vx / speed) * MIN_SPEED;
      b.vy = (b.vy / speed) * MIN_SPEED;
    }
  }

  function keepInBounds(b) {
    if (b.x < EDGE_MARGIN) b.vx += EDGE_TURN;
    if (b.x > W - EDGE_MARGIN) b.vx -= EDGE_TURN;
    if (b.y < EDGE_MARGIN) b.vy += EDGE_TURN;
    if (b.y > H - EDGE_MARGIN) b.vy -= EDGE_TURN;
  }

  // Spatial grid for O(n) neighbor lookups
  const CELL_SIZE = VISUAL_RANGE;
  let grid = {};

  function buildGrid() {
    grid = {};
    for (let i = 0; i < boids.length; i++) {
      const b = boids[i];
      const cx = Math.floor(b.x / CELL_SIZE);
      const cy = Math.floor(b.y / CELL_SIZE);
      const key = cx + ',' + cy;
      if (!grid[key]) grid[key] = [];
      grid[key].push(i);
    }
  }

  function getNearbyCells(b) {
    const cx = Math.floor(b.x / CELL_SIZE);
    const cy = Math.floor(b.y / CELL_SIZE);
    const nearby = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = (cx + dx) + ',' + (cy + dy);
        if (grid[key]) {
          for (const idx of grid[key]) nearby.push(idx);
        }
      }
    }
    return nearby;
  }

  function update() {
    buildGrid();

    for (let i = 0; i < boids.length; i++) {
      const b = boids[i];
      let sepX = 0, sepY = 0;
      let alignX = 0, alignY = 0;
      let cohX = 0, cohY = 0;
      let neighbors = 0;

      const nearby = getNearbyCells(b);
      for (const j of nearby) {
        if (i === j) continue;
        const other = boids[j];
        const dx = other.x - b.x;
        const dy = other.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < VISUAL_RANGE) {
          if (dist < SEPARATION_DIST && dist > 0) {
            sepX -= dx / dist;
            sepY -= dy / dist;
          }
          alignX += other.vx;
          alignY += other.vy;
          cohX += other.x;
          cohY += other.y;
          neighbors++;
        }
      }

      if (neighbors > 0) {
        alignX /= neighbors;
        alignY /= neighbors;
        b.vx += (alignX - b.vx) * ALIGNMENT_FACTOR;
        b.vy += (alignY - b.vy) * ALIGNMENT_FACTOR;

        cohX /= neighbors;
        cohY /= neighbors;
        b.vx += (cohX - b.x) * COHESION_FACTOR;
        b.vy += (cohY - b.y) * COHESION_FACTOR;
      }

      b.vx += sepX * SEPARATION_FACTOR;
      b.vy += sepY * SEPARATION_FACTOR;

      // Mouse avoidance
      if (mouse.active) {
        const mdx = b.x - mouse.x;
        const mdy = b.y - mouse.y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < 180) {
          b.vx += (mdx / mdist) * 1.2;
          b.vy += (mdy / mdist) * 1.2;
        }
      }

      keepInBounds(b);
      limitSpeed(b);

      b.x += b.vx;
      b.y += b.vy;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    for (const b of boids) {
      const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      const alpha = b.opacity * (0.6 + (speed / MAX_SPEED) * 0.4);
      const angle = Math.atan2(b.vy, b.vx);

      // Draw as small elongated shapes — more bird-like
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(angle);

      ctx.beginPath();
      ctx.ellipse(0, 0, b.size * 2, b.size * 0.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(15, 15, 25, ${alpha})`;
      ctx.fill();

      // Trail
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-b.size * 3, 0);
      ctx.strokeStyle = `rgba(10, 10, 20, ${alpha * 0.2})`;
      ctx.lineWidth = b.size * 0.4;
      ctx.stroke();

      ctx.restore();
    }
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  // Events
  window.addEventListener('resize', resize);

  canvas.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  });

  canvas.addEventListener('mouseleave', () => {
    mouse.active = false;
  });

  canvas.addEventListener('touchmove', (e) => {
    mouse.x = e.touches[0].clientX;
    mouse.y = e.touches[0].clientY;
    mouse.active = true;
  }, { passive: true });

  canvas.addEventListener('touchend', () => {
    mouse.active = false;
  });

  // Scroll-based fade for hero
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    const heroH = window.innerHeight;
    const opacity = Math.max(0, 1 - scrollY / (heroH * 0.6));
    canvas.style.opacity = opacity;
  });

  // Scroll-triggered fade-in animations
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.fade-in').forEach((el) => observer.observe(el));

  init();
  loop();
})();
