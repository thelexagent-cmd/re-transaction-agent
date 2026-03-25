'use client';

import Link from 'next/link';
import { Activity, Mail, Bell, FileText, UserPlus, CheckCircle2 } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import type { RecentEventItem } from '@/lib/api';

const EVENT_ICONS: Record<string, React.ReactNode> = {
  email_sent: <Mail className="h-3.5 w-3.5" />,
  sms_sent: <Bell className="h-3.5 w-3.5" />,
  broker_alert: <Bell className="h-3.5 w-3.5 text-orange-500" />,
  document_collected: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  contract_parsed: <FileText className="h-3.5 w-3.5 text-blue-500" />,
  transaction_created: <UserPlus className="h-3.5 w-3.5 text-blue-500" />,
};

const EVENT_COLORS: Record<string, string> = {
  email_sent: 'bg-blue-50',
  sms_sent: 'bg-purple-50',
  broker_alert: 'bg-orange-50',
  document_collected: 'bg-green-50',
  contract_parsed: 'bg-blue-50',
  transaction_created: 'bg-blue-50',
};

function EventRow({ event }: { event: RecentEventItem }) {
  const icon = EVENT_ICONS[event.event_type] ?? <Activity className="h-3.5 w-3.5" />;
  const color = EVENT_COLORS[event.event_type] ?? 'bg-slate-50';

  return (
    <Link href={`/transactions/${event.transaction_id}`} className="block">
      <div className="flex gap-3 py-2.5 px-1 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer">
        <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${color}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-700 leading-snug line-clamp-2">{event.description}</p>
          <p className="text-xs text-slate-400 mt-0.5 truncate">{event.transaction_address}</p>
        </div>
        <p className="text-xs text-slate-400 shrink-0 mt-0.5 whitespace-nowrap">
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
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
          <Activity className="h-4 w-4 text-blue-500" />
        </div>
        <h2 className="text-sm font-semibold text-slate-800">Recent Activity</h2>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Activity className="h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-600">No activity yet</p>
          <p className="text-xs text-slate-400 mt-1">Events will appear here as the app works</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-y-auto max-h-72">
          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
