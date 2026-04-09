'use client';

import Link from 'next/link';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { daysUntil, formatCurrency } from '@/lib/utils';
import type { TransactionListItem } from '@/lib/api';

interface UrgentPanelProps {
  transactions: TransactionListItem[];
  isLoading: boolean;
}

function UrgentRow({ tx }: { tx: TransactionListItem }) {
  const days = daysUntil(tx.closing_date);
  const isOverdue = days !== null && days < 0;
  const isToday   = days === 0;
  const isUrgent  = days !== null && days <= 3;

  const chipColor  = isOverdue || isToday ? '#f87171' : isUrgent ? '#fbbf24' : '#fb923c';
  const chipBg     = isOverdue || isToday ? 'rgba(239,68,68,0.1)' : isUrgent ? 'rgba(245,158,11,0.1)' : 'rgba(249,115,22,0.1)';
  const dayLabel   = isOverdue
    ? `${Math.abs(days!)} day${Math.abs(days!) !== 1 ? 's' : ''} overdue`
    : isToday ? 'Closing today'
    : `${days}d left`;

  return (
    <Link href={`/transactions/${tx.id}`} className="block">
      <div
        className="flex items-center justify-between py-2.5 px-2 rounded-lg transition-all duration-150 cursor-pointer"
        style={{ gap: '0.75rem' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.05)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate" style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary)' }}>{tx.address}</p>
          <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '1px' }}>{formatCurrency(tx.purchase_price ?? null)}</p>
        </div>
        <span className="shrink-0 rounded-full px-2.5 py-0.5" style={{
          fontSize: '0.6875rem',
          fontWeight: 700,
          color: chipColor,
          background: chipBg,
          border: `1px solid ${chipColor}30`,
          letterSpacing: '0.03em',
          whiteSpace: 'nowrap',
        }}>
          {dayLabel}
        </span>
      </div>
    </Link>
  );
}

export function UrgentPanel({ transactions, isLoading }: UrgentPanelProps) {
  const urgent = transactions
    .filter((t) => { const d = daysUntil(t.closing_date); return d !== null && d <= 7; })
    .sort((a, b) => (daysUntil(a.closing_date) ?? 999) - (daysUntil(b.closing_date) ?? 999));

  return (
    <div className="rounded-2xl p-5 h-full" style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
    }}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <AlertTriangle className="h-4 w-4" style={{ color: '#f87171' }} />
        </div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
          Needs Attention
        </h2>
        {urgent.length > 0 && (
          <span className="ml-auto rounded-full px-2 py-0.5" style={{
            fontSize: '0.625rem', fontWeight: 700, background: 'rgba(239,68,68,0.12)',
            color: '#f87171', border: '1px solid rgba(239,68,68,0.2)',
          }}>
            {urgent.length}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-10 lex-skeleton rounded-lg" />)}
        </div>
      ) : urgent.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full mb-3" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <CheckCircle className="h-5 w-5" style={{ color: '#34d399' }} />
          </div>
          <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>All clear</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>No closings in the next 7 days</p>
        </div>
      ) : (
        <div style={{ borderTop: '1px solid rgba(148,163,184,0.07)' }}>
          {urgent.map((tx) => <UrgentRow key={tx.id} tx={tx} />)}
        </div>
      )}
    </div>
  );
}
