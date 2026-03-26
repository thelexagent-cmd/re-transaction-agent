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
import { NotificationBell } from '@/components/notification-center';
import { DealHealthScore } from '@/components/deal-health-score';
import { Plus, AlertCircle, TrendingUp, Calendar, FileCheck, Search, ChevronDown, Timer } from 'lucide-react';
import type { TransactionListItem } from '@/lib/api';

function countClosingThisMonth(transactions: TransactionListItem[]): number {
  return transactions.filter((t) => {
    const days = daysUntil(t.closing_date);
    return days !== null && days >= 0 && days <= 30;
  }).length;
}

// Closing Countdown Widget
function ClosingCountdown({ transactions }: { transactions: TransactionListItem[] }) {
  const upcoming = transactions
    .filter((t) => {
      const d = daysUntil(t.closing_date);
      return d !== null && d >= 0;
    })
    .sort((a, b) => {
      const da = daysUntil(a.closing_date) ?? 999;
      const db = daysUntil(b.closing_date) ?? 999;
      return da - db;
    })
    .slice(0, 3);

  if (upcoming.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Timer className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-slate-900">Next Closings</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {upcoming.map((tx) => {
          const days = daysUntil(tx.closing_date) ?? 0;
          const urgency = days === 0 ? 'bg-red-50 border-red-200' : days <= 7 ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200';
          const textColor = days === 0 ? 'text-red-700' : days <= 7 ? 'text-orange-700' : 'text-blue-700';
          const numColor = days === 0 ? 'text-red-600' : days <= 7 ? 'text-orange-600' : 'text-blue-600';
          return (
            <Link key={tx.id} href={`/transactions/${tx.id}`}>
              <div className={`rounded-lg border p-3 hover:shadow-sm transition-shadow ${urgency}`}>
                <div className="text-xs text-slate-600 font-medium truncate mb-1">{tx.address}</div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-2xl font-bold tabular-nums ${numColor}`}>{days}</span>
                  <span className={`text-xs ${textColor}`}>{days === 0 ? 'TODAY' : days === 1 ? 'day left' : 'days left'}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">Closes {formatDate(tx.closing_date)}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  const { data: transactions, error, isLoading } = useSWR(
    '/transactions',
    getTransactions,
    { refreshInterval: 30000 }
  );

  const { data: activityData, isLoading: activityLoading } = useSWR(
    '/events/recent',
    () => getRecentEvents(15),
    { refreshInterval: 60000 }
  );

  const { data: allDeadlines } = useSWR('/deadlines/all', getAllDeadlines, { refreshInterval: 60000 });
  const { data: allDocuments } = useSWR('/documents/all', getAllDocuments, { refreshInterval: 60000 });

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string>('all');

  const totalDeals = transactions?.length ?? 0;
  const activeDeals = transactions?.filter((t) => t.status === 'active').length ?? 0;
  const closingThisMonth = transactions ? countClosingThisMonth(transactions) : 0;
  const missedDeadlines = allDeadlines?.filter((d) => d.status === 'missed').length ?? 0;
  const overdueDocs = allDocuments?.filter((d) => d.status === 'overdue').length ?? 0;

  // Filtered transactions
  const filtered = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter((tx) => {
      const matchSearch =
        !search ||
        tx.address.toLowerCase().includes(search.toLowerCase()) ||
        tx.property_type.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || tx.status === statusFilter;
      const matchType = propertyTypeFilter === 'all' || tx.property_type === propertyTypeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [transactions, search, statusFilter, propertyTypeFilter]);

  const propertyTypes = useMemo(() => {
    if (!transactions) return [];
    return [...new Set(transactions.map((t) => t.property_type))];
  }, [transactions]);

  return (
    <div className="p-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Active Deals</h1>
          <p className="text-sm text-slate-500 mt-1">Manage all your real estate transactions</p>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <Link
            href="/transactions/new"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Transaction
          </Link>
        </div>
      </div>

      {/* Stats Bar - 4 cards now */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{isLoading ? '—' : activeDeals}</div>
              <div className="text-xs text-slate-500">Active Deals</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
              <FileCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{isLoading ? '—' : totalDeals}</div>
              <div className="text-xs text-slate-500">Total Transactions</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50">
              <Calendar className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{isLoading ? '—' : closingThisMonth}</div>
              <div className="text-xs text-slate-500">Closing This Month</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{isLoading ? '—' : missedDeadlines + overdueDocs}</div>
              <div className="text-xs text-slate-500">Overdue Items</div>
            </div>
          </div>
        </div>
      </div>

      {/* Closing Countdown */}
      {transactions && transactions.length > 0 && (
        <ClosingCountdown transactions={transactions} />
      )}

      {/* Urgent + Activity panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <UrgentPanel transactions={transactions ?? []} isLoading={isLoading} />
        <ActivityFeed events={activityData?.events ?? []} isLoading={activityLoading} />
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by address or property type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={propertyTypeFilter}
            onChange={(e) => setPropertyTypeFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Property Types</option>
            {propertyTypes.map((pt) => (
              <option key={pt} value={pt}>{pt.toUpperCase()}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 flex items-center gap-3 mb-6">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <div>
            <div className="text-sm font-medium text-red-700">Failed to load transactions</div>
            <div className="text-xs text-red-600 mt-0.5">{error.message}</div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <Skeleton className="h-5 w-3/4 mb-3" />
              <Skeleton className="h-8 w-1/3 mb-4" />
              <Skeleton className="h-4 w-1/2 mb-3" />
              <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100">
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Deal Grid */}
      {!isLoading && !error && transactions && (
        <>
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 mx-auto mb-4">
                <TrendingUp className="h-8 w-8 text-slate-400" />
              </div>
              {transactions.length === 0 ? (
                <>
                  <h3 className="text-base font-semibold text-slate-900 mb-1">No transactions yet</h3>
                  <p className="text-sm text-slate-500 mb-2">Add your first transaction to get started.</p>
                  <p className="text-xs text-slate-400 mb-6 max-w-sm mx-auto">
                    Once added, the app will automatically email all parties, track document deadlines, and send reminders so you don&apos;t have to.
                  </p>
                  <Link
                    href="/transactions/new"
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    New Transaction
                  </Link>
                </>
              ) : (
                <>
                  <h3 className="text-base font-semibold text-slate-900 mb-1">No results found</h3>
                  <p className="text-sm text-slate-500">Try adjusting your search or filters.</p>
                </>
              )}
            </div>
          ) : (
            <>
              {(search || statusFilter !== 'all' || propertyTypeFilter !== 'all') && (
                <p className="text-sm text-slate-500 mb-4">
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
