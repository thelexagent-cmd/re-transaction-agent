'use client';

import Link from 'next/link';
import { daysUntil, formatDate, getSimpleDealStatus, type DealStatus } from '@/lib/utils';
import type { TransactionListItem } from '@/lib/api';

interface DealCardProps {
  transaction: TransactionListItem;
  alertCount?: number;
  pendingDocs?: number;
  deadlinesThisWeek?: number;
}

const STATUS_CONFIG: Record<DealStatus, { label: string; strip: string }> = {
  on_track:        { label: 'ON TRACK',       strip: '#10b981' },
  at_risk:         { label: 'AT RISK',         strip: '#f59e0b' },
  needs_attention: { label: 'ACTION REQ.',     strip: '#ef4444' },
};

const PIPELINE_COLORS: Record<string, string> = {
  active:         '#60a5fa',
  under_contract: '#a78bfa',
  inspection:     '#fb923c',
  financing:      '#f472b6',
  clear_to_close: '#34d399',
  closed:         '#6b7280',
  cancelled:      '#4b5563',
};

const PIPELINE_LABELS: Record<string, string> = {
  active:         'ACTIVE',
  under_contract: 'UNDER CONTRACT',
  inspection:     'INSPECTION',
  financing:      'FINANCING',
  clear_to_close: 'CLEAR TO CLOSE',
  closed:         'CLOSED',
  cancelled:      'CANCELLED',
};

function ProgressBar({ days }: { days: number | null }) {
  if (days === null) return null;
  const total = 45;
  const pct = Math.min(100, Math.max(0, Math.round(((total - Math.max(0, days)) / total) * 100)));
  const color = days <= 0 ? '#ef4444' : days <= 7 ? '#f59e0b' : days <= 14 ? '#fb923c' : '#3b82f6';
  return (
    <div style={{ marginTop: '10px' }}>
      <div style={{
        height: '2px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '1px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', left: 0, top: 0,
          height: '100%', width: `${pct}%`,
          background: color,
        }} />
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', marginTop: '4px',
        fontFamily: 'var(--font-mono)', fontSize: '0.5rem',
        color: 'var(--text-muted)', letterSpacing: '0.08em',
      }}>
        <span>CONTRACT</span>
        <span style={{ color }}>{pct}%</span>
        <span>CLOSE</span>
      </div>
    </div>
  );
}

export function DealCard({ transaction, alertCount = 0, pendingDocs = 0, deadlinesThisWeek = 0 }: DealCardProps) {
  const status = getSimpleDealStatus(transaction);
  const { label: statusLabel, strip } = STATUS_CONFIG[status];
  const days = daysUntil(transaction.closing_date);
  const pipelineColor = PIPELINE_COLORS[transaction.status] ?? '#6b7280';
  const pipelineLabel = PIPELINE_LABELS[transaction.status] ?? transaction.status.toUpperCase();

  const countdownColor = days === null ? 'var(--text-muted)'
    : days <= 0  ? '#ef4444'
    : days <= 7  ? '#f59e0b'
    : days <= 14 ? '#fb923c'
    : 'var(--text-primary)';

  return (
    <Link href={`/transactions/${transaction.id}`} className="block h-full">
      <div
        style={{
          position: 'relative',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderLeft: `3px solid ${strip}`,
          borderRadius: '6px',
          padding: '14px 15px 12px',
          height: '100%',
          boxShadow: '0 2px 16px rgba(0,0,0,0.45)',
          transition: 'border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = `${strip}40`;
          el.style.borderLeftColor = strip;
          el.style.boxShadow = `0 0 0 1px ${strip}18, 0 6px 28px rgba(0,0,0,0.55)`;
          el.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = 'var(--border)';
          el.style.borderLeftColor = strip;
          el.style.boxShadow = '0 2px 16px rgba(0,0,0,0.45)';
          el.style.transform = 'translateY(0)';
        }}
      >

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
          <div style={{ minWidth: 0 }}>
            {/* Pipeline stage */}
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.5rem',
              letterSpacing: '0.14em',
              color: pipelineColor,
              fontWeight: 700,
              marginBottom: '4px',
            }}>
              {pipelineLabel}
            </div>
            {/* Address */}
            <div style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '0.01em',
              lineHeight: 1.35,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {transaction.address}
            </div>
          </div>

          {/* Status chip */}
          <div style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 6px',
            border: `1px solid ${strip}30`,
            borderRadius: '3px',
            background: `${strip}0d`,
          }}>
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: strip }} />
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.475rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: strip,
              whiteSpace: 'nowrap',
            }}>
              {statusLabel}
            </span>
          </div>
        </div>

        {/* ── Countdown ── */}
        <div>
          {days !== null ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '2.875rem',
                fontWeight: 700,
                lineHeight: 1,
                color: countdownColor,
                letterSpacing: '-0.04em',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {Math.abs(days)}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.5rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  color: countdownColor,
                }}>
                  {days < 0 ? 'DAYS OVERDUE' : days === 0 ? 'CLOSING TODAY' : 'DAYS TO CLOSE'}
                </span>
                {transaction.closing_date && (
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.5rem',
                    color: 'var(--text-muted)',
                    letterSpacing: '0.06em',
                  }}>
                    {formatDate(transaction.closing_date).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
              letterSpacing: '0.08em',
            }}>
              NO CLOSING DATE SET
            </span>
          )}
        </div>

        {/* ── Progress bar ── */}
        <ProgressBar days={days} />

        {/* ── Footer stats ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1px 1fr 1px 1fr',
          marginTop: '10px',
          paddingTop: '10px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          alignItems: 'center',
        }}>
          {[
            { val: pendingDocs,        label: 'DOCS',      warn: pendingDocs > 0,        color: '#f59e0b' },
            { val: deadlinesThisWeek,  label: 'DEADLINES', warn: deadlinesThisWeek > 0,  color: '#fb923c' },
            { val: alertCount,         label: 'ALERTS',    warn: alertCount > 0,          color: '#ef4444' },
          ].flatMap(({ val, label: lbl, warn, color }, i) => {
            const items: React.ReactNode[] = [
              <div key={lbl} style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: warn ? color : 'var(--text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}>
                  {val}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.4375rem',
                  color: warn ? `${color}99` : 'var(--text-muted)',
                  letterSpacing: '0.1em',
                  marginTop: '3px',
                }}>
                  {lbl}
                </div>
              </div>
            ];
            if (i < 2) {
              items.push(<div key={`sep-${i}`} style={{ height: '24px', background: 'rgba(255,255,255,0.05)', width: '1px' }} />);
            }
            return items;
          })}
        </div>

      </div>
    </Link>
  );
}
