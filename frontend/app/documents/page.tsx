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

  const overdue = documents?.filter(d => d.status === 'overdue') ?? [];
  const pending = documents?.filter(d => d.status === 'pending') ?? [];

  return (
    <div className="p-8 mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
          Pending Documents
        </h1>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '4px' }}>Every document still outstanding across all transactions</p>
      </div>

      {/* Summary bar */}
      {!isLoading && documents && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertCircle className="h-5 w-5 shrink-0" style={{ color: '#f87171' }} />
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f87171' }}>{overdue.length}</div>
              <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>Overdue</div>
            </div>
          </div>
          <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <Clock className="h-5 w-5 shrink-0" style={{ color: '#60a5fa' }} />
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{pending.length}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pending</div>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 lex-skeleton rounded-xl" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl px-5 py-4 text-sm" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          Failed to load documents.
        </div>
      )}

      {!isLoading && !error && documents?.length === 0 && (
        <div className="text-center py-20">
          <div className="flex h-14 w-14 items-center justify-center rounded-full mx-auto mb-4" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <CheckCircle className="h-7 w-7" style={{ color: '#34d399' }} />
          </div>
          <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-secondary)' }}>All caught up</p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '4px' }}>No pending documents across any transaction</p>
        </div>
      )}

      {!isLoading && documents && documents.length > 0 && (
        <div className="space-y-8">
          {overdue.length > 0 && (
            <DocSection title="Overdue" icon={<AlertCircle className="h-4 w-4" style={{ color: '#f87171' }} />} docs={overdue} isOverdue={true} />
          )}
          {pending.length > 0 && (
            <DocSection title="Pending" icon={<Clock className="h-4 w-4" style={{ color: '#60a5fa' }} />} docs={pending} isOverdue={false} />
          )}
        </div>
      )}
    </div>
  );
}

function DocSection({ title, icon, docs, isOverdue }: {
  title: string;
  icon: React.ReactNode;
  docs: Awaited<ReturnType<typeof getAllDocuments>>;
  isOverdue: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{title}</h2>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>({docs.length})</span>
      </div>
      <div className="space-y-2">
        {docs.map((doc) => (
          <Link key={doc.id} href={`/transactions/${doc.transaction_id}`} className="block">
            <div
              className="flex items-center justify-between rounded-xl px-5 py-4 transition-all duration-150 cursor-pointer"
              style={{
                background: isOverdue ? 'rgba(239,68,68,0.05)' : 'var(--bg-surface)',
                border: isOverdue ? '1px solid rgba(239,68,68,0.15)' : '1px solid rgba(148,163,184,0.09)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.8'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                <div className="min-w-0">
                  <p className="truncate" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>{doc.name}</p>
                  <p className="truncate mt-0.5" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{doc.transaction_address}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                {doc.responsible_party_role && (
                  <span className="hidden sm:block" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {PARTY_ROLE_LABELS[doc.responsible_party_role] ?? doc.responsible_party_role}
                  </span>
                )}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{doc.due_date ? formatDate(doc.due_date) : 'No due date'}</span>
                <span className="rounded-full px-2.5 py-0.5" style={{
                  fontSize: '0.6875rem', fontWeight: 700,
                  color: isOverdue ? '#f87171' : '#60a5fa',
                  background: isOverdue ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
                  border: isOverdue ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(59,130,246,0.25)',
                }}>
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
