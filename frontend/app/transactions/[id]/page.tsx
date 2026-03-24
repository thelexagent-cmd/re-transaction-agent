'use client';

import { use } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useState } from 'react';
import {
  getTransaction,
  getDocuments,
  getDocumentSummary,
  getDeadlines,
  getAlerts,
  dismissAlert,
  markDocumentCollected,
} from '@/lib/api';
import type {
  TransactionDetail,
  DocumentListResponse,
  DocumentSummary,
  DeadlineListResponse,
  AlertListResponse,
  EventResponse,
} from '@/lib/api';
import { formatDate, formatDateTime, formatCurrency, daysUntil, getDealStatus, PROPERTY_TYPE_LABELS, PARTY_ROLE_LABELS } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronLeft,
  AlertCircle,
  Clock,
  Bell,
  Flag,
  Info,
  Upload,
  CheckCircle2,
  XCircle,
  Circle,
} from 'lucide-react';

const PHASE_NAMES: Record<string, string> = {
  '1': 'Contract Execution (Days 0-3)',
  '2': 'Inspection Period (Days 1-15)',
  '3': 'Financing (Days 5-30)',
  '4': 'Title and HOA (Days 1-35)',
  '5': 'Pre-Closing (Days 30-43)',
  '6': 'Closing',
};

const TABS = ['Overview', 'Documents', 'Timeline', 'Activity', 'Alerts'] as const;
type Tab = typeof TABS[number];

// ── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'needs_attention') return <Badge variant="danger">Needs Attention</Badge>;
  if (status === 'at_risk') return <Badge variant="warning">At Risk</Badge>;
  return <Badge variant="success">On Track</Badge>;
}

function DeadlineStatusBadge({ status }: { status: string }) {
  if (status === 'missed') return <Badge variant="danger">Missed</Badge>;
  if (status === 'warning') return <Badge variant="warning">Warning</Badge>;
  if (status === 'completed') return <Badge variant="success">Completed</Badge>;
  return <Badge variant="info">Upcoming</Badge>;
}

function DocStatusBadge({ status }: { status: string }) {
  if (status === 'overdue') return <Badge variant="danger">Overdue</Badge>;
  if (status === 'collected') return <Badge variant="success">Collected</Badge>;
  return <Badge variant="default">Pending</Badge>;
}

function ActivityIcon({ eventType }: { eventType: string }) {
  if (eventType.includes('document')) return <Upload className="h-4 w-4" />;
  if (eventType.includes('alert') || eventType.includes('broker')) return <Bell className="h-4 w-4" />;
  if (eventType.includes('deadline')) return <Clock className="h-4 w-4" />;
  if (eventType.includes('created')) return <Flag className="h-4 w-4" />;
  return <Info className="h-4 w-4" />;
}

// ── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab({ tx }: { tx: TransactionDetail }) {
  return (
    <div className="space-y-6">
      {/* Property Info */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900 mb-4">Property Details</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Address</div>
            <div className="text-sm text-slate-900">{tx.address}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Property Type</div>
            <div className="text-sm text-slate-900">{PROPERTY_TYPE_LABELS[tx.property_type] ?? tx.property_type}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Purchase Price</div>
            <div className="text-sm text-slate-900">{formatCurrency(tx.purchase_price)}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Status</div>
            <div className="text-sm text-slate-900 capitalize">{tx.status}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Closing Date</div>
            <div className="text-sm text-slate-900">{formatDate(tx.closing_date)}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Contract Execution</div>
            <div className="text-sm text-slate-900">{formatDate(tx.contract_execution_date)}</div>
          </div>
        </div>
      </div>

      {/* Key Dates */}
      {tx.closing_date && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900 mb-4">Key Dates</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-sm text-slate-600">Days until closing</span>
              <span className="text-sm font-semibold text-slate-900">
                {(() => {
                  const d = daysUntil(tx.closing_date);
                  if (d === null) return 'N/A';
                  if (d < 0) return `${Math.abs(d)} days overdue`;
                  if (d === 0) return 'Today';
                  return `${d} days`;
                })()}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-sm text-slate-600">Transaction created</span>
              <span className="text-sm text-slate-900">{formatDate(tx.created_at)}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-600">Last updated</span>
              <span className="text-sm text-slate-900">{formatDateTime(tx.updated_at)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Parties */}
      {tx.parties && tx.parties.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900 mb-4">Parties</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tx.parties.map((party) => (
              <div key={party.id} className="rounded-lg border border-slate-200 p-4">
                <div className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">{PARTY_ROLE_LABELS[party.role] ?? party.role}</div>
                <div className="text-sm font-semibold text-slate-900 mb-1">{party.full_name}</div>
                {party.email && <div className="text-xs text-slate-500">{party.email}</div>}
                {party.phone && <div className="text-xs text-slate-500">{party.phone}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Documents Tab ───────────────────────────────────────────────────────────

function DocumentsTab({ txId }: { txId: number }) {
  const { data: docs, error: docsError, isLoading: docsLoading, mutate: mutateDocs } = useSWR(
    `/transactions/${txId}/documents`,
    () => getDocuments(txId),
    { refreshInterval: 30000 }
  );
  const { data: summary, isLoading: summaryLoading } = useSWR(
    `/transactions/${txId}/documents/summary`,
    () => getDocumentSummary(txId),
    { refreshInterval: 30000 }
  );
  const [collecting, setCollecting] = useState<number | null>(null);

  async function handleCollect(docId: number, currentStatus: string) {
    if (currentStatus === 'collected') return;
    setCollecting(docId);
    try {
      await markDocumentCollected(txId, docId);
      await mutateDocs();
    } catch {
      // ignore
    } finally {
      setCollecting(null);
    }
  }

  if (docsLoading || summaryLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (docsError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-red-600" />
        <div className="text-sm text-red-700">Failed to load documents: {docsError.message}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total', value: summary.total, color: 'text-slate-900' },
            { label: 'Collected', value: summary.collected, color: 'text-green-700' },
            { label: 'Pending', value: summary.pending, color: 'text-slate-700' },
            { label: 'Overdue', value: summary.overdue, color: 'text-red-700' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Docs by phase */}
      {docs && Object.keys(PHASE_NAMES).map((phase) => {
        const phaseDocs = (docs as DocumentListResponse)[phase] || [];
        if (phaseDocs.length === 0) return null;
        return (
          <div key={phase} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
              <span className="text-sm font-semibold text-slate-700">Phase {phase}: {PHASE_NAMES[phase]}</span>
            </div>
            <div className="divide-y divide-slate-100">
              {phaseDocs.map((doc) => (
                <div key={doc.id} className="flex items-center gap-4 px-5 py-3">
                  <button
                    onClick={() => handleCollect(doc.id, doc.status)}
                    disabled={doc.status === 'collected' || collecting === doc.id}
                    className="shrink-0 disabled:cursor-default"
                  >
                    {doc.status === 'collected' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : doc.status === 'overdue' ? (
                      <div className="h-5 w-5 rounded-full border-2 border-red-400" />
                    ) : (
                      <Circle className="h-5 w-5 text-slate-300 hover:text-slate-400" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-900">{doc.name}</div>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      {doc.responsible_party_role && (
                        <span className="text-xs text-slate-500">{doc.responsible_party_role}</span>
                      )}
                      {doc.due_date && (
                        <span className="text-xs text-slate-400">Due {formatDate(doc.due_date)}</span>
                      )}
                      {doc.last_followup_at && (
                        <span className="text-xs text-slate-400">Last follow-up {formatDate(doc.last_followup_at)}</span>
                      )}
                    </div>
                  </div>
                  <DocStatusBadge status={doc.status} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Timeline Tab ────────────────────────────────────────────────────────────

function TimelineTab({ txId }: { txId: number }) {
  const { data, error, isLoading } = useSWR(
    `/transactions/${txId}/deadlines`,
    () => getDeadlines(txId),
    { refreshInterval: 30000 }
  );

  if (isLoading) return <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16" />)}</div>;
  if (error) return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5 flex items-center gap-3">
      <AlertCircle className="h-5 w-5 text-red-600" />
      <div className="text-sm text-red-700">Failed to load deadlines: {error.message}</div>
    </div>
  );

  const deadlines = data?.deadlines ?? [];

  const dotColor: Record<string, string> = {
    upcoming: 'bg-blue-500',
    warning: 'bg-yellow-500',
    missed: 'bg-red-500',
    completed: 'bg-green-500',
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
      {deadlines.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">No deadlines found</div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-3.5 top-0 bottom-0 w-px bg-slate-200" />
          <div className="space-y-0">
            {deadlines.map((deadline, index) => (
              <div key={deadline.id} className={`relative flex items-start gap-5 py-4 ${index < deadlines.length - 1 ? 'border-b border-slate-100' : ''}`}>
                <div className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${dotColor[deadline.status] || 'bg-slate-400'}`}>
                  <div className="h-2 w-2 rounded-full bg-white" />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900">{deadline.name}</span>
                    <DeadlineStatusBadge status={deadline.status} />
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{formatDate(deadline.due_date)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Activity Tab ────────────────────────────────────────────────────────────

function ActivityTab({ events }: { events: EventResponse[] }) {
  const sorted = [...events].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
      {sorted.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">No activity yet</div>
      ) : (
        <div className="space-y-0 divide-y divide-slate-100">
          {sorted.map((event) => (
            <div key={event.id} className="flex items-start gap-4 py-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                <ActivityIcon eventType={event.event_type} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-900">{event.description}</div>
                <div className="text-xs text-slate-500 mt-0.5">{formatDateTime(event.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Alerts Tab ──────────────────────────────────────────────────────────────

function AlertsTab({ txId }: { txId: number }) {
  const { data, error, isLoading, mutate } = useSWR<AlertListResponse>(
    `/transactions/${txId}/alerts`,
    () => getAlerts(txId),
    { refreshInterval: 30000 }
  );
  const [dismissing, setDismissing] = useState<number | null>(null);

  async function handleDismiss(eventId: number) {
    setDismissing(eventId);
    try {
      await dismissAlert(txId, eventId);
      await mutate();
    } catch {
      // ignore
    } finally {
      setDismissing(null);
    }
  }

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>;
  if (error) return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5 flex items-center gap-3">
      <AlertCircle className="h-5 w-5 text-red-600" />
      <div className="text-sm text-red-700">Failed to load alerts: {error.message}</div>
    </div>
  );

  const active = (data?.alerts ?? []).filter((a) => !a.dismissed);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
      {active.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
          <div className="text-sm text-slate-600 font-medium">No active alerts</div>
          <div className="text-xs text-slate-400 mt-0.5">All clear - no issues to address</div>
        </div>
      ) : (
        <div className="space-y-0 divide-y divide-slate-100">
          {active.map((alert) => (
            <div key={alert.id} className="flex items-start gap-4 py-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
                <Bell className="h-4 w-4 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-900">{alert.description}</div>
                <div className="text-xs text-slate-500 mt-0.5">{formatDateTime(alert.created_at)}</div>
              </div>
              <button
                onClick={() => handleDismiss(alert.id)}
                disabled={dismissing === alert.id}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                {dismissing === alert.id ? (
                  <XCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const txId = parseInt(id, 10);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');

  const { data: tx, error, isLoading } = useSWR<TransactionDetail>(
    `/transactions/${txId}`,
    () => getTransaction(txId),
    { refreshInterval: 30000 }
  );

  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-6 w-32 mb-6" />
        <Skeleton className="h-8 w-1/2 mb-2" />
        <Skeleton className="h-5 w-1/3 mb-8" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !tx) {
    return (
      <div className="p-8">
        <Link href="/transactions" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
          <ChevronLeft className="h-4 w-4" />
          Back to Transactions
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <div className="text-sm text-red-700">
            {error ? `Failed to load transaction: ${error.message}` : 'Transaction not found'}
          </div>
        </div>
      </div>
    );
  }

  const dealStatus = getDealStatus(tx, tx.events, tx.deadlines);

  return (
    <div className="p-8">
      {/* Back */}
      <Link
        href="/transactions"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Transactions
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{tx.address}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm text-slate-500">{PROPERTY_TYPE_LABELS[tx.property_type] ?? tx.property_type}</span>
            {tx.closing_date && (
              <span className="text-sm text-slate-500">
                Closes {formatDate(tx.closing_date)}
              </span>
            )}
          </div>
        </div>
        <StatusBadge status={dealStatus} />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab}
              {tab === 'Alerts' && tx.events.filter(e => !e.dismissed).length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-red-500 text-white text-xs">
                  {tx.events.filter(e => !e.dismissed).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'Overview' && <OverviewTab tx={tx} />}
      {activeTab === 'Documents' && <DocumentsTab txId={txId} />}
      {activeTab === 'Timeline' && <TimelineTab txId={txId} />}
      {activeTab === 'Activity' && <ActivityTab events={tx.events} />}
      {activeTab === 'Alerts' && <AlertsTab txId={txId} />}
    </div>
  );
}
