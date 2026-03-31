'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, FileText, Clock, Users, TrendingUp, Shield, Zap, Sun, Moon } from 'lucide-react';

// ── Typing text ───────────────────────────────────────────────────────────────
const HEADLINE_PART1 = "Stop chasing paperwork. ";
const HEADLINE_PART2 = "Start closing deals.";
const FULL_HEADLINE  = HEADLINE_PART1 + HEADLINE_PART2;

// ── Canvas field points ───────────────────────────────────────────────────────
const FIELD_POINTS = [
  { phase: 0.00, spd: 0.20, r: 700, color: [99,  102, 241] as const },
  { phase: 1.57, spd: 0.15, r: 800, color: [59,  130, 246] as const },
  { phase: 3.14, spd: 0.25, r: 650, color: [139, 92,  246] as const },
  { phase: 4.71, spd: 0.18, r: 750, color: [20,  184, 166] as const },
  { phase: 0.80, spd: 0.22, r: 620, color: [99,  102, 241] as const },
  { phase: 2.40, spd: 0.17, r: 680, color: [59,  130, 246] as const },
];

// ── Features ──────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: FileText,   title: 'AI Contract Parsing',    desc: 'Upload any contract PDF and Lex extracts all parties, deadlines, and key terms automatically.' },
  { icon: Clock,      title: 'Deadline Intelligence',  desc: 'Never miss a critical date. Automated alerts at 3 days and 1 day before every deadline.' },
  { icon: Users,      title: 'Client Portals',         desc: 'Send buyers, sellers, and lenders a secure magic-link portal to upload docs and track progress.' },
  { icon: TrendingUp, title: 'Deal Health Score',      desc: 'Real-time 0–100 score for every transaction, powered by Claude AI.' },
  { icon: Shield,     title: 'Compliance & FIRPTA',    desc: 'Built-in compliance checklists and automatic FIRPTA withholding calculations.' },
  { icon: Zap,        title: 'Automation Workflows',   desc: 'Status triggers, document collection, and multilingual broker emails — running 24/7.' },
];

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef  = useRef({ targetX: 0, targetY: 0 });
  const rafRef    = useRef<number>(0);

  const [theme, setTheme]         = useState<'dark' | 'light'>('dark');
  const [visible, setVisible]     = useState(false);
  const [typed, setTyped]         = useState(0);
  const [typingDone, setTypingDone] = useState(false);
  const [showCursor, setShowCursor] = useState(true);

  // ── Theme init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem('lex-theme') as 'dark' | 'light' | null;
    const initial = stored ?? 'dark';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
    setTimeout(() => setVisible(true), 80);
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('lex-theme', next);
  }

  // ── Typing animation ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    // Small delay before typing starts so page is settled
    const startDelay = setTimeout(() => {
      let i = 0;
      const typeInterval = setInterval(() => {
        i++;
        setTyped(i);
        if (i >= FULL_HEADLINE.length) {
          clearInterval(typeInterval);
          setTypingDone(true);
          // Blink cursor 3 times then hide
          let blinks = 0;
          const blinkInterval = setInterval(() => {
            setShowCursor(prev => !prev);
            blinks++;
            if (blinks >= 6) {
              clearInterval(blinkInterval);
              setShowCursor(false);
            }
          }, 250);
        }
      }, 45);
      return () => clearInterval(typeInterval);
    }, 400);
    return () => clearTimeout(startDelay);
  }, [visible]);

  // ── Canvas aura ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let W = window.innerWidth;
    let H = window.innerHeight;
    canvas.width  = W;
    canvas.height = H;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const mouse = mouseRef.current;
    let fcx = W * 0.5;
    let fcy = H * 0.4;
    mouse.targetX = W * 0.5;
    mouse.targetY = H * 0.4;

    const t0 = performance.now();

    const onMouseMove = (e: MouseEvent) => { mouse.targetX = e.clientX; mouse.targetY = e.clientY; };
    const onResize = () => {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W; canvas.height = H;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize',    onResize);

    function animate() {
      const t = (performance.now() - t0) * 0.001;
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';

      // Autonomous drift + cursor influence
      const driftX = W * 0.06 * Math.sin(t * 0.14 + 1.0);
      const driftY = H * 0.05 * Math.cos(t * 0.11 + 0.5);
      fcx += ((mouse.targetX + driftX) - fcx) * 0.007;
      fcy += ((mouse.targetY + driftY) - fcy) * 0.007;

      ctx!.clearRect(0, 0, W, H);

      FIELD_POINTS.forEach((pt) => {
        const spread = Math.min(W, H) * 0.30;
        const nx =
          Math.sin(t * 0.30 * pt.spd + pt.phase)              * spread
        + Math.cos(t * 0.17 * pt.spd + pt.phase * 1.618)      * spread * 0.42
        + Math.sin(t * 0.10 * pt.spd + pt.phase * 2.72 + 0.5) * spread * 0.18;
        const ny =
          Math.cos(t * 0.25 * pt.spd + pt.phase * 0.73)       * spread * 0.80
        + Math.sin(t * 0.19 * pt.spd + pt.phase * 2.14)       * spread * 0.35
        + Math.cos(t * 0.12 * pt.spd + pt.phase * 1.41 + 1.2) * spread * 0.15;

        const px = fcx + nx;
        const py = fcy + ny;
        const [r, g, b] = pt.color;

        if (isLight) {
          // Light mode: use normal blending with soft tinted gradients
          // Colors are more saturated/dark to show against white
          ctx!.globalCompositeOperation = 'source-over';
          const grad = ctx!.createRadialGradient(px, py, 0, px, py, pt.r);
          grad.addColorStop(0.00, `rgba(${r},${g},${b},0.07)`);
          grad.addColorStop(0.40, `rgba(${r},${g},${b},0.03)`);
          grad.addColorStop(1.00, `rgba(${r},${g},${b},0.00)`);
          ctx!.fillStyle = grad;
          ctx!.fillRect(0, 0, W, H);
        } else {
          // Dark mode: screen blending for additive glow
          ctx!.globalCompositeOperation = 'screen';
          const grad = ctx!.createRadialGradient(px, py, 0, px, py, pt.r);
          grad.addColorStop(0.00, `rgba(${r},${g},${b},0.15)`);
          grad.addColorStop(0.35, `rgba(${r},${g},${b},0.07)`);
          grad.addColorStop(0.70, `rgba(${r},${g},${b},0.02)`);
          grad.addColorStop(1.00, `rgba(${r},${g},${b},0.00)`);
          ctx!.fillStyle = grad;
          ctx!.fillRect(0, 0, W, H);
        }
      });

      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize',    onResize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived typed headline ───────────────────────────────────────────────────
  const visiblePart1  = FULL_HEADLINE.slice(0, Math.min(typed, HEADLINE_PART1.length));
  const visiblePart2  = typed > HEADLINE_PART1.length
    ? FULL_HEADLINE.slice(HEADLINE_PART1.length, typed)
    : '';
  const stillTyping   = typed < FULL_HEADLINE.length;

  // ── Theme-aware colors ────────────────────────────────────────────────────
  const isLight = theme === 'light';
  // Only non-CSS-var colors (backgrounds, borders, accents)
  const navBg          = isLight ? 'rgba(248,249,252,0.90)' : 'rgba(8,12,20,0.75)';
  const navBorder      = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.05)';
  const badgeText      = isLight ? '#1D4ED8' : '#60a5fa';
  const badgeBg        = isLight ? 'rgba(30,94,255,0.07)' : 'rgba(30,94,255,0.12)';
  const secondBtnBg    = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
  const secondBtnBorder= isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.10)';
  const dotColor       = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
  const sectionBorder  = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.05)';
  const cardBg         = isLight ? 'rgba(255,255,255,0.85)' : 'rgba(14,20,32,0.60)';
  const cardBorder     = isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)';
  const cardBgHover    = isLight ? 'rgba(255,255,255,1.0)' : 'rgba(14,20,32,0.80)';
  const cardBorderHover= isLight ? 'rgba(30,94,255,0.25)' : 'rgba(30,94,255,0.30)';
  // Gradient colors for headline text — dark enough for both modes
  const gradFrom       = isLight ? '#1D4ED8' : '#60a5fa';
  const gradMid        = isLight ? '#6366f1' : '#a78bfa';
  const gradTo         = isLight ? '#0369A1' : '#2FE6DE';

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      backgroundImage: `radial-gradient(${dotColor} 1px, transparent 1px)`,
      backgroundSize: '22px 22px',
      fontFamily: 'var(--font-sans)',
      color: 'var(--text-primary)',
      overflowX: 'hidden',
      transition: 'background 0.3s ease',
    }}>

      {/* Canvas aura */}
      <canvas ref={canvasRef} style={{
        position: 'fixed', left: 0, top: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ── Nav ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1.1rem 2.5rem',
        background: navBg,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${navBorder}`,
        transition: 'background 0.3s ease, border-color 0.3s ease',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'linear-gradient(160deg, #060C24 0%, #0D1B4B 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(59,130,246,0.3)',
            boxShadow: '0 0 14px rgba(30,94,255,0.3)',
          }}>
            <svg width="22" height="20" viewBox="0 0 34 30" fill="none">
              <defs>
                <linearGradient id="navlg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#BAE6FD" stopOpacity="0.95"/>
                  <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.85"/>
                </linearGradient>
              </defs>
              <rect x="0"  y="18" width="5"  height="11" rx="0.5" fill="url(#navlg)"/>
              <rect x="6"  y="10" width="6"  height="19" rx="0.5" fill="url(#navlg)"/>
              <rect x="13" y="2"  width="8"  height="27" rx="0.5" fill="url(#navlg)"/>
              <rect x="22" y="8"  width="6"  height="21" rx="0.5" fill="url(#navlg)"/>
              <rect x="29" y="16" width="5"  height="13" rx="0.5" fill="url(#navlg)"/>
            </svg>
          </div>
          <span style={{ fontSize: '1.1rem', fontWeight: 900, letterSpacing: '-0.05em', color: 'var(--text-primary)' }}>
            Lex
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'transparent', border: `1px solid ${navBorder}`,
              color: 'var(--text-secondary)', cursor: 'pointer',
              transition: 'border-color 150ms, color 150ms',
            }}
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>

          <Link href="/login" style={{
            fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)',
            textDecoration: 'none', padding: '0.45rem 1rem',
          }}>
            Sign in
          </Link>
          <Link href="/register" style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            fontSize: '0.8125rem', fontWeight: 700, color: '#fff',
            textDecoration: 'none', padding: '0.45rem 1.1rem',
            background: 'linear-gradient(135deg, #1E5EFF 0%, #0A3FCC 100%)',
            borderRadius: '9px',
            boxShadow: '0 0 16px rgba(30,94,255,0.35)',
            transition: 'box-shadow 150ms, transform 150ms',
          }}>
            Get started <ArrowRight style={{ width: '13px', height: '13px' }} />
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh',
        padding: '8rem 2rem 5rem',
        textAlign: 'center',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.8s ease, transform 0.8s ease',
      }}>

        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.35rem 0.9rem', borderRadius: '100px',
          background: badgeBg,
          border: '1px solid rgba(30,94,255,0.25)',
          marginBottom: '2rem',
          transition: 'background 0.3s ease',
        }}>
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: '#1E5EFF', boxShadow: '0 0 8px rgba(30,94,255,0.6)',
          }} />
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: badgeText, letterSpacing: '0.04em' }}>
            AI-POWERED REAL ESTATE PLATFORM
          </span>
        </div>

        {/* Typed headline */}
        <h1 style={{
          fontSize: 'clamp(2.6rem, 6vw, 5rem)',
          fontWeight: 900,
          letterSpacing: '-0.05em',
          lineHeight: 1.05,
          color: 'var(--text-primary)',
          maxWidth: '860px',
          marginBottom: '1.5rem',
          minHeight: '1.05em',
        }}>
          {visiblePart1}
          {visiblePart2 && (
            <span style={{
              background: `linear-gradient(135deg, ${gradFrom} 0%, ${gradMid} 50%, ${gradTo} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              {visiblePart2}
            </span>
          )}
          {/* Blinking cursor during + right after typing */}
          {(stillTyping || (!typingDone && showCursor) || (typingDone && showCursor)) && (
            <span style={{
              display: 'inline-block',
              width: '3px', height: '0.85em',
              background: '#1E5EFF',
              borderRadius: '2px',
              marginLeft: '4px',
              verticalAlign: 'middle',
              opacity: showCursor ? 1 : 0,
              transition: 'opacity 80ms',
            }} />
          )}
        </h1>

        {/* Subheading — fades in after typing starts */}
        <p style={{
          fontSize: 'clamp(1rem, 2vw, 1.2rem)',
          color: 'var(--text-secondary)',
          maxWidth: '560px',
          lineHeight: 1.65,
          marginBottom: '2.75rem',
          opacity: typed > 10 ? 1 : 0,
          transform: typed > 10 ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}>
          Lex manages every transaction from contract to closing — deadlines, documents, commissions, and client communication — powered by Claude AI.
        </p>

        {/* CTAs */}
        <div style={{
          display: 'flex', gap: '0.875rem', flexWrap: 'wrap', justifyContent: 'center',
          opacity: typed > 20 ? 1 : 0,
          transform: typed > 20 ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.6s ease 0.1s, transform 0.6s ease 0.1s',
        }}>
          <Link href="/register" style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.85rem 1.75rem',
            background: 'linear-gradient(135deg, #1E5EFF 0%, #0A3FCC 100%)',
            color: '#fff', fontWeight: 700, fontSize: '0.9375rem',
            letterSpacing: '-0.01em',
            borderRadius: '12px', textDecoration: 'none',
            boxShadow: '0 0 28px rgba(30,94,255,0.45)',
            transition: 'transform 150ms, box-shadow 150ms',
          }}>
            Start free <ArrowRight style={{ width: '16px', height: '16px' }} />
          </Link>
          <Link href="/login" style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.85rem 1.75rem',
            background: secondBtnBg,
            border: `1px solid ${secondBtnBorder}`,
            color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9375rem',
            borderRadius: '12px', textDecoration: 'none',
            backdropFilter: 'blur(8px)',
            transition: 'background 150ms, border-color 150ms',
          }}>
            Sign in
          </Link>
        </div>

        <p style={{
          marginTop: '2.5rem',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          letterSpacing: '0.02em',
          opacity: typingDone ? 1 : 0,
          transition: 'opacity 0.5s ease',
        }}>
          Built for Miami brokers. Works for anyone.
        </p>
      </section>

      {/* ── Features ── */}
      <section style={{
        position: 'relative', zIndex: 10,
        maxWidth: '1080px', margin: '0 auto',
        padding: '0 2rem 8rem',
        opacity: visible ? 1 : 0,
        transition: 'opacity 1s ease 0.3s',
      }}>
        <h2 style={{
          fontSize: 'clamp(1.6rem, 3vw, 2.4rem)',
          fontWeight: 800, letterSpacing: '-0.04em',
          color: 'var(--text-primary)', textAlign: 'center',
          marginBottom: '0.75rem',
        }}>
          Everything in one place
        </h2>
        <p style={{
          textAlign: 'center', color: 'var(--text-secondary)',
          fontSize: '0.9375rem',
          maxWidth: '460px', margin: '0 auto 3.5rem',
        }}>
          Every tool a transaction coordinator needs — no spreadsheets, no missed deadlines.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1.25rem',
        }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              borderRadius: '16px',
              padding: '1.5rem',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: isLight ? '0 2px 12px rgba(0,0,0,0.06)' : 'none',
              transition: 'border-color 200ms, background 200ms, box-shadow 200ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = cardBorderHover;
              e.currentTarget.style.background  = cardBgHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = cardBorder;
              e.currentTarget.style.background  = cardBg;
            }}
            >
              <div style={{
                width: '38px', height: '38px', borderRadius: '10px',
                background: isLight ? 'rgba(30,94,255,0.08)' : 'rgba(30,94,255,0.12)',
                border: `1px solid ${isLight ? 'rgba(30,94,255,0.15)' : 'rgba(30,94,255,0.20)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '1rem',
              }}>
                <f.icon style={{ width: '17px', height: '17px', color: isLight ? '#1E5EFF' : '#60a5fa' }} />
              </div>
              <h3 style={{
                fontSize: '0.9375rem', fontWeight: 700, letterSpacing: '-0.02em',
                color: 'var(--text-primary)', marginBottom: '0.4rem',
              }}>
                {f.title}
              </h3>
              <p style={{
                fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6,
              }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section style={{
        position: 'relative', zIndex: 10,
        textAlign: 'center', padding: '4rem 2rem 6rem',
        borderTop: `1px solid ${sectionBorder}`,
        opacity: visible ? 1 : 0,
        transition: 'opacity 1s ease 0.5s, border-color 0.3s ease',
      }}>
        <h2 style={{
          fontSize: 'clamp(1.8rem, 4vw, 3rem)',
          fontWeight: 900, letterSpacing: '-0.04em',
          color: 'var(--text-primary)', marginBottom: '1rem',
        }}>
          Ready to close more deals?
        </h2>
        <p style={{
          color: 'var(--text-secondary)', fontSize: '1rem',
          marginBottom: '2rem',
        }}>
          Get started in minutes. No setup required.
        </p>
        <Link href="/register" style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.9rem 2rem',
          background: 'linear-gradient(135deg, #1E5EFF 0%, #0A3FCC 100%)',
          color: '#fff', fontWeight: 700, fontSize: '0.9375rem',
          borderRadius: '12px', textDecoration: 'none',
          boxShadow: '0 0 32px rgba(30,94,255,0.4)',
        }}>
          Create free account <ArrowRight style={{ width: '16px', height: '16px' }} />
        </Link>
      </section>

    </div>
  );
}
