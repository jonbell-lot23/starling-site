// Starling Murmuration — Canvas flocking simulation
(() => {
  const canvas = document.getElementById('murmuration');
  const ctx = canvas.getContext('2d');

  let W, H;
  const NUM_BOIDS = 300;
  const boids = [];

  // Flocking parameters
  const VISUAL_RANGE = 75;
  const SEPARATION_DIST = 25;
  const SEPARATION_FACTOR = 0.05;
  const ALIGNMENT_FACTOR = 0.045;
  const COHESION_FACTOR = 0.005;
  const MAX_SPEED = 3.5;
  const MIN_SPEED = 1.5;
  const EDGE_MARGIN = 100;
  const EDGE_TURN = 0.3;

  // Mouse interaction
  let mouse = { x: -1000, y: -1000, active: false };

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function createBoid() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      size: 1.2 + Math.random() * 1.3,
      opacity: 0.3 + Math.random() * 0.5,
    };
  }

  function init() {
    resize();
    boids.length = 0;
    for (let i = 0; i < NUM_BOIDS; i++) {
      boids.push(createBoid());
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

  function update() {
    for (let i = 0; i < boids.length; i++) {
      const b = boids[i];
      let sepX = 0, sepY = 0;
      let alignX = 0, alignY = 0;
      let cohX = 0, cohY = 0;
      let neighbors = 0;

      for (let j = 0; j < boids.length; j++) {
        if (i === j) continue;
        const other = boids[j];
        const dx = other.x - b.x;
        const dy = other.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < VISUAL_RANGE) {
          // Separation
          if (dist < SEPARATION_DIST && dist > 0) {
            sepX -= dx / dist;
            sepY -= dy / dist;
          }

          // Alignment
          alignX += other.vx;
          alignY += other.vy;

          // Cohesion
          cohX += other.x;
          cohY += other.y;

          neighbors++;
        }
      }

      if (neighbors > 0) {
        // Alignment — steer toward average heading
        alignX /= neighbors;
        alignY /= neighbors;
        b.vx += (alignX - b.vx) * ALIGNMENT_FACTOR;
        b.vy += (alignY - b.vy) * ALIGNMENT_FACTOR;

        // Cohesion — steer toward center of mass
        cohX /= neighbors;
        cohY /= neighbors;
        b.vx += (cohX - b.x) * COHESION_FACTOR;
        b.vy += (cohY - b.y) * COHESION_FACTOR;
      }

      // Separation
      b.vx += sepX * SEPARATION_FACTOR;
      b.vy += sepY * SEPARATION_FACTOR;

      // Mouse avoidance
      if (mouse.active) {
        const mdx = b.x - mouse.x;
        const mdy = b.y - mouse.y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < 150) {
          b.vx += (mdx / mdist) * 0.8;
          b.vy += (mdy / mdist) * 0.8;
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

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(15, 15, 25, ${alpha})`;
      ctx.fill();

      // Subtle trail
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 2, b.y - b.vy * 2);
      ctx.strokeStyle = `rgba(10, 10, 20, ${alpha * 0.3})`;
      ctx.lineWidth = b.size * 0.6;
      ctx.stroke();
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
