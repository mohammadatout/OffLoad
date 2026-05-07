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

    const chars = '·•∙+−|/\\TJ▪▫'.split('');
    const N = 1400;
    const points = Array.from({ length: N }, () => {
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      return {
        t,
        p,
        char: chars[Math.floor(Math.random() * chars.length)],
        size: 6 + Math.random() * 4,
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
      const R = Math.min(w, h) * 0.42;
      angle += 0.0012;

      points.forEach((pt) => {
        const x = R * Math.sin(pt.p) * Math.cos(pt.t + angle);
        const y = R * Math.sin(pt.p) * Math.sin(pt.t + angle * 0.6);
        const z = R * Math.cos(pt.p);
        const scale = (z + R * 1.2) / (R * 2.2);
        ctx!.fillStyle = `rgba(10,10,10,${0.25 + scale * 0.55})`;
        ctx!.font = `${pt.size * scale}px ui-monospace, "JetBrains Mono", monospace`;
        ctx!.fillText(pt.char, cx + x, cy + y);
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
    <div className="min-h-screen relative" style={{ background: '#F4F3EE', color: '#0A0A0A', fontFamily: "'Inter', system-ui, sans-serif" }}>
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
          <Link href="/workspace" style={{ fontSize: 13, color: '#0A0A0A', textDecoration: 'none', transition: 'color 0.3s' }}>
            Sign in
          </Link>
          <Link href="/workspace"
            style={{
              background: '#0A0A0A', color: '#fff', fontSize: 13, fontWeight: 500,
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
              <span style={{ width: 32, height: 1, background: '#0A0A0A' }} />
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
                    stroke="#0A0A0A"
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
                  background: '#0A0A0A', color: '#fff', padding: '0 16px 0 20px',
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
                  background: 'transparent', color: '#0A0A0A',
                  border: '1px solid #0A0A0A', padding: '0 20px',
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
