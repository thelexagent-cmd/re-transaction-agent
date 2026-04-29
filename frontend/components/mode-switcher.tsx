'use client';

import { usePathname } from 'next/navigation';
import { Building2, MapPin } from 'lucide-react';
import { useModeTransition } from '@/components/mode-transition';

// Mode is URL-derived — never stale.
type Mode = 'crm' | 'market';

export function ModeSwitcher() {
  const pathname                       = usePathname();
  const { triggerTransition, pendingHref } = useModeTransition();

  // Visual active mode: commit to destination immediately on click (optimistic),
  // so the pill doesn't lag behind the transition animation.
  const urlMode: Mode   = pathname.startsWith('/market') ? 'market' : 'crm';
  const activeMode: Mode = pendingHref
    ? (pendingHref.startsWith('/market') ? 'market' : 'crm')
    : urlMode;

  function handleSwitch(next: Mode) {
    const href       = next === 'market' ? '/market' : '/transactions';
    const targetMode: Mode = href.startsWith('/market') ? 'market' : 'crm';
    if (targetMode === urlMode && !pendingHref) return; // already here, no-op
    triggerTransition(href);
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
        { id: 'crm'    as Mode, label: 'Lex CRM',    icon: Building2 },
        { id: 'market' as Mode, label: 'Lex Market',  icon: MapPin    },
      ]).map(({ id, label, icon: Icon }) => {
        const active = activeMode === id;
        return (
          <button
            key={id}
            onClick={() => handleSwitch(id)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 px-3"
            style={{
              fontSize:    '0.8125rem',
              fontWeight:  active ? 700 : 500,
              color:       active ? 'var(--text-primary)' : 'var(--text-muted)',
              background:  active ? 'var(--bg-elevated)' : 'transparent',
              boxShadow:   active ? '0 1px 6px rgba(0,0,0,0.3)' : 'none',
              whiteSpace:  'nowrap',
              transition:  'background 180ms ease, color 180ms ease, box-shadow 180ms ease',
            }}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// Hook for other components that need the current mode (always URL-derived).
export function useMode(): Mode {
  const pathname = usePathname();
  return pathname.startsWith('/market') ? 'market' : 'crm';
}
