'use client';

import useSWR from 'swr';
import { getReportSummary } from '@/lib/api';

export default function ReportsPage() {
  const { data, error, isLoading } = useSWR('/reports/summary', getReportSummary, { revalidateOnFocus: false });

  if (isLoading) return (
    <div className="p-8 mx-auto max-w-6xl">
      <div className="mb-8">
        <div className="h-8 w-40 lex-skeleton rounded-lg mb-2" />
        <div className="h-4 w-64 lex-skeleton rounded" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1,2,3,4].map((i) => <div key={i} className="h-24 lex-skeleton rounded-2xl" />)}
      </div>
    </div>
  );

  if (error) return (
    <div className="p-8 mx-auto max-w-6xl">
      <div className="rounded-xl px-5 py-4" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.875rem', color: '#f87171' }}>
        Failed to load report data.
      </div>
    </div>
  );

  const months = data?.monthly_data || [];
  const maxCreated = Math.max(...months.map((m: any) => m.created), 1);
  const isEmpty = (data?.total_transactions ?? 0) === 0;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
          Reports
        </h1>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '4px' }}>Performance overview and transaction analytics</p>
      </div>

      {isEmpty && (
        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📊</div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>No data yet</h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
            Create your first transaction to see reports.
          </p>
        </div>
      )}

      {!isEmpty && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Transactions', value: data?.total_transactions ?? 0, color: 'var(--text-primary)' },
              { label: 'Active', value: data?.active ?? 0, color: '#34d399' },
              { label: 'Closed', value: data?.closed ?? 0, color: '#60a5fa' },
              { label: 'Avg Days to Close', value: data?.avg_days_to_close ?? '—', color: 'var(--text-primary)' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-2xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>{label}</div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Volume */}
          {(data?.total_volume ?? 0) > 0 && (
            <div className="rounded-2xl p-5 mb-8" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>Total Closed Volume</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>${((data?.total_volume ?? 0) / 1_000_000).toFixed(2)}M</div>
            </div>
          )}

          {/* Monthly Bar Chart */}
          <div className="rounded-2xl p-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>Monthly Activity (Last 12 Months)</h2>
            <div className="flex items-end gap-1.5" style={{ height: '8rem' }}>
              {months.map((m: any) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t transition-all duration-300"
                    style={{
                      height: `${Math.round((m.created / maxCreated) * 100)}%`,
                      minHeight: m.created > 0 ? '4px' : '0',
                      background: 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)',
                      opacity: 0.85,
                    }}
                    title={`${m.created} new`}
                  />
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', transform: 'rotate(45deg)', transformOrigin: 'left' }}>
                    {m.month.slice(5)}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-5" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <div className="h-3 w-3 rounded" style={{ background: '#3b82f6' }} />
              New transactions per month
            </div>
          </div>
        </>
      )}
    </div>
  );
}
