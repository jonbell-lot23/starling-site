// Starling Murmuration — demoscene-optimized flocking
(() => {
  const canvas = document.getElementById('murmuration');
  const ctx = canvas.getContext('2d');

  let W, H;
  const N = 875;

  // SoA layout — cache-friendly typed arrays
  const px = new Float32Array(N);
  const py = new Float32Array(N);
  const vx = new Float32Array(N);
  const vy = new Float32Array(N);
  const sz = new Float32Array(N);
  const op = new Float32Array(N);

  // Flocking
  const VR = 90, VR2 = VR * VR;
  const SEP_D2 = 18 * 18;
  const SEP_F = 0.05;
  const ALN_F = 0.065;
  const COH_F = 0.008;
  const MAX_SPD = 4, MAX_SPD2 = 16;
  const MIN_SPD = 2, MIN_SPD2 = 4;
  const EDGE_M = 80, EDGE_T = 0.4;

  let mouse = { x: -1000, y: -1000, active: false };
  let frame = 0;

  // Spatial grid
  const CELL = VR;
  let gridKeys, gridNext, gridHead, gridCols;

  function allocGrid() {
    gridCols = Math.ceil(W / CELL) + 2;
    const cells = gridCols * (Math.ceil(H / CELL) + 2);
    gridHead = new Int32Array(cells).fill(-1);
    gridKeys = new Int32Array(N);
    gridNext = new Int32Array(N);
  }

  function buildGrid() {
    gridHead.fill(-1);
    for (let i = 0; i < N; i++) {
      const cx = (px[i] / CELL) | 0;
      const cy = (py[i] / CELL) | 0;
      const key = cy * gridCols + cx;
      gridKeys[i] = key;
      gridNext[i] = gridHead[key];
      gridHead[key] = i;
    }
  }

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    allocGrid();
  }

  function init() {
    resize();
    const cxp = W * 0.5, cyp = H * 0.45;
    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 6 + Math.random() * 0.5;
      const r = 30 + Math.random() * 120;
      px[i] = cxp + Math.cos(angle) * r;
      py[i] = cyp + Math.sin(angle) * r;
      const spd = 2.5 + Math.random() * 2;
      vx[i] = -Math.sin(angle) * spd + (Math.random() - 0.5) * 0.5;
      vy[i] = Math.cos(angle) * spd + (Math.random() - 0.5) * 0.5;
      sz[i] = 1 + Math.random() * 1.2;
      op[i] = 0.4 + Math.random() * 0.5;
    }
  }

  function update() {
    buildGrid();

    // Staggered: update half the flock each frame
    const start = (frame & 1) ? 0 : (N >> 1);
    const end = start + (N >> 1);

    for (let i = start; i < end; i++) {
      let sepX = 0, sepY = 0;
      let alnX = 0, alnY = 0;
      let cohX = 0, cohY = 0;
      let nb = 0;

      const cx = (px[i] / CELL) | 0;
      const cy = (py[i] / CELL) | 0;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const key = (cy + dy) * gridCols + (cx + dx);
          let j = gridHead[key];
          while (j !== -1) {
            if (j !== i) {
              const ddx = px[j] - px[i];
              const ddy = py[j] - py[i];
              const d2 = ddx * ddx + ddy * ddy;

              if (d2 < VR2) {
                if (d2 < SEP_D2 && d2 > 0.01) {
                  // Fast inverse sqrt approximation (no sqrt!)
                  const inv = 1 / (d2 + 1);
                  sepX -= ddx * inv;
                  sepY -= ddy * inv;
                }
                alnX += vx[j];
                alnY += vy[j];
                cohX += px[j];
                cohY += py[j];
                nb++;
              }
            }
            j = gridNext[j];
          }
        }
      }

      if (nb > 0) {
        const invN = 1 / nb;
        vx[i] += ((alnX * invN) - vx[i]) * ALN_F;
        vy[i] += ((alnY * invN) - vy[i]) * ALN_F;
        vx[i] += ((cohX * invN) - px[i]) * COH_F;
        vy[i] += ((cohY * invN) - py[i]) * COH_F;
      }

      vx[i] += sepX * SEP_F;
      vy[i] += sepY * SEP_F;

      // Mouse avoidance
      if (mouse.active) {
        const mdx = px[i] - mouse.x;
        const mdy = py[i] - mouse.y;
        const md2 = mdx * mdx + mdy * mdy;
        if (md2 < 32400) { // 180²
          const inv = 1.2 / (Math.sqrt(md2) + 1);
          vx[i] += mdx * inv;
          vy[i] += mdy * inv;
        }
      }

      // Bounds
      if (px[i] < EDGE_M) vx[i] += EDGE_T;
      if (px[i] > W - EDGE_M) vx[i] -= EDGE_T;
      if (py[i] < EDGE_M) vy[i] += EDGE_T;
      if (py[i] > H - EDGE_M) vy[i] -= EDGE_T;

      // Speed clamp (no sqrt for common case)
      const s2 = vx[i] * vx[i] + vy[i] * vy[i];
      if (s2 > MAX_SPD2) {
        const s = Math.sqrt(s2);
        vx[i] = (vx[i] / s) * MAX_SPD;
        vy[i] = (vy[i] / s) * MAX_SPD;
      } else if (s2 < MIN_SPD2) {
        const s = Math.sqrt(s2);
        vx[i] = (vx[i] / s) * MIN_SPD;
        vy[i] = (vy[i] / s) * MIN_SPD;
      }
    }

    // Move ALL boids every frame (positions always update)
    for (let i = 0; i < N; i++) {
      px[i] += vx[i];
      py[i] += vy[i];
    }

    frame++;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Batch all birds in one path per alpha band
    // 3 bands for depth variation
    const bands = [
      { minOp: 0.4, maxOp: 0.6, alpha: 0.45 },
      { minOp: 0.6, maxOp: 0.75, alpha: 0.65 },
      { minOp: 0.75, maxOp: 1.0, alpha: 0.85 },
    ];

    for (const band of bands) {
      ctx.fillStyle = `rgba(15, 15, 25, ${band.alpha})`;
      ctx.beginPath();

      for (let i = 0; i < N; i++) {
        if (op[i] < band.minOp || op[i] >= band.maxOp) continue;
        const angle = Math.atan2(vy[i], vx[i]);
        const s = sz[i];
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const lx = s * 2.2;
        const ly = s * 0.5;

        // Approximate ellipse with a quick diamond/kite shape
        ctx.moveTo(px[i] + cos * lx, py[i] + sin * lx);
        ctx.lineTo(px[i] - sin * ly, py[i] + cos * ly);
        ctx.lineTo(px[i] - cos * lx * 0.5, py[i] - sin * lx * 0.5);
        ctx.lineTo(px[i] + sin * ly, py[i] - cos * ly);
      }

      ctx.fill();
    }

    // Batch trails in one stroke
    ctx.strokeStyle = 'rgba(10, 10, 20, 0.12)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      ctx.moveTo(px[i], py[i]);
      ctx.lineTo(px[i] - vx[i] * 3, py[i] - vy[i] * 3);
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
