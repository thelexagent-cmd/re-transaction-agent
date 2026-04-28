'use client';

import type { ReactNode } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';

export default function MarketLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-full min-h-screen">
        <Sidebar />
        <main className="ml-64 flex-1 min-h-screen bg-[var(--bg)]">
          <TopBar />
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
