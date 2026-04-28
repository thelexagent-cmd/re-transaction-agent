'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AuthGuard } from '@/components/auth-guard';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';

export default function MarketLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isGlobe = pathname === '/market';

  return (
    <AuthGuard>
      {isGlobe ? (
        // Globe + map view: full-bleed, no sidebar eating space
        <div style={{ position: 'fixed', inset: 0 }}>
          {children}
        </div>
      ) : (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
          <Sidebar />
          <div style={{ marginLeft: 256, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <TopBar />
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
              {children}
            </div>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}
