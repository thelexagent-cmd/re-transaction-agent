'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { register } from '@/lib/api';
import { setToken } from '@/lib/auth';
import { Loader2, ArrowRight, Eye, EyeOff, Sun, Moon } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA';

const FIELD_POINTS = [
  { phase: 0.00, spd: 0.28, r: 600, color: [99,  102, 241] as const },
  { phase: 1.26, spd: 0.22, r: 680, color: [59,  130, 246] as const },
  { phase: 2.51, spd: 0.34, r: 560, color: [139, 92,  246] as const },
  { phase: 3.77, spd: 0.19, r: 640, color: [20,  184, 166] as const },
  { phase: 5.03, spd: 0.31, r: 510, color: [99,  102, 241] as const },
  { phase: 0.63, spd: 0.25, r: 580, color: [59,  130, 246] as const },
];

function LexLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{
        width: '46px', height: '46px', borderRadius: '12px',
        background: 'linear-gradient(160deg, #060C24 0%, #0D1B4B 50%, #0A1A44 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        boxShadow: '0 2px 20px rgba(30,94,255,0.40), inset 0 1px 0 rgba(100,180,255,0.10)',
        border: '1px solid rgba(59,130,246,0.25)',
      }}>
        <svg width="34" height="30" viewBox="0 0 34 30" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="rg3" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#BAE6FD" stopOpacity="0.95"/>
              <stop offset="40%" stopColor="#60A5FA" stopOpacity="0.90"/>
              <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.80"/>
            </linearGradient>
          </defs>
          <ellipse cx="17" cy="29.5" rx="15" ry="1.2" fill="rgba(30,94,255,0.22)"/>
          <rect x="0"  y="18" width="5"  height="11" rx="0.5" fill="url(#rg3)"/>
          <rect x="6"  y="10" width="6"  height="19" rx="0.5" fill="url(#rg3)"/>
          <rect x="13" y="2"  width="8"  height="27" rx="0.5" fill="url(#rg3)"/>
          <rect x="22" y="8"  width="6"  height="21" rx="0.5" fill="url(#rg3)"/>
          <rect x="29" y="16" width="5"  height="13" rx="0.5" fill="url(#rg3)"/>
        </svg>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.055em', lineHeight: 1, fontFamily: 'var(--font-sans)', transition: 'color 0.3s ease' }}>Lex</span>
        <span style={{ fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', lineHeight: 1, transition: 'color 0.3s ease' }}>Transaction AI</span>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName]         = useState('');
  const [brokerage, setBrokerage]       = useState('');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [confirmPw, setConfirmPw]       = useState('');
  const [showPw, setShowPw]             = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [theme, setTheme]               = useState<'dark' | 'light'>('dark');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [visible, setVisible]           = useState(false);

  const mouseRef  = useRef({ targetX: 0, targetY: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const stored = localStorage.getItem('lex-theme') as 'dark' | 'light' | null;
    const initial = stored ?? 'dark';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
    setTimeout(() => setVisible(true), 60);
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('lex-theme', next);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let W = window.innerWidth, H = window.innerHeight;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const mouse = mouseRef.current;
    let fcx = W * 0.5, fcy = H * 0.5;
    mouse.targetX = W * 0.5; mouse.targetY = H * 0.5;
    const t0 = performance.now();
    const onMouseMove = (e: MouseEvent) => {
      mouse.targetX = e.clientX; mouse.targetY = e.clientY;
      if (cursorRef.current) cursorRef.current.style.transform = `translate(${e.clientX - 5}px, ${e.clientY - 5}px)`;
    };
    const onResize = () => { W = window.innerWidth; H = window.innerHeight; canvas.width = W; canvas.height = H; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onResize);
    function animate() {
      const t = (performance.now() - t0) * 0.001;
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      const aS = isLight ? 0.20 : 1.0;
      const driftX = W * 0.055 * Math.sin(t * 0.17 + 1.0);
      const driftY = H * 0.045 * Math.cos(t * 0.13 + 0.5);
      fcx += ((mouse.targetX + driftX) - fcx) * 0.008;
      fcy += ((mouse.targetY + driftY) - fcy) * 0.008;
      ctx!.clearRect(0, 0, W, H);
      ctx!.globalCompositeOperation = 'screen';
      FIELD_POINTS.forEach((pt) => {
        const spread = Math.min(W, H) * 0.30;
        const nx = Math.sin(t * 0.33 * pt.spd + pt.phase) * spread + Math.cos(t * 0.19 * pt.spd + pt.phase * 1.618) * spread * 0.45;
        const ny = Math.cos(t * 0.28 * pt.spd + pt.phase * 0.73) * spread * 0.85 + Math.sin(t * 0.21 * pt.spd + pt.phase * 2.14) * spread * 0.38;
        const px = fcx + nx, py = fcy + ny;
        const [r, g, b] = pt.color;
        const grad = ctx!.createRadialGradient(px, py, 0, px, py, pt.r);
        grad.addColorStop(0.00, `rgba(${r},${g},${b},${0.16 * aS})`);
        grad.addColorStop(0.35, `rgba(${r},${g},${b},${0.08 * aS})`);
        grad.addColorStop(0.70, `rgba(${r},${g},${b},${0.025 * aS})`);
        grad.addColorStop(1.00, `rgba(${r},${g},${b},0.00)`);
        ctx!.fillStyle = grad;
        ctx!.fillRect(0, 0, W, H);
      });
      rafRef.current = requestAnimationFrame(animate);
    }
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirmPw) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await register({ email, password, full_name: fullName, brokerage_name: brokerage || undefined, turnstile_token: turnstileToken || undefined });
      // Auto-login after register
      const { login } = await import('@/lib/api');
      const data = await login(email, password, turnstileToken || undefined);
      setToken(data.access_token);
      router.replace('/transactions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
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
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.75rem', fontWeight: 600,
    color: 'var(--text-secondary)', marginBottom: '0.4rem',
    transition: 'color 0.3s ease',
  };

  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'rgba(30,94,255,0.5)';
    e.target.style.boxShadow = '0 0 0 3px rgba(30,94,255,0.1)';
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--border)';
    e.target.style.boxShadow = 'none';
  };

  return (
    <div style={{
      position: 'relative', minHeight: '100vh',
      background: 'var(--bg)',
      backgroundImage: 'radial-gradient(var(--dot-color, rgba(255,255,255,0.07)) 1px, transparent 1px)',
      backgroundSize: '22px 22px',
      fontFamily: 'var(--font-sans)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', cursor: 'none',
      transition: 'background 0.3s ease',
    }}>
      <style>{`
        [data-theme="light"] { --dot-color: rgba(0,0,0,0.07); }
        [data-theme="dark"]  { --dot-color: rgba(255,255,255,0.07); }
      `}</style>

      {/* Grain overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
        opacity: theme === 'dark' ? 0.035 : 0.025,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: '180px 180px',
      }} />

      {/* Custom cursor */}
      <div ref={cursorRef} style={{
        position: 'fixed', left: 0, top: 0,
        width: '10px', height: '10px', borderRadius: '50%',
        background: 'rgba(30,94,255,0.45)',
        boxShadow: '0 0 8px rgba(30,94,255,0.25)',
        pointerEvents: 'none', zIndex: 9999, willChange: 'transform',
      }} />

      {/* Canvas */}
      <canvas ref={canvasRef} style={{
        position: 'fixed', left: 0, top: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Theme toggle */}
      <div style={{ position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 100 }}>
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '34px', height: '34px', borderRadius: '10px',
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', cursor: 'pointer',
            transition: 'border-color 150ms, color 150ms, background 0.3s ease',
          }}
        >
          {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Main form */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', width: '100%',
        padding: '2rem',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}>

        <div style={{ marginBottom: '1.75rem' }}>
          <LexLogo />
        </div>

        <div style={{
          width: '100%', maxWidth: '400px',
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
              color: 'var(--text-primary)', letterSpacing: '-0.04em', marginBottom: '0.3rem',
              transition: 'color 0.3s ease',
            }}>
              Create account
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', transition: 'color 0.3s ease' }}>
              Start managing your transactions with AI
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

            <div>
              <label htmlFor="fullName" style={labelStyle}>Full name</label>
              <input
                id="fullName" type="text" required autoFocus
                value={fullName} onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
                style={inputStyle}
                onFocus={onFocus} onBlur={onBlur}
              />
            </div>

            <div>
              <label htmlFor="brokerage" style={labelStyle}>
                Brokerage <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
              </label>
              <input
                id="brokerage" type="text"
                value={brokerage} onChange={(e) => setBrokerage(e.target.value)}
                placeholder="Global G Real Estate"
                style={inputStyle}
                onFocus={onFocus} onBlur={onBlur}
              />
            </div>

            <div>
              <label htmlFor="email" style={labelStyle}>Email</label>
              <input
                id="email" type="email" required autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={inputStyle}
                onFocus={onFocus} onBlur={onBlur}
              />
            </div>

            <div>
              <label htmlFor="password" style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password" type={showPw ? 'text' : 'password'} required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  style={{ ...inputStyle, paddingRight: '2.5rem' }}
                  onFocus={onFocus} onBlur={onBlur}
                />
                <button
                  type="button" onClick={() => setShowPw(p => !p)}
                  style={{
                    position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                  }}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPw" style={labelStyle}>Confirm password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="confirmPw" type={showConfirm ? 'text' : 'password'} required
                  value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="••••••••"
                  style={{ ...inputStyle, paddingRight: '2.5rem' }}
                  onFocus={onFocus} onBlur={onBlur}
                />
                <button
                  type="button" onClick={() => setShowConfirm(p => !p)}
                  style={{
                    position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                  }}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
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

            <div style={{ display: 'flex', justifyContent: 'center', margin: '0.25rem 0' }}>
              <Turnstile
                siteKey={TURNSTILE_SITE_KEY}
                onSuccess={setTurnstileToken}
                onError={() => setTurnstileToken('')}
                onExpire={() => setTurnstileToken('')}
                options={{ theme: theme === 'dark' ? 'dark' : 'light', size: 'normal' }}
              />
            </div>

            <button
              type="submit" disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                width: '100%', padding: '0.7rem', marginTop: '0.25rem',
                background: loading ? 'var(--bg-hover)' : 'linear-gradient(135deg, #1E5EFF 0%, #0A3FCC 100%)',
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
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating account...</>
                : <>Create account <ArrowRight className="h-3.5 w-3.5" /></>
              }
            </button>

          </form>

          <p style={{
            marginTop: '1.25rem', textAlign: 'center',
            fontSize: '0.75rem', color: 'var(--text-secondary)',
            transition: 'color 0.3s ease',
          }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: '#1E5EFF', fontWeight: 600, textDecoration: 'none' }}>
              Sign in
            </Link>
          </p>

          <p style={{
            marginTop: '0.75rem', textAlign: 'center',
            fontSize: '0.6875rem', color: 'var(--text-muted)',
            transition: 'color 0.3s ease',
          }}>
            By creating an account you agree to our{' '}
            <Link href="/terms" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>Terms</Link>
            {' and '}
            <Link href="/privacy" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>Privacy Policy</Link>
          </p>

        </div>
      </div>
    </div>
  );
}
