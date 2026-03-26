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

// ── Disbursement Types & Helpers ──────────────────────────────────────────

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
      return {
        status: parsed.status ?? 'Pending',
        dateDisbursed: parsed.dateDisbursed ?? '',
        notes: parsed.notes ?? '',
      };
    }
  } catch {
    // ignore
  }
  return { status: 'Pending', dateDisbursed: '', notes: '' };
}

function saveDisbursement(txId: number, data: DisbursementData) {
  localStorage.setItem(`lex_disbursement_${txId}`, JSON.stringify(data));
}

function StatusBadgeDisbursement({ status }: { status: DisbursementStatus }) {
  const colors: Record<DisbursementStatus, string> = {
    Pending: 'bg-slate-100 text-slate-600',
    Disbursed: 'bg-green-100 text-green-800',
    Partial: 'bg-yellow-100 text-yellow-800',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status]}`}>
      {status}
    </span>
  );
}

function ResultRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-3 border-b border-slate-100 ${highlight ? 'bg-blue-50 -mx-4 px-4 rounded' : ''}`}>
      <span className={`text-sm ${highlight ? 'font-semibold text-blue-900' : 'text-slate-600'}`}>{label}</span>
      <span className={`text-sm font-bold ${highlight ? 'text-blue-700 text-base' : 'text-slate-900'}`}>{value}</span>
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

  // Populate from selected transaction
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

  const result = useMemo(() => commissionCalc(
    calcInput.salePrice,
    calcInput.commissionPct,
    calcInput.cobrokePct,
    calcInput.agentSplitPct
  ), [calcInput]);

  function handleManual(field: keyof ManualCalcState, value: string) {
    setManual((prev) => ({ ...prev, [field]: value }));
  }

  // Summary stats from all transactions
  const closedTransactions = transactions?.filter((t) => t.status === 'closed' && t.purchase_price) ?? [];
  const totalVolume = closedTransactions.reduce((sum, t) => sum + (t.purchase_price ?? 0), 0);
  const estGross = totalVolume * 0.03; // estimate 3% commission
  const estAgentNet = estGross * 0.7; // estimate 70% agent split after co-broke

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
          <DollarSign className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Commission Tracker</h1>
          <p className="text-sm text-slate-500">Calculate and track your commission earnings</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Closed Volume (Est.)</div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalVolume)}</div>
          <div className="text-xs text-slate-400 mt-1">{closedTransactions.length} closed transactions</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Est. Gross Commission</div>
          <div className="text-2xl font-bold text-green-700">{formatCurrency(estGross)}</div>
          <div className="text-xs text-slate-400 mt-1">Based on 3% avg commission</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Est. Agent Net</div>
          <div className="text-2xl font-bold text-blue-700">{formatCurrency(estAgentNet)}</div>
          <div className="text-xs text-slate-400 mt-1">After co-broke & 70% split</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calculator */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <Calculator className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-900">Commission Calculator</h2>
          </div>

          {/* Load from transaction */}
          {transactions && transactions.length > 0 && (
            <div className="mb-5">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Load from Transaction</label>
              <div className="relative">
                <select
                  value={selectedTxId}
                  onChange={(e) => setSelectedTxId(e.target.value)}
                  className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Manual entry --</option>
                  {transactions.filter((t) => t.purchase_price).map((t) => (
                    <option key={t.id} value={String(t.id)}>
                      {t.address} ({formatCurrency(t.purchase_price)})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Sale Price */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Sale Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input
                  type="text"
                  value={selectedTx?.purchase_price ? selectedTx.purchase_price.toLocaleString() : manual.salePrice}
                  onChange={(e) => { setSelectedTxId(''); handleManual('salePrice', e.target.value); }}
                  placeholder="500,000"
                  className="w-full pl-7 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  readOnly={!!selectedTx}
                />
              </div>
            </div>

            {/* Commission % */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Total Commission Rate
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  max="10"
                  value={manual.commissionPct}
                  onChange={(e) => handleManual('commissionPct', e.target.value)}
                  className="w-full pr-8 pl-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
              </div>
            </div>

            {/* Co-broke split */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Co-broke Split (other side)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="5"
                  min="0"
                  max="100"
                  value={manual.cobrokePct}
                  onChange={(e) => handleManual('cobrokePct', e.target.value)}
                  className="w-full pr-8 pl-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
              </div>
            </div>

            {/* Agent split */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Your Agent Split
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="5"
                  min="0"
                  max="100"
                  value={manual.agentSplitPct}
                  onChange={(e) => handleManual('agentSplitPct', e.target.value)}
                  className="w-full pr-8 pl-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <h2 className="text-base font-semibold text-slate-900">Commission Breakdown</h2>
          </div>

          {calcInput.salePrice === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              Enter a sale price to see the breakdown
            </div>
          ) : (
            <div className="space-y-0">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-3 font-medium">
                Based on {formatCurrency(calcInput.salePrice)} sale
              </div>
              <ResultRow label="Sale Price" value={formatCurrency(calcInput.salePrice)} />
              <ResultRow label={`Gross Commission (${formatPct(calcInput.commissionPct)})`} value={formatCurrency(result.grossCommission)} />
              <ResultRow label={`Co-broke to Other Side (${formatPct(calcInput.cobrokePct)})`} value={`- ${formatCurrency(result.cobrokeDollar)}`} />
              <ResultRow label="Your Side of Commission" value={formatCurrency(result.ourSide)} />
              <ResultRow label={`Broker Portion (${formatPct(100 - calcInput.agentSplitPct)})`} value={`- ${formatCurrency(result.brokerNet)}`} />
              <div className="mt-3 pt-3 border-t-2 border-blue-200">
                <div className="flex items-center justify-between py-2 bg-blue-50 -mx-2 px-2 rounded-lg">
                  <span className="text-sm font-bold text-blue-900">Your Net Commission</span>
                  <span className="text-xl font-bold text-blue-700">{formatCurrency(result.agentNet)}</span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-center">
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs text-slate-500 mb-1">Effective Rate</div>
                  <div className="text-base font-bold text-slate-900">
                    {formatPct((result.agentNet / calcInput.salePrice) * 100)}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs text-slate-500 mb-1">Per $1M Volume</div>
                  <div className="text-base font-bold text-slate-900">
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
        <div className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <h2 className="text-base font-semibold text-slate-900">Transaction Commission Estimates</h2>
            <p className="text-xs text-slate-500 mt-0.5">Using your calculator settings above</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Address</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sale Price</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Gross Comm.</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Agent Net</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions
                  .filter((t) => t.purchase_price)
                  .map((tx) => {
                    const r = commissionCalc(
                      tx.purchase_price ?? 0,
                      calcInput.commissionPct,
                      calcInput.cobrokePct,
                      calcInput.agentSplitPct
                    );
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50">
                        <td className="px-6 py-3">
                          <Link href={`/transactions/${tx.id}`} className="text-blue-600 hover:underline">
                            {tx.address}
                          </Link>
                        </td>
                        <td className="px-6 py-3 text-right text-slate-700">{formatCurrency(tx.purchase_price)}</td>
                        <td className="px-6 py-3 text-right text-slate-700">{formatCurrency(r.grossCommission)}</td>
                        <td className="px-6 py-3 text-right font-semibold text-green-700">{formatCurrency(r.agentNet)}</td>
                        <td className="px-6 py-3 text-right">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            tx.status === 'closed' ? 'bg-green-100 text-green-800' :
                            tx.status === 'active' ? 'bg-blue-100 text-blue-800' :
                            'bg-slate-100 text-slate-600'
                          }`}>
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

      {/* Disbursement Tracker */}
      <DisbursementTracker
        transactions={transactions ?? []}
        commissionPct={calcInput.commissionPct}
        cobrokePct={calcInput.cobrokePct}
        agentSplitPct={calcInput.agentSplitPct}
      />
    </div>
  );
}

// ── Disbursement Tracker ──────────────────────────────────────────────────────

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

  // Load all disbursement data on mount / when transactions change
  useEffect(() => {
    const loaded: Record<number, DisbursementData> = {};
    txWithPrice.forEach((tx) => {
      loaded[tx.id] = loadDisbursement(tx.id);
    });
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

  // Summary calculations
  const summary = useMemo(() => {
    let totalPending = 0;
    let totalDisbursed = 0;
    let countPending = 0;
    let countDisbursed = 0;
    let countPartial = 0;

    const currentYear = new Date().getFullYear();

    txWithPrice.forEach((tx) => {
      const d = disbursements[tx.id];
      const calc = commissionCalc(tx.purchase_price ?? 0, commissionPct, cobrokePct, agentSplitPct);

      if (!d || d.status === 'Pending') {
        totalPending += calc.agentNet;
        countPending++;
      } else if (d.status === 'Disbursed') {
        if (d.dateDisbursed) {
          const year = new Date(d.dateDisbursed).getFullYear();
          if (year === currentYear) totalDisbursed += calc.agentNet;
        } else {
          totalDisbursed += calc.agentNet;
        }
        countDisbursed++;
      } else {
        // Partial
        countPartial++;
        totalPending += calc.agentNet * 0.5;
        totalDisbursed += calc.agentNet * 0.5;
      }
    });

    return { totalPending, totalDisbursed, countPending, countDisbursed, countPartial };
  }, [txWithPrice, disbursements, commissionPct, cobrokePct, agentSplitPct]);

  if (txWithPrice.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-6">
        <Banknote className="h-5 w-5 text-blue-600" />
        <h2 className="text-lg font-bold text-slate-900">Disbursement Tracker</h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Pending</div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(summary.totalPending)}</div>
          <div className="text-xs text-slate-400 mt-1">{summary.countPending} transactions</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Disbursed This Year</div>
          <div className="text-2xl font-bold text-green-700">{formatCurrency(summary.totalDisbursed)}</div>
          <div className="text-xs text-slate-400 mt-1">{summary.countDisbursed} transactions</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Partial</div>
          <div className="text-2xl font-bold text-yellow-700">{summary.countPartial}</div>
          <div className="text-xs text-slate-400 mt-1">transactions</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Tracked</div>
          <div className="text-2xl font-bold text-blue-700">{txWithPrice.length}</div>
          <div className="text-xs text-slate-400 mt-1">transactions</div>
        </div>
      </div>

      {/* Disbursement Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Property</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sale Price</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Commission $</th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date Disbursed</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</th>
                <th className="w-10 px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
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
  tx,
  data,
  agentNet,
  isExpanded,
  onToggleExpand,
  onUpdate,
}: {
  tx: TransactionListItem;
  data: DisbursementData;
  agentNet: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<DisbursementData>) => void;
}) {
  return (
    <>
      <tr
        className="hover:bg-slate-50 cursor-pointer transition-colors"
        onClick={onToggleExpand}
      >
        <td className="px-6 py-3">
          <Link
            href={`/transactions/${tx.id}`}
            className="text-blue-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {tx.address}
          </Link>
        </td>
        <td className="px-6 py-3 text-right text-slate-700">{formatCurrency(tx.purchase_price)}</td>
        <td className="px-6 py-3 text-right font-semibold text-green-700">{formatCurrency(agentNet)}</td>
        <td className="px-6 py-3 text-center">
          <StatusBadgeDisbursement status={data.status} />
        </td>
        <td className="px-6 py-3 text-slate-600 text-xs">
          {data.dateDisbursed || '--'}
        </td>
        <td className="px-6 py-3 text-slate-500 text-xs truncate max-w-[150px]">
          {data.notes || '--'}
        </td>
        <td className="px-3 py-3 text-slate-400">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={7} className="px-6 py-4 bg-slate-50 border-b border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={data.status}
                  onChange={(e) => onUpdate({ status: e.target.value as DisbursementStatus })}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Pending">Pending</option>
                  <option value="Disbursed">Disbursed</option>
                  <option value="Partial">Partial</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Date Disbursed</label>
                <input
                  type="date"
                  value={data.dateDisbursed}
                  onChange={(e) => onUpdate({ dateDisbursed: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={data.notes}
                  onChange={(e) => onUpdate({ notes: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Add notes..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
