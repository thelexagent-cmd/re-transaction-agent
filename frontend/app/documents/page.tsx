'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { getAllDocuments } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { PARTY_ROLE_LABELS } from '@/lib/utils';
import { FileText, CheckCircle, AlertCircle, Clock } from 'lucide-react';

const PHASE_LABELS: Record<number, string> = {
  1: 'Opening',
  2: 'Inspection',
  3: 'Financing',
  4: 'Title & Escrow',
  5: 'Pre-Closing',
  6: 'Closing',
};

export default function DocumentsPage() {
  const { data: documents, error, isLoading } = useSWR(
    '/documents/all',
    getAllDocuments,
    { refreshInterval: 60000 }
  );

  const overdue  = documents?.filter(d => d.status === 'overdue') ?? [];
  const pending  = documents?.filter(d => d.status === 'pending') ?? [];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Pending Documents</h1>
        <p className="text-sm text-slate-500 mt-1">Every document still outstanding across all transactions</p>
      </div>

      {/* Summary bar */}
      {!isLoading && documents && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
            <div>
              <div className="text-xl font-bold text-red-700">{overdue.length}</div>
              <div className="text-xs text-red-600">Overdue</div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-blue-500 shrink-0" />
            <div>
              <div className="text-xl font-bold text-slate-700">{pending.length}</div>
              <div className="text-xs text-slate-500">Pending</div>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Failed to load documents.
        </div>
      )}

      {!isLoading && !error && documents?.length === 0 && (
        <div className="text-center py-20">
          <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
          <p className="text-base font-semibold text-slate-700">All caught up</p>
          <p className="text-sm text-slate-400 mt-1">No pending documents across any transaction</p>
        </div>
      )}

      {!isLoading && documents && documents.length > 0 && (
        <div className="space-y-8">
          {overdue.length > 0 && (
            <DocSection title="Overdue" icon={<AlertCircle className="h-4 w-4 text-red-500" />} docs={overdue} rowStyle="border-red-100 bg-red-50/40" badgeStyle="bg-red-100 text-red-700" />
          )}
          {pending.length > 0 && (
            <DocSection title="Pending" icon={<Clock className="h-4 w-4 text-blue-500" />} docs={pending} rowStyle="border-slate-200 bg-white" badgeStyle="bg-blue-100 text-blue-700" />
          )}
        </div>
      )}
    </div>
  );
}

function DocSection({ title, icon, docs, rowStyle, badgeStyle }: {
  title: string;
  icon: React.ReactNode;
  docs: Awaited<ReturnType<typeof getAllDocuments>>;
  rowStyle: string;
  badgeStyle: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{title}</h2>
        <span className="text-xs text-slate-400">({docs.length})</span>
      </div>
      <div className="space-y-2">
        {docs.map((doc) => (
          <Link key={doc.id} href={`/transactions/${doc.transaction_id}`}>
            <div className={`flex items-center justify-between rounded-xl border px-5 py-4 hover:opacity-80 transition-opacity cursor-pointer ${rowStyle}`}>
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{doc.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{doc.transaction_address}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                {doc.responsible_party_role && (
                  <span className="text-xs text-slate-400 hidden sm:block">
                    {PARTY_ROLE_LABELS[doc.responsible_party_role] ?? doc.responsible_party_role}
                  </span>
                )}
                <span className="text-xs text-slate-400">{doc.due_date ? formatDate(doc.due_date) : 'No due date'}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeStyle}`}>
                  {PHASE_LABELS[doc.phase] ?? `Phase ${doc.phase}`}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
