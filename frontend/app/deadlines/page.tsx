'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { getAllDeadlines } from '@/lib/api';
import { daysUntil, formatDate } from '@/lib/utils';
import { CalendarClock, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

const STATUS_STYLES: Record<string, string> = {
  missed:   'bg-red-100 text-red-700 border-red-200',
  warning:  'bg-orange-100 text-orange-700 border-orange-200',
  upcoming: 'bg-blue-100 text-blue-700 border-blue-200',
};

const STATUS_LABELS: Record<string, string> = {
  missed:   'Missed',
  warning:  'Due Soon',
  upcoming: 'Upcoming',
};

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
        <h1 className="text-2xl font-bold text-slate-900">Upcoming Deadlines</h1>
        <p className="text-sm text-slate-500 mt-1">All critical dates across every active transaction</p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Failed to load deadlines.
        </div>
      )}

      {!isLoading && !error && deadlines && deadlines.length === 0 && (
        <div className="text-center py-20">
          <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
          <p className="text-base font-semibold text-slate-700">No upcoming deadlines</p>
          <p className="text-sm text-slate-400 mt-1">Deadlines appear here once you create transactions</p>
        </div>
      )}

      {!isLoading && deadlines && deadlines.length > 0 && (
        <div className="space-y-8">
          {missed.length > 0 && (
            <Section title="Missed" icon={<AlertTriangle className="h-4 w-4 text-red-500" />} items={missed} />
          )}
          {warning.length > 0 && (
            <Section title="Due Soon" icon={<Clock className="h-4 w-4 text-orange-500" />} items={warning} />
          )}
          {upcoming.length > 0 && (
            <Section title="Upcoming" icon={<CalendarClock className="h-4 w-4 text-blue-500" />} items={upcoming} />
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, items }: { title: string; icon: React.ReactNode; items: ReturnType<typeof getAllDeadlines> extends Promise<infer T> ? T : never }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{title}</h2>
        <span className="text-xs text-slate-400">({items.length})</span>
      </div>
      <div className="space-y-2">
        {items.map((d) => {
          const days = daysUntil(d.due_date);
          const dayLabel = days === null ? '' :
            days < 0  ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue` :
            days === 0 ? 'Due today' :
            `${days} day${days !== 1 ? 's' : ''} left`;

          return (
            <Link key={d.id} href={`/transactions/${d.transaction_id}`}>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-slate-800">{d.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{d.transaction_address}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className="text-xs text-slate-500">{formatDate(d.due_date)}</span>
                  {dayLabel && (
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[d.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
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
