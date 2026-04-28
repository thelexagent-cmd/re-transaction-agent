'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Bell, ListChecks, MapPin } from 'lucide-react';

const marketNavItems = [
  { href: '/market/watchlist', label: 'Watchlist', icon: ListChecks },
  { href: '/market/alerts',    label: 'Alerts',    icon: Bell },
];

export function MarketSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-3">
      {marketNavItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150"
            style={{
              fontSize: '0.875rem',
              fontWeight: active ? 600 : 400,
              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
              background: active ? 'var(--bg-elevated)' : 'transparent',
            }}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}

      <RecentZips />
    </nav>
  );
}

function RecentZips() {
  const pathname = usePathname();
  const [zips, setZips] = useState<string[]>([]);

  useEffect(() => {
    function readZips() {
      try {
        const cached = localStorage.getItem('lex-market-zips');
        setZips(cached ? JSON.parse(cached) : []);
      } catch { /* ignore */ }
    }
    readZips();
    window.addEventListener('storage', readZips);
    return () => window.removeEventListener('storage', readZips);
  }, []);

  if (zips.length === 0) return null;

  return (
    <div className="mt-3 px-1">
      <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px', paddingLeft: '8px' }}>
        ZIP Codes
      </p>
      {zips.slice(0, 6).map((zip) => {
        const active = pathname === `/market/${zip}`;
        return (
          <Link
            key={zip}
            href={`/market/${zip}`}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 transition-colors"
            style={{
              fontSize: '0.8125rem',
              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
              background: active ? 'var(--bg-elevated)' : 'transparent',
            }}
          >
            <MapPin className="h-3 w-3 shrink-0" />
            {zip}
          </Link>
        );
      })}
    </div>
  );
}
