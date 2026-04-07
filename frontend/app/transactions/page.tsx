'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import { getTransactions, getRecentEvents, getAllDeadlines, getAllDocuments } from '@/lib/api';
import { daysUntil, formatDate } from '@/lib/utils';
import { DealCard } from '@/components/deal-card';
import { UrgentPanel } from '@/components/urgent-panel';
import { ActivityFeed } from '@/components/activity-feed';
import { Skeleton } from '@/components/ui/skeleton';
import { DealHealthScore } from '@/components/deal-health-score';
import {
  Plus, AlertCircle, TrendingUp,
  Search, ChevronDown, Timer,
} from 'lucide-react';
import type { TransactionListItem } from '@/lib/api';

function countClosingThisMonth(transactions: TransactionListItem[]): number {
  return transactions.filter((t) => {
    const days = daysUntil(t.closing_date);
    return days !== null && days >= 0 && days <= 30;
  }).length;
}

// ── Closing Countdown ──────────────────────────────────────────
function ClosingCountdown({ transactions }: { transactions: TransactionListItem[] }) {
  const upcoming = transactions
    .filter((t) => { const d = daysUntil(t.closing_date); return d !== null && d >= 0; })
    .sort((a, b) => (daysUntil(a.closing_date) ?? 999) - (daysUntil(b.closing_date) ?? 999))
    .slice(0, 3);

  if (upcoming.length === 0) return null;

  return (
    <div className="rounded-2xl p-5 mb-6" style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
    }}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <Timer className="h-4 w-4" style={{ color: '#60a5fa' }} />
        </div>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
          Next Closings
        </h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {upcoming.map((tx) => {
          const days = daysUntil(tx.closing_date) ?? 0;
          const isToday  = days === 0;
          const isUrgent = days <= 7;
          const color  = isToday ? '#f87171' : isUrgent ? '#fbbf24' : '#60a5fa';
          const bg     = isToday ? 'rgba(239,68,68,0.07)' : isUrgent ? 'rgba(245,158,11,0.07)' : 'rgba(59,130,246,0.07)';
          const border = isToday ? 'rgba(239,68,68,0.2)' : isUrgent ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.2)';

          return (
            <Link key={tx.id} href={`/transactions/${tx.id}`}>
              <div
                className="rounded-xl p-3.5 transition-all duration-150"
                style={{ background: bg, border: `1px solid ${border}` }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
              >
                <div className="truncate mb-1.5" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{tx.address}</div>
                <div className="flex items-baseline gap-1">
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 700, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    {days}
                  </span>
                  <span style={{ fontSize: '0.75rem', color, fontWeight: 600 }}>
                    {isToday ? 'TODAY' : days === 1 ? 'day left' : 'days left'}
                  </span>
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Closes {formatDate(tx.closing_date)}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────
function StatCard({ value, label, accentColor, isLoading }: {
  value: number;
  label: string;
  accentColor: string;
  isLoading: boolean;
}) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderTop: `2px solid ${accentColor}`,
      borderRadius: '6px',
      padding: '14px 16px 12px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.475rem',
        fontWeight: 700,
        letterSpacing: '0.14em',
        color: accentColor,
        marginBottom: '6px',
      }}>
        {label.toUpperCase()}
      </div>
      {isLoading
        ? <Skeleton className="h-8 w-12" />
        : <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '2rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            lineHeight: 1,
            letterSpacing: '-0.03em',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {value}
          </div>
      }
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function TransactionsPage() {
  const { data: transactions, error, isLoading } = useSWR('/transactions', getTransactions, { refreshInterval: 30000 });
  const { data: activityData, isLoading: activityLoading } = useSWR('/events/recent', () => getRecentEvents(15), { refreshInterval: 60000 });
  const { data: allDeadlines } = useSWR('/deadlines/all', getAllDeadlines, { refreshInterval: 60000 });
  const { data: allDocuments } = useSWR('/documents/all', getAllDocuments, { refreshInterval: 60000 });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string>('all');

  const totalDeals       = transactions?.length ?? 0;
  const activeDeals      = transactions?.filter((t) => t.status !== 'closed' && t.status !== 'cancelled').length ?? 0;
  const closingThisMonth = transactions ? countClosingThisMonth(transactions) : 0;
  const missedDeadlines  = allDeadlines?.filter((d) => d.status === 'missed').length ?? 0;
  const overdueDocs      = allDocuments?.filter((d) => d.status === 'overdue').length ?? 0;
  const overdueCount     = missedDeadlines + overdueDocs;

  const filtered = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter((tx) => {
      const matchSearch = !search || tx.address.toLowerCase().includes(search.toLowerCase()) || tx.property_type.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || tx.status === statusFilter;
      const matchType   = propertyTypeFilter === 'all' || tx.property_type === propertyTypeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [transactions, search, statusFilter, propertyTypeFilter]);

  const propertyTypes = useMemo(() => {
    if (!transactions) return [];
    return [...new Set(transactions.map((t) => t.property_type))];
  }, [transactions]);

  return (
    <div className="p-6 md:p-8">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-primary)' }}>
            Active Deals
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px', letterSpacing: '0.02em' }}>
            Manage all your real estate transactions
          </p>
        </div>
        <Link
          href="/transactions/new"
          className="inline-flex items-center gap-2 rounded-lg text-white transition-all duration-150 active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            padding: '0.5625rem 1.125rem',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            boxShadow: '0 2px 12px rgba(59,130,246,0.25)',
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          New Transaction
        </Link>
      </div>

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard value={activeDeals}      label="Active Deals"       accentColor="#60a5fa" isLoading={isLoading} />
        <StatCard value={totalDeals}       label="Total Transactions" accentColor="#34d399" isLoading={isLoading} />
        <StatCard value={closingThisMonth} label="Closing This Month" accentColor="#fb923c" isLoading={isLoading} />
        <StatCard value={overdueCount}     label="Overdue Items"      accentColor="#f87171" isLoading={isLoading} />
      </div>

      {/* ── Closing Countdown ── */}
      {transactions && transactions.length > 0 && <ClosingCountdown transactions={transactions} />}

      {/* ── Urgent + Activity ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <UrgentPanel transactions={transactions ?? []} isLoading={isLoading} />
        <ActivityFeed events={activityData?.events ?? []} isLoading={activityLoading} />
      </div>

      {/* ── Search & Filters ── */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by address or property type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg text-sm transition-all duration-150"
            style={{
              paddingLeft: '2.25rem', paddingRight: '1rem', paddingTop: '0.5625rem', paddingBottom: '0.5625rem',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
            onFocus={(e) => { e.target.style.borderColor = 'rgba(59,130,246,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'rgba(148,163,184,0.09)'; e.target.style.boxShadow = 'none'; }}
          />
        </div>
        {[
          {
            value: statusFilter, onChange: setStatusFilter,
            options: [{ value: 'all', label: 'All Status' }, { value: 'active', label: 'Active' }, { value: 'under_contract', label: 'Under Contract' }, { value: 'inspection', label: 'Inspection' }, { value: 'financing', label: 'Financing' }, { value: 'clear_to_close', label: 'Clear to Close' }, { value: 'closed', label: 'Closed' }, { value: 'cancelled', label: 'Cancelled' }],
          },
          {
            value: propertyTypeFilter, onChange: setPropertyTypeFilter,
            options: [{ value: 'all', label: 'All Types' }, ...propertyTypes.map((pt) => ({ value: pt, label: pt.toUpperCase() }))],
          },
        ].map((sel, i) => (
          <div key={i} className="relative">
            <select
              value={sel.value}
              onChange={(e) => sel.onChange(e.target.value)}
              className="appearance-none rounded-lg text-sm pr-8 pl-3 py-2.5 transition-all duration-150"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                outline: 'none',
              }}
            >
              {sel.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
          </div>
        ))}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-xl p-4 flex items-center gap-3 mb-6" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertCircle className="h-5 w-5 shrink-0" style={{ color: '#f87171' }} />
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f87171' }}>Failed to load transactions</div>
            <div style={{ fontSize: '0.75rem', color: '#f87171', opacity: 0.7, marginTop: '1px' }}>{error.message}</div>
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <Skeleton className="h-4 w-3/4 mb-3" />
              <Skeleton className="h-10 w-1/3 mb-4" />
              <Skeleton className="h-3 w-1/2 mb-3" />
              <Skeleton className="h-2 w-full mb-4" />
              <div className="grid grid-cols-3 gap-2 mt-4 pt-3" style={{ borderTop: '1px solid rgba(148,163,184,0.07)' }}>
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Deal Grid ── */}
      {!isLoading && !error && transactions && (
        <>
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="flex h-16 w-16 items-center justify-center rounded-full mx-auto mb-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <TrendingUp className="h-8 w-8" style={{ color: 'var(--text-muted)' }} />
              </div>
              {transactions.length === 0 ? (
                <>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>No transactions yet</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '4px' }}>Add your first transaction to get started.</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', maxWidth: '28rem', marginLeft: 'auto', marginRight: 'auto' }}>
                    Once added, the app will automatically email all parties, track document deadlines, and send reminders.
                  </p>
                  <Link
                    href="/transactions/new"
                    className="inline-flex items-center gap-2 mt-6 rounded-lg text-white transition-all duration-150 active:scale-95"
                    style={{
                      background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                      padding: '0.5625rem 1.125rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      boxShadow: '0 2px 12px rgba(59,130,246,0.25)',
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New Transaction
                  </Link>
                </>
              ) : (
                <>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>No results found</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '4px' }}>Try adjusting your search or filters.</p>
                </>
              )}
            </div>
          ) : (
            <>
              {(search || statusFilter !== 'all' || propertyTypeFilter !== 'all') && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Showing {filtered.length} of {transactions.length} transactions
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filtered.map((tx) => (
                  <div key={tx.id} className="relative">
                    <DealCard transaction={tx} />
                    <div className="absolute bottom-14 right-3 pointer-events-none">
                      <DealHealthScore transaction={tx} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
