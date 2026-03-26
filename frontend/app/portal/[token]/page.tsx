'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-bb87.up.railway.app';

async function fetchPortal(token: string) {
  const res = await fetch(`${API_URL}/portal/${token}`);
  if (!res.ok) throw new Error('Portal link is invalid or expired.');
  return res.json();
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  closed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
  under_contract: 'bg-yellow-100 text-yellow-800',
  inspection: 'bg-orange-100 text-orange-800',
  financing: 'bg-purple-100 text-purple-800',
  clear_to_close: 'bg-teal-100 text-teal-800',
};

const deadlineStatusColors: Record<string, string> = {
  upcoming: 'text-slate-600',
  warning: 'text-amber-600 font-semibold',
  missed: 'text-red-600 font-semibold',
  completed: 'text-green-600',
};

export default function PortalPage() {
  const { token } = useParams<{ token: string }>();
  const { data, error, isLoading } = useSWR(
    token ? `/portal/${token}` : null,
    () => fetchPortal(token),
    { revalidateOnFocus: false }
  );

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

  const stages: string[] = data.pipeline_stages ?? ['Lead', 'Under Contract', 'Inspection', 'Financing', 'Clear to Close', 'Closed'];
  const currentStage: number = data.current_stage ?? 1;

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
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[data.status] || 'bg-slate-100 text-slate-600'}`}>
              {data.status?.replace(/_/g, ' ')}
            </span>
            {data.closing_date && (
              <span className="text-sm opacity-75">Closing: {new Date(data.closing_date).toLocaleDateString()}</span>
            )}
            {data.purchase_price && (
              <span className="text-sm opacity-75">${Number(data.purchase_price).toLocaleString()}</span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">

        {/* Pipeline Progress */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Transaction Progress</h2>
          <div className="flex items-center gap-0">
            {stages.map((stage, i) => (
              <div key={stage} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center flex-1">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    i < currentStage ? 'bg-blue-600 text-white' :
                    i === currentStage ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
                    'bg-slate-200 text-slate-500'
                  }`}>
                    {i < currentStage ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs mt-1 text-center leading-tight ${
                    i === currentStage ? 'text-blue-600 font-semibold' : 'text-slate-500'
                  }`} style={{ fontSize: '10px' }}>
                    {stage}
                  </span>
                </div>
                {i < stages.length - 1 && (
                  <div className={`h-0.5 flex-1 mb-4 ${i < currentStage ? 'bg-blue-600' : 'bg-slate-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Pending Documents */}
        {data.pending_documents?.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-800 mb-1">Documents Needed</h2>
            <p className="text-sm text-slate-500 mb-4">Please provide these documents to keep your transaction on track.</p>
            <div className="space-y-2">
              {data.pending_documents.map((doc: { name: string; status: string }, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg border border-slate-100 bg-slate-50">
                  <span className="text-sm text-slate-700">{doc.name}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    doc.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {doc.status === 'overdue' ? 'Overdue' : 'Needed'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key Deadlines */}
        {data.deadlines?.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-800 mb-4">Key Deadlines</h2>
            <div className="space-y-3">
              {data.deadlines.map((d: { name: string; due_date: string; status: string }, i: number) => (
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
              {data.events.map((e: { description: string; created_at: string }, i: number) => (
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

        {/* Transaction Parties */}
        {data.parties?.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-800 mb-4">Your Team</h2>
            <div className="grid grid-cols-2 gap-3">
              {data.parties.map((p: { role: string; full_name: string }, i: number) => (
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
