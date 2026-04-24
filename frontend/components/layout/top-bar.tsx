'use client';

import { ModeSwitcher } from '@/components/mode-switcher';

export function TopBar() {
  return (
    <div
      className="flex items-center justify-center py-2 px-4"
      style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}
    >
      <ModeSwitcher />
    </div>
  );
}
