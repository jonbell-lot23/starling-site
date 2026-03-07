// Starling Murmuration — tight swarm, radius-based
(() => {
  const canvas = document.getElementById('murmuration');
  const ctx = canvas.getContext('2d');

  let W, H;
  const N = 500;
  const boids = [];

  const VR = 100;
  const VR2 = VR * VR;
  const SEP_DIST = 16;
  const SEP_F = 0.04;
  const ALN_F = 0.06;        // moderate — they generally move together
  const COH_F = 0.003;       // light — drift together, don't clump
  const MAX_SPD = 3.5;
  const MIN_SPD = 1.8;
  const EDGE_M = 80;
  const EDGE_T = 0.5;

  let mouse = { x: -1000, y: -1000, active: false };
  let t = 0;

  // Phantom scare — random burst that scatters birds like a predator dove in
  let scareX = 0, scareY = 0, scareActive = false, scareTimer = 0;
  let nextScare = 120 + Math.random() * 300; // 2-7 seconds at 60fps

  function triggerScare() {
    // Pick a random point near the flock center
    let cx = 0, cy = 0;
    for (let i = 0; i < N; i++) { cx += boids[i].x; cy += boids[i].y; }
    cx /= N; cy /= N;
    // Scare from a random direction near the flock
    const angle = Math.random() * Math.PI * 2;
    scareX = cx + Math.cos(angle) * 50;
    scareY = cy + Math.sin(angle) * 50;
    scareActive = true;
    scareTimer = 20; // lasts ~20 frames
  }

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
        vx: -Math.sin(angle) * spd + (Math.random() - 0.5) * 0.3,
        vy: Math.cos(angle) * spd + (Math.random() - 0.5) * 0.3,
        sz: 0.8 + Math.random() * 1,
        wander: Math.random() * Math.PI * 2,
        // Lost bird system: timer counts down, when 0 bird goes lost
        // Stagger so they don't all get lost at once
        lostTimer: Math.floor(Math.random() * 600) + 200,
        lost: false,
        lostDuration: 0,
      });
    }
  }

  function update() {
    t++;

    // Phantom scare timer — only if mouse isn't already scaring them
    if (!mouse.active) {
      nextScare--;
      if (nextScare <= 0) {
        triggerScare();
        nextScare = 120 + Math.random() * 300;
      }
    }
    if (scareActive) {
      scareTimer--;
      if (scareTimer <= 0) scareActive = false;
    }

    // Count current lost birds
    let lostCount = 0;
    for (let i = 0; i < N; i++) if (boids[i].lost) lostCount++;

    for (let i = 0; i < N; i++) {
      const b = boids[i];

      // Lost bird state machine
      if (b.lost) {
        b.lostDuration--;
        if (b.lostDuration <= 0) {
          // Rejoin — start flocking again
          b.lost = false;
          b.lostTimer = 300 + Math.floor(Math.random() * 500);
        }
      } else {
        b.lostTimer--;
        if (b.lostTimer <= 0 && lostCount < N * 0.2) {
          // Go lost — wander off on your own
          b.lost = true;
          b.lostDuration = 120 + Math.floor(Math.random() * 180); // lost for 2-5 sec
          b.wander = Math.random() * Math.PI * 2;
          lostCount++;
        }
      }

      // Lost birds: stronger wander, weaker flocking
      if (b.lost) {
        b.wander += (Math.random() - 0.5) * 0.4;
        b.vx += Math.cos(b.wander) * 0.15;
        b.vy += Math.sin(b.wander) * 0.15;

        // Still gently pulled back toward flock so they eventually return
        let fcx = 0, fcy = 0, fc = 0;
        for (let j = 0; j < N; j++) {
          if (!boids[j].lost) { fcx += boids[j].x; fcy += boids[j].y; fc++; }
        }
        if (fc > 0) {
          b.vx += ((fcx / fc) - b.x) * 0.0005;
          b.vy += ((fcy / fc) - b.y) * 0.0005;
        }

        // Speed + bounds still apply (handled below)
        // Skip normal flocking
        goto_speed: {
          // Phantom scare still affects lost birds
          if (scareActive) {
            const sdx = b.x - scareX;
            const sdy = b.y - scareY;
            const sd2 = sdx * sdx + sdy * sdy;
            if (sd2 < 40000) {
              const inv = 1.5 / (Math.sqrt(sd2) + 1);
              b.vx += sdx * inv;
              b.vy += sdy * inv;
            }
          }
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
        continue;
      }

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
          if (d2 < SEP_DIST * SEP_DIST && d2 > 0.01) {
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

      // Rotating wind that pulses — swirl then gather, swirl then gather
      const windAngle = t * 0.004;
      const windStrength = 0.02 + Math.sin(t * 0.008) * 0.03;
      b.vx += Math.cos(windAngle) * windStrength;
      b.vy += Math.sin(windAngle) * windStrength;

      // Individual wander — enough to be swirly
      b.wander += (Math.random() - 0.5) * 0.25;
      b.vx += Math.cos(b.wander) * 0.05;
      b.vy += Math.sin(b.wander) * 0.05;

      // Phantom scare
      if (scareActive) {
        const sdx = b.x - scareX;
        const sdy = b.y - scareY;
        const sd2 = sdx * sdx + sdy * sdy;
        if (sd2 < 40000) {
          const inv = 1.5 / (Math.sqrt(sd2) + 1);
          b.vx += sdx * inv;
          b.vy += sdy * inv;
        }
      }

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
