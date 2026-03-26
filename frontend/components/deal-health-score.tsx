'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { getDocumentSummary, getDeadlines } from '@/lib/api';
import { daysUntil } from '@/lib/utils';
import type { TransactionListItem } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Props {
  transaction: TransactionListItem;
  size?: 'sm' | 'md';
}

export function computeHealthScore(
  tx: TransactionListItem,
  docSummary?: { total: number; collected: number; pending: number; overdue: number } | null,
  missedDeadlines?: number,
  warningDeadlines?: number
): number {
  let score = 100;

  // Days until close penalty
  const days = daysUntil(tx.closing_date);
  if (days !== null) {
    if (days < 0) score -= 30; // past closing
    else if (days === 0) score -= 20; // closing today
    else if (days <= 3) score -= 15;
    else if (days <= 7) score -= 8;
  }

  // Document collection penalty
  if (docSummary && docSummary.total > 0) {
    const pct = docSummary.collected / docSummary.total;
    if (pct < 0.25) score -= 25;
    else if (pct < 0.5) score -= 15;
    else if (pct < 0.75) score -= 8;
    score -= docSummary.overdue * 5; // -5 per overdue doc
  }

  // Deadline penalties
  if (missedDeadlines) score -= missedDeadlines * 15;
  if (warningDeadlines) score -= warningDeadlines * 5;

  // Status penalty
  if (tx.status === 'cancelled') score = 0;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function HealthBadge({ score, size = 'sm' }: { score: number; size?: 'sm' | 'md' }) {
  const color =
    score >= 75 ? 'bg-green-100 text-green-800 border-green-200' :
    score >= 50 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
    'bg-red-100 text-red-800 border-red-200';

  const label = score >= 75 ? 'Healthy' : score >= 50 ? 'At Risk' : 'Critical';

  if (size === 'md') {
    return (
      <div className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold', color)}>
        <span className="text-sm font-bold tabular-nums">{score}</span>
        <span>{label}</span>
      </div>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold', color)}>
      {score}
    </span>
  );
}

// Circular gauge for use on transaction detail
export function HealthGauge({ score }: { score: number }) {
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;

  const stroke =
    score >= 75 ? '#22c55e' :
    score >= 50 ? '#eab308' :
    '#ef4444';

  const label = score >= 75 ? 'Healthy' : score >= 50 ? 'At Risk' : 'Critical';
  const textColor = score >= 75 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
          <circle cx="36" cy="36" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="7" />
          <circle
            cx="36" cy="36" r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth="7"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('text-lg font-bold tabular-nums', textColor)}>{score}</span>
        </div>
      </div>
      <span className={cn('text-xs font-semibold mt-1', textColor)}>{label}</span>
    </div>
  );
}

// Full component that fetches its own data
export function DealHealthScore({ transaction, size = 'sm' }: Props) {
  const { data: docSummary } = useSWR(
    `/transactions/${transaction.id}/documents/summary`,
    () => getDocumentSummary(transaction.id),
    { revalidateOnFocus: false }
  );
  const { data: deadlines } = useSWR(
    `/transactions/${transaction.id}/deadlines`,
    () => getDeadlines(transaction.id),
    { revalidateOnFocus: false }
  );

  const missed = deadlines?.deadlines?.filter((d) => d.status === 'missed').length ?? 0;
  const warning = deadlines?.deadlines?.filter((d) => d.status === 'warning').length ?? 0;

  const score = useMemo(
    () => computeHealthScore(transaction, docSummary ?? null, missed, warning),
    [transaction, docSummary, missed, warning]
  );

  return <HealthBadge score={score} size={size} />;
}
