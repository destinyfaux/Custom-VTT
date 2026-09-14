// client/src/components/LoginAmbience.jsx
// Lightweight ambient particle canvas for the landing page — drifting golden
// embers/dust motes. Dependency-free, ~30 particles, pauses when the tab is
// hidden, honors prefers-reduced-motion, and cleans up on unmount.

import { useEffect, useRef } from 'react';

export default function LoginAmbience({ density = 30 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const ctx = canvas.getContext('2d');
    let raf = 0;
    let particles = [];
    let running = true;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const PALETTE = [
      { r: 230, g: 180, b: 34 },   // accent gold
      { r: 251, g: 191, b: 36 },   // amber
      { r: 255, g: 236, b: 179 },  // pale candle
      { r: 247, g: 147, b: 59 },   // ember orange
    ];

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
    };

    const spawn = () => ({
      x: Math.random() * canvas.width,
      y: canvas.height + Math.random() * canvas.height * 0.25,
      r: (0.7 + Math.random() * 1.9) * dpr,
      drift: (Math.random() - 0.5) * 0.16 * dpr,
      rise: (0.14 + Math.random() * 0.42) * dpr,
      life: 0,
      maxLife: 380 + Math.random() * 420,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      flicker: 0.5 + Math.random() * 0.5,
    });

    const init = () => {
      resize();
      particles = Array.from({ length: density }, () => {
        const p = spawn();
        p.y = Math.random() * canvas.height; // start scattered
        p.life = Math.random() * p.maxLife;
        return p;
      });
    };

    const tick = () => {
      if (!running) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life += 1;
        p.x += p.drift + Math.sin((p.life + i * 40) * 0.011) * 0.18 * dpr;
        p.y -= p.rise;

        // Fade in, flicker, fade out
        const born = Math.min(1, p.life / 60);
        const dying = Math.max(0, 1 - p.life / p.maxLife);
        const alpha = born * dying * (0.42 + 0.38 * Math.sin(p.life * 0.05 * p.flicker));

        if (p.y < -12 || p.life > p.maxLife) {
          particles[i] = spawn();
          continue;
        }

        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3.2);
        glow.addColorStop(0, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${Math.max(0, alpha)})`);
        glow.addColorStop(1, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(255, 244, 214, ${Math.max(0, alpha * 0.9)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.85, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(tick);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };

    init();
    raf = requestAnimationFrame(tick);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
      aria-hidden="true"
    />
  );
}
