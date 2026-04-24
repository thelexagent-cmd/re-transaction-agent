'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, MapPin } from 'lucide-react';

type Mode = 'crm' | 'market';

export function ModeSwitcher() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('crm');

  useEffect(() => {
    const stored = localStorage.getItem('lex-mode') as Mode | null;
    setMode(stored ?? 'crm');
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    localStorage.setItem('lex-mode', next);
    if (next === 'market') router.push('/market/watchlist');
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
        { id: 'crm' as Mode,    label: 'Lex CRM',    icon: Building2 },
        { id: 'market' as Mode, label: 'Lex Market',  icon: MapPin },
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

export function useMode(): Mode {
  const [mode, setMode] = useState<Mode>('crm');

  useEffect(() => {
    const stored = localStorage.getItem('lex-mode') as Mode | null;
    setMode(stored ?? 'crm');

    function onStorage(e: StorageEvent) {
      if (e.key === 'lex-mode') setMode((e.newValue as Mode) ?? 'crm');
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return mode;
}
