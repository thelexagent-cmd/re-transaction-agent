'use client';

import { useState, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { getMe, updateMe, changePassword } from '@/lib/api';
import type { UserProfile } from '@/lib/api';
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
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

type Section = 'profile' | 'password' | 'preferences' | 'branding' | 'billing';

// ── Helpers ────────────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900 mb-5">{title}</h2>
      {children}
    </div>
  );
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
      <CheckCircle className="h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
      <AlertCircle className="h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = 'text',
  disabled = false,
  placeholder = '',
  suffix,
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
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          disabled={disabled}
          placeholder={placeholder}
          className={[
            'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'transition-colors',
            disabled ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white',
            suffix ? 'pr-10' : '',
          ].join(' ')}
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

// ── Profile Section ─────────────────────────────────────────────────────────

function ProfileSection({ user }: { user: UserProfile }) {
  const [fullName, setFullName] = useState(user.full_name);
  const [brokerageName, setBrokerageName] = useState(user.brokerage_name ?? '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Keep form in sync if SWR revalidates
  useEffect(() => {
    setFullName(user.full_name);
    setBrokerageName(user.brokerage_name ?? '');
  }, [user.full_name, user.brokerage_name]);

  async function handleSave() {
    setSuccess('');
    setError('');
    if (!fullName.trim()) {
      setError('Full name is required.');
      return;
    }
    setSaving(true);
    try {
      await updateMe({
        full_name: fullName.trim(),
        brokerage_name: brokerageName.trim() || null,
      });
      await mutate('/auth/me');
      setSuccess('Profile updated successfully.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Profile">
      <div className="space-y-4">
        <InputField
          label="Full Name"
          value={fullName}
          onChange={setFullName}
          placeholder="Jane Doe"
        />
        <InputField
          label="Email Address"
          value={user.email}
          disabled
          placeholder=""
        />
        <InputField
          label="Brokerage Name"
          value={brokerageName}
          onChange={setBrokerageName}
          placeholder="Miami Realty Group"
        />
        {success && <SuccessBanner message={success} />}
        {error && <ErrorBanner message={error} />}
        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Card>
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
    setSuccess('');
    setError('');
    if (!currentPw) { setError('Enter your current password.'); return; }
    if (newPw.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setError('New passwords do not match.'); return; }
    setSaving(true);
    try {
      await changePassword(currentPw, newPw);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setSuccess('Password changed successfully.');
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Failed to change password.';
      // Surface the backend detail if it mentions "incorrect"
      if (raw.toLowerCase().includes('incorrect') || raw.toLowerCase().includes('current')) {
        setError('Current password is incorrect.');
      } else {
        setError(raw);
      }
    } finally {
      setSaving(false);
    }
  }

  const eyeBtn = (show: boolean, toggle: () => void) => (
    <button
      type="button"
      onClick={toggle}
      className="text-slate-400 hover:text-slate-600"
      tabIndex={-1}
    >
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  return (
    <Card title="Change Password">
      <div className="space-y-4">
        <InputField
          label="Current Password"
          value={currentPw}
          onChange={setCurrentPw}
          type={showCurrent ? 'text' : 'password'}
          suffix={eyeBtn(showCurrent, () => setShowCurrent((v) => !v))}
        />
        <InputField
          label="New Password"
          value={newPw}
          onChange={setNewPw}
          type={showNew ? 'text' : 'password'}
          placeholder="Min. 8 characters"
          suffix={eyeBtn(showNew, () => setShowNew((v) => !v))}
        />
        <InputField
          label="Confirm New Password"
          value={confirmPw}
          onChange={setConfirmPw}
          type="password"
          placeholder="Repeat new password"
        />
        {success && <SuccessBanner message={success} />}
        {error && <ErrorBanner message={error} />}
        <div className="pt-2">
          <button
            onClick={handleChange}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Changing…' : 'Change Password'}
          </button>
        </div>
      </div>
    </Card>
  );
}

// ── Preferences Section ─────────────────────────────────────────────────────

function PreferencesSection() {
  const [language, setLanguage] = useState('EN');
  const [isDark, setIsDark] = useState(false);
  const [notifSound, setNotifSound] = useState(true);

  useEffect(() => {
    setLanguage(localStorage.getItem('lex_default_language') ?? 'EN');
    setIsDark(localStorage.getItem('lex_dark_mode') === '1');
    setNotifSound(localStorage.getItem('lex_notif_sound') !== '0');
  }, []);

  function handleLanguage(val: string) {
    setLanguage(val);
    localStorage.setItem('lex_default_language', val);
  }

  function handleDark(next: boolean) {
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('lex_dark_mode', '1');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('lex_dark_mode', '0');
    }
  }

  function handleNotifSound(next: boolean) {
    setNotifSound(next);
    localStorage.setItem('lex_notif_sound', next ? '1' : '0');
  }

  return (
    <Card title="Preferences">
      <div className="space-y-5">
        {/* Language */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Default Language for New Transactions</label>
          <select
            value={language}
            onChange={(e) => handleLanguage(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            <option value="EN">English (EN)</option>
            <option value="ES">Spanish (ES)</option>
            <option value="PT">Portuguese (PT)</option>
          </select>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100" />

        {/* Dark mode toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-800">Dark Mode</p>
            <p className="text-xs text-slate-500 mt-0.5">Switch between light and dark interface</p>
          </div>
          <button
            role="switch"
            aria-checked={isDark}
            onClick={() => handleDark(!isDark)}
            className={[
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
              isDark ? 'bg-blue-600' : 'bg-slate-200',
            ].join(' ')}
          >
            <span
              className={[
                'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-200',
                isDark ? 'translate-x-5' : 'translate-x-0',
              ].join(' ')}
            />
          </button>
        </div>

        {/* Notification sound toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-800">Notification Sound</p>
            <p className="text-xs text-slate-500 mt-0.5">Play a sound for new alerts and notifications</p>
          </div>
          <button
            role="switch"
            aria-checked={notifSound}
            onClick={() => handleNotifSound(!notifSound)}
            className={[
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
              notifSound ? 'bg-blue-600' : 'bg-slate-200',
            ].join(' ')}
          >
            <span
              className={[
                'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-200',
                notifSound ? 'translate-x-5' : 'translate-x-0',
              ].join(' ')}
            />
          </button>
        </div>
      </div>
    </Card>
  );
}

// ── Branding Section ────────────────────────────────────────────────────────

function BrandingSection() {
  return (
    <Card title="Branding">
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
          Coming Soon
        </div>
        <Palette className="h-10 w-10 text-slate-300 mb-3" />
        <p className="text-sm font-medium text-slate-700 max-w-sm">
          Custom branding coming soon — upload your logo, customize colors, and white-label the client portal.
        </p>
        <p className="text-xs text-slate-400 mt-2">Your clients will see your brand, not ours.</p>
      </div>
    </Card>
  );
}

// ── Billing Section ─────────────────────────────────────────────────────────

function BillingSection() {
  return (
    <Card title="Billing & Plan">
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Professional Plan</p>
            <p className="text-xs text-slate-500 mt-0.5">Unlimited transactions · Priority support</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-slate-900">$49</p>
            <p className="text-xs text-slate-500">/month</p>
          </div>
        </div>
        <button
          disabled
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-400 cursor-not-allowed"
          title="Coming soon"
        >
          <CreditCard className="h-4 w-4" />
          Manage Billing
          <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Coming Soon</span>
        </button>
      </div>
    </Card>
  );
}

// ── Main Settings Page ──────────────────────────────────────────────────────

const sidebarItems: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'profile',     label: 'Profile',          icon: User },
  { id: 'password',    label: 'Change Password',   icon: Lock },
  { id: 'preferences', label: 'Preferences',       icon: Sliders },
  { id: 'branding',    label: 'Branding',          icon: Palette },
  { id: 'billing',     label: 'Billing & Plan',    icon: CreditCard },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<Section>('profile');
  const { data: user, isLoading } = useSWR('/auth/me', getMe, { revalidateOnFocus: false });

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
      <div className="flex gap-6">
      {/* Settings sidebar nav */}
      <nav className="w-52 shrink-0 settings-sidenav">
        <p className="px-3 mb-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Settings</p>
        <div className="space-y-0.5">
          {sidebarItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={[
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left',
                activeSection === id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              ].join(' ')}
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
            <div className="h-8 w-48 rounded-lg bg-slate-200 animate-pulse" />
            <div className="h-64 rounded-xl bg-slate-200 animate-pulse" />
          </div>
        ) : user ? (
          <>
            {activeSection === 'profile'     && <ProfileSection user={user} />}
            {activeSection === 'password'    && <PasswordSection />}
            {activeSection === 'preferences' && <PreferencesSection />}
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
