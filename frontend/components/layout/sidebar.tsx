'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { clearToken } from '@/lib/auth';
import { getMe } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  LogOut,
  Building2,
  CalendarClock,
  FileText,
  Plus,
  BarChart3,
  Menu,
  X,
  Users,
  Mail,
  DollarSign,
  Sun,
  Moon,
  Bell,
  CheckSquare,
} from 'lucide-react';
import { NotificationCenter } from '@/components/notification-center';

const navItems = [
  { href: '/transactions',  label: 'Dashboard',          icon: LayoutDashboard },
  { href: '/deadlines',     label: 'Upcoming Deadlines',  icon: CalendarClock },
  { href: '/documents',     label: 'Pending Documents',   icon: FileText },
  { href: '/contacts',      label: 'Contacts',            icon: Users },
  { href: '/reports',       label: 'Reports',             icon: BarChart3 },
  { href: '/tasks',          label: 'Tasks',                icon: CheckSquare },
  { href: '/commission',    label: 'Commission',          icon: DollarSign },
  { href: '/templates',     label: 'Email Templates',     icon: Mail },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const { data: user } = useSWR('/auth/me', getMe, { revalidateOnFocus: false }) as {
    data: { full_name?: string; brokerage_name?: string } | undefined;
  };

  // Dark mode: toggle class on <html>
  useEffect(() => {
    const saved = localStorage.getItem('lex_dark_mode');
    if (saved === '1') {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  function toggleDark() {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('lex_dark_mode', '1');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('lex_dark_mode', '0');
    }
  }

  function handleLogout() {
    clearToken();
    router.replace('/login');
  }

  const sidebarContent = (
    <aside className="flex h-full w-64 flex-col bg-slate-900 text-white">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-700">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
          <Building2 className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight">Lex Transaction</div>
          <div className="text-xs text-slate-400 leading-tight">Agent</div>
        </div>
        {/* Mobile close button */}
        <button
          onClick={() => setIsMobileOpen(false)}
          className="ml-auto md:hidden text-slate-400 hover:text-white"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Quick Action */}
      <div className="px-3 pt-4 pb-2">
        <Link
          href="/transactions/new"
          onClick={() => setIsMobileOpen(false)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Transaction
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        <p className="px-3 pt-2 pb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Menu</p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User profile + logout */}
      <div className="px-3 py-4 border-t border-slate-700 space-y-1">
        {user?.full_name && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {user.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user.full_name}</p>
              {user.brokerage_name && (
                <p className="text-xs text-slate-400 truncate">{user.brokerage_name}</p>
              )}
            </div>
          </div>
        )}

        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </button>

        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
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
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="fixed top-4 left-4 z-40 flex items-center justify-center h-9 w-9 rounded-lg bg-slate-900 text-white shadow-md md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile slide-in sidebar */}
      <div
        className={cn(
          'fixed left-0 top-0 z-50 h-screen transition-transform duration-300 md:hidden',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </div>

      {/* Desktop fixed sidebar */}
      <div className="hidden md:flex fixed left-0 top-0 h-screen z-10">
        {sidebarContent}
      </div>
    </>
  );
}
