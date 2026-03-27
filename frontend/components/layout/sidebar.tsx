'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { clearToken } from '@/lib/auth';
import { getMe } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, LogOut, Building2, CalendarClock, FileText,
  Plus, BarChart3, Menu, X, Users, Mail, DollarSign, Bell,
  CheckSquare, Settings,
} from 'lucide-react';
import { NotificationCenter } from '@/components/notification-center';

const navItems = [
  { href: '/transactions', label: 'Dashboard',       icon: LayoutDashboard },
  { href: '/deadlines',    label: 'Deadlines',        icon: CalendarClock },
  { href: '/documents',    label: 'Documents',        icon: FileText },
  { href: '/contacts',     label: 'Contacts',         icon: Users },
  { href: '/tasks',        label: 'Tasks',            icon: CheckSquare },
  { href: '/commission',   label: 'Commission',       icon: DollarSign },
  { href: '/reports',      label: 'Reports',          icon: BarChart3 },
  { href: '/templates',    label: 'Email Templates',  icon: Mail },
  { href: '/settings',     label: 'Settings',         icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const { data: user } = useSWR('/auth/me', getMe, { revalidateOnFocus: false }) as {
    data: { full_name?: string; brokerage_name?: string } | undefined;
  };

  useEffect(() => { setIsMobileOpen(false); }, [pathname]);

  function handleLogout() {
    clearToken();
    router.replace('/login');
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'L';

  const sidebarContent = (
    <aside className="flex h-full w-64 flex-col" style={{
      background: 'linear-gradient(180deg, #060c18 0%, #07101f 100%)',
      borderRight: '1px solid rgba(148,163,184,0.07)',
    }}>

      {/* ── Logo ── */}
      <div className="flex items-center gap-3 px-5 py-[18px]" style={{ borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
          boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
        }}>
          <Building2 className="h-4 w-4 text-white" />
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9rem', fontWeight: 600, letterSpacing: '0.1em', color: '#f1f5f9' }}>
            LEX
          </div>
          <div style={{ fontSize: '0.625rem', color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Transaction Agent
          </div>
        </div>
        <button onClick={() => setIsMobileOpen(false)} className="ml-auto md:hidden" aria-label="Close menu" style={{ color: '#475569' }}>
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* ── New Transaction CTA ── */}
      <div className="px-4 pt-4 pb-2">
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

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        <p style={{ padding: '0.5rem 0.75rem 0.375rem', fontSize: '0.6rem', fontWeight: 700, color: '#2d3f55', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          Menu
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg py-2 text-sm transition-all duration-150',
                isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              )}
              style={isActive
                ? { background: 'rgba(59,130,246,0.1)', borderLeft: '2px solid #3b82f6', paddingLeft: '10px', paddingRight: '12px' }
                : { borderLeft: '2px solid transparent', paddingLeft: '10px', paddingRight: '12px' }
              }
            >
              <Icon className="h-4 w-4 shrink-0" style={isActive ? { color: '#60a5fa' } : {}} />
              <span style={{ fontSize: '0.8125rem', fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Bottom ── */}
      <div className="px-3 pb-4 pt-3 space-y-0.5" style={{ borderTop: '1px solid rgba(148,163,184,0.07)' }}>
        <div className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-slate-400 hover:text-slate-200 transition-colors"
            style={{ fontSize: '0.8125rem' }}
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

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-slate-400 hover:text-red-400 transition-colors"
          style={{ fontSize: '0.8125rem' }}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>

        {user?.full_name && (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mt-1" style={{
            background: 'rgba(148,163,184,0.04)',
            border: '1px solid rgba(148,163,184,0.07)',
          }}>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white" style={{
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              fontSize: '0.625rem',
              fontWeight: 700,
            }}>
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate" style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2e8f0' }}>{user.full_name}</p>
              {user.brokerage_name && (
                <p className="truncate" style={{ fontSize: '0.625rem', color: '#3d5068' }}>{user.brokerage_name}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <>
      <button
        onClick={() => setIsMobileOpen(true)}
        className="fixed top-4 left-4 z-40 flex h-9 w-9 items-center justify-center rounded-lg shadow-md md:hidden"
        style={{ background: '#060c18', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.1)' }}
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
