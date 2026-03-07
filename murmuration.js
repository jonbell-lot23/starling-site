// Starling Murmuration — organic flocking with wandering attractors
(() => {
  const canvas = document.getElementById('murmuration');
  const ctx = canvas.getContext('2d');

  let W, H;
  const N = 800;
  const boids = [];

  const VR2 = 80 * 80;
  const SEP_D2 = 20 * 20;
  const SEP_F = 0.06;
  const ALN_F = 0.08;       // strong alignment = ribbons not blobs
  const COH_F = 0.003;      // weak cohesion = don't clump into a ball
  const MAX_SPD = 4.5;
  const MIN_SPD = 2.5;
  const EDGE_M = 60;
  const EDGE_T = 0.5;

  let mouse = { x: -1000, y: -1000, active: false };
  let t = 0;

  // Wandering attractors — invisible points that drift slowly,
  // pulling nearby birds into streams and funnels
  const NUM_ATTRACTORS = 4;
  const attractors = [];

  function initAttractors() {
    attractors.length = 0;
    for (let i = 0; i < NUM_ATTRACTORS; i++) {
      attractors.push({
        x: W * (0.2 + Math.random() * 0.6),
        y: H * (0.2 + Math.random() * 0.6),
        // Each attractor drifts on its own slow sine path
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
        speedX: 0.003 + Math.random() * 0.004,
        speedY: 0.002 + Math.random() * 0.005,
        ampX: W * (0.15 + Math.random() * 0.15),
        ampY: H * (0.1 + Math.random() * 0.15),
        cx: W * (0.2 + Math.random() * 0.6),
        cy: H * (0.2 + Math.random() * 0.6),
        strength: 0.015 + Math.random() * 0.01,
      });
    }
  }

  function updateAttractors() {
    for (const a of attractors) {
      a.x = a.cx + Math.sin(t * a.speedX + a.phaseX) * a.ampX;
      a.y = a.cy + Math.cos(t * a.speedY + a.phaseY) * a.ampY;
    }
  }

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function init() {
    resize();
    boids.length = 0;
    initAttractors();
    const cx = W * 0.5, cy = H * 0.45;
    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 6 + Math.random() * 0.5;
      const r = 30 + Math.random() * 120;
      const spd = 2.5 + Math.random() * 2;
      boids.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        vx: -Math.sin(angle) * spd + (Math.random() - 0.5) * 0.5,
        vy: Math.cos(angle) * spd + (Math.random() - 0.5) * 0.5,
        sz: 1.25 + Math.random() * 1.5,
        op: 0.4 + Math.random() * 0.5,
        // Each bird is drawn to a primary attractor (creates sub-flocks)
        att: (i % NUM_ATTRACTORS),
        // Per-bird wander phase for organic noise
        wPhase: Math.random() * Math.PI * 2,
      });
    }
  }

  function update() {
    t++;
    updateAttractors();

    for (let i = 0; i < N; i++) {
      const b = boids[i];
      let sepX = 0, sepY = 0;
      let alnX = 0, alnY = 0;
      let cohX = 0, cohY = 0;
      let nb = 0;

      for (let j = 0; j < N; j++) {
        if (i === j) continue;
        const o = boids[j];
        const dx = o.x - b.x;
        const dy = o.y - b.y;
        const d2 = dx * dx + dy * dy;

        if (d2 < VR2) {
          if (d2 < SEP_D2 && d2 > 0.01) {
            const inv = 1 / (d2 + 1);
            sepX -= dx * inv;
            sepY -= dy * inv;
          }
          alnX += o.vx;
          alnY += o.vy;
          cohX += o.x;
          cohY += o.y;
          nb++;
        }
      }

      if (nb > 0) {
        const inv = 1 / nb;
        b.vx += ((alnX * inv) - b.vx) * ALN_F;
        b.vy += ((alnY * inv) - b.vy) * ALN_F;
        b.vx += ((cohX * inv) - b.x) * COH_F;
        b.vy += ((cohY * inv) - b.y) * COH_F;
      }

      b.vx += sepX * SEP_F;
      b.vy += sepY * SEP_F;

      // Attractor pull — creates the funnels and streams
      const a = attractors[b.att];
      const adx = a.x - b.x;
      const ady = a.y - b.y;
      const ad2 = adx * adx + ady * ady;
      if (ad2 > 100) {
        const str = a.strength / (1 + ad2 * 0.00003);
        b.vx += adx * str;
        b.vy += ady * str;
      }

      // Per-bird wander noise — prevents lockstep
      const wander = 0.15;
      b.vx += Math.sin(t * 0.02 + b.wPhase) * wander;
      b.vy += Math.cos(t * 0.017 + b.wPhase * 1.3) * wander;

      // Mouse avoidance
      if (mouse.active) {
        const mdx = b.x - mouse.x;
        const mdy = b.y - mouse.y;
        const md2 = mdx * mdx + mdy * mdy;
        if (md2 < 32400) {
          const inv = 1.2 / (Math.sqrt(md2) + 1);
          b.vx += mdx * inv;
          b.vy += mdy * inv;
        }
      }

      if (b.x < EDGE_M) b.vx += EDGE_T;
      if (b.x > W - EDGE_M) b.vx -= EDGE_T;
      if (b.y < EDGE_M) b.vy += EDGE_T;
      if (b.y > H - EDGE_M) b.vy -= EDGE_T;

      const s2 = b.vx * b.vx + b.vy * b.vy;
      if (s2 > 0.001) {
        if (s2 > MAX_SPD * MAX_SPD) {
          const s = Math.sqrt(s2);
          b.vx = (b.vx / s) * MAX_SPD;
          b.vy = (b.vy / s) * MAX_SPD;
        } else if (s2 < MIN_SPD * MIN_SPD) {
          const s = Math.sqrt(s2);
          b.vx = (b.vx / s) * MIN_SPD;
          b.vy = (b.vy / s) * MIN_SPD;
        }
      } else {
        b.vx = (Math.random() - 0.5) * MIN_SPD;
        b.vy = (Math.random() - 0.5) * MIN_SPD;
      }

      b.x += b.vx;
      b.y += b.vy;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(15, 15, 25, 0.7)';
    for (let i = 0; i < N; i++) {
      const b = boids[i];
      const s = b.sz;
      ctx.fillRect(b.x - s, b.y - s * 0.4, s * 2.5, s * 0.8);
    }

    ctx.strokeStyle = 'rgba(10, 10, 20, 0.15)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const b = boids[i];
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 3, b.y - b.vy * 3);
    }
    ctx.stroke();
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);
  canvas.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; });
  canvas.addEventListener('mouseleave', () => { mouse.active = false; });
  canvas.addEventListener('touchmove', (e) => { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; mouse.active = true; }, { passive: true });
  canvas.addEventListener('touchend', () => { mouse.active = false; });

  window.addEventListener('scroll', () => {
    canvas.style.opacity = Math.max(0, 1 - window.scrollY / (window.innerHeight * 0.6));
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
  document.querySelectorAll('.fade-in').forEach((el) => observer.observe(el));

  init();
  loop();
})();
