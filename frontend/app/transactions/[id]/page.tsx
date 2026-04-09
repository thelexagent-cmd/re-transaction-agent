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

// ── Shared styles ─────────────────────────────────────────────────────────────

const cardStyle = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
};

const inputStyle = {
  padding: '0.625rem 0.875rem',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  outline: 'none',
  width: '100%',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--text-muted)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  marginBottom: '0.375rem',
};

function focusInput(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.target.style.borderColor = 'rgba(59,130,246,0.4)';
  (e.target.style as CSSStyleDeclaration & { boxShadow: string }).boxShadow = '0 0 0 3px rgba(59,130,246,0.08)';
}
function blurInput(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.target.style.borderColor = 'rgba(148,163,184,0.09)';
  (e.target.style as CSSStyleDeclaration & { boxShadow: string }).boxShadow = 'none';
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'needs_attention') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.25rem 0.625rem', borderRadius: '9999px', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.05em', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
      Needs Attention
    </span>
  );
  if (status === 'at_risk') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.25rem 0.625rem', borderRadius: '9999px', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.05em', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}>
      At Risk
    </span>
  );
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.25rem 0.625rem', borderRadius: '9999px', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.05em', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }}>
      On Track
    </span>
  );
}

function DeadlineStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; border: string; color: string; label: string }> = {
    missed:    { bg: 'rgba(239,68,68,0.12)',    border: 'rgba(239,68,68,0.25)',    color: '#f87171',  label: 'Missed' },
    warning:   { bg: 'rgba(251,191,36,0.12)',   border: 'rgba(251,191,36,0.25)',   color: '#fbbf24',  label: 'Warning' },
    completed: { bg: 'rgba(16,185,129,0.12)',   border: 'rgba(16,185,129,0.25)',   color: '#34d399',  label: 'Completed' },
    upcoming:  { bg: 'rgba(59,130,246,0.12)',   border: 'rgba(59,130,246,0.25)',   color: '#60a5fa',  label: 'Upcoming' },
  };
  const c = cfg[status] ?? cfg.upcoming;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.5rem', borderRadius: '9999px', fontSize: '0.6875rem', fontWeight: 600, background: c.bg, border: `1px solid ${c.border}`, color: c.color }}>
      {c.label}
    </span>
  );
}

function DocStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; border: string; color: string; label: string }> = {
    overdue:   { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.25)',  color: '#f87171', label: 'Overdue' },
    collected: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', color: '#34d399', label: 'Collected' },
    pending:   { bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)', color: '#64748b', label: 'Pending' },
  };
  const c = cfg[status] ?? cfg.pending;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.5rem', borderRadius: '9999px', fontSize: '0.6875rem', fontWeight: 600, background: c.bg, border: `1px solid ${c.border}`, color: c.color }}>
      {c.label}
    </span>
  );
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
      title="Open WhatsApp"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
        padding: '0.2rem 0.5rem', borderRadius: '0.375rem',
        background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
        color: '#34d399', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none',
      }}
    >
      <MessageCircle className="h-3 w-3" />
      WhatsApp
    </a>
  );
}

// ── Transaction Progress Bar ─────────────────────────────────────────────────

function TransactionProgressBar({ docs }: { docs: DocumentListResponse | undefined }) {
  let currentPhase = 1;
  if (docs) {
    for (let p = 1; p <= 6; p++) {
      const phaseDocs = docs[String(p)] ?? [];
      const anyCollected = phaseDocs.some((d) => d.status === 'collected');
      if (anyCollected) currentPhase = p;
    }
  }

  return (
    <div className="rounded-2xl p-6 mb-6 print-block" style={cardStyle}>
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '1.25rem' }}>
        Transaction Progress
      </h3>
      <div className="relative">
        <div style={{ position: 'absolute', top: '20px', left: '5%', right: '5%', height: '1px', background: 'rgba(148,163,184,0.1)', zIndex: 0 }} />
        <div className="flex justify-between relative" style={{ zIndex: 1 }}>
          {PIPELINE_STEPS.map((step, idx) => {
            const phaseNum = parseInt(step.phase, 10);
            const isCompleted = phaseNum < currentPhase;
            const isCurrent = phaseNum === currentPhase;
            return (
              <div key={step.key} className="flex flex-col items-center" style={{ flex: 1 }}>
                <div
                  style={{
                    height: '40px', width: '40px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.8125rem', fontWeight: 700, transition: 'all 0.2s',
                    background: isCompleted
                      ? 'linear-gradient(135deg, #34d399, #059669)'
                      : isCurrent
                      ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
                      : 'rgba(148,163,184,0.08)',
                    border: isCompleted
                      ? '2px solid rgba(16,185,129,0.4)'
                      : isCurrent
                      ? '2px solid rgba(59,130,246,0.5)'
                      : '2px solid rgba(148,163,184,0.15)',
                    color: isCompleted || isCurrent ? '#fff' : '#3d5068',
                    boxShadow: isCurrent ? '0 4px 16px rgba(59,130,246,0.3)' : 'none',
                  }}
                >
                  {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : idx + 1}
                </div>
                <div style={{
                  marginTop: '0.5rem', textAlign: 'center', fontSize: '0.6875rem', fontWeight: 600,
                  color: isCurrent ? '#60a5fa' : isCompleted ? '#34d399' : '#3d5068',
                  letterSpacing: '0.04em',
                }}>
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

  useEffect(() => {
    if (initializedRef.current) return;
    const backendNotes = (txData as Record<string, unknown>)?.notes as string | undefined;
    if (backendNotes !== undefined && backendNotes !== null) {
      setNotes(backendNotes);
      initializedRef.current = true;
    } else {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setNotes(parsed.content ?? '');
          setLastSaved(parsed.savedAt ?? null);
        }
      } catch { /* ignore */ }
      if (txData) initializedRef.current = true;
    }
  }, [txData, STORAGE_KEY]);

  const persistNotes = useCallback(async (content: string) => {
    const payload = { content, savedAt: new Date().toISOString() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch { /* ignore */ }
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
        <div style={{ width: '16rem', borderRadius: '0.875rem', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid rgba(251,191,36,0.2)', background: '#0d1628' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'rgba(251,191,36,0.08)', borderBottom: '1px solid rgba(251,191,36,0.12)' }}>
            <div className="flex items-center gap-1.5">
              <StickyNote className="h-3.5 w-3.5" style={{ color: '#fbbf24' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fbbf24' }}>Quick Notes</span>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ color: '#fbbf24', background: 'none', border: 'none', cursor: 'pointer' }}>
              <XCircle className="h-3.5 w-3.5" />
            </button>
          </div>
          <div style={{ padding: '0.625rem' }}>
            <textarea
              value={notes}
              onChange={(e) => handleChange(e.target.value)}
              rows={5}
              placeholder="Jot down notes..."
              style={{ width: '100%', fontSize: '0.75rem', background: 'transparent', border: 'none', resize: 'none', outline: 'none', color: '#cbd5e1' }}
            />
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {saveStatus === 'saving' && 'Saving...'}
              {saveStatus === 'saved' && <span style={{ color: '#34d399' }}>Saved</span>}
              {saveStatus === 'error' && <span style={{ color: '#f87171' }}>Save failed — will retry</span>}
              {saveStatus === 'idle' && (lastSaved ? `Saved ${formatDateTime(lastSaved)}` : 'Not saved yet')}
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2"
          style={{
            padding: '0.75rem 1rem', borderRadius: '0.875rem', fontSize: '0.8125rem', fontWeight: 600,
            background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)', cursor: 'pointer',
          }}
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
  const [portalCopied, setPortalCopied] = useState(false);
  const [lenderPortalLink, setLenderPortalLink] = useState<string | null>(null);
  const [generatingLenderLink, setGeneratingLenderLink] = useState(false);
  const [lenderPortalError, setLenderPortalError] = useState<string | null>(null);
  const [lenderCopied, setLenderCopied] = useState(false);
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
    setPartyState((prev) => ({ ...prev, [partyId]: { ...prev[partyId], [field]: value } }));
    setSavingParty(partyId);
    try { await updateParty(txId, partyId, { [field]: value }); } catch { /* ignore */ } finally { setSavingParty(null); }
  }

  async function handleGeneratePortalLink() {
    setGeneratingLink(true); setPortalError(null);
    try {
      const result = await createPortalToken(txId);
      setPortalLink(`${window.location.origin}/portal/${result.token}`);
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Failed to generate link. Please try again.');
    } finally { setGeneratingLink(false); }
  }

  async function handleGenerateLenderPortalLink() {
    setGeneratingLenderLink(true); setLenderPortalError(null);
    try {
      const result = await createLenderPortalToken(txId, lenderName || 'Loan Officer', lenderEmail || undefined);
      setLenderPortalLink(`${window.location.origin}/portal/lender/${result.token}`);
    } catch (err) {
      setLenderPortalError(err instanceof Error ? err.message : 'Failed to generate lender link. Please try again.');
    } finally { setGeneratingLenderLink(false); }
  }

  const sectionHeadStyle = { fontFamily: 'var(--font-heading)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.06em', marginBottom: '1rem' };
  const metaLabel = { fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' as const, marginBottom: '0.25rem' };
  const metaValue = { fontSize: '0.875rem', color: '#cbd5e1' };

  return (
    <div className="space-y-5">
      <TransactionProgressBar docs={docs} />

      {/* Property Info */}
      <div className="rounded-2xl p-6 print-block" style={cardStyle}>
        <h3 style={sectionHeadStyle}>Property Details</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          {[
            { label: 'Address', value: tx.address },
            { label: 'Property Type', value: PROPERTY_TYPE_LABELS[tx.property_type] ?? tx.property_type },
            { label: 'Purchase Price', value: formatCurrency(tx.purchase_price) },
            { label: 'Status', value: tx.status?.charAt(0).toUpperCase() + (tx.status?.slice(1) ?? '') },
            { label: 'Closing Date', value: formatDate(tx.closing_date) },
            { label: 'Contract Execution', value: formatDate(tx.contract_execution_date) },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={metaLabel}>{label}</div>
              <div style={metaValue}>{value || '—'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Key Dates */}
      {tx.closing_date && (
        <div className="rounded-2xl p-6 print-block" style={cardStyle}>
          <h3 style={sectionHeadStyle}>Key Dates</h3>
          <div className="space-y-0">
            {[
              {
                label: 'Days until closing',
                value: (() => {
                  const d = daysUntil(tx.closing_date);
                  if (d === null) return 'N/A';
                  if (d < 0) return `${Math.abs(d)} days overdue`;
                  if (d === 0) return 'Today';
                  return `${d} days`;
                })(),
                color: (() => {
                  const d = daysUntil(tx.closing_date);
                  if (d === null || d > 7) return '#cbd5e1';
                  if (d < 0) return '#f87171';
                  return '#fbbf24';
                })(),
              },
              { label: 'Transaction created', value: formatDate(tx.created_at), color: 'var(--text-secondary)' },
              { label: 'Last updated', value: formatDateTime(tx.updated_at), color: 'var(--text-secondary)' },
            ].map(({ label, value, color }, i, arr) => (
              <div key={label} className="flex items-center justify-between py-3" style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(148,163,184,0.07)' : 'none' }}>
                <span style={{ fontSize: '0.875rem', color: '#64748b' }}>{label}</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Parties */}
      {tx.parties && tx.parties.length > 0 && (
        <div className="rounded-2xl p-6 print-block" style={cardStyle}>
          <h3 style={sectionHeadStyle}>Parties</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tx.parties.map((party) => (
              <div key={party.id} className="rounded-xl p-4" style={{ background: 'rgba(148,163,184,0.04)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.25rem' }}>
                  {PARTY_ROLE_LABELS[party.role] ?? party.role}
                </div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{party.full_name}</div>
                {party.email && <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>{party.email}</div>}
                {party.phone && (
                  <div className="flex items-center gap-2 mt-1">
                    <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>{party.phone}</div>
                    <WhatsAppBtn phone={party.phone} name={party.full_name} />
                  </div>
                )}
                <div className="mt-3 flex items-center gap-2 no-print">
                  <Globe className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                  <select
                    value={getPartyField(party, 'preferred_language') as string}
                    onChange={(e) => handlePartyUpdate(party.id, 'preferred_language', e.target.value)}
                    disabled={savingParty === party.id}
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.375rem', borderRadius: '0.375rem', background: 'var(--bg-elevated)', border: '1px solid rgba(148,163,184,0.12)', color: 'var(--text-secondary)', outline: 'none' }}
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="pt">Portuguese</option>
                  </select>
                </div>
                {party.role === 'seller' && (
                  <div className="mt-2 flex items-center gap-2 no-print">
                    <Shield className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={getPartyField(party, 'is_foreign_national') as boolean}
                        onChange={(e) => handlePartyUpdate(party.id, 'is_foreign_national', e.target.checked)}
                        disabled={savingParty === party.id}
                        style={{ accentColor: '#3b82f6' }}
                      />
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Foreign national (FIRPTA)</span>
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Client Portal */}
      <div className="rounded-2xl p-6 no-print" style={cardStyle}>
        <div className="flex items-center justify-between mb-3">
          <h3 style={sectionHeadStyle}>Client Portal</h3>
          <button
            onClick={handleGeneratePortalLink}
            disabled={generatingLink}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
              padding: '0.4rem 0.875rem', borderRadius: '0.5rem',
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff',
              fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(59,130,246,0.3)', opacity: generatingLink ? 0.5 : 1,
            }}
          >
            <Link2 className="h-3.5 w-3.5" />
            {generatingLink ? 'Generating...' : 'Generate Portal Link'}
          </button>
        </div>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          Share a magic link with buyers or sellers so they can view transaction status without logging in. Links expire after 30 days.
        </p>
        {portalError && (
          <div className="rounded-lg px-3 py-2 mb-3" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.8125rem', color: '#f87171' }}>
            {portalError}
          </div>
        )}
        {portalLink && (
          <div className="flex items-center gap-2">
            <input
              readOnly value={portalLink}
              onFocus={(e) => e.target.select()}
              style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', outline: 'none' }}
            />
            <button
              onClick={() => { navigator.clipboard.writeText(portalLink); setPortalCopied(true); setTimeout(() => setPortalCopied(false), 2000); }}
              style={{
                padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                background: portalCopied ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.08)',
                border: portalCopied ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(148,163,184,0.12)',
                color: portalCopied ? '#4ade80' : 'var(--text-secondary)',
              }}
            >
              {portalCopied ? '✓ Copied' : 'Copy Link'}
            </button>
          </div>
        )}
      </div>

      {/* Lender Portal */}
      <div className="rounded-2xl p-6 no-print" style={cardStyle}>
        <h3 style={{ ...sectionHeadStyle, marginBottom: '0.5rem' }}>Lender Portal</h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          Share a link with the loan officer so they can view transaction details and required documents. Links expire after 30 days.
        </p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label style={labelStyle}>Lender / LO Name</label>
            <input type="text" value={lenderName} onChange={(e) => setLenderName(e.target.value)} placeholder="Loan Officer Name"
              className="rounded-lg text-sm" style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
          </div>
          <div>
            <label style={labelStyle}>Lender Email (optional)</label>
            <input type="email" value={lenderEmail} onChange={(e) => setLenderEmail(e.target.value)} placeholder="lo@lender.com"
              className="rounded-lg text-sm" style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
          </div>
        </div>
        <button
          onClick={handleGenerateLenderPortalLink}
          disabled={generatingLenderLink}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
            padding: '0.4rem 0.875rem', borderRadius: '0.5rem', marginBottom: '0.75rem',
            background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
            color: '#34d399', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
            opacity: generatingLenderLink ? 0.5 : 1,
          }}
        >
          <Link2 className="h-3.5 w-3.5" />
          {generatingLenderLink ? 'Generating...' : 'Generate Lender Portal Link'}
        </button>
        {lenderPortalError && (
          <div className="rounded-lg px-3 py-2 mb-3" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.8125rem', color: '#f87171' }}>
            {lenderPortalError}
          </div>
        )}
        {lenderPortalLink && (
          <div className="flex items-center gap-2">
            <input
              readOnly value={lenderPortalLink}
              onFocus={(e) => e.target.select()}
              style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', outline: 'none' }}
            />
            <button
              onClick={() => { navigator.clipboard.writeText(lenderPortalLink); setLenderCopied(true); setTimeout(() => setLenderCopied(false), 2000); }}
              style={{
                padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                background: lenderCopied ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.08)',
                border: lenderCopied ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(148,163,184,0.12)',
                color: lenderCopied ? '#4ade80' : 'var(--text-secondary)',
              }}
            >
              {lenderCopied ? '✓ Copied' : 'Copy Link'}
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

  const numInputStyle = { ...inputStyle, paddingRight: '2rem', paddingLeft: '0.875rem' };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6" style={cardStyle}>
        <div className="flex items-center gap-3 mb-5">
          <DollarSign className="h-5 w-5" style={{ color: '#60a5fa' }} />
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
            Commission Calculator
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>for {tx.address}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Commission Rate', val: commPct, set: setCommPct, step: '0.25', max: '10' },
            { label: 'Co-broke Split', val: cobrokePct, set: setCobrokePct, step: '5', max: '100' },
            { label: 'Your Agent Split', val: agentSplitPct, set: setAgentSplitPct, step: '5', max: '100' },
          ].map(({ label, val, set, step, max }) => (
            <div key={label}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.375rem' }}>{label}</label>
              <div className="relative">
                <input type="number" step={step} min="0" max={max} value={val} onChange={(e) => set(e.target.value)}
                  className="rounded-lg text-sm" style={numInputStyle} onFocus={focusInput} onBlur={blurInput} />
                <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>%</span>
              </div>
            </div>
          ))}
        </div>

        {salePrice === 0 ? (
          <div className="rounded-lg p-4" style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)', fontSize: '0.875rem', color: '#fbbf24' }}>
            No sale price set on this transaction. Add a purchase price to calculate commission.
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {[
              { label: 'Sale Price', value: formatCurrency(salePrice) },
              { label: `Gross Commission (${cp}%)`, value: formatCurrency(gross) },
              { label: `Co-broke to Other Side (${co}%)`, value: `– ${formatCurrency(cobrokeAmt)}` },
              { label: 'Your Side of Commission', value: formatCurrency(ourSide) },
              { label: `Broker Net (${100 - ap}%)`, value: `– ${formatCurrency(brokerNet)}` },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
                <span style={{ fontSize: '0.875rem', color: '#64748b' }}>{label}</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-5 py-4" style={{ background: 'rgba(59,130,246,0.07)' }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#93c5fd' }}>Your Net Commission</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#60a5fa' }}>{formatCurrency(agentNet)}</span>
            </div>
          </div>
        )}

        {salePrice > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-4">
            {[
              { label: 'Gross Commission', value: formatCurrency(gross), color: 'var(--text-secondary)' },
              { label: 'Your Agent Net', value: formatCurrency(agentNet), color: '#34d399' },
              { label: 'Effective Rate', value: `${((agentNet / salePrice) * 100).toFixed(2)}%`, color: '#60a5fa' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg p-4 text-center" style={{ background: 'rgba(148,163,184,0.04)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color }}>{value}</div>
              </div>
            ))}
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
      <div className="rounded-2xl p-6" style={cardStyle}>
        <div className="flex items-center gap-3 mb-4">
          <Shield className="h-5 w-5" style={{ color: '#60a5fa' }} />
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
            FIRPTA Compliance Analysis
          </h3>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={buyerPrimary}
              onChange={(e) => { setBuyerPrimary(e.target.checked); mutate(); }}
              style={{ accentColor: '#3b82f6' }}
            />
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Buyer intends primary residence</span>
          </label>
        </div>

        {!hasForeignSeller && (
          <div className="rounded-lg px-3 py-2 mb-4" style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid var(--border)', fontSize: '0.8125rem', color: '#64748b' }}>
            No sellers are marked as foreign nationals. To trigger FIRPTA analysis, mark a seller as a foreign national in the Overview tab.
          </div>
        )}

        {isLoading && <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Analyzing...</div>}
        {error && <div style={{ fontSize: '0.875rem', color: '#f87171' }}>Failed to load FIRPTA analysis.</div>}

        {data && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg px-4 py-3" style={{
              background: data.is_firpta_applicable ? 'rgba(251,191,36,0.07)' : 'rgba(16,185,129,0.07)',
              border: `1px solid ${data.is_firpta_applicable ? 'rgba(251,191,36,0.2)' : 'rgba(16,185,129,0.2)'}`,
            }}>
              <div style={{ height: '0.625rem', width: '0.625rem', borderRadius: '50%', background: data.is_firpta_applicable ? '#fbbf24' : '#34d399' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: data.is_firpta_applicable ? '#fbbf24' : '#34d399' }}>
                {data.is_firpta_applicable ? 'FIRPTA Withholding Required' : 'FIRPTA Not Applicable'}
              </span>
            </div>

            {data.is_firpta_applicable && (
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Withholding Rate', value: `${(data.withholding_rate * 100).toFixed(0)}%`, color: '#f87171' },
                  { label: 'Withholding Amount', value: `$${data.withholding_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: '#f87171' },
                  { label: 'Gross Sales Price', value: `$${data.gross_sales_price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: 'var(--text-secondary)' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-lg p-4 text-center" style={{ background: 'rgba(148,163,184,0.04)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.375rem' }}>{label}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</div>
                  </div>
                ))}
              </div>
            )}

            {data.notes.length > 0 && (
              <div>
                <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Analysis Notes</h4>
                <ul className="space-y-1">
                  {data.notes.map((note, i) => (
                    <li key={i} className="flex gap-2" style={{ fontSize: '0.875rem', color: '#64748b' }}>
                      <span style={{ color: '#60a5fa', flexShrink: 0, marginTop: '0.125rem' }}>•</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.action_items.length > 0 && (
              <div>
                <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Required Action Items</h4>
                <ul className="space-y-2">
                  {data.action_items.map((item, i) => (
                    <li key={i} className="flex gap-2" style={{ fontSize: '0.875rem' }}>
                      <span style={{ display: 'flex', height: '1.25rem', width: '1.25rem', flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'rgba(251,191,36,0.12)', color: '#fbbf24', fontSize: '0.6875rem', fontWeight: 700, marginTop: '0.125rem' }}>
                        {i + 1}
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>{item}</span>
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
        <a href={link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600, color: '#34d399', textDecoration: 'none' }}>
          <Link2 className="h-3.5 w-3.5" />
          E-Sign link
        </a>
        <button onClick={handleChangeLink} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
          Change
        </button>
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="url" value={inputValue} onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder="Paste signing link" autoFocus
          style={{ width: '12rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '0.375rem', background: 'var(--bg-elevated)', border: '1px solid rgba(148,163,184,0.12)', color: 'var(--text-primary)', outline: 'none' }}
        />
        <button onClick={handleSave} disabled={!inputValue.trim()}
          style={{ padding: '0.25rem 0.625rem', borderRadius: '0.375rem', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer', opacity: !inputValue.trim() ? 0.4 : 1 }}>
          Save
        </button>
        <button onClick={() => { setShowForm(false); setInputValue(''); }}
          style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => setShowForm(true)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: '0.375rem', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
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
    try { await markDocumentCollected(txId, docId); await mutateDocs(); } catch { /* ignore */ } finally { setCollecting(null); }
  }

  if (docsLoading || summaryLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="lex-skeleton rounded-xl h-20" />)}
        </div>
        <div className="lex-skeleton rounded-xl h-40" />
      </div>
    );
  }

  if (docsError) {
    return (
      <div className="rounded-xl p-5 flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
        <AlertCircle className="h-5 w-5" style={{ color: '#f87171' }} />
        <div style={{ fontSize: '0.875rem', color: '#f87171' }}>Failed to load documents: {docsError.message}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total', value: summary.total, color: 'var(--text-secondary)' },
            { label: 'Collected', value: summary.collected, color: '#34d399' },
            { label: 'Pending', value: summary.pending, color: '#64748b' },
            { label: 'Overdue', value: summary.overdue, color: '#f87171' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl p-4 text-center" style={cardStyle}>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color }}>{value}</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.125rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {docs && Object.keys(PHASE_NAMES).map((phase) => {
        const phaseDocs = (docs as DocumentListResponse)[phase] || [];
        if (phaseDocs.length === 0) return null;
        return (
          <div key={phase} className="rounded-2xl overflow-hidden" style={cardStyle}>
            <div style={{ padding: '0.625rem 1.25rem', background: 'rgba(148,163,184,0.05)', borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#60a5fa' }}>Phase {phase}: {PHASE_NAMES[phase]}</span>
            </div>
            <div>
              {phaseDocs.map((doc, i) => (
                <div key={doc.id} className="flex items-center gap-4 px-5 py-3" style={{ borderBottom: i < phaseDocs.length - 1 ? '1px solid rgba(148,163,184,0.06)' : 'none' }}>
                  <button
                    onClick={() => handleCollect(doc.id, doc.status)}
                    disabled={doc.status === 'collected' || collecting === doc.id}
                    style={{ background: 'none', border: 'none', cursor: doc.status === 'collected' ? 'default' : 'pointer', flexShrink: 0 }}
                  >
                    {doc.status === 'collected' ? (
                      <CheckCircle2 className="h-5 w-5" style={{ color: '#34d399' }} />
                    ) : doc.status === 'overdue' ? (
                      <div style={{ height: '1.25rem', width: '1.25rem', borderRadius: '50%', border: '2px solid #f87171' }} />
                    ) : (
                      <Circle className="h-5 w-5" style={{ color: 'var(--text-muted)' }} />
                    )}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.875rem', color: doc.status === 'collected' ? '#3d5068' : '#cbd5e1', textDecoration: doc.status === 'collected' ? 'line-through' : 'none' }}>
                      {doc.name}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      {doc.responsible_party_role && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{doc.responsible_party_role}</span>}
                      {doc.due_date && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Due {formatDate(doc.due_date)}</span>}
                      {doc.last_followup_at && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last follow-up {formatDate(doc.last_followup_at)}</span>}
                    </div>
                  </div>
                  {(doc.status === 'pending' || doc.status === 'overdue') && <ESignButton docId={doc.id} />}
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

  if (isLoading) return <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="lex-skeleton rounded-xl h-16" />)}</div>;
  if (error) return (
    <div className="rounded-xl p-5 flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
      <AlertCircle className="h-5 w-5" style={{ color: '#f87171' }} />
      <div style={{ fontSize: '0.875rem', color: '#f87171' }}>Failed to load timeline: {error.message}</div>
    </div>
  );

  const deadlines = data?.deadlines ?? [];

  const iconCfg: Record<string, { bg: string; ring: string; icon: React.ReactNode }> = {
    upcoming:  { bg: 'linear-gradient(135deg, #3b82f6, #2563eb)', ring: 'rgba(59,130,246,0.2)',  icon: <Clock className="h-4 w-4 text-white" /> },
    warning:   { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', ring: 'rgba(251,191,36,0.2)',  icon: <AlertCircle className="h-4 w-4 text-white" /> },
    missed:    { bg: 'linear-gradient(135deg, #ef4444, #dc2626)', ring: 'rgba(239,68,68,0.2)',   icon: <XCircle className="h-4 w-4 text-white" /> },
    completed: { bg: 'linear-gradient(135deg, #10b981, #059669)', ring: 'rgba(16,185,129,0.2)',  icon: <CheckCircle2 className="h-4 w-4 text-white" /> },
  };

  return (
    <div className="rounded-2xl p-6" style={cardStyle}>
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.05em', marginBottom: '1.5rem' }}>
        Transaction Timeline
      </h3>
      {deadlines.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>No deadlines found</div>
      ) : (
        <div className="relative">
          <div style={{ position: 'absolute', left: '20px', top: 0, bottom: 0, width: '1px', background: 'linear-gradient(to bottom, rgba(59,130,246,0.3), rgba(148,163,184,0.1))', zIndex: 0 }} />
          <div>
            {deadlines.map((deadline, index) => {
              const cfg = iconCfg[deadline.status] ?? iconCfg.upcoming;
              const isLast = index === deadlines.length - 1;
              const d = daysUntil(deadline.due_date);
              return (
                <div key={deadline.id} className="relative flex items-start gap-5 py-5" style={{ borderBottom: !isLast ? '1px solid rgba(148,163,184,0.06)' : 'none' }}>
                  <div style={{
                    position: 'relative', zIndex: 1, display: 'flex', height: '40px', width: '40px', flexShrink: 0,
                    alignItems: 'center', justifyContent: 'center', borderRadius: '50%',
                    background: cfg.bg, boxShadow: `0 0 0 4px ${cfg.ring}`,
                  }}>
                    {cfg.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingTop: '0.25rem' }}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{deadline.name}</span>
                      <DeadlineStatusBadge status={deadline.status} />
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <CalendarIcon className="h-3 w-3" />
                        {formatDate(deadline.due_date)}
                      </span>
                      {d !== null && deadline.status !== 'completed' && (
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: d < 0 ? '#f87171' : d <= 3 ? '#fbbf24' : '#3d5068' }}>
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

function CalendarIcon({ className }: { className?: string }) {
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
    <div className="rounded-2xl p-6" style={cardStyle}>
      {sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>No activity yet</div>
      ) : (
        <div>
          {sorted.map((event, i) => (
            <div key={event.id} className="flex items-start gap-4 py-4" style={{ borderBottom: i < sorted.length - 1 ? '1px solid rgba(148,163,184,0.06)' : 'none' }}>
              <div style={{ display: 'flex', height: '2rem', width: '2rem', flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}>
                <ActivityIcon eventType={event.event_type} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>{event.description}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{formatDateTime(event.created_at)}</div>
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
    try { await dismissAlert(txId, eventId); await mutate(); } catch { /* ignore */ } finally { setDismissing(null); }
  }

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="lex-skeleton rounded-xl h-16" />)}</div>;
  if (error) return (
    <div className="rounded-xl p-5 flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
      <AlertCircle className="h-5 w-5" style={{ color: '#f87171' }} />
      <div style={{ fontSize: '0.875rem', color: '#f87171' }}>Failed to load alerts: {error.message}</div>
    </div>
  );

  const active = (data?.alerts ?? []).filter((a) => !a.dismissed);

  return (
    <div className="rounded-2xl p-6" style={cardStyle}>
      {active.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <CheckCircle2 className="h-8 w-8 mx-auto mb-2" style={{ color: '#34d399' }} />
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 600 }}>No active alerts</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>All clear — no issues to address</div>
        </div>
      ) : (
        <div>
          {active.map((alert, i) => (
            <div key={alert.id} className="flex items-start gap-4 py-4" style={{ borderBottom: i < active.length - 1 ? '1px solid rgba(148,163,184,0.06)' : 'none' }}>
              <div style={{ display: 'flex', height: '2rem', width: '2rem', flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'rgba(239,68,68,0.1)' }}>
                <Bell className="h-4 w-4" style={{ color: '#f87171' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>{alert.description}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{formatDateTime(alert.created_at)}</div>
              </div>
              <button
                onClick={() => handleDismiss(alert.id)}
                disabled={dismissing === alert.id}
                style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.75rem', borderRadius: '0.5rem', background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.12)', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', opacity: dismissing === alert.id ? 0.5 : 1 }}
              >
                <XCircle className="h-3.5 w-3.5" />
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
    try { await initializeCompliance(txId); await mutate(); } catch { /* ignore */ } finally { setInitializing(false); }
  }

  async function handleToggle(item: ComplianceItem) {
    setToggling(item.id);
    try { await toggleComplianceItem(txId, item.id, !item.is_checked); await mutate(); } catch { /* ignore */ } finally { setToggling(null); }
  }

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="lex-skeleton rounded-xl h-16" />)}</div>;

  const hasItems = items && items.length > 0;

  if (!hasItems) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)' }}>
          <Shield className="h-8 w-8 mx-auto mb-3" style={{ color: '#fbbf24' }} />
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#fbbf24', marginBottom: '0.5rem' }}>Compliance Checklist Not Initialized</h3>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>Click below to create the compliance checklist for this transaction.</p>
          <button
            onClick={handleInitialize}
            disabled={initializing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', borderRadius: '0.625rem', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', fontSize: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 2px 12px rgba(59,130,246,0.3)', opacity: initializing ? 0.5 : 1 }}
          >
            <Shield className="h-4 w-4" />
            {initializing ? 'Initializing...' : 'Initialize Compliance Checklist'}
          </button>
        </div>
      </div>
    );
  }

  const sections = new Map<string, ComplianceItem[]>();
  for (const item of items) {
    const section = item.section || 'General';
    if (!sections.has(section)) sections.set(section, []);
    sections.get(section)!.push(item);
  }

  const completedCount = items.filter((item) => item.is_checked).length;
  const totalCount = items.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const barColor = pct === 100 ? '#34d399' : pct >= 70 ? '#3b82f6' : pct >= 40 ? '#fbbf24' : '#f87171';

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-6" style={cardStyle}>
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.05em' }}>Compliance Score</h3>
          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: barColor }}>
            {completedCount}/{totalCount} — {pct}%
          </span>
        </div>
        <div style={{ height: '6px', borderRadius: '9999px', background: 'rgba(148,163,184,0.1)', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: '9999px', transition: 'width 0.5s ease', width: `${pct}%`, background: barColor }} />
        </div>
      </div>

      {Array.from(sections.entries()).map(([sectionTitle, sectionItems]) => {
        const sectionComplete = sectionItems.filter((item) => item.is_checked).length;
        return (
          <div key={sectionTitle} className="rounded-2xl overflow-hidden" style={cardStyle}>
            <div className="flex items-center justify-between px-5 py-3" style={{ background: 'rgba(148,163,184,0.04)', borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{sectionTitle}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sectionComplete}/{sectionItems.length}</span>
            </div>
            <div>
              {sectionItems.map((item, i) => (
                <label
                  key={item.id}
                  className="flex items-center gap-3 px-5 py-3 cursor-pointer"
                  style={{ borderBottom: i < sectionItems.length - 1 ? '1px solid rgba(148,163,184,0.05)' : 'none', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(148,163,184,0.03)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <input
                    type="checkbox"
                    checked={item.is_checked}
                    onChange={() => handleToggle(item)}
                    disabled={toggling === item.id}
                    style={{ accentColor: '#3b82f6', opacity: toggling === item.id ? 0.5 : 1 }}
                  />
                  <span style={{ fontSize: '0.875rem', color: item.is_checked ? '#3d5068' : '#94a3b8', textDecoration: item.is_checked ? 'line-through' : 'none' }}>
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
    setSaving(true); setSaveMsg('');
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
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-6" style={cardStyle}>
        <div className="flex items-center gap-3 mb-5">
          <DollarSign className="h-5 w-5" style={{ color: '#60a5fa' }} />
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
            Earnest Money Deposit
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>for {tx.address}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div>
            <label style={labelStyle}>EMD Amount</label>
            <div className="relative">
              <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>$</span>
              <input type="number" step="100" min="0" value={emdAmount} onChange={(e) => setEmdAmount(e.target.value)} placeholder="0"
                className="rounded-lg text-sm" style={{ ...inputStyle, paddingLeft: '1.75rem' }} onFocus={focusInput} onBlur={blurInput} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Who Holds It</label>
            <input type="text" value={emdHolder} onChange={(e) => setEmdHolder(e.target.value)} placeholder="Title Company, Broker, etc."
              className="rounded-lg text-sm" style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
          </div>
          <div>
            <label style={labelStyle}>Due Date</label>
            <input type="date" value={emdDueDate} onChange={(e) => setEmdDueDate(e.target.value)}
              className="rounded-lg text-sm" style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={emdReceived} onChange={(e) => setEmdReceived(e.target.checked)} style={{ accentColor: '#3b82f6' }} />
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Received</span>
              {emdReceived && <CheckCircle2 className="h-4 w-4" style={{ color: '#34d399' }} />}
            </label>
          </div>
        </div>

        <div className="mb-5">
          <label style={labelStyle}>Notes</label>
          <textarea value={emdNotes} onChange={(e) => setEmdNotes(e.target.value)} rows={3} placeholder="Any notes about the earnest money deposit..."
            className="rounded-lg text-sm resize-none" style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
        </div>

        <div className="flex items-center justify-end gap-3">
          {saveMsg && (
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: saveMsg === 'Saved' ? '#34d399' : '#f87171' }}>
              {saveMsg}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', borderRadius: '0.625rem', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', fontSize: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 2px 12px rgba(59,130,246,0.3)', opacity: saving ? 0.5 : 1 }}
          >
            {saving ? 'Saving...' : 'Save EMD Details'}
          </button>
        </div>
      </div>

      {emdAmount && parseFloat(emdAmount) > 0 && (
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          <div style={{ padding: '0.625rem 1.25rem', background: 'rgba(148,163,184,0.04)', borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>EMD Summary</span>
          </div>
          <div>
            {[
              { label: 'Amount', value: formatCurrency(parseFloat(emdAmount)) },
              emdHolder ? { label: 'Held by', value: emdHolder } : null,
              emdDueDate ? { label: 'Due Date', value: formatDate(emdDueDate) } : null,
            ].filter(Boolean).map((row, i, arr) => (
              <div key={row!.label} className="flex items-center justify-between px-5 py-3" style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(148,163,184,0.06)' : 'none' }}>
                <span style={{ fontSize: '0.875rem', color: '#64748b' }}>{row!.label}</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{row!.value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-5 py-3">
              <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Status</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.5rem', borderRadius: '9999px', fontSize: '0.6875rem', fontWeight: 600,
                background: emdReceived ? 'rgba(16,185,129,0.12)' : 'rgba(251,191,36,0.12)',
                border: `1px solid ${emdReceived ? 'rgba(16,185,129,0.25)' : 'rgba(251,191,36,0.25)'}`,
                color: emdReceived ? '#34d399' : '#fbbf24',
              }}>
                {emdReceived ? 'Received' : 'Pending'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inspection Tab ──────────────────────────────────────────────────────────

const SEVERITY_CFG: Record<string, { bg: string; border: string; color: string }> = {
  minor:  { bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.2)',  color: '#fbbf24' },
  major:  { bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.2)',  color: '#fb923c' },
  safety: { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.2)',   color: '#f87171' },
};

const STATUS_CFG: Record<string, { bg: string; border: string; color: string }> = {
  open:        { bg: 'rgba(59,130,246,0.1)',   border: 'rgba(59,130,246,0.2)',   color: '#60a5fa' },
  negotiating: { bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.2)',   color: '#fbbf24' },
  repaired:    { bg: 'rgba(16,185,129,0.1)',   border: 'rgba(16,185,129,0.2)',   color: '#34d399' },
  waived:      { bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.15)', color: '#64748b' },
  credited:    { bg: 'rgba(139,92,246,0.1)',   border: 'rgba(139,92,246,0.2)',   color: '#a78bfa' },
};

function InspectionTab({ txId }: { txId: number }) {
  const { data: items, error, isLoading, mutate } = useSWR<InspectionItem[]>(
    `/transactions/${txId}/inspection`,
    () => getInspectionItems(txId),
    { revalidateOnFocus: false }
  );
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InspectionItem | null>(null);
  const [form, setForm] = useState({ description: '', severity: 'minor' as string, status: 'open' as string, repair_cost: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function resetForm() {
    setForm({ description: '', severity: 'minor', status: 'open', repair_cost: '', notes: '' });
    setEditingItem(null);
    setShowForm(false);
  }

  function handleEdit(item: InspectionItem) {
    setForm({ description: item.description, severity: item.severity, status: item.status, repair_cost: item.repair_cost != null ? String(item.repair_cost) : '', notes: item.notes ?? '' });
    setEditingItem(item);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.description.trim()) return;
    setSaving(true);
    try {
      const payload = { description: form.description, severity: form.severity, status: form.status, repair_cost: form.repair_cost ? parseFloat(form.repair_cost) : null, notes: form.notes || null };
      if (editingItem) { await updateInspectionItem(txId, editingItem.id, payload); }
      else { await createInspectionItem(txId, payload); }
      await mutate(); resetForm();
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function handleDelete(itemId: number) {
    setDeletingId(itemId);
    try { await deleteInspectionItem(txId, itemId); await mutate(); } catch { /* ignore */ } finally { setDeletingId(null); }
  }

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="lex-skeleton rounded-xl h-16" />)}</div>;

  const totalCost = (items ?? []).reduce((sum, i) => sum + (i.repair_cost ?? 0), 0);

  const selectStyle = { ...inputStyle, padding: '0.5rem 0.75rem' };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5" style={{ color: '#60a5fa' }} />
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.05em' }}>Inspection Findings</h3>
          {items && items.length > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{items.length} item{items.length !== 1 ? 's' : ''} — Total est. cost: {formatCurrency(totalCost)}</span>
          )}
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.4rem 0.875rem', borderRadius: '0.5rem', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(59,130,246,0.3)' }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Item
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl p-5" style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.875rem' }}>
            {editingItem ? 'Edit Inspection Item' : 'New Inspection Item'}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="md:col-span-2">
              <label style={labelStyle}>Description</label>
              <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. HVAC system needs repair"
                className="rounded-lg text-sm" style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
            </div>
            <div>
              <label style={labelStyle}>Severity</label>
              <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}
                className="rounded-lg text-sm" style={selectStyle} onFocus={focusInput} onBlur={blurInput}>
                <option value="minor">Minor</option>
                <option value="major">Major</option>
                <option value="safety">Safety</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="rounded-lg text-sm" style={selectStyle} onFocus={focusInput} onBlur={blurInput}>
                <option value="open">Open</option>
                <option value="negotiating">Negotiating</option>
                <option value="repaired">Repaired</option>
                <option value="waived">Waived</option>
                <option value="credited">Credited</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Estimated Repair Cost</label>
              <div className="relative">
                <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>$</span>
                <input type="number" step="50" min="0" value={form.repair_cost} onChange={(e) => setForm({ ...form, repair_cost: e.target.value })} placeholder="0"
                  className="rounded-lg text-sm" style={{ ...inputStyle, paddingLeft: '1.75rem' }} onFocus={focusInput} onBlur={blurInput} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..."
                className="rounded-lg text-sm" style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !form.description.trim()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.4rem 1rem', borderRadius: '0.5rem', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer', opacity: (saving || !form.description.trim()) ? 0.5 : 1 }}>
              {saving ? 'Saving...' : editingItem ? 'Update Item' : 'Add Item'}
            </button>
            <button onClick={resetForm}
              style={{ padding: '0.4rem 1rem', borderRadius: '0.5rem', background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.12)', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {(!items || items.length === 0) && !showForm ? (
        <div className="rounded-2xl p-8 text-center" style={cardStyle}>
          <AlertCircle className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>No inspection findings yet</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Add items to track inspection findings and repairs</p>
        </div>
      ) : items && items.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          <div className="hidden md:grid md:grid-cols-12 gap-3 px-5 py-2.5" style={{ background: 'rgba(148,163,184,0.04)', borderBottom: '1px solid rgba(148,163,184,0.07)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            <div className="col-span-4">Description</div>
            <div className="col-span-2">Severity</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Cost</div>
            <div className="col-span-2">Actions</div>
          </div>
          <div>
            {items.map((item, i) => {
              const sev = SEVERITY_CFG[item.severity] ?? SEVERITY_CFG.minor;
              const sta = STATUS_CFG[item.status] ?? STATUS_CFG.open;
              return (
                <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 px-5 py-3 items-center" style={{ borderBottom: i < items.length - 1 ? '1px solid rgba(148,163,184,0.06)' : 'none', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(148,163,184,0.03)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <div className="col-span-4">
                    <div style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>{item.description}</div>
                    {item.notes && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{item.notes}</div>}
                  </div>
                  <div className="col-span-2">
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.5rem', borderRadius: '9999px', fontSize: '0.6875rem', fontWeight: 600, background: sev.bg, border: `1px solid ${sev.border}`, color: sev.color }}>
                      {item.severity}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.5rem', borderRadius: '9999px', fontSize: '0.6875rem', fontWeight: 600, background: sta.bg, border: `1px solid ${sta.border}`, color: sta.color }}>
                      {item.status}
                    </span>
                  </div>
                  <div className="col-span-2" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {item.repair_cost != null ? formatCurrency(item.repair_cost) : '—'}
                  </div>
                  <div className="col-span-2 flex gap-3">
                    <button onClick={() => handleEdit(item)} style={{ fontSize: '0.75rem', fontWeight: 600, color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer' }}>
                      Edit
                    </button>
                    <button onClick={() => handleDelete(item.id)} disabled={deletingId === item.id} style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', opacity: deletingId === item.id ? 0.5 : 1 }}>
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
    try { await deleteTransaction(txId); router.replace('/transactions'); }
    catch { setDeleting(false); setShowDeleteConfirm(false); }
  }

  const { data: tx, error, isLoading } = useSWR<TransactionDetail>(
    `/transactions/${txId}`,
    () => getTransaction(txId),
    { refreshInterval: 30000 }
  );

  const { data: docs } = useSWR(`/transactions/${txId}/documents`, () => getDocuments(txId), { revalidateOnFocus: false });
  const { data: docSummary } = useSWR(`/transactions/${txId}/documents/summary`, () => getDocumentSummary(txId), { revalidateOnFocus: false });
  const { data: deadlinesData } = useSWR(`/transactions/${txId}/deadlines`, () => getDeadlines(txId), { revalidateOnFocus: false });

  const missed = deadlinesData?.deadlines?.filter((d) => d.status === 'missed').length ?? 0;
  const warning = deadlinesData?.deadlines?.filter((d) => d.status === 'warning').length ?? 0;

  if (isLoading) {
    return (
      <div className="p-8" style={{ background: 'var(--bg)', minHeight: '100vh' }}>
        <div className="lex-skeleton rounded-lg h-5 w-32 mb-6" />
        <div className="lex-skeleton rounded-lg h-8 w-1/2 mb-2" />
        <div className="lex-skeleton rounded-lg h-5 w-1/3 mb-8" />
        <div className="lex-skeleton rounded-2xl h-64 w-full" />
      </div>
    );
  }

  if (error || !tx) {
    return (
      <div className="p-8">
        <Link href="/transactions" className="inline-flex items-center gap-1.5 mb-6" style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
          <ChevronLeft className="h-4 w-4" />
          Back to Transactions
        </Link>
        <div className="rounded-xl p-5 flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertCircle className="h-5 w-5" style={{ color: '#f87171' }} />
          <div style={{ fontSize: '0.875rem', color: '#f87171' }}>
            {error ? `Failed to load transaction: ${error.message}` : 'Transaction not found'}
          </div>
        </div>
      </div>
    );
  }

  const dealStatus = getDealStatus(tx, tx.events, tx.deadlines);
  const healthScore = tx ? computeHealthScore(tx, docSummary ?? null, missed, warning) : 100;
  const alertCount = tx.events.filter(e => !e.dismissed).length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div className="p-6 md:p-8">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 mb-4 no-print">
          <Link href="/transactions" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#60a5fa')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#3d5068')}>
            Dashboard
          </Link>
          <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 500 }} className="truncate max-w-xs">{tx.address}</span>
        </nav>

        {/* Export PDF */}
        <div className="flex items-center justify-end mb-4 no-print">
          <button
            onClick={() => window.print()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.4rem 0.875rem', borderRadius: '0.5rem', background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.12)', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
          >
            <Printer className="h-3.5 w-3.5" />
            Export PDF
          </button>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
              {tx.address}
            </h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{PROPERTY_TYPE_LABELS[tx.property_type] ?? tx.property_type}</span>
              {tx.closing_date && (
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Closes {formatDate(tx.closing_date)}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <HealthGauge score={healthScore} />
            <StatusBadge status={dealStatus} />
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="no-print"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.4rem 0.875rem', borderRadius: '0.5rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </div>

        {/* Delete confirmation modal */}
        {showDeleteConfirm && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
            <div className="rounded-2xl p-6 w-full max-w-sm mx-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
                Delete transaction?
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.5rem' }}>
                This will permanently delete{' '}
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{tx.address}</span>{' '}
                and all its documents, deadlines, and activity. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  style={{ flex: 1, padding: '0.625rem 1rem', borderRadius: '0.625rem', background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.12)', color: '#64748b', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', opacity: deleting ? 0.5 : 1 }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{ flex: 1, padding: '0.625rem 1rem', borderRadius: '0.625rem', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', fontSize: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 2px 12px rgba(239,68,68,0.3)', opacity: deleting ? 0.5 : 1 }}
                >
                  {deleting ? 'Deleting…' : 'Yes, delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 no-print" style={{ borderBottom: '1px solid rgba(148,163,184,0.09)' }}>
          <div className="flex flex-wrap gap-0">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '0.75rem 1rem',
                  fontSize: '0.8125rem',
                  fontWeight: activeTab === tab ? 600 : 500,
                  borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
                  color: activeTab === tab ? '#60a5fa' : '#3d5068',
                  background: 'none',
                  border: 'none',
                  borderBottomWidth: '2px',
                  borderBottomStyle: 'solid',
                  borderBottomColor: activeTab === tab ? '#3b82f6' : 'transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.15s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                }}
                onMouseEnter={(e) => { if (activeTab !== tab) e.currentTarget.style.color = '#94a3b8'; }}
                onMouseLeave={(e) => { if (activeTab !== tab) e.currentTarget.style.color = '#3d5068'; }}
              >
                {tab}
                {tab === 'Alerts' && alertCount > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '1rem', width: '1rem', borderRadius: '50%', background: '#ef4444', color: '#fff', fontSize: '0.625rem', fontWeight: 700 }}>
                    {alertCount}
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
    </div>
  );
}
