/* ============================================================
   TCF Galaxy — Star Field Canvas Animation
   ============================================================ */
'use strict';

(function () {
  const canvas = document.getElementById('starfield');
  const ctx = canvas.getContext('2d');

  let stars = [];
  const STAR_COUNT = 320;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function initStars() {
    stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      const tier = Math.random();
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        // Three tiers of stars: tiny, small, medium
        r: tier < 0.7 ? Math.random() * 0.6 + 0.2 : tier < 0.95 ? Math.random() * 1.0 + 0.6 : Math.random() * 1.6 + 1.0,
        baseOpacity: tier < 0.7 ? Math.random() * 0.35 + 0.1 : Math.random() * 0.55 + 0.25,
        speed: Math.random() * 0.004 + 0.001,
        phase: Math.random() * Math.PI * 2,
        // Rare colored stars (blue or purple tint)
        hue: Math.random() < 0.06 ? (Math.random() < 0.5 ? '180, 210, 255' : '190, 170, 255') : '255, 255, 255',
      });
    }
  }

  let frame = 0;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const time = frame * 0.5;
    stars.forEach(star => {
      const twinkle = Math.sin(time * star.speed + star.phase);
      const alpha = star.baseOpacity * (0.65 + 0.35 * twinkle);

      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${star.hue}, ${alpha})`;
      ctx.fill();
    });

    frame++;
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => {
    resize();
    initStars();
  });

  resize();
  initStars();
  draw();
})();
