import { Sidebar } from '@/components/layout/sidebar';

export default function DocumentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <Sidebar />
      <main className="flex-1 ml-64">{children}</main>
    </div>
  );
}
