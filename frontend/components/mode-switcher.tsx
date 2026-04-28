'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Building2, MapPin } from 'lucide-react';

// Mode is derived entirely from the current URL — no localStorage state.
// This prevents contamination: if you're on /transactions, mode is always CRM.
// If you're on /market/*, mode is always Market.
type Mode = 'crm' | 'market';

function useCurrentMode(): Mode {
  const pathname = usePathname();
  return pathname.startsWith('/market') ? 'market' : 'crm';
}

export function ModeSwitcher() {
  const router = useRouter();
  const mode = useCurrentMode();

  function switchMode(next: Mode) {
    if (next === 'market') router.push('/market');
    else router.push('/transactions');
  }

  return (
    <div
      className="flex rounded-full p-1"
      style={{
        background: 'rgba(148,163,184,0.08)',
        border: '1px solid var(--border)',
        width: 220,
      }}
    >
      {([
        { id: 'crm' as Mode,    label: 'Lex CRM',   icon: Building2 },
        { id: 'market' as Mode, label: 'Lex Market', icon: MapPin },
      ]).map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => switchMode(id)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 px-3 transition-all duration-200"
          style={{
            fontSize: '0.8125rem',
            fontWeight: mode === id ? 700 : 500,
            color: mode === id ? 'var(--text-primary)' : 'var(--text-muted)',
            background: mode === id ? 'var(--bg-elevated)' : 'transparent',
            boxShadow: mode === id ? '0 1px 6px rgba(0,0,0,0.3)' : 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          {label}
        </button>
      ))}
    </div>
  );
}

// Hook for other components that need to know the current mode.
// Always URL-derived — never stale.
export function useMode(): Mode {
  return useCurrentMode();
}
