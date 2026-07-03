'use client';

import { useEffect, useRef, useState } from 'react';

type GlobeMode = 'connected' | 'arcs' | 'neural';

const MODES: { id: GlobeMode; label: string; hint: string }[] = [
  { id: 'connected', label: 'Connected Dot Globe', hint: 'Balanced premium look' },
  { id: 'arcs', label: 'Flight Arc Globe', hint: 'Global traffic storytelling' },
  { id: 'neural', label: 'Neural Mesh Globe', hint: 'Most futuristic / wow' },
];

export default function LandingGlobeLabPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<GlobeMode>('connected');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const drawCtx = ctx;

    let raf = 0;
    const dpr = window.devicePixelRatio || 1;

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      drawCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const points = Array.from({ length: 340 }, () => ({
      theta: Math.random() * Math.PI * 2,
      phi: Math.acos(2 * Math.random() - 1),
      jitter: Math.random() * Math.PI * 2,
    }));

    const routes = Array.from({ length: 14 }, () => ({
      a: points[Math.floor(Math.random() * points.length)],
      b: points[Math.floor(Math.random() * points.length)],
      speed: 0.001 + Math.random() * 0.002,
      t: Math.random(),
    }));

    const neuralSpikes = Array.from({ length: 12 }, () => ({
      from: Math.floor(Math.random() * points.length),
      to: Math.floor(Math.random() * points.length),
      life: Math.random(),
      speed: 0.009 + Math.random() * 0.013,
    }));

    function project(
      pt: { theta: number; phi: number; jitter: number },
      t: number,
      cx: number,
      cy: number,
      radius: number
    ) {
      const wobble = 1 + Math.sin(t + pt.jitter) * 0.04;
      const x0 = radius * wobble * Math.sin(pt.phi) * Math.cos(pt.theta);
      const y0 = radius * wobble * Math.cos(pt.phi);
      const z0 = radius * wobble * Math.sin(pt.phi) * Math.sin(pt.theta);

      const ry = t * 0.9;
      const rx = t * 0.45;
      const cosY = Math.cos(ry);
      const sinY = Math.sin(ry);
      const cosX = Math.cos(rx);
      const sinX = Math.sin(rx);

      const x1 = x0 * cosY + z0 * sinY;
      const z1 = -x0 * sinY + z0 * cosY;
      const y2 = y0 * cosX - z1 * sinX;
      const z2 = y0 * sinX + z1 * cosX;
      const depth = (z2 + radius) / (radius * 2);

      return {
        x: cx + x1,
        y: cy + y2,
        z: z2,
        depth,
        alpha: 0.14 + depth * 0.78,
      };
    }

    let time = 0;
    function draw() {
      if (!canvas) return;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * 0.36;

      time += 0.012;
      drawCtx.clearRect(0, 0, w, h);

      const projected = points.map((p) => project(p, time, cx, cy, radius));

      if (mode === 'connected' || mode === 'neural') {
        for (let i = 0; i < projected.length; i++) {
          for (let j = i + 1; j < projected.length; j++) {
            const a = projected[i];
            const b = projected[j];
            const dist = Math.hypot(a.x - b.x, a.y - b.y);
            const threshold = mode === 'neural' ? 42 : 30;
            if (dist > threshold) continue;
            const alpha = ((threshold - dist) / threshold) * Math.min(a.alpha, b.alpha) * (mode === 'neural' ? 0.45 : 0.35);
            if (alpha < 0.02) continue;
            drawCtx.strokeStyle = `rgba(10,10,10,${alpha.toFixed(3)})`;
            drawCtx.lineWidth = mode === 'neural' ? 0.9 : 0.8;
            drawCtx.beginPath();
            drawCtx.moveTo(a.x, a.y);
            drawCtx.lineTo(b.x, b.y);
            drawCtx.stroke();
          }
        }
      }

      if (mode === 'arcs') {
        routes.forEach((r) => {
          const a = project(r.a, time, cx, cy, radius);
          const b = project(r.b, time, cx, cy, radius);
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2 - radius * 0.2;

          drawCtx.strokeStyle = 'rgba(10,10,10,0.2)';
          drawCtx.lineWidth = 1;
          drawCtx.beginPath();
          drawCtx.moveTo(a.x, a.y);
          drawCtx.quadraticCurveTo(mx, my, b.x, b.y);
          drawCtx.stroke();

          r.t = (r.t + r.speed) % 1;
          const t = r.t;
          const qx = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * mx + t * t * b.x;
          const qy = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * my + t * t * b.y;
          drawCtx.fillStyle = 'rgba(10,10,10,0.9)';
          drawCtx.beginPath();
          drawCtx.arc(qx, qy, 2.2, 0, Math.PI * 2);
          drawCtx.fill();
        });
      }

      if (mode === 'neural') {
        neuralSpikes.forEach((s) => {
          s.life += s.speed;
          if (s.life > 1) {
            s.life = 0;
            s.from = Math.floor(Math.random() * points.length);
            s.to = Math.floor(Math.random() * points.length);
          }
          const a = projected[s.from];
          const b = projected[s.to];
          const x = a.x + (b.x - a.x) * s.life;
          const y = a.y + (b.y - a.y) * s.life;

          drawCtx.fillStyle = 'rgba(10,10,10,0.95)';
          drawCtx.beginPath();
          drawCtx.arc(x, y, 2.6, 0, Math.PI * 2);
          drawCtx.fill();
        });
      }

      projected
        .sort((a, b) => a.z - b.z)
        .forEach((p) => {
          const r = 0.7 + p.depth * 2.4;
          drawCtx.fillStyle = `rgba(10,10,10,${p.alpha.toFixed(3)})`;
          drawCtx.beginPath();
          drawCtx.arc(p.x, p.y, r, 0, Math.PI * 2);
          drawCtx.fill();
        });

      drawCtx.strokeStyle = 'rgba(10,10,10,0.1)';
      drawCtx.lineWidth = 1;
      drawCtx.beginPath();
      drawCtx.ellipse(cx, cy, radius * 1.03, radius * 0.34, time * 0.28, 0, Math.PI * 2);
      drawCtx.stroke();

      raf = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, [mode]);

  return (
    <div className="min-h-screen" style={{ background: '#F4F3EE', color: '#0A0A0A' }}>
      <div className="max-w-[1440px] mx-auto px-8 py-10">
        <h1 className="text-[26px] font-medium">Landing Globe Lab</h1>
        <p className="text-[13px] mt-2" style={{ color: '#6B6B66' }}>
          Temporary page to compare globe animation styles before finalizing landing.
        </p>

        <div className="flex flex-wrap gap-3 mt-6">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className="h-10 px-4 rounded-full text-[12px] border transition-all"
              style={{
                background: mode === m.id ? '#0A0A0A' : 'transparent',
                color: mode === m.id ? '#F4F3EE' : '#0A0A0A',
                borderColor: '#0A0A0A',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="mt-6 text-[12px]" style={{ color: '#6B6B66' }}>
          {MODES.find((m) => m.id === mode)?.hint}
        </div>

        <div
          className="mt-5 rounded-md"
          style={{
            border: '1px solid #E5E3DC',
            background: 'rgba(255,255,255,0.6)',
            padding: 24,
          }}
        >
          <div className="w-full max-w-[560px] mx-auto aspect-square">
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', mixBlendMode: 'multiply' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
