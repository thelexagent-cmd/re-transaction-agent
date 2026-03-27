'use client';

import Link from 'next/link';
import { cn, daysUntil, formatDate, getSimpleDealStatus, type DealStatus } from '@/lib/utils';
import type { TransactionListItem } from '@/lib/api';
import { MapPin, Calendar } from 'lucide-react';

interface DealCardProps {
  transaction: TransactionListItem;
  alertCount?: number;
  pendingDocs?: number;
  deadlinesThisWeek?: number;
}

const statusConfig: Record<DealStatus, { label: string; badgeClass: string; accentColor: string }> = {
  on_track:         { label: 'On Track',        badgeClass: 'lex-badge-green', accentColor: 'rgba(16,185,129,0.0)' },
  at_risk:          { label: 'At Risk',          badgeClass: 'lex-badge-amber', accentColor: 'rgba(245,158,11,0.06)' },
  needs_attention:  { label: 'Needs Attention',  badgeClass: 'lex-badge-red',   accentColor: 'rgba(239,68,68,0.06)' },
};

function ClosingProgress({ days }: { days: number | null }) {
  if (days === null) return null;
  const total = 45;
  const pct = Math.min(100, Math.max(0, Math.round(((total - Math.max(0, days)) / total) * 100)));
  const color = days <= 0 ? '#ef4444' : days <= 7 ? '#f59e0b' : days <= 14 ? '#f97316' : '#3b82f6';
  return (
    <div className="mt-3 mb-1">
      <div className="flex justify-between mb-1" style={{ fontSize: '0.625rem', color: '#3d5068', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        <span>Progress</span>
        <span>{pct}%</span>
      </div>
      <div className="lex-progress">
        <div className="lex-progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export function DealCard({ transaction, alertCount = 0, pendingDocs = 0, deadlinesThisWeek = 0 }: DealCardProps) {
  const status = getSimpleDealStatus(transaction);
  const { label, badgeClass, accentColor } = statusConfig[status];
  const days = daysUntil(transaction.closing_date);

  const countdownColor = days === null ? '#4a5568'
    : days <= 0  ? '#f87171'
    : days <= 7  ? '#fbbf24'
    : days <= 14 ? '#fb923c'
    : '#f1f5f9';

  return (
    <Link href={`/transactions/${transaction.id}`} className="block h-full">
      <div
        className="rounded-2xl p-5 h-full transition-all duration-200 cursor-pointer"
        style={{
          background: `linear-gradient(145deg, var(--bg-surface) 0%, ${accentColor || 'var(--bg-surface)'} 100%)`,
          border: '1px solid rgba(148,163,184,0.09)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = 'rgba(59,130,246,0.3)';
          el.style.boxShadow = '0 0 0 1px rgba(59,130,246,0.15), 0 8px 32px rgba(0,0,0,0.4)';
          el.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = 'rgba(148,163,184,0.09)';
          el.style.boxShadow = '0 4px 24px rgba(0,0,0,0.35)';
          el.style.transform = 'translateY(0)';
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-start gap-2 min-w-0">
            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: '#3d5068' }} />
            <h3 className="leading-snug truncate" style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '0.8rem',
              fontWeight: 600,
              letterSpacing: '0.04em',
              color: '#e2e8f0',
            }}>
              {transaction.address}
            </h3>
          </div>
          <span className={cn('lex-badge shrink-0', badgeClass)}>
            <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ background: 'currentColor' }} />
            {label}
          </span>
        </div>

        {/* Countdown */}
        <div className="mb-1">
          {days !== null ? (
            <div className="flex items-baseline gap-1.5">
              <span style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '2.75rem',
                fontWeight: 700,
                lineHeight: 1,
                color: countdownColor,
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {Math.abs(days)}
              </span>
              <span style={{ fontSize: '0.8125rem', color: '#4a5568', fontWeight: 500 }}>
                {days < 0 ? 'days overdue' : days === 0 ? 'closing today' : 'days to close'}
              </span>
            </div>
          ) : (
            <span style={{ fontSize: '0.875rem', color: '#3d5068' }}>No closing date</span>
          )}
        </div>

        {/* Date */}
        {transaction.closing_date && (
          <div className="flex items-center gap-1.5" style={{ color: '#3d5068', fontSize: '0.75rem' }}>
            <Calendar className="h-3 w-3" />
            <span>{formatDate(transaction.closing_date)}</span>
          </div>
        )}

        {/* Progress */}
        <ClosingProgress days={days} />

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-center mt-3 pt-3" style={{ borderTop: '1px solid rgba(148,163,184,0.07)' }}>
          {[
            { val: pendingDocs,       label: 'Docs',      warn: pendingDocs > 0,      color: '#fbbf24' },
            { val: deadlinesThisWeek, label: 'Deadlines', warn: deadlinesThisWeek > 0, color: '#fb923c' },
            { val: alertCount,        label: 'Alerts',    warn: alertCount > 0,        color: '#f87171' },
          ].map(({ val, label: lbl, warn, color }) => (
            <div key={lbl}>
              <div style={{ fontSize: '1.0625rem', fontWeight: 700, color: warn ? color : '#3d5068', fontVariantNumeric: 'tabular-nums' }}>{val}</div>
              <div style={{ fontSize: '0.5875rem', color: '#2d3f55', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{lbl}</div>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}
