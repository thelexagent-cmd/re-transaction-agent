'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login } from '@/lib/api';
import { setToken, isAuthenticated } from '@/lib/auth';
import { Loader2, Sun, Moon, ArrowRight, Eye, EyeOff } from 'lucide-react';

const TYPING_TEXT = "Stop chasing paperwork. Start closing deals.";

// ── Logo — city skyline ────────────────────────────────────────────────────────
function LexLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{
        width: '46px', height: '46px',
        borderRadius: '12px',
        background: 'linear-gradient(160deg, #060C24 0%, #0D1B4B 50%, #0A1A44 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 2px 20px rgba(30,94,255,0.40), inset 0 1px 0 rgba(100,180,255,0.10)',
        border: '1px solid rgba(59,130,246,0.25)',
      }}>
        <svg width="34" height="30" viewBox="0 0 34 30" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="bg1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#67E8F9" stopOpacity="0.95"/>
              <stop offset="45%" stopColor="#38BDF8" stopOpacity="0.90"/>
              <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.85"/>
            </linearGradient>
            <linearGradient id="bg2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.88"/>
              <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.80"/>
              <stop offset="100%" stopColor="#1E40AF" stopOpacity="0.75"/>
            </linearGradient>
            <linearGradient id="bg3" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#BAE6FD" stopOpacity="0.95"/>
              <stop offset="40%" stopColor="#60A5FA" stopOpacity="0.90"/>
              <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.80"/>
            </linearGradient>
            <linearGradient id="bg4" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7DD3FC" stopOpacity="0.85"/>
              <stop offset="55%" stopColor="#2563EB" stopOpacity="0.78"/>
              <stop offset="100%" stopColor="#1E3A8A" stopOpacity="0.72"/>
            </linearGradient>
            <linearGradient id="bg5" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A5F3FC" stopOpacity="0.80"/>
              <stop offset="50%" stopColor="#38BDF8" stopOpacity="0.72"/>
              <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.65"/>
            </linearGradient>
          </defs>
          <ellipse cx="17" cy="29.5" rx="15" ry="1.2" fill="rgba(30,94,255,0.22)"/>
          <rect x="0"  y="18" width="5"  height="11" rx="0.5" fill="url(#bg1)"/>
          <rect x="1.5" y="19.5" width="1.5" height="2" rx="0.25" fill="rgba(255,255,255,0.50)"/>
          <rect x="6"  y="10" width="6"  height="19" rx="0.5" fill="url(#bg2)"/>
          <rect x="7.2" y="12" width="1.5" height="2"   rx="0.25" fill="rgba(255,255,255,0.45)"/>
          <rect x="9.2" y="12" width="1.5" height="2"   rx="0.25" fill="rgba(255,255,255,0.35)"/>
          <rect x="7.2" y="16" width="1.5" height="1.5" rx="0.25" fill="rgba(255,255,255,0.30)"/>
          <rect x="13" y="2"  width="8"  height="27" rx="0.5" fill="url(#bg3)"/>
          <rect x="14" y="3"  width="1.8" height="26" rx="0.5" fill="rgba(255,255,255,0.12)"/>
          <rect x="16.5" y="5"  width="1.8" height="2.5" rx="0.25" fill="rgba(255,255,255,0.50)"/>
          <rect x="16.5" y="9"  width="1.8" height="2.5" rx="0.25" fill="rgba(255,255,255,0.40)"/>
          <rect x="16.5" y="13" width="1.8" height="2.5" rx="0.25" fill="rgba(255,255,255,0.35)"/>
          <rect x="16.5" y="17" width="1.8" height="2.5" rx="0.25" fill="rgba(255,255,255,0.28)"/>
          <rect x="22" y="8"  width="6"  height="21" rx="0.5" fill="url(#bg4)"/>
          <rect x="23.2" y="10" width="1.5" height="2" rx="0.25" fill="rgba(255,255,255,0.42)"/>
          <rect x="25.2" y="10" width="1.5" height="2" rx="0.25" fill="rgba(255,255,255,0.32)"/>
          <rect x="23.2" y="14" width="1.5" height="2" rx="0.25" fill="rgba(255,255,255,0.28)"/>
          <rect x="29" y="16" width="5"  height="13" rx="0.5" fill="url(#bg5)"/>
          <rect x="30.2" y="17.5" width="1.5" height="2" rx="0.25" fill="rgba(255,255,255,0.38)"/>
        </svg>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={{
          fontSize: '1.4rem', fontWeight: 900,
          color: 'var(--text-primary)',
          letterSpacing: '-0.055em',
          lineHeight: 1,
          fontFamily: 'var(--font-sans)',
          transition: 'color 0.3s ease',
        }}>
          Lex
        </span>
        <span style={{
          fontSize: '0.5rem', fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          lineHeight: 1,
          transition: 'color 0.3s ease',
        }}>
          Transaction AI
        </span>
      </div>
    </div>
  );
}

// ── Theme toggle ──────────────────────────────────────────────────────────────
function ThemeToggle({ theme, onToggle }: { theme: 'dark' | 'light'; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label="Toggle theme"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '34px', height: '34px', borderRadius: '10px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'border-color 150ms, color 150ms, background 0.3s ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(30,94,255,0.4)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
    >
      {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
    </button>
  );
}

// ── Canvas field control points ───────────────────────────────────────────────
// Each point contributes one large soft radial gradient.
// They all orbit a shared field center (fcx/fcy) that slowly follows the cursor.
const FIELD_POINTS = [
  { phase: 0.00, spd: 0.28, r: 600, color: [99,  102, 241] as const },
  { phase: 1.26, spd: 0.22, r: 680, color: [59,  130, 246] as const },
  { phase: 2.51, spd: 0.34, r: 560, color: [139, 92,  246] as const },
  { phase: 3.77, spd: 0.19, r: 640, color: [20,  184, 166] as const },
  { phase: 5.03, spd: 0.31, r: 510, color: [99,  102, 241] as const },
  { phase: 0.63, spd: 0.25, r: 580, color: [59,  130, 246] as const },
  { phase: 1.88, spd: 0.38, r: 520, color: [139, 92,  246] as const },
  { phase: 4.40, spd: 0.21, r: 620, color: [20,  184, 166] as const },
];

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [theme, setTheme]           = useState<'dark' | 'light'>('dark');

  // Intro stage machine
  const [stage, setStage]             = useState<'typing' | 'fading' | 'ready'>('typing');
  const [displayText, setDisplayText] = useState('');
  const [showCursor, setShowCursor]   = useState(true);

  // Refs
  const mouseRef  = useRef({ targetX: 0, targetY: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const rafRef    = useRef<number>(0);
  const blinkRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isAuthenticated()) router.replace('/transactions');
  }, [router]);

  // ── Theme init ────────────────────────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem('lex-theme') as 'dark' | 'light' | null;
    const initial = stored ?? 'dark';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('lex-theme', next);
  }

  // ── Typing intro ──────────────────────────────────────────────────────────
  useEffect(() => {
    let i = 0;
    const typeInterval = setInterval(() => {
      i++;
      setDisplayText(TYPING_TEXT.slice(0, i));
      if (i >= TYPING_TEXT.length) {
        clearInterval(typeInterval);
        let blinks = 0;
        blinkRef.current = setInterval(() => {
          setShowCursor(prev => !prev);
          blinks++;
          if (blinks >= 4) {
            clearInterval(blinkRef.current!);
            blinkRef.current = null;
            setShowCursor(false);
            setStage('fading');
            fadeTimerRef.current = setTimeout(() => setStage('ready'), 800);
          }
        }, 220);
      }
    }, 40);
    return () => {
      clearInterval(typeInterval);
      if (blinkRef.current)     clearInterval(blinkRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  // ── Canvas fluid energy field ─────────────────────────────────────────────
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

    // Field center starts at screen center, then drifts toward cursor
    let fcx = W * 0.5;
    let fcy = H * 0.5;

    mouse.targetX = W * 0.5;
    mouse.targetY = H * 0.5;

    const t0 = performance.now();

    const onMouseMove = (e: MouseEvent) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${e.clientX - 5}px, ${e.clientY - 5}px)`;
      }
    };

    const onResize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width  = W;
      canvas.height = H;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize',    onResize);

    function animate() {
      const t = (performance.now() - t0) * 0.001;

      // Check light mode — dim canvas significantly in light mode
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      const alphaScale = isLight ? 0.20 : 1.0;

      // Autonomous drift: even when cursor is still, the effective target slowly wanders
      // in a slow figure-8 so the aura never fully stops moving
      const driftX = W * 0.055 * Math.sin(t * 0.17 + 1.0);
      const driftY = H * 0.045 * Math.cos(t * 0.13 + 0.5);

      // Low lerp rate (0.008) = very slow, smooth drift — not reactive
      fcx += ((mouse.targetX + driftX) - fcx) * 0.008;
      fcy += ((mouse.targetY + driftY) - fcy) * 0.008;

      ctx!.clearRect(0, 0, W, H);
      ctx!.globalCompositeOperation = 'screen';

      FIELD_POINTS.forEach((pt) => {
        const spread = Math.min(W, H) * 0.30;

        const nx =
          Math.sin(t * 0.33 * pt.spd + pt.phase)              * spread
        + Math.cos(t * 0.19 * pt.spd + pt.phase * 1.618)      * spread * 0.45
        + Math.sin(t * 0.11 * pt.spd + pt.phase * 2.72 + 0.5) * spread * 0.22;

        const ny =
          Math.cos(t * 0.28 * pt.spd + pt.phase * 0.73)       * spread * 0.85
        + Math.sin(t * 0.21 * pt.spd + pt.phase * 2.14)       * spread * 0.38
        + Math.cos(t * 0.13 * pt.spd + pt.phase * 1.41 + 1.2) * spread * 0.18;

        const px = fcx + nx;
        const py = fcy + ny;

        const [r, g, b] = pt.color;
        const a1 = 0.16 * alphaScale;
        const a2 = 0.08 * alphaScale;
        const a3 = 0.025 * alphaScale;

        const grad = ctx!.createRadialGradient(px, py, 0, px, py, pt.r);
        grad.addColorStop(0.00, `rgba(${r},${g},${b},${a1})`);
        grad.addColorStop(0.35, `rgba(${r},${g},${b},${a2})`);
        grad.addColorStop(0.70, `rgba(${r},${g},${b},${a3})`);
        grad.addColorStop(1.00, `rgba(${r},${g},${b},0.00)`);

        ctx!.fillStyle = grad;
        ctx!.fillRect(0, 0, W, H);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      setToken(data.access_token);
      router.replace('/transactions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'relative', minHeight: '100vh',
      background: 'var(--bg)',
      // Slightly more visible dot grid for texture
      backgroundImage: 'radial-gradient(var(--dot-color, rgba(255,255,255,0.07)) 1px, transparent 1px)',
      backgroundSize: '22px 22px',
      fontFamily: 'var(--font-sans)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', cursor: 'none',
      transition: 'background 0.3s ease',
    }}>

      {/* ── CSS var for dot color based on theme ── */}
      <style>{`
        [data-theme="light"] { --dot-color: rgba(0,0,0,0.07); }
        [data-theme="dark"]  { --dot-color: rgba(255,255,255,0.07); }
      `}</style>

      {/* ── Subtle grain overlay for texture depth ── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
        opacity: theme === 'dark' ? 0.035 : 0.025,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: '180px 180px',
      }} />

      {/* ── Custom cursor dot ── */}
      <div ref={cursorRef} style={{
        position: 'fixed', left: 0, top: 0,
        width: '10px', height: '10px', borderRadius: '50%',
        background: 'rgba(30,94,255,0.45)',
        boxShadow: '0 0 8px rgba(30,94,255,0.25)',
        pointerEvents: 'none', zIndex: 9999,
        willChange: 'transform',
      }} />

      {/* ── Canvas fluid energy field ── */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed', left: 0, top: 0,
          width: '100%', height: '100%',
          pointerEvents: 'none', zIndex: 0,
        }}
      />

      {/* ── Theme toggle ── */}
      <div style={{ position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 100 }}>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>

      {/* ── INTRO OVERLAY — big typing text that scales down as it fades ── */}
      {stage !== 'ready' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '2rem', pointerEvents: 'none',
          opacity: stage === 'fading' ? 0 : 1,
          // Scale down + drift up as it fades — "big then it goes"
          transform: stage === 'fading' ? 'scale(0.82) translateY(-40px)' : 'scale(1) translateY(0)',
          transition: 'opacity 0.75s ease, transform 0.80s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          {/* Glow halo behind text */}
          <div style={{
            position: 'absolute',
            width: '640px', height: '200px',
            background: 'radial-gradient(ellipse, rgba(30,94,255,0.10) 0%, transparent 70%)',
            filter: 'blur(50px)', pointerEvents: 'none',
          }} />
          {/* Large headline that types out */}
          <p style={{
            position: 'relative',
            fontSize: 'clamp(2.4rem, 5.5vw, 4.2rem)',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.04em',
            lineHeight: 1.15,
            textAlign: 'center',
            maxWidth: '820px',
            transition: 'color 0.3s ease',
          }}>
            {displayText}
            {showCursor && (
              <span style={{ color: '#1E5EFF', marginLeft: '3px', fontWeight: 300 }}>|</span>
            )}
          </p>
        </div>
      )}

      {/* ── MAIN CONTENT — slides up as intro exits ── */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', width: '100%',
        padding: '2rem',
        opacity: stage === 'typing' ? 0 : 1,
        transform: stage === 'typing' ? 'translateY(20px)' : 'translateY(0)',
        transition: 'opacity 0.7s ease, transform 0.7s ease',
        pointerEvents: stage === 'typing' ? 'none' : 'auto',
      }}>

        {/* Settled tagline — shows after typing completes */}
        <p style={{
          marginBottom: '1.5rem',
          fontSize: '0.875rem',
          fontWeight: 500,
          color: 'var(--text-secondary)',
          letterSpacing: '0.01em',
          textAlign: 'center',
          transition: 'color 0.3s ease',
        }}>
          {TYPING_TEXT}
        </p>

        {/* Logo */}
        <div style={{ marginBottom: '1.75rem' }}>
          <LexLogo />
        </div>

        {/* Glass form card */}
        <div style={{
          width: '100%', maxWidth: '380px',
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: '20px',
          padding: '2rem',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          transition: 'background 0.3s ease, border-color 0.3s ease',
        }}>
          <div style={{ marginBottom: '1.75rem' }}>
            <h2 style={{
              fontSize: '1.5rem', fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.04em', marginBottom: '0.3rem',
              transition: 'color 0.3s ease',
            }}>
              Welcome back
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', transition: 'color 0.3s ease' }}>
              Sign in to your workspace
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            <div>
              <label htmlFor="email" style={{
                display: 'block', fontSize: '0.75rem', fontWeight: 600,
                color: 'var(--text-secondary)', marginBottom: '0.4rem',
                transition: 'color 0.3s ease',
              }}>
                Email
              </label>
              <input
                id="email" type="email" required autoFocus autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{
                  width: '100%', padding: '0.65rem 0.875rem',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  color: 'var(--text-primary)',
                  fontSize: '0.8125rem',
                  fontFamily: 'var(--font-sans)',
                  outline: 'none',
                  transition: 'border-color 150ms, box-shadow 150ms, background 0.3s ease, color 0.3s ease',
                  cursor: 'text',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(30,94,255,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(30,94,255,0.1)'; }}
                onBlur={(e)  => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label htmlFor="password" style={{
                  fontSize: '0.75rem', fontWeight: 600,
                  color: 'var(--text-secondary)', transition: 'color 0.3s ease',
                }}>
                  Password
                </label>
                <Link href="/forgot-password" style={{
                  fontSize: '0.72rem', color: '#1E5EFF',
                  textDecoration: 'none', fontWeight: 500, cursor: 'pointer',
                }}>
                  Forgot?
                </Link>
              </div>
              {/* Password field with show/hide toggle */}
              <div style={{ position: 'relative' }}>
                <input
                  id="password" type={showPw ? 'text' : 'password'} required autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%', padding: '0.65rem 2.5rem 0.65rem 0.875rem',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    color: 'var(--text-primary)',
                    fontSize: '0.8125rem',
                    fontFamily: 'var(--font-sans)',
                    outline: 'none',
                    transition: 'border-color 150ms, box-shadow 150ms, background 0.3s ease, color 0.3s ease',
                    cursor: 'text',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(30,94,255,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(30,94,255,0.1)'; }}
                  onBlur={(e)  => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  style={{
                    position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                    transition: 'color 150ms',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                padding: '0.625rem 0.875rem', borderRadius: '9px',
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                fontSize: '0.75rem', color: '#f87171',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                width: '100%', padding: '0.7rem', marginTop: '0.25rem',
                background: loading
                  ? 'var(--bg-hover)'
                  : 'linear-gradient(135deg, #1E5EFF 0%, #0A3FCC 100%)',
                color: loading ? 'var(--text-muted)' : '#fff',
                fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '-0.01em',
                borderRadius: '10px',
                border: loading ? '1px solid var(--border)' : 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 0 20px rgba(30,94,255,0.30)',
                transition: 'all 150ms',
              }}
              onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 28px rgba(30,94,255,0.48)'; } }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = loading ? 'none' : '0 0 20px rgba(30,94,255,0.30)'; }}
            >
              {loading
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Signing in...</>
                : <>Sign in <ArrowRight className="h-3.5 w-3.5" /></>
              }
            </button>

          </form>

          {/* Create account link */}
          <p style={{
            marginTop: '1.25rem', textAlign: 'center',
            fontSize: '0.75rem', color: 'var(--text-secondary)',
            transition: 'color 0.3s ease',
          }}>
            Don&apos;t have an account?{' '}
            <Link href="/register" style={{
              color: '#1E5EFF', fontWeight: 600, textDecoration: 'none',
            }}>
              Create account
            </Link>
          </p>

        </div>
      </div>

    </div>
  );
}
