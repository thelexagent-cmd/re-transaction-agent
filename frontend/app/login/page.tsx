'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login } from '@/lib/api';
import { setToken, isAuthenticated } from '@/lib/auth';
import { Loader2, Sun, Moon, ArrowRight, Building2, TrendingUp, Clock, FileCheck, DollarSign } from 'lucide-react';

function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  useEffect(() => {
    const stored = localStorage.getItem('lex-theme') as 'dark' | 'light' | null;
    const initial = stored ?? 'dark';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);
  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('lex-theme', next);
  }
  return (
    <button onClick={toggle} aria-label="Toggle theme" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: '34px', height: '34px', borderRadius: '10px',
      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
      color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 150ms',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
    </button>
  );
}

function StatCard({ icon, label, value, sub, delay, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string; delay: string; color: string;
}) {
  return (
    <div className="animate-fade-up" style={{
      animationDelay: delay,
      padding: '0.75rem 0.875rem',
      borderRadius: '10px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      backdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'center', gap: '0.625rem',
      transition: 'background 200ms, border-color 200ms',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.055)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
    >
      <div style={{ width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: color }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', marginBottom: '0.1rem', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>{value}</div>
      </div>
      <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textAlign: 'right', flexShrink: 0, lineHeight: 1.4 }}>{sub}</div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated()) router.replace('/transactions');
  }, [router]);

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
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'var(--font-sans)', background: 'var(--bg)' }}>

      {/* ── LEFT PANEL ─────────────────────────────────────────── */}
      <div className="hidden lg:flex" style={{
        flex: '0 0 50%',
        position: 'relative',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '3rem 2.5rem',
        overflow: 'hidden',
        background: '#060910',
      }}>

        {/* === AURORA BLOBS === */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: '-15%', left: '-10%',
            width: '65%', height: '65%', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 70%)',
            filter: 'blur(50px)',
            animation: 'aurora1 12s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', bottom: '-10%', right: '-5%',
            width: '55%', height: '55%', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.25) 0%, transparent 70%)',
            filter: 'blur(60px)',
            animation: 'aurora2 15s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', top: '35%', left: '30%',
            width: '45%', height: '45%', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)',
            filter: 'blur(70px)',
            animation: 'aurora3 18s ease-in-out infinite',
          }} />

          {/* Light beams */}
          <div style={{
            position: 'absolute', top: '-20%', left: 0, right: 0, bottom: '-20%',
            background: 'linear-gradient(105deg, transparent 30%, rgba(148,130,255,0.06) 50%, transparent 70%)',
            width: '200%',
            animation: 'beam-sweep 8s ease-in-out infinite',
            animationDelay: '2s',
          }} />
          <div style={{
            position: 'absolute', top: '-20%', left: 0, right: 0, bottom: '-20%',
            background: 'linear-gradient(105deg, transparent 30%, rgba(100,160,255,0.04) 50%, transparent 70%)',
            width: '200%',
            animation: 'beam-sweep 8s ease-in-out infinite',
            animationDelay: '6s',
          }} />

          {/* Dot grid */}
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.06,
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }} />
        </div>

        {/* Right-edge fade */}
        <div style={{
          position: 'absolute', top: 0, right: 0, width: '100px', height: '100%',
          background: 'linear-gradient(to right, transparent 0%, var(--bg) 100%)',
          zIndex: 20, pointerEvents: 'none',
        }} />

        {/* Logo — absolute top left */}
        <div style={{ position: 'absolute', top: '2.25rem', left: '2.5rem', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, #6366f1, #4338ca)',
              boxShadow: '0 4px 16px rgba(99,102,241,0.45)',
            }}>
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>LEX</span>
          </div>
        </div>

        {/* Footer — absolute bottom left */}
        <div style={{ position: 'absolute', bottom: '2rem', left: '2.5rem', zIndex: 10 }}>
          <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.18)' }}>© 2026 Lex · Built for real estate professionals</p>
        </div>

        {/* ── CENTERED CONTENT ── */}
        <div style={{ position: 'relative', zIndex: 10 }}>
          {/* Badge */}
          <div className="animate-fade-up" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.22rem 0.7rem', borderRadius: '999px',
            background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
            fontSize: '0.65rem', fontWeight: 700, color: '#a5b4fc',
            letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '1rem',
          }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#818cf8', display: 'inline-block' }} />
            Transaction Intelligence
          </div>

          <h1 className="animate-fade-up" style={{
            animationDelay: '0.05s',
            fontSize: 'clamp(1.875rem, 3vw, 2.5rem)', fontWeight: 900,
            color: '#fff', letterSpacing: '-0.05em', lineHeight: 1.05, marginBottom: '0.875rem',
          }}>
            Every deal.<br />
            <span style={{
              background: 'linear-gradient(100deg, #a5b4fc 0%, #93c5fd 45%, #c4b5fd 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              Under control.
            </span>
          </h1>

          <p className="animate-fade-up" style={{
            animationDelay: '0.1s',
            fontSize: '0.875rem', color: 'rgba(255,255,255,0.4)',
            lineHeight: 1.65, marginBottom: '1.5rem', maxWidth: '300px',
          }}>
            Deadlines, documents, commissions — all tracked automatically.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxWidth: '340px' }}>
            <StatCard delay="0.15s" color="rgba(99,102,241,0.18)" label="Active Transactions" value="12 deals" sub="3 closing this week"
              icon={<TrendingUp className="h-3.5 w-3.5" style={{ color: '#818cf8' }} />} />
            <StatCard delay="0.2s" color="rgba(245,158,11,0.15)" label="Upcoming Deadlines" value="5 this week" sub="2 need attention"
              icon={<Clock className="h-3.5 w-3.5" style={{ color: '#fbbf24' }} />} />
            <StatCard delay="0.25s" color="rgba(16,185,129,0.15)" label="Docs Collected" value="84%" sub="↑ 12% this month"
              icon={<FileCheck className="h-3.5 w-3.5" style={{ color: '#34d399' }} />} />
            <StatCard delay="0.3s" color="rgba(59,130,246,0.15)" label="Pipeline Value" value="$4.2M" sub="Across active deals"
              icon={<DollarSign className="h-3.5 w-3.5" style={{ color: '#60a5fa' }} />} />
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────── */}
      <div style={{
        flex: '0 0 50%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '2rem', position: 'relative',
        background: 'var(--bg)',
      }}>

        {/* Theme toggle */}
        <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem' }}>
          <ThemeToggle />
        </div>

        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-2 mb-10">
          <div style={{ width: '34px', height: '34px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #6366f1, #4338ca)' }}>
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>LEX</span>
        </div>

        {/* Form */}
        <div className="w-full animate-fade-up" style={{ maxWidth: '360px', animationDelay: '0.08s' }}>
          <div style={{ marginBottom: '1.75rem' }}>
            <h2 style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.04em', marginBottom: '0.3rem' }}>
              Welcome back
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Sign in to your workspace
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div>
              <label htmlFor="email" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Email
              </label>
              <input id="email" type="email" required autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{
                  width: '100%', padding: '0.65rem 0.875rem',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: '10px', color: 'var(--text-primary)',
                  fontSize: '0.875rem', outline: 'none', fontFamily: 'var(--font-sans)',
                  transition: 'border-color 150ms, box-shadow 150ms',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label htmlFor="password" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Password</label>
                <Link href="/forgot-password" style={{ fontSize: '0.75rem', color: 'var(--accent-bright)', textDecoration: 'none', fontWeight: 500 }}>
                  Forgot?
                </Link>
              </div>
              <input id="password" type="password" required autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '0.65rem 0.875rem',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: '10px', color: 'var(--text-primary)',
                  fontSize: '0.875rem', outline: 'none', fontFamily: 'var(--font-sans)',
                  transition: 'border-color 150ms, box-shadow 150ms',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {error && (
              <div style={{ padding: '0.7rem 0.875rem', borderRadius: '10px', background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.8rem', color: '#f87171' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              width: '100%', padding: '0.7rem', marginTop: '0.125rem',
              background: loading ? 'var(--bg-elevated)' : 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
              color: loading ? 'var(--text-muted)' : '#fff',
              fontSize: '0.875rem', fontWeight: 700, letterSpacing: '-0.01em',
              borderRadius: '10px', border: loading ? '1px solid var(--border)' : 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
              transition: 'all 150ms',
            }}
              onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(99,102,241,0.5)'; } }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = loading ? 'none' : '0 4px 20px rgba(99,102,241,0.4)'; }}
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>

          <p style={{ marginTop: '1.75rem', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Transaction management for real estate professionals
          </p>
        </div>
      </div>
    </div>
  );
}
