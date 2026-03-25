'use client';

import Link from 'next/link';
import { AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { daysUntil, formatDate, formatCurrency } from '@/lib/utils';
import type { TransactionListItem } from '@/lib/api';

interface UrgentPanelProps {
  transactions: TransactionListItem[];
  isLoading: boolean;
}

function UrgentRow({ tx }: { tx: TransactionListItem }) {
  const days = daysUntil(tx.closing_date);
  const isOverdue = days !== null && days < 0;
  const isToday = days === 0;
  const isUrgent = days !== null && days <= 3;

  const badgeColor = isOverdue || isToday
    ? 'bg-red-100 text-red-700'
    : isUrgent
    ? 'bg-orange-100 text-orange-700'
    : 'bg-yellow-100 text-yellow-700';

  const dayLabel = isOverdue
    ? `${Math.abs(days!)} day${Math.abs(days!) !== 1 ? 's' : ''} overdue`
    : isToday
    ? 'Closing today'
    : `${days} day${days !== 1 ? 's' : ''} left`;

  return (
    <Link href={`/transactions/${tx.id}`} className="block">
      <div className="flex items-center justify-between py-3 px-1 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800 truncate">{tx.address}</p>
          <p className="text-xs text-slate-500 mt-0.5">{formatCurrency(tx.purchase_price ?? null)}</p>
        </div>
        <span className={`ml-3 shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${badgeColor}`}>
          {dayLabel}
        </span>
      </div>
    </Link>
  );
}

export function UrgentPanel({ transactions, isLoading }: UrgentPanelProps) {
  const urgent = transactions
    .filter((t) => {
      const days = daysUntil(t.closing_date);
      return days !== null && days <= 7;
    })
    .sort((a, b) => {
      const da = daysUntil(a.closing_date) ?? 999;
      const db = daysUntil(b.closing_date) ?? 999;
      return da - db;
    });

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-500" />
        </div>
        <h2 className="text-sm font-semibold text-slate-800">Needs Attention</h2>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : urgent.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CheckCircle className="h-8 w-8 text-green-400 mb-2" />
          <p className="text-sm font-medium text-slate-600">All clear</p>
          <p className="text-xs text-slate-400 mt-1">No closings in the next 7 days</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {urgent.map((tx) => (
            <UrgentRow key={tx.id} tx={tx} />
          ))}
        </div>
      )}
    </div>
  );
}
