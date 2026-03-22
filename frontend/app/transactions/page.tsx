'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { getTransactions } from '@/lib/api';
import { daysUntil } from '@/lib/utils';
import { DealCard } from '@/components/deal-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, AlertCircle, TrendingUp, Calendar } from 'lucide-react';
import type { TransactionListItem } from '@/lib/api';

function countClosingThisWeek(transactions: TransactionListItem[]): number {
  return transactions.filter((t) => {
    const days = daysUntil(t.closing_date);
    return days !== null && days >= 0 && days <= 7;
  }).length;
}

export default function TransactionsPage() {
  const { data: transactions, error, isLoading } = useSWR(
    '/transactions',
    getTransactions,
    { refreshInterval: 30000 }
  );

  const totalDeals = transactions?.length ?? 0;
  const activeDeals = transactions?.filter((t) => t.status === 'active').length ?? 0;
  const closingThisWeek = transactions ? countClosingThisWeek(transactions) : 0;

  return (
    <div className="p-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Active Deals</h1>
          <p className="text-sm text-slate-500 mt-1">Manage all your real estate transactions</p>
        </div>
        <Link
          href="/transactions/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Transaction
        </Link>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{isLoading ? '—' : totalDeals}</div>
              <div className="text-xs text-slate-500">Total Transactions</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{isLoading ? '—' : activeDeals}</div>
              <div className="text-xs text-slate-500">Active Deals</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50">
              <Calendar className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{isLoading ? '—' : closingThisWeek}</div>
              <div className="text-xs text-slate-500">Closing This Week</div>
            </div>
          </div>
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
          {transactions.length === 0 ? (
            <div className="text-center py-20">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 mx-auto mb-4">
                <TrendingUp className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-1">No transactions yet</h3>
              <p className="text-sm text-slate-500 mb-6">Create your first transaction to get started</p>
              <Link
                href="/transactions/new"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                New Transaction
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {transactions.map((tx) => (
                <DealCard key={tx.id} transaction={tx} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
