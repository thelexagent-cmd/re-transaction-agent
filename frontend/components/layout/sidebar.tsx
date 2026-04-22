'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { clearToken } from '@/lib/auth';
import { getMe } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, LogOut, Building2, CalendarClock, FileText,
  Plus, BarChart3, Menu, X, Users, Mail, DollarSign, Bell,
  CheckSquare, Settings, Sun, Moon, ChevronUp, CreditCard,
  Sliders, HelpCircle, User, MapPin,
} from 'lucide-react';
import { NotificationCenter } from '@/components/notification-center';
import { useOnboarding } from '@/components/onboarding/OnboardingManager';
import { ModeSwitcher, useMode } from '@/components/mode-switcher';
import { MarketSidebar } from '@/components/layout/market-sidebar';

const navItems = [
  { href: '/transactions', label: 'Dashboard',       icon: LayoutDashboard },
  { href: '/deadlines',    label: 'Deadlines',        icon: CalendarClock },
  { href: '/documents',    label: 'Documents',        icon: FileText },
  { href: '/contacts',     label: 'Contacts',         icon: Users },
  { href: '/tasks',        label: 'Tasks',            icon: CheckSquare },
  { href: '/commission',   label: 'Commission',       icon: DollarSign },
  { href: '/reports',      label: 'Reports',          icon: BarChart3 },
  { href: '/templates',    label: 'Email Templates',  icon: Mail },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const { resetGuide } = useOnboarding();

  function handleTakeTour() {
    resetGuide();
    if (pathname !== '/transactions') {
      router.push('/transactions');
    }
  }
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const profileRef = useRef<HTMLDivElement>(null);

  const mode = useMode();

  const { data: user } = useSWR('/auth/me', getMe, { revalidateOnFocus: false }) as {
    data: { full_name?: string; brokerage_name?: string; avatar_url?: string | null; email?: string } | undefined;
  };

  useEffect(() => { setIsMobileOpen(false); }, [pathname]);

  useEffect(() => {
    const stored = localStorage.getItem('lex-theme') as 'dark' | 'light' | null;
    setTheme(stored ?? 'dark');
  }, []);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [profileOpen]);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('lex-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  }

  function handleLogout() {
    clearToken();
    router.replace('/login');
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'L';

  const profileMenuItems = [
    { icon: User,       label: 'Profile',         href: '/settings?section=profile' },
    { icon: Sliders,    label: 'Personalization',  href: '/settings?section=preferences' },
    { icon: Settings,   label: 'Settings',         href: '/settings' },
    { icon: CreditCard, label: 'Upgrade Plan',     href: '/settings?section=billing' },
    { icon: HelpCircle, label: 'Help',             href: '/help' },
  ];

  const sidebarContent = (
    <aside className="flex h-full w-64 flex-col" style={{
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
    }}>

      {/* ── Logo ── */}
      <div data-tour="sidebar-logo" className="flex items-center gap-3 px-5 py-[18px]" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
          boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
        }}>
          <Building2 className="h-4 w-4 text-white" />
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-primary)' }}>
            LEX
          </div>
          <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Transaction Agent
          </div>
        </div>
        <button onClick={() => setIsMobileOpen(false)} className="ml-auto md:hidden" aria-label="Close menu" style={{ color: 'var(--text-muted)' }}>
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* ── Mode Switcher ── */}
      <div className="pt-3">
        <ModeSwitcher />
      </div>

      {/* ── New Transaction CTA (CRM only) ── */}
      {mode === 'crm' && (
        <div className="px-4 pt-2 pb-2">
          <Link
            href="/transactions/new"
            className="flex w-full items-center justify-center gap-2 rounded-lg text-white transition-all duration-150 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              padding: '0.5625rem 1rem',
              fontSize: '0.6875rem',
              fontWeight: 700,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              boxShadow: '0 2px 12px rgba(59,130,246,0.25)',
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            New Transaction
          </Link>
        </div>
      )}

      {/* ── Nav ── */}
      {mode === 'market' ? (
        <div className="flex-1 overflow-y-auto py-3">
          <MarketSidebar />
        </div>
      ) : (
        <nav data-tour="sidebar-nav" className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          <p style={{ padding: '0.5rem 0.75rem 0.375rem', fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            Menu
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg py-2 text-sm transition-all duration-150"
                style={isActive
                  ? { background: 'rgba(59,130,246,0.1)', borderLeft: '2px solid #3b82f6', paddingLeft: '10px', paddingRight: '12px', color: 'var(--text-primary)' }
                  : { borderLeft: '2px solid transparent', paddingLeft: '10px', paddingRight: '12px', color: 'var(--text-secondary)' }
                }
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
              >
                <Icon className="h-4 w-4 shrink-0" style={isActive ? { color: '#60a5fa' } : { color: 'inherit' }} />
                <span style={{ fontSize: '0.8125rem', fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}

      {/* ── Bottom ── */}
      <div className="px-3 pb-4 pt-3 space-y-0.5" style={{ borderTop: '1px solid var(--border)' }}>

        {/* Take the tour */}
        <button
          onClick={handleTakeTour}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors"
          style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
        >
          <MapPin className="h-4 w-4" />
          Take the tour
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors"
          style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
        >
          {theme === 'dark'
            ? <Sun className="h-4 w-4" />
            : <Moon className="h-4 w-4" />
          }
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors"
            style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
          >
            <Bell className="h-4 w-4" />
            Notifications
          </button>
          {notifOpen && (
            <div className="absolute bottom-full left-0 mb-2 z-50 w-80">
              <NotificationCenter onClose={() => setNotifOpen(false)} />
            </div>
          )}
        </div>

        {/* Profile Card — click to open dropdown */}
        <div ref={profileRef} className="relative mt-1">
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-150"
            style={{
              background: 'var(--bg-elevated)',
              border: `1px solid ${profileOpen ? 'rgba(59,130,246,0.35)' : 'var(--border)'}`,
              cursor: 'pointer',
            }}
          >
            {/* Avatar */}
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full overflow-hidden"
              style={{
                background: user?.avatar_url ? 'transparent' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                fontSize: '0.625rem',
                fontWeight: 700,
                color: 'white',
              }}
            >
              {user?.avatar_url
                ? <img src={user.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials
              }
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {user?.full_name ?? 'Loading...'}
              </p>
              <p className="truncate" style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                {user?.brokerage_name ?? user?.email ?? ''}
              </p>
            </div>
            <ChevronUp
              className="h-3.5 w-3.5 shrink-0 transition-transform duration-200"
              style={{
                color: 'var(--text-muted)',
                transform: profileOpen ? 'rotate(0deg)' : 'rotate(180deg)',
              }}
            />
          </button>

          {/* Profile Dropdown */}
          {profileOpen && (
            <div
              className="absolute bottom-full left-0 right-0 mb-2 rounded-xl overflow-hidden z-50"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                boxShadow: '0 -8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset',
              }}
            >
              {/* User header */}
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full overflow-hidden"
                    style={{
                      background: user?.avatar_url ? 'transparent' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'white',
                    }}
                  >
                    {user?.avatar_url
                      ? <img src={user.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : initials
                    }
                  </div>
                  <div className="min-w-0">
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.full_name}</p>
                    <p className="truncate" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{user?.email}</p>
                  </div>
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1.5">
                {profileMenuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 transition-all duration-100"
                      style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', textDecoration: 'none' }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.07)';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                      }}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}

                <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />

                <button
                  onClick={() => { setProfileOpen(false); handleLogout(); }}
                  className="flex w-full items-center gap-3 px-4 py-2 transition-all duration-100"
                  style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.07)';
                    (e.currentTarget as HTMLElement).style.color = '#f87171';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                  }}
                >
                  <LogOut className="h-3.5 w-3.5 shrink-0" />
                  Log Out
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </aside>
  );

  return (
    <>
      <button
        onClick={() => setIsMobileOpen(true)}
        className="fixed top-4 left-4 z-40 flex h-9 w-9 items-center justify-center rounded-lg shadow-md md:hidden"
        style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <div className={cn('fixed left-0 top-0 z-50 h-screen transition-transform duration-300 md:hidden', isMobileOpen ? 'translate-x-0' : '-translate-x-full')}>
        {sidebarContent}
      </div>

      <div className="hidden md:flex fixed left-0 top-0 h-screen z-10">
        {sidebarContent}
      </div>
    </>
  );
}
