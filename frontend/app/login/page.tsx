'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login } from '@/lib/api';
import { setToken, isAuthenticated } from '@/lib/auth';
import { Loader2, Sun, Moon, ArrowRight, Building2, CheckCircle2 } from 'lucide-react';

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
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '36px', height: '36px', borderRadius: '10px',
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        color: 'var(--text-secondary)', cursor: 'pointer',
        transition: 'all 150ms',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

const FEATURES = [
  'Automated deadline tracking',
  'Document collection pipeline',
  'Commission calculator',
  'Client portal sharing',
];

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
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      {/* ── Left Panel ── */}
      <div
        className="hidden lg:flex"
        style={{
          flex: '0 0 48%',
          position: 'relative',
          overflow: 'hidden',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '2.5rem',
        }}
      >
        {/* Gradient mesh background */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: `
            radial-gradient(ellipse 80% 70% at 10% 30%, rgba(99,102,241,0.2) 0%, transparent 60%),
            radial-gradient(ellipse 60% 60% at 90% 80%, rgba(59,130,246,0.15) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 60% 10%, rgba(139,92,246,0.1) 0%, transparent 60%),
            var(--bg-surface)
          `,
        }} />

        {/* Subtle grid overlay */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1, opacity: 0.03,
          backgroundImage: 'linear-gradient(var(--text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--text-primary) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />

        {/* Glowing orbs */}
        <div style={{ position: 'absolute', top: '20%', left: '15%', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(99,102,241,0.08)', filter: 'blur(60px)', zIndex: 1 }} />
        <div style={{ position: 'absolute', bottom: '25%', right: '10%', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(59,130,246,0.07)', filter: 'blur(50px)', zIndex: 1 }} />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '40px', height: '40px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
            }}>
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <span style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
              LEX
            </span>
          </div>
        </div>

        {/* Hero text */}
        <div style={{ position: 'relative', zIndex: 2 }} className="animate-fade-up">
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.3rem 0.75rem', borderRadius: '999px',
            background: 'var(--accent-dim)', border: '1px solid var(--border-accent)',
            fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-bright)',
            marginBottom: '1.5rem',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
            Real Estate Transaction Agent
          </div>

          <h1 style={{
            fontSize: 'clamp(2rem, 3.5vw, 2.75rem)',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.04em',
            lineHeight: 1.1,
            marginBottom: '1.25rem',
          }}>
            Close deals faster.<br />
            <span style={{
              background: 'linear-gradient(135deg, #818cf8, #60a5fa)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Stay in control.
            </span>
          </h1>

          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '2rem', maxWidth: '380px' }}>
            Every deadline, document, and party in one place. Built for agents who move fast.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {FEATURES.map((f, i) => (
              <div key={f} className="animate-fade-up" style={{ animationDelay: `${0.1 + i * 0.07}s`, display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-bright)' }} />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            © 2026 Lex · Built for real estate professionals
          </p>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="hidden lg:block" style={{ width: '1px', background: 'var(--border)', flexShrink: 0 }} />

      {/* ── Right Panel ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        position: 'relative',
      }}>

        {/* Theme toggle top-right */}
        <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem' }}>
          <ThemeToggle />
        </div>

        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-2 mb-10">
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
          }}>
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>LEX</span>
        </div>

        {/* Form card */}
        <div
          className="w-full animate-fade-up"
          style={{ maxWidth: '400px', animationDelay: '0.1s' }}
        >
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: '0.375rem' }}>
              Welcome back
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Sign in to your account to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Email */}
            <div>
              <label htmlFor="email" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="lex-input"
                style={{ borderRadius: '10px' }}
              />
            </div>

            {/* Password */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label htmlFor="password" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Password
                </label>
                <Link href="/forgot-password" style={{ fontSize: '0.8rem', color: 'var(--accent-bright)', textDecoration: 'none', fontWeight: 500 }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}>
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="lex-input"
                style={{ borderRadius: '10px' }}
              />
            </div>

            {/* Error */}
            {error && (
              <div style={{
                padding: '0.75rem 1rem', borderRadius: '10px',
                background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.2)',
                fontSize: '0.8125rem', color: '#f87171',
              }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                width: '100%', padding: '0.75rem 1rem', marginTop: '0.25rem',
                background: loading ? 'var(--accent-dim)' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: loading ? 'var(--accent-bright)' : '#fff',
                fontSize: '0.9rem', fontWeight: 700,
                borderRadius: '10px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.35)',
                transition: 'all 150ms',
                letterSpacing: '-0.01em',
              }}
              onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(99,102,241,0.45)'; } }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = loading ? 'none' : '0 4px 20px rgba(99,102,241,0.35)'; }}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</>
              ) : (
                <>Sign in <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
