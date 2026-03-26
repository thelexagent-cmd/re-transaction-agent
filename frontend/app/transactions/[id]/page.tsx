'use client';

import { use, useState, useEffect, useRef, useCallback } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  getTransaction,
  getDocuments,
  getDocumentSummary,
  getDeadlines,
  getAlerts,
  dismissAlert,
  markDocumentCollected,
  deleteTransaction,
  getFirptaAnalysis,
  createPortalToken,
  updateParty,
  saveNotes,
  getCompliance,
  initializeCompliance,
  toggleComplianceItem,
  updateEmd,
  getInspectionItems,
  createInspectionItem,
  updateInspectionItem,
  deleteInspectionItem,
  createLenderPortalToken,
} from '@/lib/api';
import type {
  TransactionDetail,
  DocumentListResponse,
  AlertListResponse,
  EventResponse,
  FirptaAnalysis,
  ComplianceItem,
  InspectionItem,
} from '@/lib/api';
import { formatDate, formatDateTime, formatCurrency, daysUntil, getDealStatus, PROPERTY_TYPE_LABELS, PARTY_ROLE_LABELS } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { HealthGauge, computeHealthScore } from '@/components/deal-health-score';
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
  Trash2,
  Link2,
  Shield,
  Globe,
  MessageCircle,
  Printer,
  StickyNote,
  ChevronRight,
  DollarSign,
  Plus,
} from 'lucide-react';

const PHASE_NAMES: Record<string, string> = {
  '1': 'Contract Execution (Days 0-3)',
  '2': 'Inspection Period (Days 1-15)',
  '3': 'Financing (Days 5-30)',
  '4': 'Title and HOA (Days 1-35)',
  '5': 'Pre-Closing (Days 30-43)',
  '6': 'Closing',
};

const PIPELINE_STEPS = [
  { key: 'contract',   label: 'Contract',   phase: '1' },
  { key: 'inspection', label: 'Inspection', phase: '2' },
  { key: 'financing',  label: 'Financing',  phase: '3' },
  { key: 'title',      label: 'Title',      phase: '4' },
  { key: 'preclose',   label: 'Pre-Close',  phase: '5' },
  { key: 'closed',     label: 'Closed',     phase: '6' },
];

const TABS = ['Overview', 'Documents', 'Timeline', 'Activity', 'Alerts', 'Commission', 'Compliance', 'FIRPTA', 'EMD', 'Inspection'] as const;
type Tab = typeof TABS[number];

// ── Helpers ─────────────────────────────────────────────────────────────────

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

function WhatsAppBtn({ phone, name }: { phone: string; name: string }) {
  const clean = phone.replace(/\D/g, '');
  const msg = encodeURIComponent(`Hello ${name}, I'm reaching out regarding your real estate transaction. Please let me know if you have any questions.`);
  return (
    <a
      href={`https://wa.me/${clean}?text=${msg}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
      title="Open WhatsApp"
    >
      <MessageCircle className="h-3 w-3" />
      WhatsApp
    </a>
  );
}

// ── Transaction Progress Bar ─────────────────────────────────────────────────

function TransactionProgressBar({ docs }: { docs: DocumentListResponse | undefined }) {
  // Determine current phase based on which phases have any collected docs
  let currentPhase = 1;
  if (docs) {
    for (let p = 1; p <= 6; p++) {
      const phaseDocs = docs[String(p)] ?? [];
      const anyCollected = phaseDocs.some((d) => d.status === 'collected');
      if (anyCollected) currentPhase = p;
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6 print-block">
      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Transaction Progress</h3>
      <div className="relative">
        {/* Connector line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-200" style={{ zIndex: 0 }} />
        <div className="flex justify-between relative" style={{ zIndex: 1 }}>
          {PIPELINE_STEPS.map((step, idx) => {
            const phaseNum = parseInt(step.phase, 10);
            const isCompleted = phaseNum < currentPhase;
            const isCurrent = phaseNum === currentPhase;
            return (
              <div key={step.key} className="flex flex-col items-center" style={{ flex: 1 }}>
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                    isCompleted
                      ? 'bg-green-500 border-green-500 text-white'
                      : isCurrent
                      ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200'
                      : 'bg-white border-slate-300 text-slate-400'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : idx + 1}
                </div>
                <div className={`mt-2 text-center text-xs font-medium ${
                  isCurrent ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-slate-400'
                }`}>
                  {step.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Quick Notes Widget ────────────────────────────────────────────────────────

function QuickNotes({ txId, txData }: { txId: number; txData: TransactionDetail | undefined }) {
  const STORAGE_KEY = `lex_notes_tx_${txId}`;
  const [notes, setNotes] = useState('');
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isOpen, setIsOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  // Initialize from txData (backend) or fall back to localStorage
  useEffect(() => {
    if (initializedRef.current) return;
    const backendNotes = (txData as Record<string, unknown>)?.notes as string | undefined;
    if (backendNotes !== undefined && backendNotes !== null) {
      setNotes(backendNotes);
      initializedRef.current = true;
    } else {
      // Fallback to localStorage
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setNotes(parsed.content ?? '');
          setLastSaved(parsed.savedAt ?? null);
        }
      } catch {
        // ignore
      }
      if (txData) initializedRef.current = true;
    }
  }, [txData, STORAGE_KEY]);

  const persistNotes = useCallback(async (content: string) => {
    // Save to localStorage as offline cache
    const payload = { content, savedAt: new Date().toISOString() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch { /* ignore */ }

    // Save to backend
    setSaveStatus('saving');
    try {
      await saveNotes(txId, content);
      setLastSaved(payload.savedAt);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [STORAGE_KEY, txId]);

  function handleChange(value: string) {
    setNotes(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => persistNotes(value), 1000);
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 no-print">
      {isOpen ? (
        <div className="w-64 rounded-xl border border-yellow-300 bg-yellow-50 shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-yellow-200">
            <div className="flex items-center gap-1.5">
              <StickyNote className="h-3.5 w-3.5 text-yellow-800" />
              <span className="text-xs font-semibold text-yellow-800">Quick Notes</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-yellow-700 hover:text-yellow-900">
              <XCircle className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="p-2.5">
            <textarea
              value={notes}
              onChange={(e) => handleChange(e.target.value)}
              rows={5}
              placeholder="Jot down notes..."
              className="w-full text-xs bg-yellow-50 border-0 resize-none focus:outline-none text-slate-800 placeholder-yellow-600/60"
            />
            <div className="text-xs text-yellow-700 mt-0.5">
              {saveStatus === 'saving' && 'Saving...'}
              {saveStatus === 'saved' && 'Saved'}
              {saveStatus === 'error' && 'Save failed — will retry'}
              {saveStatus === 'idle' && (lastSaved ? `Saved ${formatDateTime(lastSaved)}` : 'Not saved yet')}
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 rounded-xl border border-yellow-300 bg-yellow-100 px-4 py-3 text-sm font-medium text-yellow-800 shadow-lg hover:bg-yellow-200 transition-colors"
        >
          <StickyNote className="h-4 w-4" />
          {notes ? 'View Notes' : 'Add Notes'}
        </button>
      )}
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ tx, txId, docs }: { tx: TransactionDetail; txId: number; docs: DocumentListResponse | undefined }) {
  const [partyState, setPartyState] = useState<Record<number, { preferred_language: string; is_foreign_national: boolean }>>({});
  const [savingParty, setSavingParty] = useState<number | null>(null);
  const [portalLink, setPortalLink] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [lenderPortalLink, setLenderPortalLink] = useState<string | null>(null);
  const [generatingLenderLink, setGeneratingLenderLink] = useState(false);
  const [lenderPortalError, setLenderPortalError] = useState<string | null>(null);
  const [lenderName, setLenderName] = useState('');
  const [lenderEmail, setLenderEmail] = useState('');

  function getPartyField<K extends 'preferred_language' | 'is_foreign_national'>(
    party: TransactionDetail['parties'][0],
    field: K
  ) {
    if (partyState[party.id]?.[field] !== undefined) return partyState[party.id][field];
    if (field === 'preferred_language') return (party as Record<string, unknown>).preferred_language as string ?? 'en';
    if (field === 'is_foreign_national') return (party as Record<string, unknown>).is_foreign_national as boolean ?? false;
  }

  async function handlePartyUpdate(partyId: number, field: 'preferred_language' | 'is_foreign_national', value: string | boolean) {
    setPartyState((prev) => ({
      ...prev,
      [partyId]: { ...prev[partyId], [field]: value },
    }));
    setSavingParty(partyId);
    try {
      await updateParty(txId, partyId, { [field]: value });
    } catch {
      // ignore
    } finally {
      setSavingParty(null);
    }
  }

  async function handleGeneratePortalLink() {
    setGeneratingLink(true);
    setPortalError(null);
    try {
      const result = await createPortalToken(txId);
      const baseUrl = window.location.origin;
      setPortalLink(`${baseUrl}/portal/${result.token}`);
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Failed to generate link. Please try again.');
    } finally {
      setGeneratingLink(false);
    }
  }

  async function handleGenerateLenderPortalLink() {
    setGeneratingLenderLink(true);
    setLenderPortalError(null);
    try {
      const result = await createLenderPortalToken(txId, lenderName || 'Loan Officer', lenderEmail || undefined);
      const baseUrl = window.location.origin;
      setLenderPortalLink(`${baseUrl}/portal/lender/${result.token}`);
    } catch (err) {
      setLenderPortalError(err instanceof Error ? err.message : 'Failed to generate lender link. Please try again.');
    } finally {
      setGeneratingLenderLink(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <TransactionProgressBar docs={docs} />

      {/* Property Info */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm print-block">
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
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm print-block">
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
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm print-block">
          <h3 className="text-base font-semibold text-slate-900 mb-4">Parties</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tx.parties.map((party) => (
              <div key={party.id} className="rounded-lg border border-slate-200 p-4">
                <div className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">{PARTY_ROLE_LABELS[party.role] ?? party.role}</div>
                <div className="text-sm font-semibold text-slate-900 mb-1">{party.full_name}</div>
                {party.email && <div className="text-xs text-slate-500">{party.email}</div>}
                {party.phone && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="text-xs text-slate-500">{party.phone}</div>
                    <WhatsAppBtn phone={party.phone} name={party.full_name} />
                  </div>
                )}

                {/* Language preference */}
                <div className="mt-3 flex items-center gap-2 no-print">
                  <Globe className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <select
                    value={getPartyField(party, 'preferred_language') as string}
                    onChange={(e) => handlePartyUpdate(party.id, 'preferred_language', e.target.value)}
                    disabled={savingParty === party.id}
                    className="text-xs border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 bg-white disabled:opacity-50"
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="pt">Portuguese</option>
                  </select>
                </div>

                {/* Foreign national toggle */}
                {(party.role === 'seller') && (
                  <div className="mt-2 flex items-center gap-2 no-print">
                    <Shield className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={getPartyField(party, 'is_foreign_national') as boolean}
                        onChange={(e) => handlePartyUpdate(party.id, 'is_foreign_national', e.target.checked)}
                        disabled={savingParty === party.id}
                        className="rounded border-slate-300 disabled:opacity-50"
                      />
                      <span className="text-xs text-slate-600">Foreign national (FIRPTA)</span>
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Share Portal Link */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm no-print">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-slate-900">Client Portal</h3>
          <button
            onClick={handleGeneratePortalLink}
            disabled={generatingLink}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Link2 className="h-3.5 w-3.5" />
            {generatingLink ? 'Generating...' : 'Generate Portal Link'}
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Share a magic link with buyers or sellers so they can view transaction status without logging in. Links expire after 30 days.
        </p>
        {portalError && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
            {portalError}
          </div>
        )}
        {portalLink && (
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={portalLink}
              className="flex-1 text-xs font-mono border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-slate-700"
              onFocus={(e) => e.target.select()}
            />
            <button
              onClick={() => { navigator.clipboard.writeText(portalLink); }}
              className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Copy
            </button>
          </div>
        )}
      </div>

      {/* Lender Portal Link */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm no-print">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-slate-900">Lender Portal</h3>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Share a link with the loan officer so they can view transaction details and required documents. Links expire after 30 days.
        </p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Lender / LO Name</label>
            <input
              type="text"
              value={lenderName}
              onChange={(e) => setLenderName(e.target.value)}
              placeholder="Loan Officer Name"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Lender Email (optional)</label>
            <input
              type="email"
              value={lenderEmail}
              onChange={(e) => setLenderEmail(e.target.value)}
              placeholder="lo@lender.com"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
        <button
          onClick={handleGenerateLenderPortalLink}
          disabled={generatingLenderLink}
          className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50 mb-3"
        >
          <Link2 className="h-3.5 w-3.5" />
          {generatingLenderLink ? 'Generating...' : 'Generate Lender Portal Link'}
        </button>
        {lenderPortalError && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
            {lenderPortalError}
          </div>
        )}
        {lenderPortalLink && (
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={lenderPortalLink}
              className="flex-1 text-xs font-mono border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-slate-700"
              onFocus={(e) => e.target.select()}
            />
            <button
              onClick={() => { navigator.clipboard.writeText(lenderPortalLink); }}
              className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Copy
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Commission Tab ───────────────────────────────────────────────────────────

function CommissionTab({ tx }: { tx: TransactionDetail }) {
  const [commPct, setCommPct] = useState('3');
  const [cobrokePct, setCobrokePct] = useState('50');
  const [agentSplitPct, setAgentSplitPct] = useState('70');

  const salePrice = tx.purchase_price ?? 0;
  const cp = parseFloat(commPct) || 0;
  const co = parseFloat(cobrokePct) || 0;
  const ap = parseFloat(agentSplitPct) || 0;
  const gross = salePrice * (cp / 100);
  const cobrokeAmt = gross * (co / 100);
  const ourSide = gross - cobrokeAmt;
  const agentNet = ourSide * (ap / 100);
  const brokerNet = ourSide - agentNet;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <DollarSign className="h-5 w-5 text-blue-600" />
          <h3 className="text-base font-semibold text-slate-900">Commission Calculator</h3>
          <span className="text-xs text-slate-500">for {tx.address}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Commission Rate</label>
            <div className="relative">
              <input
                type="number" step="0.25" min="0" max="10"
                value={commPct}
                onChange={(e) => setCommPct(e.target.value)}
                className="w-full pr-8 pl-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Co-broke Split</label>
            <div className="relative">
              <input
                type="number" step="5" min="0" max="100"
                value={cobrokePct}
                onChange={(e) => setCobrokePct(e.target.value)}
                className="w-full pr-8 pl-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Your Agent Split</label>
            <div className="relative">
              <input
                type="number" step="5" min="0" max="100"
                value={agentSplitPct}
                onChange={(e) => setAgentSplitPct(e.target.value)}
                className="w-full pr-8 pl-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
            </div>
          </div>
        </div>

        {salePrice === 0 ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
            No sale price set on this transaction. Add a purchase price to calculate commission.
          </div>
        ) : (
          <div className="space-y-0 border border-slate-200 rounded-xl overflow-hidden">
            {[
              { label: 'Sale Price', value: formatCurrency(salePrice), highlight: false },
              { label: `Gross Commission (${cp}%)`, value: formatCurrency(gross), highlight: false },
              { label: `Co-broke to Other Side (${co}%)`, value: `– ${formatCurrency(cobrokeAmt)}`, highlight: false },
              { label: 'Your Side of Commission', value: formatCurrency(ourSide), highlight: false },
              { label: `Broker Net (${100 - ap}%)`, value: `– ${formatCurrency(brokerNet)}`, highlight: false },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                <span className="text-sm text-slate-600">{label}</span>
                <span className="text-sm font-semibold text-slate-900">{value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-5 py-4 bg-blue-50">
              <span className="text-base font-bold text-blue-900">Your Net Commission</span>
              <span className="text-xl font-bold text-blue-700">{formatCurrency(agentNet)}</span>
            </div>
          </div>
        )}

        {salePrice > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-slate-50 p-4 text-center">
              <div className="text-xs text-slate-500 mb-1">Gross Commission</div>
              <div className="text-lg font-bold text-slate-900">{formatCurrency(gross)}</div>
            </div>
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <div className="text-xs text-slate-500 mb-1">Your Agent Net</div>
              <div className="text-lg font-bold text-green-700">{formatCurrency(agentNet)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4 text-center">
              <div className="text-xs text-slate-500 mb-1">Effective Rate</div>
              <div className="text-lg font-bold text-slate-900">
                {salePrice > 0 ? `${((agentNet / salePrice) * 100).toFixed(2)}%` : '—'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── FIRPTA Tab ───────────────────────────────────────────────────────────────

function FirptaTab({ tx, txId }: { tx: TransactionDetail; txId: number }) {
  const [buyerPrimary, setBuyerPrimary] = useState(false);
  const { data, error, isLoading, mutate } = useSWR<FirptaAnalysis>(
    `/transactions/${txId}/firpta?buyer_primary_residence=${buyerPrimary}`,
    () => getFirptaAnalysis(txId, buyerPrimary),
    { revalidateOnFocus: false }
  );

  const hasForeignSeller = tx.parties.some(
    (p) => p.role === 'seller' && (p as Record<string, unknown>).is_foreign_national
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="h-5 w-5 text-blue-600" />
          <h3 className="text-base font-semibold text-slate-900">FIRPTA Compliance Analysis</h3>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={buyerPrimary}
              onChange={(e) => { setBuyerPrimary(e.target.checked); mutate(); }}
              className="rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">Buyer intends primary residence</span>
          </label>
        </div>

        {!hasForeignSeller && (
          <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 mb-4">
            No sellers are marked as foreign nationals. To trigger FIRPTA analysis, mark a seller as a foreign national in the Overview tab.
          </div>
        )}

        {isLoading && <div className="text-sm text-slate-500">Analyzing...</div>}
        {error && <div className="text-sm text-red-600">Failed to load FIRPTA analysis.</div>}

        {data && (
          <div className="space-y-4">
            <div className={`flex items-center gap-3 rounded-lg px-4 py-3 ${data.is_firpta_applicable ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
              <div className={`h-3 w-3 rounded-full ${data.is_firpta_applicable ? 'bg-amber-500' : 'bg-green-500'}`} />
              <span className={`text-sm font-semibold ${data.is_firpta_applicable ? 'text-amber-800' : 'text-green-800'}`}>
                {data.is_firpta_applicable ? 'FIRPTA Withholding Required' : 'FIRPTA Not Applicable'}
              </span>
            </div>

            {data.is_firpta_applicable && (
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border border-slate-200 p-4 text-center">
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Withholding Rate</div>
                  <div className="text-2xl font-bold text-slate-900">{(data.withholding_rate * 100).toFixed(0)}%</div>
                </div>
                <div className="rounded-lg border border-slate-200 p-4 text-center">
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Withholding Amount</div>
                  <div className="text-2xl font-bold text-red-600">${data.withholding_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <div className="rounded-lg border border-slate-200 p-4 text-center">
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Gross Sales Price</div>
                  <div className="text-2xl font-bold text-slate-900">${data.gross_sales_price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
              </div>
            )}

            {data.notes.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Analysis Notes</h4>
                <ul className="space-y-1">
                  {data.notes.map((note, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-600">
                      <span className="text-blue-400 shrink-0 mt-0.5">•</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.action_items.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Required Action Items</h4>
                <ul className="space-y-2">
                  {data.action_items.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold mt-0.5">{i + 1}</span>
                      <span className="text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Documents Tab ────────────────────────────────────────────────────────────

function ESignButton({ docId }: { docId: number }) {
  const storageKey = `lex_esign_${docId}`;
  const [link, setLink] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) setLink(stored);
  }, [storageKey]);

  function handleSave() {
    if (!inputValue.trim()) return;
    localStorage.setItem(storageKey, inputValue.trim());
    setLink(inputValue.trim());
    setInputValue('');
    setShowForm(false);
  }

  function handleChangeLink() {
    setInputValue(link);
    setShowForm(true);
  }

  if (link && !showForm) {
    return (
      <div className="flex items-center gap-2">
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-800"
        >
          <Link2 className="h-3.5 w-3.5 text-green-600" />
          E-Sign link
        </a>
        <button
          onClick={handleChangeLink}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          Change
        </button>
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="url"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder="Paste signing link"
          className="w-48 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          autoFocus
        />
        <button
          onClick={handleSave}
          disabled={!inputValue.trim()}
          className="rounded bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          Save
        </button>
        <button
          onClick={() => { setShowForm(false); setInputValue(''); }}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowForm(true)}
      className="inline-flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
    >
      <Link2 className="h-3 w-3" />
      E-Sign
    </button>
  );
}

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
                  {(doc.status === 'pending' || doc.status === 'overdue') && (
                    <ESignButton docId={doc.id} />
                  )}
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

// ── Timeline Tab ─────────────────────────────────────────────────────────────

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
      <div className="text-sm text-red-700">Failed to load timeline: {error.message}</div>
    </div>
  );

  const deadlines = data?.deadlines ?? [];

  const iconConfig: Record<string, { bg: string; icon: React.ReactNode; ring: string }> = {
    upcoming: { bg: 'bg-blue-500', icon: <Clock className="h-4 w-4 text-white" />, ring: 'ring-blue-200' },
    warning: { bg: 'bg-yellow-500', icon: <AlertCircle className="h-4 w-4 text-white" />, ring: 'ring-yellow-200' },
    missed: { bg: 'bg-red-500', icon: <XCircle className="h-4 w-4 text-white" />, ring: 'ring-red-200' },
    completed: { bg: 'bg-green-500', icon: <CheckCircle2 className="h-4 w-4 text-white" />, ring: 'ring-green-200' },
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
      <h3 className="text-base font-semibold text-slate-900 mb-6">Transaction Timeline</h3>
      {deadlines.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">No deadlines found</div>
      ) : (
        <div className="relative">
          {/* Vertical spine */}
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-300 via-slate-200 to-slate-100" />
          <div className="space-y-0">
            {deadlines.map((deadline, index) => {
              const cfg = iconConfig[deadline.status] ?? iconConfig.upcoming;
              const isLast = index === deadlines.length - 1;
              const d = daysUntil(deadline.due_date);
              return (
                <div key={deadline.id} className={`relative flex items-start gap-5 py-5 ${!isLast ? 'border-b border-slate-100' : ''}`}>
                  {/* Icon */}
                  <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${cfg.bg} ring-4 ${cfg.ring} shadow-sm`}>
                    {cfg.icon}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">{deadline.name}</span>
                      <DeadlineStatusBadge status={deadline.status} />
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(deadline.due_date)}
                      </span>
                      {d !== null && deadline.status !== 'completed' && (
                        <span className={`text-xs font-medium ${
                          d < 0 ? 'text-red-600' : d <= 3 ? 'text-yellow-600' : 'text-slate-500'
                        }`}>
                          {d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'Due today' : `${d}d remaining`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Little calendar icon helper (not imported above)
function Calendar({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

// ── Activity Tab ─────────────────────────────────────────────────────────────

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

// ── Alerts Tab ───────────────────────────────────────────────────────────────

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

// ── Compliance Tab ──────────────────────────────────────────────────────────

function ComplianceTab({ txId }: { txId: number }) {
  const { data: items, error, isLoading, mutate } = useSWR<ComplianceItem[]>(
    `/transactions/${txId}/compliance`,
    () => getCompliance(txId),
    { revalidateOnFocus: false }
  );
  const [initializing, setInitializing] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);

  async function handleInitialize() {
    setInitializing(true);
    try {
      await initializeCompliance(txId);
      await mutate();
    } catch {
      // ignore
    } finally {
      setInitializing(false);
    }
  }

  async function handleToggle(item: ComplianceItem) {
    setToggling(item.id);
    try {
      await toggleComplianceItem(txId, item.id, !item.is_checked);
      await mutate();
    } catch {
      // ignore
    } finally {
      setToggling(null);
    }
  }

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>;

  // If no items exist yet (empty array or error), show initialize button + fallback
  const hasItems = items && items.length > 0;

  if (!hasItems) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <Shield className="h-8 w-8 text-amber-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-amber-800 mb-2">Compliance Checklist Not Initialized</h3>
          <p className="text-sm text-amber-700 mb-4">Click below to create the compliance checklist for this transaction.</p>
          <button
            onClick={handleInitialize}
            disabled={initializing}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Shield className="h-4 w-4" />
            {initializing ? 'Initializing...' : 'Initialize Compliance Checklist'}
          </button>
        </div>
      </div>
    );
  }

  // Group items by section
  const sections = new Map<string, ComplianceItem[]>();
  for (const item of items) {
    const section = item.section || 'General';
    if (!sections.has(section)) sections.set(section, []);
    sections.get(section)!.push(item);
  }

  const completedCount = items.filter((item) => item.is_checked).length;
  const totalCount = items.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Score Card */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-slate-900">Compliance Score</h3>
          <span className="text-sm font-bold text-slate-700">
            {completedCount}/{totalCount} items complete &mdash; {pct}%
          </span>
        </div>
        <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              pct === 100 ? 'bg-green-500' : pct >= 70 ? 'bg-blue-600' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Sections */}
      {Array.from(sections.entries()).map(([sectionTitle, sectionItems]) => {
        const sectionComplete = sectionItems.filter((item) => item.is_checked).length;
        return (
          <div key={sectionTitle} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">{sectionTitle}</span>
              <span className="text-xs text-slate-400">
                {sectionComplete}/{sectionItems.length}
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {sectionItems.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={item.is_checked}
                    onChange={() => handleToggle(item)}
                    disabled={toggling === item.id}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className={`text-sm ${item.is_checked ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── EMD Tab ─────────────────────────────────────────────────────────────────

function EmdTab({ tx, txId }: { tx: TransactionDetail; txId: number }) {
  const txAny = tx as Record<string, unknown>;
  const [emdAmount, setEmdAmount] = useState<string>(txAny.emd_amount != null ? String(txAny.emd_amount) : '');
  const [emdHolder, setEmdHolder] = useState<string>((txAny.emd_holder as string) ?? '');
  const [emdDueDate, setEmdDueDate] = useState<string>((txAny.emd_due_date as string) ?? '');
  const [emdReceived, setEmdReceived] = useState<boolean>((txAny.emd_received as boolean) ?? false);
  const [emdNotes, setEmdNotes] = useState<string>((txAny.emd_notes as string) ?? '');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  async function handleSave() {
    setSaving(true);
    setSaveMsg('');
    try {
      await updateEmd(txId, {
        emd_amount: emdAmount ? parseFloat(emdAmount) : null,
        emd_holder: emdHolder || null,
        emd_due_date: emdDueDate || null,
        emd_received: emdReceived,
        emd_notes: emdNotes || null,
      });
      setSaveMsg('Saved');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch {
      setSaveMsg('Save failed');
      setTimeout(() => setSaveMsg(''), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <DollarSign className="h-5 w-5 text-blue-600" />
          <h3 className="text-base font-semibold text-slate-900">Earnest Money Deposit</h3>
          <span className="text-xs text-slate-500">for {tx.address}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">EMD Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input
                type="number"
                step="100"
                min="0"
                value={emdAmount}
                onChange={(e) => setEmdAmount(e.target.value)}
                placeholder="0"
                className="w-full pl-7 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Who Holds It</label>
            <input
              type="text"
              value={emdHolder}
              onChange={(e) => setEmdHolder(e.target.value)}
              placeholder="Title Company, Broker, etc."
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Due Date</label>
            <input
              type="date"
              value={emdDueDate}
              onChange={(e) => setEmdDueDate(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={emdReceived}
                onChange={(e) => setEmdReceived(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700 font-medium">Received</span>
              {emdReceived && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            </label>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-medium text-slate-700 mb-1.5">Notes</label>
          <textarea
            value={emdNotes}
            onChange={(e) => setEmdNotes(e.target.value)}
            rows={3}
            placeholder="Any notes about the earnest money deposit..."
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          {saveMsg && (
            <span className={`text-xs font-medium ${saveMsg === 'Saved' ? 'text-green-600' : 'text-red-600'}`}>
              {saveMsg}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save EMD Details'}
          </button>
        </div>
      </div>

      {/* Summary card */}
      {emdAmount && parseFloat(emdAmount) > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
            <span className="text-sm font-semibold text-slate-700">EMD Summary</span>
          </div>
          <div className="divide-y divide-slate-100">
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-slate-600">Amount</span>
              <span className="text-sm font-semibold text-slate-900">{formatCurrency(parseFloat(emdAmount))}</span>
            </div>
            {emdHolder && (
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-slate-600">Held by</span>
                <span className="text-sm font-semibold text-slate-900">{emdHolder}</span>
              </div>
            )}
            {emdDueDate && (
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-slate-600">Due Date</span>
                <span className="text-sm font-semibold text-slate-900">{formatDate(emdDueDate)}</span>
              </div>
            )}
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-slate-600">Status</span>
              <Badge variant={emdReceived ? 'success' : 'warning'}>
                {emdReceived ? 'Received' : 'Pending'}
              </Badge>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inspection Tab ──────────────────────────────────────────────────────────

const SEVERITY_BADGES: Record<string, { bg: string; text: string }> = {
  minor: { bg: 'bg-yellow-100 border-yellow-200', text: 'text-yellow-800' },
  major: { bg: 'bg-orange-100 border-orange-200', text: 'text-orange-800' },
  safety: { bg: 'bg-red-100 border-red-200', text: 'text-red-800' },
};

const STATUS_BADGES: Record<string, { bg: string; text: string }> = {
  open: { bg: 'bg-blue-100 border-blue-200', text: 'text-blue-800' },
  negotiating: { bg: 'bg-yellow-100 border-yellow-200', text: 'text-yellow-800' },
  repaired: { bg: 'bg-green-100 border-green-200', text: 'text-green-800' },
  waived: { bg: 'bg-slate-100 border-slate-200', text: 'text-slate-600' },
  credited: { bg: 'bg-purple-100 border-purple-200', text: 'text-purple-800' },
};

function InspectionTab({ txId }: { txId: number }) {
  const { data: items, error, isLoading, mutate } = useSWR<InspectionItem[]>(
    `/transactions/${txId}/inspection`,
    () => getInspectionItems(txId),
    { revalidateOnFocus: false }
  );
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InspectionItem | null>(null);
  const [form, setForm] = useState({
    description: '',
    severity: 'minor' as string,
    status: 'open' as string,
    repair_cost: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function resetForm() {
    setForm({ description: '', severity: 'minor', status: 'open', repair_cost: '', notes: '' });
    setEditingItem(null);
    setShowForm(false);
  }

  function handleEdit(item: InspectionItem) {
    setForm({
      description: item.description,
      severity: item.severity,
      status: item.status,
      repair_cost: item.repair_cost != null ? String(item.repair_cost) : '',
      notes: item.notes ?? '',
    });
    setEditingItem(item);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.description.trim()) return;
    setSaving(true);
    try {
      const payload = {
        description: form.description,
        severity: form.severity,
        status: form.status,
        repair_cost: form.repair_cost ? parseFloat(form.repair_cost) : null,
        notes: form.notes || null,
      };
      if (editingItem) {
        await updateInspectionItem(txId, editingItem.id, payload);
      } else {
        await createInspectionItem(txId, payload);
      }
      await mutate();
      resetForm();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(itemId: number) {
    setDeletingId(itemId);
    try {
      await deleteInspectionItem(txId, itemId);
      await mutate();
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  }

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>;

  const totalCost = (items ?? []).reduce((sum, i) => sum + (i.repair_cost ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header + Add button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600" />
          <h3 className="text-base font-semibold text-slate-900">Inspection Findings</h3>
          {items && items.length > 0 && (
            <span className="text-xs text-slate-500">{items.length} item{items.length !== 1 ? 's' : ''} &mdash; Total est. cost: {formatCurrency(totalCost)}</span>
          )}
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Item
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h4 className="text-sm font-semibold text-slate-900 mb-3">
            {editingItem ? 'Edit Inspection Item' : 'New Inspection Item'}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. HVAC system needs repair"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Severity</label>
              <select
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="minor">Minor</option>
                <option value="major">Major</option>
                <option value="safety">Safety</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="open">Open</option>
                <option value="negotiating">Negotiating</option>
                <option value="repaired">Repaired</option>
                <option value="waived">Waived</option>
                <option value="credited">Credited</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Estimated Repair Cost</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  step="50"
                  min="0"
                  value={form.repair_cost}
                  onChange={(e) => setForm({ ...form, repair_cost: e.target.value })}
                  placeholder="0"
                  className="w-full pl-7 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Additional notes..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !form.description.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : editingItem ? 'Update Item' : 'Add Item'}
            </button>
            <button
              onClick={resetForm}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Items list */}
      {(!items || items.length === 0) && !showForm ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No inspection findings yet</p>
          <p className="text-xs text-slate-400 mt-0.5">Add items to track inspection findings and repairs</p>
        </div>
      ) : items && items.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="hidden md:grid md:grid-cols-12 gap-3 px-5 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wide">
            <div className="col-span-4">Description</div>
            <div className="col-span-2">Severity</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Cost</div>
            <div className="col-span-2">Actions</div>
          </div>
          <div className="divide-y divide-slate-100">
            {items.map((item) => {
              const sev = SEVERITY_BADGES[item.severity] ?? SEVERITY_BADGES.minor;
              const sta = STATUS_BADGES[item.status] ?? STATUS_BADGES.open;
              return (
                <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 px-5 py-3 items-center hover:bg-slate-50 transition-colors">
                  <div className="col-span-4">
                    <div className="text-sm text-slate-900">{item.description}</div>
                    {item.notes && <div className="text-xs text-slate-500 mt-0.5">{item.notes}</div>}
                  </div>
                  <div className="col-span-2">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${sev.bg} ${sev.text}`}>
                      {item.severity}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${sta.bg} ${sta.text}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="col-span-2 text-sm text-slate-900">
                    {item.repair_cost != null ? formatCurrency(item.repair_cost) : '--'}
                  </div>
                  <div className="col-span-2 flex gap-2">
                    <button
                      onClick={() => handleEdit(item)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const txId = parseInt(id, 10);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteTransaction(txId);
      router.replace('/transactions');
    } catch {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  const { data: tx, error, isLoading } = useSWR<TransactionDetail>(
    `/transactions/${txId}`,
    () => getTransaction(txId),
    { refreshInterval: 30000 }
  );

  const { data: docs } = useSWR(
    `/transactions/${txId}/documents`,
    () => getDocuments(txId),
    { revalidateOnFocus: false }
  );

  const { data: docSummary } = useSWR(
    `/transactions/${txId}/documents/summary`,
    () => getDocumentSummary(txId),
    { revalidateOnFocus: false }
  );

  const { data: deadlinesData } = useSWR(
    `/transactions/${txId}/deadlines`,
    () => getDeadlines(txId),
    { revalidateOnFocus: false }
  );

  const missed = deadlinesData?.deadlines?.filter((d) => d.status === 'missed').length ?? 0;
  const warning = deadlinesData?.deadlines?.filter((d) => d.status === 'warning').length ?? 0;

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
  const healthScore = tx ? computeHealthScore(tx, docSummary ?? null, missed, warning) : 100;

  return (
    <div className="p-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-500 mb-4 no-print">
        <Link href="/transactions" className="hover:text-slate-700">Dashboard</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-slate-900 font-medium truncate max-w-xs">{tx.address}</span>
      </nav>

      {/* Export PDF button */}
      <div className="flex items-center justify-end mb-4 no-print">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <Printer className="h-3.5 w-3.5" />
          Export PDF
        </button>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
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
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <HealthGauge score={healthScore} />
          <StatusBadge status={dealStatus} />
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors no-print"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Delete transaction?</h3>
            <p className="text-sm text-slate-500 mb-6">
              This will permanently delete <span className="font-medium text-slate-700">{tx.address}</span> and all its documents, deadlines, and activity. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6 no-print">
        <div className="flex flex-wrap gap-0">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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
      {activeTab === 'Overview' && <OverviewTab tx={tx} txId={txId} docs={docs} />}
      {activeTab === 'Documents' && <DocumentsTab txId={txId} />}
      {activeTab === 'Timeline' && <TimelineTab txId={txId} />}
      {activeTab === 'Activity' && <ActivityTab events={tx.events} />}
      {activeTab === 'Alerts' && <AlertsTab txId={txId} />}
      {activeTab === 'Commission' && <CommissionTab tx={tx} />}
      {activeTab === 'Compliance' && <ComplianceTab txId={txId} />}
      {activeTab === 'FIRPTA' && <FirptaTab tx={tx} txId={txId} />}
      {activeTab === 'EMD' && <EmdTab tx={tx} txId={txId} />}
      {activeTab === 'Inspection' && <InspectionTab txId={txId} />}

      {/* Quick Notes Floating Widget */}
      <QuickNotes txId={txId} txData={tx} />
    </div>
  );
}
