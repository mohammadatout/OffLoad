import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Play } from 'lucide-react';

// =============================================================
// EntityMatch Pro — Landing Page
// Aesthetic: Optimus-style editorial minimalism, cream + black
// "WOW in 5 seconds" — single hero, generative visual, then enter tool
// =============================================================

export default function EntityMatchLanding() {
  return (
    <div
      className="min-h-screen bg-[#F4F3EE] text-[#0A0A0A] relative overflow-hidden"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* Faint background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(10,10,10,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(10,10,10,0.04) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />

      {/* Top nav */}
      <header className="relative z-10 max-w-[1440px] mx-auto px-8 py-6 flex items-center justify-between">
        <div className="flex items-baseline gap-1">
          <span className="text-[20px] font-medium tracking-tight">EntityMatch</span>
          <span className="text-[10px] font-mono text-[#6B6B66]">PRO</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-[13px] text-[#0A0A0A]">
          {['Product', 'How it works', 'Engine', 'Docs'].map((l) => (
            <a key={l} href="#" className="hover:text-[#6B6B66] transition-colors">
              {l}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <a href="#" className="text-[13px] hover:text-[#6B6B66]">
            Sign in
          </a>
          <button className="bg-[#0A0A0A] text-white text-[13px] px-4 h-9 rounded-full hover:bg-[#1F1F1F] transition-colors">
            Start matching
          </button>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 max-w-[1440px] mx-auto px-8 pt-20 pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
          {/* Left: text */}
          <div>
            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-8">
              <span className="w-8 h-px bg-[#0A0A0A]" />
              <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-[#6B6B66]">
                The studio for clean data
              </span>
            </div>

            {/* Headline */}
            <h1
              className="font-medium tracking-[-0.04em] leading-[0.95] mb-8"
              style={{ fontSize: 'clamp(3.5rem, 9vw, 8rem)' }}
            >
              From mess
              <br />
              to <UnderlineWord>match.</UnderlineWord>
            </h1>

            {/* Subhead */}
            <p className="text-[16px] text-[#3A3A36] leading-[1.6] max-w-md mb-10">
              Stop wrestling with messy entity data. Normalize, deduplicate,
              and match company records across systems — in seconds, not
              sprints.
            </p>

            {/* CTAs */}
            <div className="flex items-center gap-3">
              <button className="group bg-[#0A0A0A] text-white text-[14px] font-medium pl-5 pr-4 h-12 rounded-full flex items-center gap-2 hover:bg-[#1F1F1F] transition-colors">
                Start matching
                <span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </button>
              <button className="bg-transparent border border-[#0A0A0A] text-[14px] font-medium px-5 h-12 rounded-full flex items-center gap-2 hover:bg-[#0A0A0A]/5 transition-colors">
                <Play className="w-3.5 h-3.5 fill-current" />
                Watch demo
              </button>
            </div>
          </div>

          {/* Right: generative visual */}
          <div className="relative aspect-square hidden lg:block">
            <ParticleSwirl />
          </div>
        </div>

        {/* Stat row */}
        <div className="mt-32 grid grid-cols-2 md:grid-cols-4 gap-8 border-t border-[#0A0A0A]/15 pt-8">
          {[
            { val: '1,228', label: 'rows in <1s', brand: 'CISCO SALES' },
            { val: '99%', label: 'accuracy', brand: 'BENCHMARK' },
            { val: '40%', label: 'avg dedup', brand: 'AMERICAS' },
            { val: '6', label: 'data sources', brand: 'PIPELINE' },
          ].map((s) => (
            <div key={s.label}>
              <div
                className="font-medium tracking-tight leading-none mb-2"
                style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
              >
                {s.val}
              </div>
              <div className="text-[12px] text-[#6B6B66] leading-tight">
                {s.label}
              </div>
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#6B6B66] mt-1">
                {s.brand}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

// =============================================================
// Hand-drawn underline that draws in on mount
// =============================================================
function UnderlineWord({ children }) {
  return (
    <span className="relative inline-block">
      {children}
      <svg
        className="absolute left-0 right-0 -bottom-2 w-full"
        viewBox="0 0 200 12"
        preserveAspectRatio="none"
        style={{ height: '0.15em' }}
      >
        <path
          d="M2 8 Q50 2 100 6 T198 5"
          stroke="#0A0A0A"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          style={{
            strokeDasharray: 250,
            strokeDashoffset: 250,
            animation: 'draw 1s ease-out 0.4s forwards',
          }}
        />
      </svg>
      <style>{`
        @keyframes draw { to { stroke-dashoffset: 0; } }
      `}</style>
    </span>
  );
}

// =============================================================
// Particle visual — characters arranged in a slowly-rotating sphere
// On-theme: characters are name fragments converging
// =============================================================
function ParticleSwirl() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();

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
    let raf;

    const render = () => {
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
        ctx.fillStyle = `rgba(10,10,10,${0.25 + scale * 0.55})`;
        ctx.font = `${pt.size * scale}px ui-monospace, monospace`;
        ctx.fillText(pt.char, cx + x, cy + y);
      });

      raf = requestAnimationFrame(render);
    };

    render();
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ mixBlendMode: 'multiply' }}
    />
  );
}
