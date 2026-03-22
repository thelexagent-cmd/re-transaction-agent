'use client';

import Link from 'next/link';
import { cn, daysUntil, formatDate, getSimpleDealStatus, type DealStatus } from '@/lib/utils';
import type { TransactionListItem } from '@/lib/api';
import { MapPin, Calendar, AlertCircle } from 'lucide-react';

interface DealCardProps {
  transaction: TransactionListItem;
  alertCount?: number;
  pendingDocs?: number;
  deadlinesThisWeek?: number;
}

const statusConfig: Record<DealStatus, { label: string; dotClass: string; badgeClass: string }> = {
  on_track: {
    label: 'On Track',
    dotClass: 'bg-green-500',
    badgeClass: 'bg-green-50 text-green-700 border-green-200',
  },
  at_risk: {
    label: 'At Risk',
    dotClass: 'bg-yellow-500',
    badgeClass: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  },
  needs_attention: {
    label: 'Needs Attention',
    dotClass: 'bg-red-500',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
  },
};

export function DealCard({ transaction, alertCount = 0, pendingDocs = 0, deadlinesThisWeek = 0 }: DealCardProps) {
  const status = getSimpleDealStatus(transaction);
  const { label, dotClass, badgeClass } = statusConfig[status];
  const days = daysUntil(transaction.closing_date);

  return (
    <Link href={`/transactions/${transaction.id}`}>
      <div
        className={cn(
          'rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer p-5',
          status === 'needs_attention' ? 'border-red-200' : 'border-slate-200'
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-start gap-2 min-w-0">
            <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
            <h3 className="text-sm font-semibold text-slate-900 leading-snug truncate">
              {transaction.address}
            </h3>
          </div>
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
              badgeClass
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', dotClass)} />
            {label}
          </span>
        </div>

        {/* Days Until Closing */}
        <div className="mb-4">
          {days !== null ? (
            <div className="flex items-baseline gap-1">
              <span
                className={cn(
                  'text-3xl font-bold tabular-nums',
                  days <= 0 ? 'text-red-600' : days <= 7 ? 'text-yellow-600' : 'text-slate-900'
                )}
              >
                {Math.abs(days)}
              </span>
              <span className="text-sm text-slate-500">
                {days < 0 ? 'days overdue' : days === 0 ? 'closing today' : 'days until closing'}
              </span>
            </div>
          ) : (
            <span className="text-slate-400 text-sm">No closing date set</span>
          )}
        </div>

        {/* Closing date */}
        {transaction.closing_date && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
            <Calendar className="h-3.5 w-3.5" />
            <span>Closes {formatDate(transaction.closing_date)}</span>
          </div>
        )}

        {/* Stats row */}
        <div className="border-t border-slate-100 pt-3 mt-1 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-sm font-semibold text-slate-900">{pendingDocs}</div>
            <div className="text-xs text-slate-500">docs pending</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">{deadlinesThisWeek}</div>
            <div className="text-xs text-slate-500">deadlines</div>
          </div>
          <div>
            <div className={cn('text-sm font-semibold', alertCount > 0 ? 'text-red-600' : 'text-slate-900')}>
              {alertCount > 0 && <AlertCircle className="h-3.5 w-3.5 inline mr-0.5" />}
              {alertCount}
            </div>
            <div className="text-xs text-slate-500">alerts</div>
          </div>
        </div>
      </div>
    </Link>
  );
}
