import { Sidebar } from '@/components/layout/Sidebar';

export default function DeadlinesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <Sidebar />
      <main className="flex-1 ml-64">{children}</main>
    </div>
  );
}
