/* محرّك المؤثرات البصرية: خلفية معمل ذرية متحركة + احتفالات */

const PALETTE = ['#22e3ff', '#8b5cf6', '#a3e635', '#f472b6', '#fbbf24'];

export function startBackground(canvas = document.getElementById('fx')) {
  if (!canvas) return () => {};
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let raf = 0;
  let running = true;
  const pointer = { x: -1, y: -1, active: false };

  const atoms = [];
  const sparks = [];
  const bonds = [];

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  }

  function seed() {
    atoms.length = 0;
    bonds.length = 0;
    const count = Math.max(18, Math.min(46, Math.round((width * height) / 34000)));
    for (let i = 0; i < count; i += 1) {
      atoms.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.34,
        vy: (Math.random() - 0.5) * 0.34,
        r: 1.6 + Math.random() * 3.4,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        pulse: Math.random() * Math.PI * 2,
        orbit: Math.random() < 0.25,
      });
    }
  }

  function step(t) {
    if (!running) return;
    ctx.clearRect(0, 0, width, height);

    // توهج خفيف في زوايا الشاشة
    const glow = ctx.createRadialGradient(width * 0.82, height * 0.08, 0, width * 0.82, height * 0.08, Math.max(width, height) * 0.7);
    glow.addColorStop(0, 'rgba(34,227,255,0.10)');
    glow.addColorStop(0.45, 'rgba(139,92,246,0.05)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    // شبكة مختبر خفيفة
    ctx.strokeStyle = 'rgba(120,200,255,0.05)';
    ctx.lineWidth = 1;
    const grid = 64;
    for (let x = 0; x < width; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += grid) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // الروابط بين الذرات القريبة
    for (let i = 0; i < atoms.length; i += 1) {
      const a = atoms[i];
      for (let j = i + 1; j < atoms.length; j += 1) {
        const b = atoms[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 150) {
          const alpha = (1 - dist / 150) * 0.22;
          ctx.strokeStyle = `rgba(34,227,255,${alpha.toFixed(3)})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // حركة الذرات
    atoms.forEach((atom) => {
      if (!reduce) {
        atom.x += atom.vx;
        atom.y += atom.vy;
        if (atom.x < -20) atom.x = width + 20;
        if (atom.x > width + 20) atom.x = -20;
        if (atom.y < -20) atom.y = height + 20;
        if (atom.y > height + 20) atom.y = -20;
      }

      if (pointer.active) {
        const dx = atom.x - pointer.x;
        const dy = atom.y - pointer.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 130 && dist > 0.5) {
          atom.x += (dx / dist) * 0.6;
          atom.y += (dy / dist) * 0.6;
        }
      }

      const pulse = 1 + Math.sin(t / 900 + atom.pulse) * 0.22;
      ctx.beginPath();
      ctx.fillStyle = atom.color;
      ctx.globalAlpha = 0.75;
      ctx.shadowBlur = 14;
      ctx.shadowColor = atom.color;
      ctx.arc(atom.x, atom.y, atom.r * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      if (atom.orbit) {
        ctx.strokeStyle = atom.color;
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        ctx.ellipse(atom.x, atom.y, atom.r * 5.5, atom.r * 2.6, t / 3400 + atom.pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    });

    // شرارات الاحتفال
    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const s = sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.045;
      s.life -= 0.014;
      if (s.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = Math.max(0, s.life);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    raf = requestAnimationFrame(step);
  }

  const onPointer = (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
  };
  const onLeave = () => {
    pointer.active = false;
  };

  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('pointerleave', onLeave);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
    } else if (!running) {
      running = true;
      raf = requestAnimationFrame(step);
    }
  });

  resize();
  raf = requestAnimationFrame(step);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', onPointer);
    window.removeEventListener('pointerleave', onLeave);
  };
}

/** انفجار شرارات في نقطة محددة (نجاح التسليم/التصحيح) */
export function celebrate(x = window.innerWidth / 2, y = window.innerHeight / 2, count = 46) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const host = document.createElement('div');
  host.className = 'confetti-layer';
  document.body.appendChild(host);
  for (let i = 0; i < count; i += 1) {
    const bit = document.createElement('i');
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const distance = 90 + Math.random() * 190;
    bit.style.setProperty('--x', `${x}px`);
    bit.style.setProperty('--y', `${y}px`);
    bit.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    bit.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
    bit.style.setProperty('--c', PALETTE[i % PALETTE.length]);
    bit.style.setProperty('--d', `${600 + Math.random() * 700}ms`);
    host.appendChild(bit);
  }
  setTimeout(() => host.remove(), 1600);
}

/** وميض نيون على عنصر */
export function flash(node, className = 'flash') {
  if (!node) return;
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
  setTimeout(() => node.classList.remove(className), 900);
}
