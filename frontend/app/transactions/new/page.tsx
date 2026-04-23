'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createTransaction, parseContract, getParseStatus } from '@/lib/api';
import type { TransactionListItem } from '@/lib/api';
import { useOnboarding } from '@/components/onboarding/OnboardingManager';
import OnboardingTooltip from '@/components/onboarding/OnboardingTooltip';
import { ChevronLeft, ChevronDown, Upload, Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react';

const PROPERTY_TYPES: { label: string; value: string }[] = [
  { label: 'SFH', value: 'sfh' },
  { label: 'Condo', value: 'condo' },
  { label: 'Townhouse', value: 'townhouse' },
  { label: 'Multi-family', value: 'multi_family' },
  { label: 'Other', value: 'other' },
];

const STAGE_OPTIONS: { label: string; value: string }[] = [
  { label: 'Select stage...', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Under Contract', value: 'under_contract' },
  { label: 'Inspection', value: 'inspection' },
  { label: 'Financing', value: 'financing' },
  { label: 'Clear to Close', value: 'clear_to_close' },
];

type ParseStatus = 'idle' | 'uploading' | 'parsing' | 'done' | 'error';

const cardStyle = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  outline: 'none',
  fontSize: '0.875rem',
  padding: '0.5625rem 0.875rem',
  borderRadius: '0.5rem',
  width: '100%',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--text-muted)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  marginBottom: '0.375rem',
};

function FormInput({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>
        {label}{required && <span style={{ color: '#f87171', marginLeft: '2px' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

export default function NewTransactionPage() {
  const router = useRouter();
  const { newTxGuideShown, markNewTxGuideDone } = useOnboarding();

  const [step, setStep] = useState<1 | 2>(1);
  const [createdTx, setCreatedTx] = useState<TransactionListItem | null>(null);

  // Required fields (shown upfront)
  const [address, setAddress] = useState('');
  const [propertyType, setPropertyType] = useState('sfh');
  const [stage, setStage] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');

  // Optional fields (progressive disclosure)
  const [expanded, setExpanded] = useState(false);
  const [sellerName, setSellerName] = useState('');
  const [sellerEmail, setSellerEmail] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [closingDate, setClosingDate] = useState('');
  const [executionDate, setExecutionDate] = useState('');
  const [lenderName, setLenderName] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Step 2
  const [file, setFile] = useState<File | null>(null);
  const [parseStatus, setParseStatus] = useState<ParseStatus>('idle');
  const [parseMessage, setParseMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // First-time tooltip guide
  const [guideStep, setGuideStep] = useState(0);

  useEffect(() => {
    if (!newTxGuideShown) {
      const t = setTimeout(() => setGuideStep(1), 600);
      return () => clearTimeout(t);
    }
  }, [newTxGuideShown]);

  const canCreate = !!(address.trim() && stage && buyerName.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      const parties = [
        buyerName.trim() ? { role: 'buyer', full_name: buyerName.trim(), email: buyerEmail.trim() || undefined } : null,
        sellerName.trim() ? { role: 'seller', full_name: sellerName.trim(), email: sellerEmail.trim() || undefined } : null,
        lenderName.trim() ? { role: 'lender', full_name: lenderName.trim() } : null,
      ].filter((p): p is NonNullable<typeof p> => p !== null);

      const tx = await createTransaction({
        address: address.trim(),
        property_type: propertyType,
        status: stage,
        purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
        closing_date: closingDate || null,
        contract_execution_date: executionDate || null,
        parties,
      });
      setCreatedTx(tx);
      setStep(2);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create transaction');
    } finally {
      setSubmitting(false);
    }
  }

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type === 'application/pdf') setFile(dropped);
  }, []);

  async function handleUpload() {
    if (!file || !createdTx) return;
    setParseStatus('uploading');
    setParseMessage('Uploading contract...');
    try {
      const result = await parseContract(createdTx.id, file);
      setParseStatus('parsing');
      setParseMessage('Parsing contract...');
      const taskId = result.task_id;
      let attempts = 0;
      const poll = async () => {
        if (attempts >= 40) { setParseStatus('error'); setParseMessage('Parsing timed out. Please try again.'); return; }
        attempts++;
        try {
          const status = await getParseStatus(createdTx.id, taskId);
          if (status.status === 'completed' || status.status === 'success') {
            setParseStatus('done'); setParseMessage('Contract parsed successfully!');
          } else if (status.status === 'failed' || status.status === 'error') {
            setParseStatus('error'); setParseMessage('Contract parsing failed. You can still proceed.');
          } else { setTimeout(poll, 3000); }
        } catch { setTimeout(poll, 3000); }
      };
      setTimeout(poll, 3000);
    } catch (err) {
      setParseStatus('error');
      setParseMessage(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  const focusHandler = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = 'rgba(59,130,246,0.4)';
    e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)';
  };
  const blurHandler = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = 'rgba(148,163,184,0.09)';
    e.target.style.boxShadow = 'none';
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link
        href="/transactions"
        className="inline-flex items-center gap-1.5 mb-6 transition-colors"
        style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#3d5068'; }}
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Transactions
      </Link>

      <div className="mb-8">
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
          {step === 1 ? 'New Transaction' : 'Upload Contract'}
        </h1>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          {step === 1
            ? 'Fill in the transaction details to get started'
            : 'Optionally upload the contract PDF to automatically extract key dates and deadlines'}
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-8">
        {[
          { num: 1, label: 'Transaction Details' },
          { num: 2, label: 'Upload Contract' },
        ].map(({ num, label }, idx) => (
          <>
            <div key={num} className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold" style={{
              background: step >= num ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'rgba(148,163,184,0.1)',
              color: step >= num ? '#fff' : '#3d5068',
              boxShadow: step >= num ? '0 2px 8px rgba(59,130,246,0.3)' : 'none',
            }}>{num}</div>
            <div style={{ fontSize: '0.75rem', color: step >= num ? '#94a3b8' : '#3d5068', fontWeight: step >= num ? 500 : 400 }}>{label}</div>
            {idx === 0 && <div className="h-px flex-1" style={{ background: 'rgba(148,163,184,0.1)' }} />}
          </>
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Property Info */}
          <div className="rounded-2xl p-6" style={cardStyle}>
            <h2 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '1.25rem' }}>
              Property Info
            </h2>
            <div className="space-y-4">
              <FormInput label="Property Address" required>
                <input
                  data-tour="newtx-address"
                  type="text" required value={address} onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 123 Palm Ave, Miami, FL"
                  style={inputStyle} onFocus={focusHandler} onBlur={blurHandler}
                />
              </FormInput>
              <div className="grid grid-cols-2 gap-4">
                <FormInput label="Property Type">
                  <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} style={inputStyle} onFocus={focusHandler} onBlur={blurHandler}>
                    {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </FormInput>
                <FormInput label="Deal Stage" required>
                  <select
                    data-tour="newtx-stage"
                    value={stage} onChange={(e) => setStage(e.target.value)}
                    style={inputStyle} onFocus={focusHandler} onBlur={blurHandler}
                  >
                    {STAGE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </FormInput>
              </div>
            </div>
          </div>

          {/* Client Info */}
          <div className="rounded-2xl p-6" style={cardStyle}>
            <h2 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '1.25rem' }}>
              Client Info
            </h2>
            <div className="space-y-4">
              <FormInput label="Buyer Name" required>
                <input
                  type="text" value={buyerName} onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="e.g. Carlos Garcia"
                  style={inputStyle} onFocus={focusHandler} onBlur={blurHandler}
                />
              </FormInput>
              <FormInput label="Buyer Email">
                <input
                  type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)}
                  placeholder="buyer@email.com"
                  style={inputStyle} onFocus={focusHandler} onBlur={blurHandler}
                />
              </FormInput>
            </div>
          </div>

          {/* Expand toggle */}
          {!expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="flex items-center gap-1.5 transition-colors"
              style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-muted)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#60a5fa'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
            >
              <ChevronDown className="h-4 w-4" />
              + Add more details
            </button>
          )}

          {/* Expanded sections */}
          {expanded && (
            <>
              {/* Seller Info */}
              <div className="rounded-2xl p-6" style={cardStyle}>
                <h2 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '1.25rem' }}>
                  Seller Info
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <FormInput label="Seller Name">
                    <input type="text" value={sellerName} onChange={(e) => setSellerName(e.target.value)} placeholder="e.g. Maria Lopez" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
                  </FormInput>
                  <FormInput label="Seller Email">
                    <input type="email" value={sellerEmail} onChange={(e) => setSellerEmail(e.target.value)} placeholder="seller@email.com" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
                  </FormInput>
                </div>
              </div>

              {/* Financials */}
              <div className="rounded-2xl p-6" style={cardStyle}>
                <h2 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '1.25rem' }}>
                  Financials
                </h2>
                <div className="space-y-4">
                  <FormInput label="Purchase Price">
                    <input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="e.g. 750000" min="0" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
                  </FormInput>
                  <div className="grid grid-cols-2 gap-4">
                    <FormInput label="Estimated Closing Date">
                      <input type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
                      {closingDate && new Date(closingDate) < new Date(Date.now() - 86400000) && (
                        <p style={{ fontSize: '0.75rem', color: '#f59e0b', margin: '0.25rem 0 0' }}>This date is in the past</p>
                      )}
                    </FormInput>
                    <FormInput label="Contract Execution Date">
                      <input type="date" value={executionDate} onChange={(e) => setExecutionDate(e.target.value)} style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
                    </FormInput>
                  </div>
                </div>
              </div>

              {/* Lender */}
              <div className="rounded-2xl p-6" style={cardStyle}>
                <h2 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '1.25rem' }}>
                  Lender <span style={{ fontWeight: 400, fontSize: '0.75rem', letterSpacing: 0, textTransform: 'none' }}>(optional)</span>
                </h2>
                <FormInput label="Lender Name">
                  <input type="text" value={lenderName} onChange={(e) => setLenderName(e.target.value)} placeholder="e.g. Wells Fargo" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
                </FormInput>
              </div>
            </>
          )}

          {submitError && (
            <div className="rounded-lg px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.8125rem', color: '#f87171' }}>
              <AlertCircle className="h-4 w-4 shrink-0" />
              {submitError}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            {!canCreate && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Fill required fields to continue
              </span>
            )}
            <button
              data-tour="newtx-create"
              type="submit" disabled={!canCreate || submitting}
              className="inline-flex items-center gap-2 rounded-lg transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ padding: '0.625rem 1.5rem', fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', boxShadow: '0 2px 12px rgba(59,130,246,0.3)' }}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Creating...' : 'Create Transaction'}
            </button>
          </div>
        </form>
      )}

      {/* Step 2 */}
      {step === 2 && createdTx && (
        <div className="space-y-6">
          <div className="rounded-xl px-5 py-4 flex items-center gap-3" style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: '#34d399' }} />
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#34d399' }}>Transaction created successfully!</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{createdTx.address}</div>
            </div>
          </div>

          <div className="rounded-2xl p-6" style={cardStyle}>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Upload Contract PDF</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Upload the purchase agreement to automatically extract key dates, deadlines, and parties.
            </p>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl p-8 text-center cursor-pointer transition-all duration-150"
              style={{
                border: dragOver ? '2px dashed rgba(59,130,246,0.5)' : file ? '2px dashed rgba(16,185,129,0.4)' : '2px dashed rgba(148,163,184,0.15)',
                background: dragOver ? 'rgba(59,130,246,0.05)' : file ? 'rgba(16,185,129,0.04)' : 'rgba(148,163,184,0.03)',
              }}
            >
              <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="h-8 w-8" style={{ color: '#34d399' }} />
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>{file.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{(file.size / 1024).toFixed(1)} KB</div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8" style={{ color: 'var(--text-muted)' }} />
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)' }}>Drop PDF here or click to browse</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PDF files only</div>
                </div>
              )}
            </div>

            {(parseStatus === 'uploading' || parseStatus === 'parsing') && (
              <div className="mt-4 flex items-center gap-2" style={{ fontSize: '0.875rem', color: '#60a5fa' }}>
                <Loader2 className="h-4 w-4 animate-spin" />
                {parseMessage}
              </div>
            )}
            {parseStatus === 'done' && (
              <div className="mt-4 flex items-center gap-2" style={{ fontSize: '0.875rem', color: '#34d399' }}>
                <CheckCircle2 className="h-4 w-4" />
                {parseMessage}
              </div>
            )}
            {parseStatus === 'error' && (
              <div className="mt-4 flex items-center gap-2" style={{ fontSize: '0.875rem', color: '#f87171' }}>
                <AlertCircle className="h-4 w-4" />
                {parseMessage}
              </div>
            )}

            {(parseStatus === 'idle' || parseStatus === 'error') && (
              <button
                onClick={handleUpload} disabled={!file}
                className="mt-4 inline-flex items-center gap-2 rounded-lg transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ padding: '0.5625rem 1rem', fontSize: '0.8125rem', fontWeight: 600, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa' }}
              >
                <Upload className="h-4 w-4" />
                Upload &amp; Parse Contract
              </button>
            )}
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => router.push(`/transactions/${createdTx.id}`)}
              style={{ fontSize: '0.875rem', color: 'var(--text-muted)', transition: 'color 150ms' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#3d5068'; }}
            >
              Skip for now
            </button>
            <Link
              href={`/transactions/${createdTx.id}`}
              className="inline-flex items-center gap-2 rounded-lg transition-all duration-150 active:scale-[0.98]"
              style={{ padding: '0.5625rem 1.25rem', fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', boxShadow: '0 2px 8px rgba(59,130,246,0.3)' }}
            >
              Go to Deal
            </Link>
          </div>
        </div>
      )}

      {/* First-time tooltip guide */}
      {step === 1 && guideStep >= 1 && guideStep <= 3 && (() => {
        const steps = [
          { selector: '[data-tour="newtx-address"]', text: 'Start with the property address', position: 'bottom' as const },
          { selector: '[data-tour="newtx-stage"]',   text: 'Set the current deal stage',       position: 'bottom' as const },
          { selector: '[data-tour="newtx-create"]',  text: 'Fill required fields to create',   position: 'top'    as const },
        ];
        const s = steps[guideStep - 1];
        return (
          <OnboardingTooltip
            key={guideStep}
            targetSelector={s.selector}
            text={s.text}
            step={guideStep}
            total={3}
            position={s.position}
            nextLabel={guideStep === 3 ? 'Got it ✓' : 'Next →'}
            onNext={() => {
              if (guideStep === 3) {
                markNewTxGuideDone();
                setGuideStep(4);
              } else {
                setGuideStep(guideStep + 1);
              }
            }}
            onDismiss={() => {
              markNewTxGuideDone();
              setGuideStep(4);
            }}
          />
        );
      })()}
    </div>
  );
}
