'use client';

import { AuthGuard } from '@/components/auth-guard';
import { Sidebar } from '@/components/layout/Sidebar';

export default function ContactsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-full min-h-screen">
        <Sidebar />
        <main className="ml-64 flex-1 min-h-screen bg-[var(--bg)]">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
