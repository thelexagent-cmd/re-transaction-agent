'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { getTransactions } from '@/lib/api';
import type { TransactionListItem } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { DollarSign, Calculator, TrendingUp, ChevronDown, ChevronUp, Banknote } from 'lucide-react';

function formatPct(val: number): string {
  return `${val.toFixed(2)}%`;
}

function commissionCalc(
  salePrice: number,
  commissionPct: number,
  cobrokePct: number,
  agentSplitPct: number
) {
  const grossCommission = salePrice * (commissionPct / 100);
  const cobrokeDollar = grossCommission * (cobrokePct / 100);
  const ourSide = grossCommission - cobrokeDollar;
  const agentNet = ourSide * (agentSplitPct / 100);
  const brokerNet = ourSide - agentNet;
  return { grossCommission, cobrokeDollar, ourSide, agentNet, brokerNet };
}

interface ManualCalcState {
  salePrice: string;
  commissionPct: string;
  cobrokePct: string;
  agentSplitPct: string;
}

type DisbursementStatus = 'Pending' | 'Disbursed' | 'Partial';

type DisbursementData = {
  status: DisbursementStatus;
  dateDisbursed: string;
  notes: string;
};

function loadDisbursement(txId: number): DisbursementData {
  try {
    const stored = localStorage.getItem(`lex_disbursement_${txId}`);
    if (stored) {
      const parsed = JSON.parse(stored) as DisbursementData;
      return { status: parsed.status ?? 'Pending', dateDisbursed: parsed.dateDisbursed ?? '', notes: parsed.notes ?? '' };
    }
  } catch { /* ignore */ }
  return { status: 'Pending', dateDisbursed: '', notes: '' };
}

function saveDisbursement(txId: number, data: DisbursementData) {
  localStorage.setItem(`lex_disbursement_${txId}`, JSON.stringify(data));
}

const cardStyle = {
  background: 'var(--bg-surface)',
  border: '1px solid rgba(148,163,184,0.09)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
};

const inputStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid rgba(148,163,184,0.09)',
  color: '#f1f5f9',
  outline: 'none',
  fontSize: '0.875rem',
  padding: '0.5625rem 0.875rem',
  borderRadius: '0.5rem',
  width: '100%',
};

function StatusBadgeDisbursement({ status }: { status: DisbursementStatus }) {
  const cfg: Record<DisbursementStatus, { color: string; bg: string; border: string }> = {
    Pending:   { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.15)' },
    Disbursed: { color: '#34d399', bg: 'rgba(16,185,129,0.1)',   border: 'rgba(16,185,129,0.25)' },
    Partial:   { color: '#fbbf24', bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.25)' },
  };
  const c = cfg[status];
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5" style={{ fontSize: '0.6875rem', fontWeight: 700, color: c.color, background: c.bg, border: `1px solid ${c.border}` }}>
      {status}
    </span>
  );
}

function ResultRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid rgba(148,163,184,0.07)', ...(highlight ? { background: 'rgba(59,130,246,0.05)', margin: '0 -1rem', padding: '0.75rem 1rem', borderRadius: '0.5rem' } : {}) }}>
      <span style={{ fontSize: '0.875rem', color: highlight ? '#93c5fd' : '#94a3b8', fontWeight: highlight ? 600 : 400 }}>{label}</span>
      <span style={{ fontSize: highlight ? '1rem' : '0.875rem', fontWeight: 700, color: highlight ? '#60a5fa' : '#e2e8f0' }}>{value}</span>
    </div>
  );
}

export default function CommissionPage() {
  const { data: transactions } = useSWR('/transactions', getTransactions, { revalidateOnFocus: false });

  const [manual, setManual] = useState<ManualCalcState>({
    salePrice: '',
    commissionPct: '3',
    cobrokePct: '50',
    agentSplitPct: '70',
  });

  const [selectedTxId, setSelectedTxId] = useState<string>('');
  const selectedTx = transactions?.find((t) => String(t.id) === selectedTxId);

  const calcInput = useMemo(() => {
    const salePrice = selectedTx?.purchase_price
      ? selectedTx.purchase_price
      : parseFloat(manual.salePrice.replace(/,/g, '')) || 0;
    const commissionPct = parseFloat(manual.commissionPct) || 0;
    const cobrokePct = parseFloat(manual.cobrokePct) || 0;
    const agentSplitPct = parseFloat(manual.agentSplitPct) || 0;
    return { salePrice, commissionPct, cobrokePct, agentSplitPct };
  }, [manual, selectedTx]);

  const result = useMemo(() => commissionCalc(calcInput.salePrice, calcInput.commissionPct, calcInput.cobrokePct, calcInput.agentSplitPct), [calcInput]);

  function handleManual(field: keyof ManualCalcState, value: string) {
    setManual((prev) => ({ ...prev, [field]: value }));
  }

  const closedTransactions = transactions?.filter((t) => t.status === 'closed' && t.purchase_price) ?? [];
  const totalVolume = closedTransactions.reduce((sum, t) => sum + (t.purchase_price ?? 0), 0);
  const estGross = totalVolume * 0.03;
  const estAgentNet = estGross * 0.7;

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', boxShadow: '0 4px 16px rgba(59,130,246,0.35)' }}>
          <DollarSign className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.08em', color: '#e2e8f0' }}>
            Commission Tracker
          </h1>
          <p style={{ fontSize: '0.8125rem', color: '#3d5068', marginTop: '2px' }}>Calculate and track your commission earnings</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Closed Volume (Est.)', value: formatCurrency(totalVolume), sub: `${closedTransactions.length} closed transactions`, color: '#e2e8f0' },
          { label: 'Est. Gross Commission', value: formatCurrency(estGross), sub: 'Based on 3% avg commission', color: '#34d399' },
          { label: 'Est. Agent Net', value: formatCurrency(estAgentNet), sub: 'After co-broke & 70% split', color: '#60a5fa' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="rounded-2xl p-5" style={cardStyle}>
            <div style={{ fontSize: '0.6875rem', color: '#3d5068', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: '0.75rem', color: '#2d3f55', marginTop: '2px' }}>{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calculator */}
        <div className="rounded-2xl p-6" style={cardStyle}>
          <div className="flex items-center gap-2 mb-5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.15)' }}>
              <Calculator className="h-3.5 w-3.5" style={{ color: '#60a5fa' }} />
            </div>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0' }}>Commission Calculator</h2>
          </div>

          {transactions && transactions.length > 0 && (
            <div className="mb-5">
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4a5568', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.375rem' }}>
                Load from Transaction
              </label>
              <div className="relative">
                <select
                  value={selectedTxId}
                  onChange={(e) => setSelectedTxId(e.target.value)}
                  className="appearance-none transition-all duration-150"
                  style={{ ...inputStyle, paddingRight: '2rem' }}
                >
                  <option value="">— Manual entry —</option>
                  {transactions.filter((t) => t.purchase_price).map((t) => (
                    <option key={t.id} value={String(t.id)}>
                      {t.address} ({formatCurrency(t.purchase_price)})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: '#3d5068' }} />
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Sale Price */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4a5568', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.375rem' }}>Sale Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#3d5068', fontSize: '0.875rem' }}>$</span>
                <input
                  type="text"
                  value={selectedTx?.purchase_price ? selectedTx.purchase_price.toLocaleString() : manual.salePrice}
                  onChange={(e) => { setSelectedTxId(''); handleManual('salePrice', e.target.value); }}
                  placeholder="500,000"
                  style={{ ...inputStyle, paddingLeft: '1.5rem' }}
                  readOnly={!!selectedTx}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(59,130,246,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(148,163,184,0.09)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {[
              { field: 'commissionPct' as const, label: 'Total Commission Rate', step: '0.25', min: '0', max: '10' },
              { field: 'cobrokePct' as const, label: 'Co-broke Split (other side)', step: '5', min: '0', max: '100' },
              { field: 'agentSplitPct' as const, label: 'Your Agent Split', step: '5', min: '0', max: '100' },
            ].map(({ field, label, step, min, max }) => (
              <div key={field}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4a5568', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.375rem' }}>{label}</label>
                <div className="relative">
                  <input
                    type="number"
                    step={step}
                    min={min}
                    max={max}
                    value={manual[field]}
                    onChange={(e) => handleManual(field, e.target.value)}
                    style={{ ...inputStyle, paddingRight: '2rem' }}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(59,130,246,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(148,163,184,0.09)'; e.target.style.boxShadow = 'none'; }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#3d5068', fontSize: '0.875rem' }}>%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="rounded-2xl p-6" style={cardStyle}>
          <div className="flex items-center gap-2 mb-5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <TrendingUp className="h-3.5 w-3.5" style={{ color: '#34d399' }} />
            </div>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0' }}>Commission Breakdown</h2>
          </div>

          {calcInput.salePrice === 0 ? (
            <div className="text-center py-8" style={{ fontSize: '0.875rem', color: '#3d5068' }}>
              Enter a sale price to see the breakdown
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '0.6875rem', color: '#3d5068', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem' }}>
                Based on {formatCurrency(calcInput.salePrice)} sale
              </div>
              <ResultRow label="Sale Price" value={formatCurrency(calcInput.salePrice)} />
              <ResultRow label={`Gross Commission (${formatPct(calcInput.commissionPct)})`} value={formatCurrency(result.grossCommission)} />
              <ResultRow label={`Co-broke to Other Side (${formatPct(calcInput.cobrokePct)})`} value={`- ${formatCurrency(result.cobrokeDollar)}`} />
              <ResultRow label="Your Side of Commission" value={formatCurrency(result.ourSide)} />
              <ResultRow label={`Broker Portion (${formatPct(100 - calcInput.agentSplitPct)})`} value={`- ${formatCurrency(result.brokerNet)}`} />
              <div className="mt-3 pt-3" style={{ borderTop: '2px solid rgba(59,130,246,0.2)' }}>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.15)' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#93c5fd' }}>Your Net Commission</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#60a5fa' }}>{formatCurrency(result.agentNet)}</span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-center">
                <div className="rounded-lg p-3" style={{ background: 'rgba(148,163,184,0.05)', border: '1px solid rgba(148,163,184,0.07)' }}>
                  <div style={{ fontSize: '0.6875rem', color: '#3d5068', marginBottom: '4px' }}>Effective Rate</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#e2e8f0' }}>
                    {formatPct((result.agentNet / calcInput.salePrice) * 100)}
                  </div>
                </div>
                <div className="rounded-lg p-3" style={{ background: 'rgba(148,163,184,0.05)', border: '1px solid rgba(148,163,184,0.07)' }}>
                  <div style={{ fontSize: '0.6875rem', color: '#3d5068', marginBottom: '4px' }}>Per $1M Volume</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#e2e8f0' }}>
                    {formatCurrency((result.agentNet / calcInput.salePrice) * 1_000_000)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transaction Commission Table */}
      {transactions && transactions.filter((t) => t.purchase_price).length > 0 && (
        <div className="mt-8 rounded-2xl overflow-hidden" style={cardStyle}>
          <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(148,163,184,0.07)', background: 'rgba(148,163,184,0.03)' }}>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0' }}>Transaction Commission Estimates</h2>
            <p style={{ fontSize: '0.75rem', color: '#3d5068', marginTop: '2px' }}>Using your calculator settings above</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
                  {['Address', 'Sale Price', 'Gross Comm.', 'Agent Net', 'Status'].map((h, i) => (
                    <th key={h} className={i > 0 ? 'text-right' : 'text-left'} style={{ padding: '0.75rem 1.5rem', fontSize: '0.6875rem', fontWeight: 700, color: '#3d5068', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.filter((t) => t.purchase_price).map((tx) => {
                  const r = commissionCalc(tx.purchase_price ?? 0, calcInput.commissionPct, calcInput.cobrokePct, calcInput.agentSplitPct);
                  const statusCfg = tx.status === 'closed'
                    ? { color: '#34d399', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' }
                    : tx.status === 'active'
                    ? { color: '#60a5fa', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)' }
                    : { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.15)' };
                  return (
                    <tr key={tx.id} style={{ borderBottom: '1px solid rgba(148,163,184,0.05)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.03)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '0.75rem 1.5rem' }}>
                        <Link href={`/transactions/${tx.id}`} style={{ color: '#3b82f6', fontSize: '0.875rem' }}>
                          {tx.address}
                        </Link>
                      </td>
                      <td className="text-right" style={{ padding: '0.75rem 1.5rem', color: '#94a3b8', fontSize: '0.875rem' }}>{formatCurrency(tx.purchase_price)}</td>
                      <td className="text-right" style={{ padding: '0.75rem 1.5rem', color: '#94a3b8', fontSize: '0.875rem' }}>{formatCurrency(r.grossCommission)}</td>
                      <td className="text-right" style={{ padding: '0.75rem 1.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#34d399' }}>{formatCurrency(r.agentNet)}</td>
                      <td className="text-right" style={{ padding: '0.75rem 1.5rem' }}>
                        <span className="inline-flex items-center rounded-full px-2 py-0.5" style={{ fontSize: '0.6875rem', fontWeight: 700, color: statusCfg.color, background: statusCfg.bg, border: `1px solid ${statusCfg.border}` }}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DisbursementTracker
        transactions={transactions ?? []}
        commissionPct={calcInput.commissionPct}
        cobrokePct={calcInput.cobrokePct}
        agentSplitPct={calcInput.agentSplitPct}
      />
    </div>
  );
}

function DisbursementTracker({
  transactions,
  commissionPct,
  cobrokePct,
  agentSplitPct,
}: {
  transactions: TransactionListItem[];
  commissionPct: number;
  cobrokePct: number;
  agentSplitPct: number;
}) {
  const [disbursements, setDisbursements] = useState<Record<number, DisbursementData>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const txWithPrice = useMemo(() => transactions.filter((t) => t.purchase_price), [transactions]);

  useEffect(() => {
    const loaded: Record<number, DisbursementData> = {};
    txWithPrice.forEach((tx) => { loaded[tx.id] = loadDisbursement(tx.id); });
    setDisbursements(loaded);
  }, [txWithPrice]);

  const updateDisbursement = useCallback((txId: number, updates: Partial<DisbursementData>) => {
    setDisbursements((prev) => {
      const current = prev[txId] ?? { status: 'Pending' as DisbursementStatus, dateDisbursed: '', notes: '' };
      const updated = { ...current, ...updates };
      saveDisbursement(txId, updated);
      return { ...prev, [txId]: updated };
    });
  }, []);

  const summary = useMemo(() => {
    let totalPending = 0, totalDisbursed = 0, countPending = 0, countDisbursed = 0, countPartial = 0;
    const currentYear = new Date().getFullYear();
    txWithPrice.forEach((tx) => {
      const d = disbursements[tx.id];
      const calc = commissionCalc(tx.purchase_price ?? 0, commissionPct, cobrokePct, agentSplitPct);
      if (!d || d.status === 'Pending') { totalPending += calc.agentNet; countPending++; }
      else if (d.status === 'Disbursed') {
        if (d.dateDisbursed && new Date(d.dateDisbursed).getFullYear() === currentYear) totalDisbursed += calc.agentNet;
        else if (!d.dateDisbursed) totalDisbursed += calc.agentNet;
        countDisbursed++;
      } else { countPartial++; totalPending += calc.agentNet * 0.5; totalDisbursed += calc.agentNet * 0.5; }
    });
    return { totalPending, totalDisbursed, countPending, countDisbursed, countPartial };
  }, [txWithPrice, disbursements, commissionPct, cobrokePct, agentSplitPct]);

  if (txWithPrice.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <Banknote className="h-4 w-4" style={{ color: '#60a5fa' }} />
        </div>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#e2e8f0' }}>Disbursement Tracker</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Pending', value: formatCurrency(summary.totalPending), sub: `${summary.countPending} transactions`, color: '#e2e8f0' },
          { label: 'Disbursed This Year', value: formatCurrency(summary.totalDisbursed), sub: `${summary.countDisbursed} transactions`, color: '#34d399' },
          { label: 'Partial', value: String(summary.countPartial), sub: 'transactions', color: '#fbbf24' },
          { label: 'Total Tracked', value: String(txWithPrice.length), sub: 'transactions', color: '#60a5fa' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="rounded-2xl p-5" style={cardStyle}>
            <div style={{ fontSize: '0.6875rem', color: '#3d5068', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: '0.75rem', color: '#2d3f55', marginTop: '2px' }}>{sub}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl overflow-hidden" style={cardStyle}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.07)', background: 'rgba(148,163,184,0.03)' }}>
                {['Property', 'Sale Price', 'Commission $', 'Status', 'Date Disbursed', 'Notes', ''].map((h, i) => (
                  <th key={i} className={i > 0 && i < 6 ? 'text-right' : 'text-left'} style={{ padding: '0.75rem 1.5rem', fontSize: '0.6875rem', fontWeight: 700, color: '#3d5068', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {txWithPrice.map((tx) => {
                const d = disbursements[tx.id] ?? { status: 'Pending' as DisbursementStatus, dateDisbursed: '', notes: '' };
                const calc = commissionCalc(tx.purchase_price ?? 0, commissionPct, cobrokePct, agentSplitPct);
                const isExpanded = expandedId === tx.id;
                return (
                  <DisbursementRow
                    key={tx.id}
                    tx={tx}
                    data={d}
                    agentNet={calc.agentNet}
                    isExpanded={isExpanded}
                    onToggleExpand={() => setExpandedId(isExpanded ? null : tx.id)}
                    onUpdate={(updates) => updateDisbursement(tx.id, updates)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DisbursementRow({
  tx, data, agentNet, isExpanded, onToggleExpand, onUpdate,
}: {
  tx: TransactionListItem;
  data: DisbursementData;
  agentNet: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<DisbursementData>) => void;
}) {
  const rowInputStyle = {
    background: 'var(--bg-elevated)',
    border: '1px solid rgba(148,163,184,0.09)',
    color: '#f1f5f9',
    outline: 'none',
    fontSize: '0.875rem',
    padding: '0.375rem 0.625rem',
    borderRadius: '0.375rem',
    width: '100%',
  };
  return (
    <>
      <tr
        className="cursor-pointer transition-colors duration-100"
        style={{ borderBottom: '1px solid rgba(148,163,184,0.05)' }}
        onClick={onToggleExpand}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.03)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        <td style={{ padding: '0.75rem 1.5rem' }}>
          <Link href={`/transactions/${tx.id}`} style={{ color: '#3b82f6', fontSize: '0.875rem' }} onClick={(e) => e.stopPropagation()}>
            {tx.address}
          </Link>
        </td>
        <td className="text-right" style={{ padding: '0.75rem 1.5rem', color: '#94a3b8', fontSize: '0.875rem' }}>{formatCurrency(tx.purchase_price)}</td>
        <td className="text-right" style={{ padding: '0.75rem 1.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#34d399' }}>{formatCurrency(agentNet)}</td>
        <td className="text-center" style={{ padding: '0.75rem 1.5rem' }}><StatusBadgeDisbursement status={data.status} /></td>
        <td style={{ padding: '0.75rem 1.5rem', color: '#3d5068', fontSize: '0.75rem' }}>{data.dateDisbursed || '—'}</td>
        <td className="max-w-[150px] truncate" style={{ padding: '0.75rem 1.5rem', color: '#3d5068', fontSize: '0.75rem' }}>{data.notes || '—'}</td>
        <td style={{ padding: '0.75rem 0.75rem', color: '#3d5068' }}>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={7} style={{ padding: '1rem 1.5rem', background: 'rgba(148,163,184,0.03)', borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  label: 'Status',
                  content: (
                    <select
                      value={data.status}
                      onChange={(e) => onUpdate({ status: e.target.value as DisbursementStatus })}
                      onClick={(e) => e.stopPropagation()}
                      style={rowInputStyle}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Disbursed">Disbursed</option>
                      <option value="Partial">Partial</option>
                    </select>
                  ),
                },
                {
                  label: 'Date Disbursed',
                  content: (
                    <input
                      type="date"
                      value={data.dateDisbursed}
                      onChange={(e) => onUpdate({ dateDisbursed: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      style={rowInputStyle}
                    />
                  ),
                },
                {
                  label: 'Notes',
                  content: (
                    <input
                      type="text"
                      value={data.notes}
                      onChange={(e) => onUpdate({ notes: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Add notes..."
                      style={rowInputStyle}
                    />
                  ),
                },
              ].map(({ label, content }) => (
                <div key={label}>
                  <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.375rem' }}>{label}</label>
                  {content}
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
