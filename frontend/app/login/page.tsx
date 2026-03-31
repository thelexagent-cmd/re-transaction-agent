'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login } from '@/lib/api';
import { setToken, isAuthenticated } from '@/lib/auth';
import { Loader2, Sun, Moon, ArrowRight, Eye, EyeOff } from 'lucide-react';

// ── Logo ───────────────────────────────────────────────────────────────────────
function LexLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{
        width: '46px', height: '46px', borderRadius: '12px',
        background: 'linear-gradient(160deg, #060C24 0%, #0D1B4B 50%, #0A1A44 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        boxShadow: '0 2px 20px rgba(30,94,255,0.35), inset 0 1px 0 rgba(100,180,255,0.10)',
        border: '1px solid rgba(59,130,246,0.25)',
      }}>
        <svg width="34" height="30" viewBox="0 0 34 30" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#67E8F9" stopOpacity="0.95"/>
              <stop offset="45%" stopColor="#38BDF8" stopOpacity="0.90"/>
              <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.85"/>
            </linearGradient>
            <linearGradient id="lg2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.88"/>
              <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.80"/>
              <stop offset="100%" stopColor="#1E40AF" stopOpacity="0.75"/>
            </linearGradient>
            <linearGradient id="lg3" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#BAE6FD" stopOpacity="0.95"/>
              <stop offset="40%" stopColor="#60A5FA" stopOpacity="0.90"/>
              <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.80"/>
            </linearGradient>
            <linearGradient id="lg4" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7DD3FC" stopOpacity="0.85"/>
              <stop offset="55%" stopColor="#2563EB" stopOpacity="0.78"/>
              <stop offset="100%" stopColor="#1E3A8A" stopOpacity="0.72"/>
            </linearGradient>
            <linearGradient id="lg5" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A5F3FC" stopOpacity="0.80"/>
              <stop offset="50%" stopColor="#38BDF8" stopOpacity="0.72"/>
              <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.65"/>
            </linearGradient>
          </defs>
          <ellipse cx="17" cy="29.5" rx="15" ry="1.2" fill="rgba(30,94,255,0.22)"/>
          <rect x="0"  y="18" width="5"  height="11" rx="0.5" fill="url(#lg1)"/>
          <rect x="1.5" y="19.5" width="1.5" height="2" rx="0.25" fill="rgba(255,255,255,0.50)"/>
          <rect x="6"  y="10" width="6"  height="19" rx="0.5" fill="url(#lg2)"/>
          <rect x="7.2" y="12" width="1.5" height="2"   rx="0.25" fill="rgba(255,255,255,0.45)"/>
          <rect x="9.2" y="12" width="1.5" height="2"   rx="0.25" fill="rgba(255,255,255,0.35)"/>
          <rect x="7.2" y="16" width="1.5" height="1.5" rx="0.25" fill="rgba(255,255,255,0.30)"/>
          <rect x="13" y="2"  width="8"  height="27" rx="0.5" fill="url(#lg3)"/>
          <rect x="14" y="3"  width="1.8" height="26" rx="0.5" fill="rgba(255,255,255,0.12)"/>
          <rect x="16.5" y="5"  width="1.8" height="2.5" rx="0.25" fill="rgba(255,255,255,0.50)"/>
          <rect x="16.5" y="9"  width="1.8" height="2.5" rx="0.25" fill="rgba(255,255,255,0.40)"/>
          <rect x="16.5" y="13" width="1.8" height="2.5" rx="0.25" fill="rgba(255,255,255,0.35)"/>
          <rect x="16.5" y="17" width="1.8" height="2.5" rx="0.25" fill="rgba(255,255,255,0.28)"/>
          <rect x="22" y="8"  width="6"  height="21" rx="0.5" fill="url(#lg4)"/>
          <rect x="23.2" y="10" width="1.5" height="2" rx="0.25" fill="rgba(255,255,255,0.42)"/>
          <rect x="25.2" y="10" width="1.5" height="2" rx="0.25" fill="rgba(255,255,255,0.32)"/>
          <rect x="23.2" y="14" width="1.5" height="2" rx="0.25" fill="rgba(255,255,255,0.28)"/>
          <rect x="29" y="16" width="5"  height="13" rx="0.5" fill="url(#lg5)"/>
          <rect x="30.2" y="17.5" width="1.5" height="2" rx="0.25" fill="rgba(255,255,255,0.38)"/>
        </svg>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={{
          fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)',
          letterSpacing: '-0.055em', lineHeight: 1,
          fontFamily: 'var(--font-sans)', transition: 'color 0.3s ease',
        }}>Lex</span>
        <span style={{
          fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: 'var(--text-muted)', lineHeight: 1,
          transition: 'color 0.3s ease',
        }}>Transaction AI</span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [theme, setTheme]       = useState<'dark' | 'light'>('dark');
  const [visible, setVisible]   = useState(false);

  useEffect(() => {
    if (isAuthenticated()) router.replace('/transactions');
    const stored = localStorage.getItem('lex-theme') as 'dark' | 'light' | null;
    const initial = stored ?? 'dark';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
    setTimeout(() => setVisible(true), 60);
  }, [router]);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('lex-theme', next);
  }

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

  const inputBase: React.CSSProperties = {
    width: '100%', padding: '0.65rem 0.875rem',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    color: 'var(--text-primary)',
    fontSize: '0.8125rem',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    transition: 'border-color 150ms, box-shadow 150ms, background 0.3s ease, color 0.3s ease',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      fontFamily: 'var(--font-sans)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem',
      transition: 'background 0.3s ease',
    }}>

      {/* Theme toggle */}
      <div style={{ position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 50 }}>
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
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(30,94,255,0.4)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Content */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}>

        <div style={{ marginBottom: '1.75rem' }}>
          <LexLogo />
        </div>

        {/* Form card */}
        <div style={{
          width: '100%', maxWidth: '380px',
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: '20px',
          padding: '2rem',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: 'var(--shadow-card)',
          transition: 'background 0.3s ease, border-color 0.3s ease',
        }}>
          <div style={{ marginBottom: '1.75rem' }}>
            <h2 style={{
              fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)',
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
              }}>Email</label>
              <input
                id="email" type="email" required autoFocus autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={inputBase}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(30,94,255,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(30,94,255,0.1)'; }}
                onBlur={(e)  => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label htmlFor="password" style={{
                  fontSize: '0.75rem', fontWeight: 600,
                  color: 'var(--text-secondary)', transition: 'color 0.3s ease',
                }}>Password</label>
                <Link href="/forgot-password" style={{
                  fontSize: '0.72rem', color: '#1E5EFF', textDecoration: 'none', fontWeight: 500,
                }}>Forgot?</Link>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  id="password" type={showPw ? 'text' : 'password'} required autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ ...inputBase, padding: '0.65rem 2.5rem 0.65rem 0.875rem' }}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(30,94,255,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(30,94,255,0.1)'; }}
                  onBlur={(e)  => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                />
                <button
                  type="button" onClick={() => setShowPw(p => !p)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                    transition: 'color 150ms',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
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
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Signing in...</>
                : <>Sign in <ArrowRight className="h-3.5 w-3.5" /></>
              }
            </button>

          </form>

          <p style={{
            marginTop: '1.25rem', textAlign: 'center',
            fontSize: '0.75rem', color: 'var(--text-secondary)',
            transition: 'color 0.3s ease',
          }}>
            Don&apos;t have an account?{' '}
            <Link href="/register" style={{ color: '#1E5EFF', fontWeight: 600, textDecoration: 'none' }}>
              Create account
            </Link>
          </p>

        </div>
      </div>

    </div>
  );
}
