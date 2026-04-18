'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { getMe, updateMe, changePassword } from '@/lib/api';
import type { UserProfile } from '@/lib/api';
import { getToken } from '@/lib/auth';
import {
  User,
  Lock,
  Sliders,
  Palette,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Users,
  Copy,
  Link2,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-bb87.up.railway.app';

type Section = 'profile' | 'password' | 'preferences' | 'team' | 'branding' | 'billing';

const cardStyle = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  outline: 'none',
  fontSize: '0.875rem',
  padding: '0.5625rem 0.875rem',
  borderRadius: '0.5rem',
  width: '100%',
  transition: 'border-color 150ms, box-shadow 150ms',
};

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6" style={cardStyle}>
      <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.25rem', fontFamily: 'var(--font-heading)', letterSpacing: '0.04em' }}>{title}</h2>
      {children}
    </div>
  );
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-4 py-3" style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', fontSize: '0.8125rem', color: '#34d399' }}>
      <CheckCircle className="h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.8125rem', color: '#f87171' }}>
      <AlertCircle className="h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}

function InputField({
  label, value, onChange, type = 'text', disabled = false, placeholder = '', suffix,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
  suffix?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          disabled={disabled}
          placeholder={placeholder}
          style={{ ...inputStyle, ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}), ...(suffix ? { paddingRight: '2.5rem' } : {}) }}
          onFocus={(e) => { if (!disabled) { e.target.style.borderColor = 'rgba(59,130,246,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}}
          onBlur={(e) => { e.target.style.borderColor = 'rgba(148,163,184,0.09)'; e.target.style.boxShadow = 'none'; }}
        />
        {suffix && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {suffix}
          </div>
        )}
      </div>
    </div>
  );
}

function SaveButton({ onClick, saving, label = 'Save Changes' }: { onClick: () => void; saving: boolean; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="rounded-lg transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        padding: '0.5625rem 1.25rem',
        fontSize: '0.75rem', fontWeight: 700,
        letterSpacing: '0.07em', textTransform: 'uppercase',
        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
        color: '#fff',
        boxShadow: saving ? 'none' : '0 2px 8px rgba(59,130,246,0.3)',
      }}
    >
      {saving ? 'Saving…' : label}
    </button>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200"
      style={{ background: checked ? '#3b82f6' : 'rgba(148,163,184,0.15)' }}
    >
      <span
        className="pointer-events-none inline-block h-5 w-5 rounded-full shadow-sm transform transition-transform duration-200"
        style={{ background: '#fff', transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
      />
    </button>
  );
}

// ── Profile Section ─────────────────────────────────────────────────────────

function ProfileSection({ user }: { user: UserProfile }) {
  const [fullName, setFullName] = useState(user.full_name);
  const [brokerageName, setBrokerageName] = useState(user.brokerage_name ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url ?? '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatar_url ?? null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFullName(user.full_name);
    setBrokerageName(user.brokerage_name ?? '');
    setAvatarUrl(user.avatar_url ?? '');
    setAvatarPreview(user.avatar_url ?? null);
  }, [user.full_name, user.brokerage_name, user.avatar_url]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setAvatarPreview(dataUrl);
      setAvatarUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function clearAvatar() {
    setAvatarPreview(null);
    setAvatarUrl('');
    if (fileRef.current) fileRef.current.value = '';
  }

  const initials = fullName
    ? fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'L';

  async function handleSave() {
    setSuccess(''); setError('');
    if (!fullName.trim()) { setError('Full name is required.'); return; }
    setSaving(true);
    try {
      await updateMe({
        full_name: fullName.trim(),
        brokerage_name: brokerageName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      });
      await mutate('/auth/me');
      setSuccess('Profile updated successfully.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally { setSaving(false); }
  }

  return (
    <SettingsCard title="Profile">
      <div className="space-y-5">
        {/* Avatar */}
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>Profile Picture</label>
          <div className="flex items-center gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full overflow-hidden"
              style={{
                background: avatarPreview ? 'transparent' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                fontSize: '1.25rem', fontWeight: 700, color: 'white',
                border: '2px solid var(--border)',
              }}
            >
              {avatarPreview
                ? <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials
              }
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  style={{
                    ...inputStyle,
                    width: 'auto',
                    padding: '0.375rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    borderRadius: '0.5rem',
                    color: 'var(--text-primary)',
                  }}
                >
                  Upload Photo
                </button>
                {avatarPreview && (
                  <button
                    type="button"
                    onClick={clearAvatar}
                    style={{
                      padding: '0.375rem 0.75rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      borderRadius: '0.5rem',
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      color: '#f87171',
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
              <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                JPG, PNG, or GIF. Max 5MB. Or paste a URL below.
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
          <div className="mt-3">
            <InputField
              label="Or paste an image URL"
              value={avatarUrl.startsWith('data:') ? '' : avatarUrl}
              onChange={(val) => { setAvatarUrl(val); setAvatarPreview(val || null); }}
              placeholder="https://example.com/photo.jpg"
            />
          </div>
        </div>

        <InputField label="Full Name" value={fullName} onChange={setFullName} placeholder="Jane Doe" />
        <InputField label="Email Address" value={user.email} disabled />
        <InputField label="Brokerage Name" value={brokerageName} onChange={setBrokerageName} placeholder="Miami Realty Group" />
        {success && <SuccessBanner message={success} />}
        {error && <ErrorBanner message={error} />}
        <div className="pt-2">
          <SaveButton onClick={handleSave} saving={saving} />
        </div>
      </div>
    </SettingsCard>
  );
}

// ── Change Password Section ─────────────────────────────────────────────────

function PasswordSection() {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  async function handleChange() {
    setSuccess(''); setError('');
    if (!currentPw) { setError('Enter your current password.'); return; }
    if (newPw.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setError('New passwords do not match.'); return; }
    setSaving(true);
    try {
      await changePassword(currentPw, newPw);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setSuccess('Password changed successfully.');
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Failed to change password.';
      setError(raw.toLowerCase().includes('incorrect') || raw.toLowerCase().includes('current') ? 'Current password is incorrect.' : raw);
    } finally { setSaving(false); }
  }

  const eyeBtn = (show: boolean, toggle: () => void) => (
    <button type="button" onClick={toggle} tabIndex={-1} style={{ color: 'var(--text-muted)', transition: 'color 150ms' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#3d5068'; }}
    >
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  return (
    <SettingsCard title="Change Password">
      <div className="space-y-4">
        <InputField label="Current Password" value={currentPw} onChange={setCurrentPw} type={showCurrent ? 'text' : 'password'} suffix={eyeBtn(showCurrent, () => setShowCurrent((v) => !v))} />
        <InputField label="New Password" value={newPw} onChange={setNewPw} type={showNew ? 'text' : 'password'} placeholder="Min. 8 characters" suffix={eyeBtn(showNew, () => setShowNew((v) => !v))} />
        <InputField label="Confirm New Password" value={confirmPw} onChange={setConfirmPw} type="password" placeholder="Repeat new password" />
        {success && <SuccessBanner message={success} />}
        {error && <ErrorBanner message={error} />}
        <div className="pt-2">
          <SaveButton onClick={handleChange} saving={saving} label="Change Password" />
        </div>
      </div>
    </SettingsCard>
  );
}

// ── Preferences Section ─────────────────────────────────────────────────────

function PreferencesSection() {
  const [language, setLanguage] = useState('EN');
  const [notifSound, setNotifSound] = useState(true);

  useEffect(() => {
    setLanguage(localStorage.getItem('lex_default_language') ?? 'EN');
    setNotifSound(localStorage.getItem('lex_notif_sound') !== '0');
  }, []);

  function handleLanguage(val: string) { setLanguage(val); localStorage.setItem('lex_default_language', val); }
  function handleNotifSound(next: boolean) { setNotifSound(next); localStorage.setItem('lex_notif_sound', next ? '1' : '0'); }

  return (
    <SettingsCard title="Preferences">
      <div className="space-y-5">
        <div className="flex flex-col gap-1.5">
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Default Language</label>
          <select
            value={language}
            onChange={(e) => handleLanguage(e.target.value)}
            className="max-w-xs"
            style={inputStyle}
          >
            <option value="EN">English (EN)</option>
            <option value="ES">Spanish (ES)</option>
            <option value="PT">Portuguese (PT)</option>
          </select>
        </div>

        <div style={{ borderTop: '1px solid rgba(148,163,184,0.07)' }} />

        <div className="flex items-center justify-between">
          <div>
            <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>Notification Sound</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Play a sound for new alerts and notifications</p>
          </div>
          <Toggle checked={notifSound} onChange={handleNotifSound} />
        </div>
      </div>
    </SettingsCard>
  );
}

// ── Branding Section ────────────────────────────────────────────────────────

function BrandingSection() {
  return (
    <SettingsCard title="Branding">
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl" style={{ border: '1px dashed rgba(148,163,184,0.15)', background: 'rgba(148,163,184,0.03)' }}>
        <span className="inline-flex items-center rounded-full px-3 py-1 mb-4" style={{ fontSize: '0.6875rem', fontWeight: 700, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Coming Soon
        </span>
        <Palette className="h-10 w-10 mb-3" style={{ color: 'var(--text-muted)' }} />
        <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)', maxWidth: '24rem' }}>
          Custom branding — upload your logo, customize colors, and white-label the client portal.
        </p>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>Your clients will see your brand, not ours.</p>
      </div>
    </SettingsCard>
  );
}

// ── Billing Section ─────────────────────────────────────────────────────────

function BillingSection() {
  return (
    <SettingsCard title="Billing & Plan">
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl px-5 py-4" style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <div>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Professional Plan</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Unlimited transactions · Priority support</p>
          </div>
          <div className="text-right">
            <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#60a5fa' }}>$49</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/month</p>
          </div>
        </div>
        <button
          disabled
          className="inline-flex items-center gap-2 rounded-lg cursor-not-allowed"
          style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: 500, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)', opacity: 0.6 }}
        >
          <CreditCard className="h-4 w-4" />
          Manage Billing
          <span className="ml-1 rounded-full px-2 py-0.5" style={{ fontSize: '0.625rem', fontWeight: 700, background: 'rgba(148,163,184,0.08)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Soon</span>
        </button>
      </div>
    </SettingsCard>
  );
}

// ── Team Section ────────────────────────────────────────────────────────────

function TeamSection() {
  const [creating, setCreating] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  async function handleGenerate() {
    setError('');
    setInviteLink('');
    setCopied(false);
    setCreating(true);
    try {
      const token = getToken();
      if (!token) {
        setError('You are not signed in. Please log in again.');
        return;
      }
      const res = await fetch(`${API_URL}/auth/invites/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { token: string };
      if (!data?.token) throw new Error('Invalid response from server.');
      setInviteLink(`${window.location.origin}/invite/${data.token}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not generate invite link.');
    } finally {
      setCreating(false);
    }
  }

  async function handleCopy() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy to clipboard. Please copy manually.');
    }
  }

  return (
    <SettingsCard title="Invite Agents">
      <div className="space-y-5">
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          Generate a single-use link to invite an agent to your brokerage. They&apos;ll
          create their own account and be linked to you automatically.
        </p>

        {!inviteLink && (
          <div>
            <button
              onClick={handleGenerate}
              disabled={creating}
              className="rounded-lg transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              style={{
                padding: '0.5625rem 1.25rem',
                fontSize: '0.75rem', fontWeight: 700,
                letterSpacing: '0.07em', textTransform: 'uppercase',
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: '#fff',
                boxShadow: creating ? 'none' : '0 2px 8px rgba(59,130,246,0.3)',
              }}
            >
              <Link2 className="h-3.5 w-3.5" />
              {creating ? 'Generating…' : 'Generate Invite Link'}
            </button>
          </div>
        )}

        {inviteLink && (
          <div className="space-y-3">
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Invite Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteLink}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
                style={{
                  ...inputStyle,
                  fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
                  fontSize: '0.8125rem',
                }}
              />
              <button
                onClick={handleCopy}
                className="rounded-lg transition-all duration-150 active:scale-[0.98] inline-flex items-center gap-2 shrink-0"
                style={{
                  padding: '0 1rem',
                  fontSize: '0.75rem', fontWeight: 700,
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  background: copied ? 'rgba(16,185,129,0.12)' : 'var(--bg-elevated)',
                  border: `1px solid ${copied ? 'rgba(16,185,129,0.35)' : 'var(--border)'}`,
                  color: copied ? '#34d399' : 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                {copied ? (
                  <>
                    <CheckCircle className="h-3.5 w-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy Link
                  </>
                )}
              </button>
            </div>
            <button
              onClick={handleGenerate}
              disabled={creating}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                fontSize: '0.75rem', fontWeight: 600, color: '#60a5fa',
              }}
            >
              {creating ? 'Generating…' : 'Generate another link'}
            </button>
          </div>
        )}

        {error && <ErrorBanner message={error} />}

        <div
          className="rounded-lg px-4 py-3"
          style={{
            background: 'rgba(148,163,184,0.04)',
            border: '1px solid rgba(148,163,184,0.1)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
          }}
        >
          Invite links are single-use and expire in 7 days.
        </div>
      </div>
    </SettingsCard>
  );
}

// ── Main Settings Page ──────────────────────────────────────────────────────

const sidebarItems: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'profile',     label: 'Profile',          icon: User },
  { id: 'password',    label: 'Change Password',   icon: Lock },
  { id: 'preferences', label: 'Preferences',       icon: Sliders },
  { id: 'team',        label: 'Invite Agents',     icon: Users },
  { id: 'branding',    label: 'Branding',          icon: Palette },
  { id: 'billing',     label: 'Billing & Plan',    icon: CreditCard },
];

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const sectionParam = searchParams.get('section') as Section | null;
  const [activeSection, setActiveSection] = useState<Section>(sectionParam ?? 'profile');
  const { data: user, isLoading } = useSWR('/auth/me', getMe, { revalidateOnFocus: false });

  useEffect(() => {
    if (sectionParam && ['profile', 'password', 'preferences', 'team', 'branding', 'billing'].includes(sectionParam)) {
      setActiveSection(sectionParam);
    }
  }, [sectionParam]);

  return (
    <div className="p-8 mx-auto max-w-6xl">
      <div className="max-w-4xl">
        <div className="mb-8">
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
            Settings
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '4px' }}>Manage your account, preferences, and billing</p>
        </div>

        <div className="flex gap-6">
          {/* Settings sidebar nav */}
          <nav className="w-52 shrink-0">
            <p style={{ padding: '0 0.75rem', marginBottom: '1rem', fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Account</p>
            <div className="space-y-0.5">
              {sidebarItems.filter(({ id }) => id !== 'team' || user?.role !== 'agent').map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className="flex w-full items-center gap-3 rounded-lg text-left transition-all duration-150"
                  style={{
                    padding: '0.5625rem 0.75rem',
                    fontSize: '0.8125rem', fontWeight: 500,
                    color: activeSection === id ? '#60a5fa' : '#4a5568',
                    background: activeSection === id ? 'rgba(59,130,246,0.08)' : 'transparent',
                    borderLeft: activeSection === id ? '2px solid #3b82f6' : '2px solid transparent',
                  }}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="space-y-4">
                <div className="h-8 w-48 lex-skeleton rounded-lg" />
                <div className="h-64 lex-skeleton rounded-2xl" />
              </div>
            ) : user ? (
              <>
                {activeSection === 'profile'     && <ProfileSection user={user} />}
                {activeSection === 'password'    && <PasswordSection />}
                {activeSection === 'preferences' && <PreferencesSection />}
                {activeSection === 'team'        && <TeamSection />}
                {activeSection === 'branding'    && <BrandingSection />}
                {activeSection === 'billing'     && <BillingSection />}
              </>
            ) : (
              <ErrorBanner message="Could not load user profile. Please refresh." />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
