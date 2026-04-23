'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { validateInvite, acceptInvite } from '@/lib/api';
import { saveToken } from '@/lib/auth';
import { Building2, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';

type PageState = 'loading' | 'valid' | 'invalid' | 'submitting' | 'success';

const inputStyle: React.CSSProperties = {
  background: 'rgba(148,163,184,0.06)',
  border: '1px solid rgba(148,163,184,0.12)',
  color: 'var(--text-primary)',
  outline: 'none',
  fontSize: '0.875rem',
  padding: '0.625rem 0.875rem',
  borderRadius: '0.5rem',
  width: '100%',
};

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params.token === 'string' ? params.token : '';

  const [state, setState] = useState<PageState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [brokerageName, setBrokerageName] = useState('');
  const [prefillEmail, setPrefillEmail] = useState('');

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Validate token on mount
  useEffect(() => {
    if (!token) { setState('invalid'); setErrorMsg('No invite token found.'); return; }

    validateInvite(token)
      .then((data) => {
        setBrokerageName(data.brokerage_name);
        if (data.email) {
          setPrefillEmail(data.email);
          setEmail(data.email);
        }
        setState('valid');
      })
      .catch((err: Error) => {
        setState('invalid');
        setErrorMsg(err.message || 'This invite is invalid or has expired.');
      });
  }, [token]);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!fullName.trim()) errors.full_name = 'Full name is required';
    if (!email.trim()) errors.email = 'Email is required';
    if (!/\S+@\S+\.\S+/.test(email)) errors.email = 'Enter a valid email';
    if (password.length < 8) errors.password = 'Password must be at least 8 characters';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setState('submitting');
    setErrorMsg('');

    try {
      const result = await acceptInvite({ token, email, password, full_name: fullName.trim() });
      saveToken(result.access_token);
      setState('success');
      setTimeout(() => router.push('/transactions'), 1200);
    } catch (err: unknown) {
      setState('valid');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  const focusStyle = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'rgba(59,130,246,0.5)';
    e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
  };
  const blurStyle = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'rgba(148,163,184,0.12)';
    e.target.style.boxShadow = 'none';
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              boxShadow: '0 8px 24px rgba(59,130,246,0.4)',
            }}
          >
            <Building2 className="h-6 w-6 text-white" />
          </div>
        </div>

        {/* Loading */}
        {state === 'loading' && (
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" style={{ color: '#60a5fa' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Validating invite...</p>
          </div>
        )}

        {/* Invalid */}
        {state === 'invalid' && (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}
          >
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full mx-auto mb-4"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <AlertCircle className="h-7 w-7" style={{ color: '#f87171' }} />
            </div>
            <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Invite Invalid
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              {errorMsg || 'This invite link is invalid, has already been used, or has expired.'}
            </p>
            <Link
              href="/login"
              style={{
                display: 'inline-block',
                padding: '0.5rem 1.25rem',
                borderRadius: '0.5rem',
                background: 'rgba(59,130,246,0.1)',
                border: '1px solid rgba(59,130,246,0.2)',
                color: '#60a5fa',
                fontSize: '0.875rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Go to Login
            </Link>
          </div>
        )}

        {/* Success */}
        {state === 'success' && (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}
          >
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full mx-auto mb-4"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}
            >
              <CheckCircle2 className="h-7 w-7" style={{ color: '#34d399' }} />
            </div>
            <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#34d399', marginBottom: '0.5rem' }}>
              Welcome to {brokerageName}!
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Account created. Taking you to your dashboard...
            </p>
          </div>
        )}

        {/* Valid — signup form */}
        {(state === 'valid' || state === 'submitting') && (
          <div
            className="rounded-2xl p-8"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}
          >
            {/* Header */}
            <div className="mb-6">
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4"
                style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}
              >
                <div className="h-2 w-2 rounded-full" style={{ background: '#3b82f6' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#60a5fa' }}>
                  {brokerageName}
                </span>
              </div>
              <h1
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.375rem',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: 'var(--text-primary)',
                  marginBottom: '0.375rem',
                }}
              >
                Join the team
              </h1>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                You&apos;ve been invited to join {brokerageName} on Lex.
              </p>
            </div>

            {/* Error banner */}
            {errorMsg && (
              <div
                className="flex items-center gap-2 rounded-lg px-4 py-3 mb-5"
                style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.8125rem', color: '#f87171' }}
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div>
                <label
                  style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.375rem' }}
                >
                  Full Name <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Sofia Martinez"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                  disabled={state === 'submitting'}
                  autoFocus
                />
                {fieldErrors.full_name && (
                  <p style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '4px' }}>{fieldErrors.full_name}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label
                  style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.375rem' }}
                >
                  Email <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{
                    ...inputStyle,
                    ...(prefillEmail ? { color: 'var(--text-secondary)' } : {}),
                  }}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                  disabled={state === 'submitting'}
                  readOnly={!!prefillEmail}
                />
                {prefillEmail && (
                  <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Email locked to the invited address
                  </p>
                )}
                {fieldErrors.email && (
                  <p style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '4px' }}>{fieldErrors.email}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label
                  style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.375rem' }}
                >
                  Password <span style={{ color: '#f87171' }}>*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    style={{ ...inputStyle, paddingRight: '2.5rem' }}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                    disabled={state === 'submitting'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '4px' }}>{fieldErrors.password}</p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={state === 'submitting'}
                className="w-full flex items-center justify-center gap-2 rounded-lg transition-all duration-150 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  marginTop: '0.5rem',
                  padding: '0.6875rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  color: '#fff',
                  boxShadow: '0 4px 16px rgba(59,130,246,0.35)',
                }}
              >
                {state === 'submitting' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create Account & Join'
                )}
              </button>
            </form>

            <p
              className="text-center mt-5"
              style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
            >
              Already have an account?{' '}
              <Link href="/login" style={{ color: '#60a5fa', fontWeight: 600 }}>
                Log in
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
