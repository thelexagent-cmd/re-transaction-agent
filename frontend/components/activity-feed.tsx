'use client';

import Link from 'next/link';
import { Activity, Mail, Bell, FileText, UserPlus, CheckCircle2 } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import type { RecentEventItem } from '@/lib/api';

const EVENT_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  email_sent:          { icon: <Mail className="h-3.5 w-3.5" />,         color: '#60a5fa', bg: 'rgba(59,130,246,0.1)' },
  sms_sent:            { icon: <Bell className="h-3.5 w-3.5" />,         color: '#c084fc', bg: 'rgba(192,132,252,0.1)' },
  broker_alert:        { icon: <Bell className="h-3.5 w-3.5" />,         color: '#fb923c', bg: 'rgba(249,115,22,0.1)' },
  document_collected:  { icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: '#34d399', bg: 'rgba(16,185,129,0.1)' },
  contract_parsed:     { icon: <FileText className="h-3.5 w-3.5" />,     color: '#60a5fa', bg: 'rgba(59,130,246,0.1)' },
  transaction_created: { icon: <UserPlus className="h-3.5 w-3.5" />,     color: '#60a5fa', bg: 'rgba(59,130,246,0.1)' },
};

const DEFAULT_EVENT = { icon: <Activity className="h-3.5 w-3.5" />, color: 'var(--text-secondary)', bg: 'rgba(148,163,184,0.08)' };

function EventRow({ event }: { event: RecentEventItem }) {
  const cfg = EVENT_CONFIG[event.event_type] ?? DEFAULT_EVENT;

  return (
    <Link href={`/transactions/${event.transaction_id}`} className="block">
      <div
        className="flex gap-3 py-2.5 px-2 rounded-lg transition-all duration-150 cursor-pointer"
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.05)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: cfg.bg, color: cfg.color }}>
          {cfg.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2" style={{ fontSize: '0.75rem', color: '#cbd5e1', lineHeight: 1.4 }}>{event.description}</p>
          <p className="truncate mt-0.5" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{event.transaction_address}</p>
        </div>
        <p className="shrink-0 mt-0.5 whitespace-nowrap" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
          {formatDateTime(event.created_at)}
        </p>
      </div>
    </Link>
  );
}

interface ActivityFeedProps {
  events: RecentEventItem[];
  isLoading: boolean;
}

export function ActivityFeed({ events, isLoading }: ActivityFeedProps) {
  return (
    <div className="rounded-2xl p-5 h-full" style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
    }}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <Activity className="h-4 w-4" style={{ color: '#60a5fa' }} />
        </div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
          Recent Activity
        </h2>
        {events.length > 0 && (
          <span className="ml-auto" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{events.length} events</span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-10 lex-skeleton rounded-lg" />)}
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full mb-3" style={{ background: 'rgba(148,163,184,0.07)', border: '1px solid var(--border)' }}>
            <Activity className="h-5 w-5" style={{ color: 'var(--text-muted)' }} />
          </div>
          <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>No activity yet</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Events will appear here as the app works</p>
        </div>
      ) : (
        <div className="overflow-y-auto" style={{ maxHeight: '18rem', borderTop: '1px solid rgba(148,163,184,0.07)' }}>
          {events.map((event) => <EventRow key={event.id} event={event} />)}
        </div>
      )}
    </div>
  );
}
