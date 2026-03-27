'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { getAllDeadlines } from '@/lib/api';
import { daysUntil, formatDate } from '@/lib/utils';
import { CalendarClock, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

export default function DeadlinesPage() {
  const { data: deadlines, error, isLoading } = useSWR(
    '/deadlines/all',
    getAllDeadlines,
    { refreshInterval: 60000 }
  );

  const missed   = deadlines?.filter(d => d.status === 'missed') ?? [];
  const warning  = deadlines?.filter(d => d.status === 'warning') ?? [];
  const upcoming = deadlines?.filter(d => d.status === 'upcoming') ?? [];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.08em', color: '#e2e8f0' }}>
          Upcoming Deadlines
        </h1>
        <p style={{ fontSize: '0.8125rem', color: '#3d5068', marginTop: '4px' }}>All critical dates across every active transaction</p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 lex-skeleton rounded-xl" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl px-5 py-4 text-sm" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          Failed to load deadlines.
        </div>
      )}

      {!isLoading && !error && deadlines && deadlines.length === 0 && (
        <div className="text-center py-20">
          <div className="flex h-14 w-14 items-center justify-center rounded-full mx-auto mb-4" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <CheckCircle className="h-7 w-7" style={{ color: '#34d399' }} />
          </div>
          <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#94a3b8' }}>No upcoming deadlines</p>
          <p style={{ fontSize: '0.8125rem', color: '#3d5068', marginTop: '4px' }}>Deadlines appear here once you create transactions</p>
        </div>
      )}

      {!isLoading && deadlines && deadlines.length > 0 && (
        <div className="space-y-8">
          {missed.length > 0 && (
            <Section title="Missed" icon={<AlertTriangle className="h-4 w-4" style={{ color: '#f87171' }} />} items={missed} status="missed" />
          )}
          {warning.length > 0 && (
            <Section title="Due Soon" icon={<Clock className="h-4 w-4" style={{ color: '#fb923c' }} />} items={warning} status="warning" />
          )}
          {upcoming.length > 0 && (
            <Section title="Upcoming" icon={<CalendarClock className="h-4 w-4" style={{ color: '#60a5fa' }} />} items={upcoming} status="upcoming" />
          )}
        </div>
      )}
    </div>
  );
}

type DeadlineItem = Awaited<ReturnType<typeof getAllDeadlines>>[number];

const STATUS_CHIP: Record<string, { color: string; bg: string; border: string }> = {
  missed:   { color: '#f87171', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.25)' },
  warning:  { color: '#fbbf24', bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.25)' },
  upcoming: { color: '#60a5fa', bg: 'rgba(59,130,246,0.1)',   border: 'rgba(59,130,246,0.25)' },
};

function Section({ title, icon, items, status }: { title: string; icon: React.ReactNode; items: DeadlineItem[]; status: string }) {
  const chip = STATUS_CHIP[status] ?? STATUS_CHIP.upcoming;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{title}</h2>
        <span style={{ fontSize: '0.6875rem', color: '#3d5068' }}>({items.length})</span>
      </div>
      <div className="space-y-2">
        {items.map((d) => {
          const days = daysUntil(d.due_date);
          const dayLabel = days === null ? '' :
            days < 0  ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue` :
            days === 0 ? 'Due today' :
            `${days} day${days !== 1 ? 's' : ''} left`;

          return (
            <Link key={d.id} href={`/transactions/${d.transaction_id}`} className="block">
              <div
                className="flex items-center justify-between rounded-xl px-5 py-4 transition-all duration-150 cursor-pointer"
                style={{ background: 'var(--bg-surface)', border: '1px solid rgba(148,163,184,0.09)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'; }}
              >
                <div>
                  <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#e2e8f0' }}>{d.name}</p>
                  <p style={{ fontSize: '0.75rem', color: '#3d5068', marginTop: '2px' }}>{d.transaction_address}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span style={{ fontSize: '0.75rem', color: '#3d5068' }}>{formatDate(d.due_date)}</span>
                  {dayLabel && (
                    <span className="rounded-full px-2.5 py-0.5" style={{
                      fontSize: '0.6875rem', fontWeight: 700,
                      color: chip.color, background: chip.bg,
                      border: `1px solid ${chip.border}`,
                    }}>
                      {dayLabel}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
