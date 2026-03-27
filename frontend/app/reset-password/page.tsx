'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Building2, Loader2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => { router.replace('/login'); }, 2000);
      return () => clearTimeout(timer);
    }
  }, [success, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setValidationError('');

    if (newPassword.length < 8) {
      setValidationError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setValidationError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const detail = data?.detail ?? res.statusText;
        throw new Error(detail || `HTTP ${res.status}`);
      }
      setSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('expired')) {
        setError('expired');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  const fieldStyle = {
    padding: '0.625rem 0.875rem',
    background: 'var(--bg-elevated)',
    border: '1px solid rgba(148,163,184,0.09)',
    color: '#f1f5f9',
    outline: 'none',
  };

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
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 600, letterSpacing: '0.05em', color: '#e2e8f0', marginBottom: '1.5rem' }}>
            Set New Password
          </h2>

          {success ? (
            <div className="rounded-lg px-4 py-3" style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', fontSize: '0.8125rem', color: '#34d399' }}>
              Password reset! Redirecting to login...
            </div>
          ) : error === 'expired' ? (
            <div className="space-y-4">
              <div className="rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.8125rem', color: '#f87171' }}>
                This reset link has expired or is invalid. Please request a new one.
              </div>
              <div className="text-center">
                <Link href="/forgot-password" style={{ fontSize: '0.8125rem', color: '#3b82f6' }}>
                  Request a new reset link
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="new-password" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4a5568', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.375rem' }}>
                  New Password
                </label>
                <input
                  id="new-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-lg text-sm transition-all duration-150"
                  style={fieldStyle}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(59,130,246,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(148,163,184,0.09)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              <div>
                <label htmlFor="confirm-password" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4a5568', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.375rem' }}>
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full rounded-lg text-sm transition-all duration-150"
                  style={fieldStyle}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(59,130,246,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(148,163,184,0.09)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              {validationError && (
                <div className="rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.8125rem', color: '#f87171' }}>
                  {validationError}
                </div>
              )}

              {error && error !== 'expired' && (
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
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}

          {!success && error !== 'expired' && (
            <div className="mt-4 text-center">
              <Link href="/login" style={{ fontSize: '0.75rem', color: '#3b82f6' }}>
                Back to login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#3b82f6' }} />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
