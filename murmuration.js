// Starling Murmuration — topological neighbor model
// Based on Ballerini et al. (2008): each bird tracks its nearest 7
// neighbors regardless of distance, not a fixed radius. This is what
// real starlings do and produces ribbons/funnels instead of blobs.
(() => {
  const canvas = document.getElementById('murmuration');
  const ctx = canvas.getContext('2d');

  let W, H;
  const N = 800;
  const boids = [];

  // Topological: each bird considers its K nearest neighbors
  const K = 7;

  const SEP_DIST = 15;
  const SEP_F = 0.04;       // softer push-away
  const ALN_F = 0.12;       // strong alignment = they move as ribbons
  const COH_F = 0.015;      // they WANT to be together
  const MAX_SPD = 4.5;
  const MIN_SPD = 2;
  const EDGE_M = 50;
  const EDGE_T = 0.6;

  let mouse = { x: -1000, y: -1000, active: false };
  let t = 0;

  // Reusable array for neighbor finding (avoid allocation per frame)
  const neighborDists = new Float32Array(N);
  const neighborIdx = new Uint16Array(K);

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function init() {
    resize();
    boids.length = 0;
    const cx = W * 0.5, cy = H * 0.45;
    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 6 + Math.random() * 0.5;
      const r = 10 + Math.random() * 50;
      const spd = 1.5 + Math.random() * 1;
      boids.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        vx: -Math.sin(angle) * spd + (Math.random() - 0.5) * 0.5,
        vy: Math.cos(angle) * spd + (Math.random() - 0.5) * 0.5,
        sz: 1.25 + Math.random() * 1.5,
        wander: Math.random() * Math.PI * 2,
      });
    }
  }

  // Find K nearest neighbors for boid i
  // Uses partial sort — O(N) per bird which is fine for 800
  function findNearest(i) {
    const b = boids[i];
    // Compute all distances
    for (let j = 0; j < N; j++) {
      if (j === i) { neighborDists[j] = 1e9; continue; }
      const dx = boids[j].x - b.x;
      const dy = boids[j].y - b.y;
      neighborDists[j] = dx * dx + dy * dy;
    }
    // Find K smallest (simple selection, faster than full sort)
    for (let k = 0; k < K; k++) {
      let minD = 1e9, minJ = 0;
      for (let j = 0; j < N; j++) {
        if (neighborDists[j] < minD) {
          minD = neighborDists[j];
          minJ = j;
        }
      }
      neighborIdx[k] = minJ;
      neighborDists[minJ] = 1e9; // exclude from next round
    }
  }

  // Cache neighbors — only recalculate for half the flock each frame
  const cachedNeighbors = new Array(N);
  for (let i = 0; i < N; i++) cachedNeighbors[i] = new Uint16Array(K);

  function update() {
    t++;

    // Stagger: recalculate neighbors for half the flock each frame
    const start = (t & 1) ? 0 : (N >> 1);
    const end = start + (N >> 1);
    for (let i = start; i < end; i++) {
      findNearest(i);
      cachedNeighbors[i].set(neighborIdx);
    }

    for (let i = 0; i < N; i++) {
      const b = boids[i];

      let sepX = 0, sepY = 0;
      let alnX = 0, alnY = 0;
      let cohX = 0, cohY = 0;

      for (let k = 0; k < K; k++) {
        const o = boids[cachedNeighbors[i][k]];
        const dx = o.x - b.x;
        const dy = o.y - b.y;
        const d2 = dx * dx + dy * dy;
        const d = Math.sqrt(d2) + 0.001;

        // Separation — push away from close neighbors
        if (d < SEP_DIST) {
          sepX -= dx / d;
          sepY -= dy / d;
        }

        // Alignment — match neighbor velocity
        alnX += o.vx;
        alnY += o.vy;

        // Cohesion — move toward neighbor center
        cohX += o.x;
        cohY += o.y;
      }

      const invK = 1 / K;
      b.vx += ((alnX * invK) - b.vx) * ALN_F;
      b.vy += ((alnY * invK) - b.vy) * ALN_F;
      b.vx += ((cohX * invK) - b.x) * COH_F;
      b.vy += ((cohY * invK) - b.y) * COH_F;
      b.vx += sepX * SEP_F;
      b.vy += sepY * SEP_F;

      // Gentle wander — each bird has a slowly rotating preferred direction
      // This creates organic drift without the wobbly attractor feel
      b.wander += (Math.random() - 0.5) * 0.2;
      b.vx += Math.cos(b.wander) * 0.04;
      b.vy += Math.sin(b.wander) * 0.04;

      // Mouse avoidance
      if (mouse.active) {
        const mdx = b.x - mouse.x;
        const mdy = b.y - mouse.y;
        const md2 = mdx * mdx + mdy * mdy;
        if (md2 < 40000) {
          const inv = 1.5 / (Math.sqrt(md2) + 1);
          b.vx += mdx * inv;
          b.vy += mdy * inv;
        }
      }

      // Soft edge wrapping
      if (b.x < EDGE_M) b.vx += EDGE_T;
      if (b.x > W - EDGE_M) b.vx -= EDGE_T;
      if (b.y < EDGE_M) b.vy += EDGE_T;
      if (b.y > H - EDGE_M) b.vy -= EDGE_T;

      // Speed clamp
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
