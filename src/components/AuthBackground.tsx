'use client';

import { useEffect, useRef } from 'react';

interface Particle { x: number; y: number; vx: number; vy: number; }

const NODE_COLOR = '124,58,237'; // purple-600 — matches the brand blobs
const LINK_DIST = 130;

/**
 * Shared signin/signup backdrop: the brand color blobs plus a quiet canvas
 * particle network (nodes drift, nearby ones link) — evokes "finding
 * connections" without competing with the form in front of it.
 */
export default function AuthBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let raf = 0;

    function resize() {
      const parent = canvas!.parentElement;
      width = parent?.clientWidth ?? window.innerWidth;
      height = parent?.clientHeight ?? window.innerHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.max(18, Math.min(50, Math.round((width * height) / 22000)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
      }));
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = width; else if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height; else if (p.y > height) p.y = 0;
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < LINK_DIST) {
            ctx!.strokeStyle = `rgba(${NODE_COLOR},${0.12 * (1 - dist / LINK_DIST)})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
      }

      for (const p of particles) {
        ctx!.fillStyle = `rgba(${NODE_COLOR},0.5)`;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function step() {
      draw();
      raf = requestAnimationFrame(step);
    }

    resize();
    window.addEventListener('resize', resize);

    if (reduceMotion) draw();
    else raf = requestAnimationFrame(step);

    return () => {
      window.removeEventListener('resize', resize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="animate-blob-drift absolute -top-40 -left-20 w-[28rem] h-[28rem] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.35), transparent 65%)' }}
      />
      <div
        className="animate-blob-drift absolute -bottom-40 -right-20 w-[30rem] h-[30rem] rounded-full blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(249,115,22,0.25), transparent 65%)',
          animationDelay: '-4s',
          animationDirection: 'alternate-reverse',
        }}
      />
      <div
        className="animate-blob-drift absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[20rem] h-[20rem] rounded-full blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(124,58,237,0.12), transparent 65%)',
          animationDelay: '-2s',
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
