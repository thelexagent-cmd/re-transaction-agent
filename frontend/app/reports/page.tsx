'use client';

import useSWR from 'swr';
import { getReportSummary } from '@/lib/api';

export default function ReportsPage() {
  const { data, error, isLoading } = useSWR('/reports/summary', getReportSummary, { revalidateOnFocus: false });

  if (isLoading) return (
    <div className="p-8 text-slate-500">Loading reports...</div>
  );
  if (error) return (
    <div className="p-8 text-red-500">Failed to load report data.</div>
  );

  const months = data?.monthly_data || [];
  const maxCreated = Math.max(...months.map((m: any) => m.created), 1);

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Reports</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Transactions</div>
          <div className="text-3xl font-bold text-slate-800">{data?.total_transactions ?? 0}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Active</div>
          <div className="text-3xl font-bold text-green-600">{data?.active ?? 0}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Closed</div>
          <div className="text-3xl font-bold text-blue-600">{data?.closed ?? 0}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Avg Days to Close</div>
          <div className="text-3xl font-bold text-slate-800">{data?.avg_days_to_close ?? '—'}</div>
        </div>
      </div>

      {/* Volume */}
      {data?.total_volume > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-8">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Closed Volume</div>
          <div className="text-3xl font-bold text-slate-800">${(data.total_volume / 1_000_000).toFixed(2)}M</div>
        </div>
      )}

      {/* Monthly Bar Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-8">
        <h2 className="font-semibold text-slate-800 mb-4">Monthly Activity (Last 12 Months)</h2>
        <div className="flex items-end gap-2 h-32">
          {months.map((m: any) => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-blue-500 rounded-t"
                style={{ height: `${Math.round((m.created / maxCreated) * 100)}%`, minHeight: m.created > 0 ? '4px' : '0' }}
                title={`${m.created} new`}
              />
              <div className="text-xs text-slate-400 rotate-45 origin-left" style={{ fontSize: '9px' }}>
                {m.month.slice(5)}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-4 text-xs text-slate-500">
          <div className="h-3 w-3 rounded bg-blue-500" /> New transactions per month
        </div>
      </div>
    </div>
  );
}
