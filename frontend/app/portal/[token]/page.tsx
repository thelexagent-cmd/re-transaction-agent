'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function fetchPortal(token: string) {
  const res = await fetch(`${API_URL}/portal/${token}`);
  if (!res.ok) throw new Error('Portal link is invalid or expired.');
  return res.json();
}

export default function PortalPage() {
  const { token } = useParams<{ token: string }>();
  const { data, error, isLoading } = useSWR(token ? `/portal/${token}` : null, () => fetchPortal(token));

  if (isLoading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-slate-500">Loading your transaction...</div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-2">Link Expired</h1>
        <p className="text-slate-500">This portal link is invalid or has expired. Please contact your agent for a new link.</p>
      </div>
    </div>
  );

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    closed: 'bg-blue-100 text-blue-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  const deadlineStatusColors: Record<string, string> = {
    upcoming: 'text-slate-600',
    warning: 'text-amber-600 font-semibold',
    missed: 'text-red-600 font-semibold',
    completed: 'text-green-600',
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-blue-700 text-white py-6 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-6 w-6 rounded bg-white/20 flex items-center justify-center text-xs font-bold">L</div>
            <span className="text-sm opacity-75">Lex Transaction Agent</span>
          </div>
          <h1 className="text-xl font-bold">{data.address}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[data.status] || 'bg-slate-100 text-slate-600'}`}>
              {data.status}
            </span>
            {data.closing_date && (
              <span className="text-sm opacity-75">Closing: {new Date(data.closing_date).toLocaleDateString()}</span>
            )}
            {data.purchase_price && (
              <span className="text-sm opacity-75">${data.purchase_price.toLocaleString()}</span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
        {/* Deadlines */}
        {data.deadlines?.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-800 mb-4">Key Deadlines</h2>
            <div className="space-y-3">
              {data.deadlines.map((d: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <span className="text-sm text-slate-700">{d.name}</span>
                  <div className="text-right">
                    <div className="text-sm font-medium">{new Date(d.due_date).toLocaleDateString()}</div>
                    <div className={`text-xs ${deadlineStatusColors[d.status] || ''}`}>{d.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Updates */}
        {data.events?.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-800 mb-4">Recent Updates</h2>
            <div className="space-y-3">
              {data.events.map((e: any, i: number) => (
                <div key={i} className="flex gap-3 py-2 border-b border-slate-100 last:border-0">
                  <div className="h-2 w-2 rounded-full bg-blue-500 mt-2 shrink-0" />
                  <div>
                    <p className="text-sm text-slate-700">{e.description}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{new Date(e.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Parties */}
        {data.parties?.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-800 mb-4">Transaction Parties</h2>
            <div className="grid grid-cols-2 gap-3">
              {data.parties.map((p: any, i: number) => (
                <div key={i} className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">{p.role.replace(/_/g, ' ')}</div>
                  <div className="text-sm font-medium text-slate-800 mt-0.5">{p.full_name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-center text-slate-400 pb-4">
          Powered by Lex Transaction Agent &bull; For questions, contact your agent directly.
        </p>
      </div>
    </div>
  );
}
