'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    const POINT_COUNT = 420;
    const points = Array.from({ length: POINT_COUNT }, () => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      return {
        theta,
        phi,
        phase: Math.random() * Math.PI * 2,
      };
    });

    let angle = 0;
    let raf: number;

    function render() {
      if (!canvas || !ctx) return;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * 0.4;
      angle += 0.0038;

      const projected = points.map((pt) => {
        const wave = 1 + Math.sin(angle + pt.phase) * 0.04;
        const x0 = radius * wave * Math.sin(pt.phi) * Math.cos(pt.theta);
        const y0 = radius * wave * Math.cos(pt.phi);
        const z0 = radius * wave * Math.sin(pt.phi) * Math.sin(pt.theta);

        const ry = angle;
        const rx = angle * 0.45;
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
          alpha: 0.15 + depth * 0.75,
        };
      });

      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const a = projected[i];
          const b = projected[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 42) continue;
          const lineAlpha = ((42 - dist) / 42) * Math.min(a.alpha, b.alpha) * 0.48;
          if (lineAlpha < 0.03) continue;
          ctx.strokeStyle = `rgba(10,10,10,${lineAlpha.toFixed(3)})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      projected
        .sort((a, b) => a.z - b.z)
        .forEach((pt) => {
          const dotRadius = 0.7 + pt.depth * 2.3;
          ctx.fillStyle = `rgba(10,10,10,${pt.alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        });

      raf = requestAnimationFrame(render);
    }
    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  const fadeUp = (delay: number) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(20px)',
    transition: `opacity 0.8s ease-out ${delay}s, transform 0.8s ease-out ${delay}s`,
  });

  const fadeDown = (delay: number) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(-12px)',
    transition: `opacity 0.7s ease-out ${delay}s, transform 0.7s ease-out ${delay}s`,
  });

  return (
    <div className="min-h-screen relative" style={{ background: '#F4F3EE', color: '#080D44', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Background grid */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'linear-gradient(rgba(10,10,10,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(10,10,10,0.04) 1px, transparent 1px)',
        backgroundSize: '80px 80px',
      }} />

      {/* Top Nav */}
      <header className="relative z-10 max-w-[1440px] mx-auto px-8 flex items-center justify-between"
              style={{ height: 72, ...fadeDown(0.1) }}>
        <div className="flex items-baseline gap-1">
          <span style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-0.02em' }}>EntityMatch</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#6B6B66', textTransform: 'uppercase' }}>PRO</span>
        </div>
        <nav className="hidden md:flex items-center gap-8">
          {['Product', 'How it works', 'Engine', 'Docs'].map((label) => (
            <span key={label} style={{ fontSize: 13, cursor: 'pointer', transition: 'color 0.3s' }}
                  className="hover:text-[#6B6B66]">
              {label}
            </span>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/workspace" style={{ fontSize: 13, color: '#080D44', textDecoration: 'none', transition: 'color 0.3s' }}>
            Sign in
          </Link>
          <Link href="/workspace"
            style={{
              background: '#080D44', color: '#fff', fontSize: 13, fontWeight: 500,
              padding: '0 16px', height: 36, borderRadius: 9999, display: 'inline-flex',
              alignItems: 'center', textDecoration: 'none', transition: 'background 0.3s',
            }}>
            Start matching
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 max-w-[1440px] mx-auto px-8" style={{ paddingTop: 80, paddingBottom: 128 }}>
        <div className="grid items-center" style={{ gridTemplateColumns: '1.2fr 1fr', gap: 48 }}>
          {/* Left: Text */}
          <div>
            {/* Eyebrow */}
            <div className="flex items-center gap-3" style={{ marginBottom: 32, ...fadeUp(0.25) }}>
              <span style={{ width: 32, height: 1, background: '#080D44' }} />
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6B6B66',
              }}>
                The studio for clean data
              </span>
            </div>

            {/* Headline */}
            <h1 style={{
              fontWeight: 500, fontSize: 'clamp(3.5rem, 9vw, 8rem)',
              lineHeight: 0.95, letterSpacing: '-0.04em', marginBottom: 32,
              ...fadeUp(0.4),
            }}>
              From mess<br />
              to{' '}
              <span style={{ position: 'relative', display: 'inline-block' }}>
                match.
                <svg
                  viewBox="0 0 200 12"
                  preserveAspectRatio="none"
                  style={{ position: 'absolute', left: 0, right: 0, bottom: -4, width: '100%', height: '0.15em' }}
                >
                  <path
                    d="M2 8 Q50 2 100 6 T198 5"
                    stroke="#080D44"
                    strokeWidth="3"
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray="250"
                    strokeDashoffset={mounted ? '0' : '250'}
                    style={{ transition: 'stroke-dashoffset 1s ease-out 1.2s' }}
                  />
                </svg>
              </span>
            </h1>

            {/* Subhead */}
            <p style={{
              fontSize: 16, color: '#3A3A36', lineHeight: 1.6,
              maxWidth: 440, marginBottom: 40, ...fadeUp(0.55),
            }}>
              Stop wrestling with messy entity data. Normalize, deduplicate,
              and match company records across systems — in seconds, not sprints.
            </p>

            {/* CTA Group */}
            <div className="flex items-center gap-3 flex-wrap" style={fadeUp(0.7)}>
              <Link href="/workspace"
                style={{
                  fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 500,
                  border: 'none', cursor: 'pointer', borderRadius: 9999, height: 48,
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: '#080D44', color: '#fff', padding: '0 16px 0 20px',
                  textDecoration: 'none', transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
                }}>
                Start Mapping
                <span style={{
                  width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: '#fff', strokeWidth: 2, fill: 'none' }}>
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </Link>
              <Link href="/workspace"
                style={{
                  fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 500,
                  cursor: 'pointer', borderRadius: 9999, height: 48,
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: 'transparent', color: '#080D44',
                  border: '1px solid #080D44', padding: '0 20px',
                  textDecoration: 'none', transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
                }}>
                Login
              </Link>
            </div>
          </div>

          {/* Right: Particle Canvas */}
          <div className="hidden lg:block" style={{ position: 'relative', aspectRatio: '1' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', mixBlendMode: 'multiply' }} />
          </div>
        </div>

        {/* Stat Row */}
        <div className="grid gap-8" style={{
          marginTop: 128, gridTemplateColumns: 'repeat(4, 1fr)',
          borderTop: '1px solid rgba(10,10,10,0.12)', paddingTop: 32,
          ...fadeUp(0.9),
        }}>
          {[
            { val: '1,228', label: 'rows in <1s', brand: 'CISCO SALES' },
            { val: '99%', label: 'accuracy', brand: 'BENCHMARK' },
            { val: '40%', label: 'avg dedup', brand: 'AMERICAS' },
            { val: '6', label: 'data sources', brand: 'PIPELINE' },
          ].map((s) => (
            <div key={s.brand}>
              <div style={{ fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 8, fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
                {s.val}
              </div>
              <div style={{ fontSize: 12, color: '#6B6B66', lineHeight: 1.3 }}>{s.label}</div>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6B6B66', marginTop: 4,
              }}>{s.brand}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
