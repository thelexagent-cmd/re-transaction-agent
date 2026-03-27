'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, Loader2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(text || `HTTP ${res.status}`);
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      {/* Ambient glow */}
      <div style={{
        position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: '600px', height: '400px', pointerEvents: 'none',
        background: 'radial-gradient(ellipse, rgba(59,130,246,0.06) 0%, transparent 70%)',
      }} />

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl mb-4" style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            boxShadow: '0 8px 24px rgba(59,130,246,0.35)',
          }}>
            <Building2 className="h-7 w-7 text-white" />
          </div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 600, letterSpacing: '0.1em', color: '#f1f5f9' }}>
            LEX
          </h1>
          <p style={{ fontSize: '0.75rem', color: '#3d5068', marginTop: '2px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Transaction Agent
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8" style={{
          background: 'var(--bg-surface)',
          border: '1px solid rgba(148,163,184,0.09)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
        }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 600, letterSpacing: '0.05em', color: '#e2e8f0', marginBottom: '0.5rem' }}>
            Reset Password
          </h2>
          <p style={{ fontSize: '0.8125rem', color: '#3d5068', marginBottom: '1.5rem' }}>
            Enter your email and we&apos;ll send you a reset link.
          </p>

          {success ? (
            <div className="rounded-lg px-4 py-3" style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', fontSize: '0.8125rem', color: '#34d399' }}>
              Check your email for a reset link. It expires in 30 minutes.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4a5568', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.375rem' }}>
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg text-sm transition-all duration-150"
                  style={{
                    padding: '0.625rem 0.875rem',
                    background: 'var(--bg-elevated)',
                    border: '1px solid rgba(148,163,184,0.09)',
                    color: '#f1f5f9',
                    outline: 'none',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(59,130,246,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(148,163,184,0.09)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              {error && (
                <div className="rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.8125rem', color: '#f87171' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-lg text-white font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  padding: '0.6875rem 1rem',
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  fontSize: '0.75rem',
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  boxShadow: loading ? 'none' : '0 2px 12px rgba(59,130,246,0.3)',
                  marginTop: '0.5rem',
                }}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          )}

          <div className="mt-4 text-center">
            <Link href="/login" style={{ fontSize: '0.75rem', color: '#3b82f6' }}>
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
