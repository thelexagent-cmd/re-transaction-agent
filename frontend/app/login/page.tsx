'use client';

import { useState, useEffect, useRef } from 'react';
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
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      color: 'rgba(255,255,255,0.4)', cursor: 'pointer', transition: 'all 150ms',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
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
      padding: '0.7rem 0.875rem',
      borderRadius: '10px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', gap: '0.625rem',
      transition: 'all 200ms',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
    >
      <div style={{ width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: color }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.3)', marginBottom: '0.1rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>{value}</div>
      </div>
      <div style={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.25)', textAlign: 'right', flexShrink: 0, lineHeight: 1.4 }}>{sub}</div>
    </div>
  );
}

// Spotlight that follows mouse on the left panel
function SpotlightPanel({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 50, y: 40 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      setPos({
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      });
    };
    el.addEventListener('mousemove', handler);
    return () => el.removeEventListener('mousemove', handler);
  }, []);

  return (
    <div ref={ref} className="hidden lg:flex" style={{
      flex: '0 0 50%',
      position: 'relative',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '3rem 2.75rem',
      overflow: 'hidden',
      background: '#050810',
    }}>
      {/* Animated grid */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: `
          linear-gradient(rgba(99,102,241,0.07) 1px, transparent 1px),
          linear-gradient(90deg, rgba(99,102,241,0.07) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
      }} />

      {/* Spotlight glow following mouse */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: `radial-gradient(600px circle at ${pos.x}% ${pos.y}%, rgba(99,102,241,0.12) 0%, transparent 60%)`,
        transition: 'background 0.05s ease',
      }} />

      {/* Corner glow accent */}
      <div style={{
        position: 'absolute', top: '-20%', left: '-10%', zIndex: 0,
        width: '60%', height: '60%', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
        filter: 'blur(60px)',
        animation: 'aurora1 14s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', bottom: '-15%', right: '-5%', zIndex: 0,
        width: '50%', height: '50%', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)',
        filter: 'blur(70px)',
        animation: 'aurora2 18s ease-in-out infinite',
      }} />

      {/* Right-edge fade into right panel */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: '80px', height: '100%', zIndex: 20,
        background: 'linear-gradient(to right, transparent, var(--bg))',
        pointerEvents: 'none',
      }} />

      {/* Logo */}
      <div style={{ position: 'absolute', top: '2.25rem', left: '2.75rem', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '9px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #6366f1, #4338ca)',
            boxShadow: '0 0 20px rgba(99,102,241,0.5)',
          }}>
            <Building2 className="h-3.5 w-3.5 text-white" />
          </div>
          <span style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>LEX</span>
        </div>
      </div>

      {/* Footer */}
      <div style={{ position: 'absolute', bottom: '1.75rem', left: '2.75rem', zIndex: 10 }}>
        <p style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.15)', letterSpacing: '0.02em' }}>© 2026 Lex · Real estate transaction intelligence</p>
      </div>

      {/* Main content */}
      <div style={{ position: 'relative', zIndex: 10 }}>
        {/* Badge */}
        <div className="animate-fade-up" style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
          padding: '0.2rem 0.65rem', borderRadius: '999px',
          background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
          fontSize: '0.625rem', fontWeight: 700, color: '#a5b4fc',
          letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '1rem',
        }}>
          <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#818cf8', display: 'inline-block' }} />
          Transaction Intelligence
        </div>

        <h1 className="animate-fade-up" style={{
          animationDelay: '0.05s',
          fontSize: 'clamp(1.75rem, 2.8vw, 2.5rem)', fontWeight: 900,
          color: '#fff', letterSpacing: '-0.05em', lineHeight: 1.06, marginBottom: '0.875rem',
        }}>
          Every deal.<br />
          <span style={{
            background: 'linear-gradient(100deg, #a5b4fc 0%, #93c5fd 50%, #c4b5fd 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            Under control.
          </span>
        </h1>

        <p className="animate-fade-up" style={{
          animationDelay: '0.1s',
          fontSize: '0.8125rem', color: 'rgba(255,255,255,0.35)',
          lineHeight: 1.7, marginBottom: '1.5rem', maxWidth: '280px',
        }}>
          Deadlines, documents, commissions — tracked automatically so nothing slips.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', maxWidth: '320px' }}>
          <StatCard delay="0.15s" color="rgba(99,102,241,0.15)" label="Active Transactions" value="12 deals" sub="3 closing this week"
            icon={<TrendingUp className="h-3.5 w-3.5" style={{ color: '#818cf8' }} />} />
          <StatCard delay="0.2s" color="rgba(245,158,11,0.12)" label="Upcoming Deadlines" value="5 this week" sub="2 need attention"
            icon={<Clock className="h-3.5 w-3.5" style={{ color: '#fbbf24' }} />} />
          <StatCard delay="0.25s" color="rgba(16,185,129,0.12)" label="Docs Collected" value="84%" sub="↑ 12% this month"
            icon={<FileCheck className="h-3.5 w-3.5" style={{ color: '#34d399' }} />} />
          <StatCard delay="0.3s" color="rgba(59,130,246,0.12)" label="Pipeline Value" value="$4.2M" sub="Across active deals"
            icon={<DollarSign className="h-3.5 w-3.5" style={{ color: '#60a5fa' }} />} />
        </div>
      </div>

      {children}
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

      <SpotlightPanel>{null}</SpotlightPanel>

      {/* ── RIGHT PANEL ── */}
      <div style={{
        flex: '0 0 50%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '2rem', position: 'relative',
        background: 'var(--bg)',
      }}>
        <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem' }}>
          <ThemeToggle />
        </div>

        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-2 mb-10">
          <div style={{ width: '32px', height: '32px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #6366f1, #4338ca)' }}>
            <Building2 className="h-3.5 w-3.5 text-white" />
          </div>
          <span style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>LEX</span>
        </div>

        <div className="w-full animate-fade-up" style={{ maxWidth: '340px', animationDelay: '0.08s' }}>
          <div style={{ marginBottom: '1.75rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.04em', marginBottom: '0.3rem' }}>
              Welcome back
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Sign in to your workspace
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div>
              <label htmlFor="email" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Email
              </label>
              <input id="email" type="email" required autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{
                  width: '100%', padding: '0.625rem 0.875rem',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: '9px', color: 'var(--text-primary)',
                  fontSize: '0.8125rem', outline: 'none', fontFamily: 'var(--font-sans)',
                  transition: 'border-color 150ms, box-shadow 150ms',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label htmlFor="password" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Password</label>
                <Link href="/forgot-password" style={{ fontSize: '0.72rem', color: '#818cf8', textDecoration: 'none', fontWeight: 500 }}>
                  Forgot?
                </Link>
              </div>
              <input id="password" type="password" required autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '0.625rem 0.875rem',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: '9px', color: 'var(--text-primary)',
                  fontSize: '0.8125rem', outline: 'none', fontFamily: 'var(--font-sans)',
                  transition: 'border-color 150ms, box-shadow 150ms',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {error && (
              <div style={{ padding: '0.625rem 0.875rem', borderRadius: '9px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.75rem', color: '#f87171' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              width: '100%', padding: '0.675rem', marginTop: '0.125rem',
              background: loading ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
              color: loading ? 'rgba(255,255,255,0.3)' : '#fff',
              fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '-0.01em',
              borderRadius: '9px', border: loading ? '1px solid rgba(255,255,255,0.06)' : 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 0 24px rgba(99,102,241,0.35)',
              transition: 'all 150ms',
            }}
              onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 32px rgba(99,102,241,0.5)'; } }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = loading ? 'none' : '0 0 24px rgba(99,102,241,0.35)'; }}
            >
              {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Signing in...</> : <>Sign in <ArrowRight className="h-3.5 w-3.5" /></>}
            </button>
          </form>

          <p style={{ marginTop: '1.75rem', textAlign: 'center', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            Transaction management for real estate professionals
          </p>
        </div>
      </div>
    </div>
  );
}
