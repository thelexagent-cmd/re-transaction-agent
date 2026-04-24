'use client';

import { AuthGuard } from '@/components/auth-guard';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { OnboardingProvider } from '@/components/onboarding/OnboardingManager';

export default function TransactionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <OnboardingProvider>
        <div className="flex h-full min-h-screen">
          <Sidebar />
          <main className="ml-64 flex-1 min-h-screen bg-[var(--bg)]">
            <TopBar />
            {children}
          </main>
        </div>
      </OnboardingProvider>
    </AuthGuard>
  );
}
