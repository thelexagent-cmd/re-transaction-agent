'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createTransaction, parseContract, getParseStatus } from '@/lib/api';
import type { TransactionListItem } from '@/lib/api';
import { ChevronLeft, Plus, Trash2, Upload, Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react';

type Party = {
  role: string;
  full_name: string;
  email: string;
  phone: string;
};

const PROPERTY_TYPES: { label: string; value: string }[] = [
  { label: 'SFH', value: 'sfh' },
  { label: 'Condo', value: 'condo' },
  { label: 'Townhouse', value: 'townhouse' },
  { label: 'Multi-family', value: 'multi_family' },
  { label: 'Other', value: 'other' },
];

const PARTY_ROLES: { label: string; value: string }[] = [
  { label: 'Buyer', value: 'buyer' },
  { label: 'Seller', value: 'seller' },
  { label: 'Buyer Agent', value: 'buyers_agent' },
  { label: 'Seller Agent', value: 'listing_agent' },
  { label: 'Lender', value: 'lender' },
  { label: 'Title Officer', value: 'title' },
  { label: 'Escrow', value: 'escrow' },
  { label: 'HOA', value: 'hoa' },
];

type ParseStatus = 'idle' | 'uploading' | 'parsing' | 'done' | 'error';

const cardStyle = {
  background: 'var(--bg-surface)',
  border: '1px solid rgba(148,163,184,0.09)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid rgba(148,163,184,0.09)',
  color: '#f1f5f9',
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
  color: '#4a5568',
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

  const [step, setStep] = useState<1 | 2>(1);
  const [createdTx, setCreatedTx] = useState<TransactionListItem | null>(null);

  const [address, setAddress] = useState('');
  const [propertyType, setPropertyType] = useState('sfh');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [closingDate, setClosingDate] = useState('');
  const [executionDate, setExecutionDate] = useState('');
  const [parties, setParties] = useState<Party[]>([
    { role: 'buyer', full_name: '', email: '', phone: '' },
    { role: 'seller', full_name: '', email: '', phone: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [file, setFile] = useState<File | null>(null);
  const [parseStatus, setParseStatus] = useState<ParseStatus>('idle');
  const [parseMessage, setParseMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function addParty() { setParties((prev) => [...prev, { role: 'buyer', full_name: '', email: '', phone: '' }]); }
  function removeParty(index: number) { setParties((prev) => prev.filter((_, i) => i !== index)); }
  function updateParty(index: number, field: keyof Party, value: string) {
    setParties((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      const data = {
        address: address.trim(),
        property_type: propertyType,
        purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
        closing_date: closingDate || null,
        contract_execution_date: executionDate || null,
        parties: parties.filter((p) => p.full_name.trim()).map((p) => ({
          role: p.role,
          full_name: p.full_name.trim(),
          email: p.email.trim() || undefined,
          phone: p.phone.trim() || undefined,
        })),
      };
      const tx = await createTransaction(data);
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
        style={{ fontSize: '0.875rem', color: '#3d5068' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#3d5068'; }}
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Transactions
      </Link>

      <div className="mb-8">
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.08em', color: '#e2e8f0' }}>
          {step === 1 ? 'New Transaction' : 'Upload Contract'}
        </h1>
        <p style={{ fontSize: '0.8125rem', color: '#3d5068', marginTop: '4px' }}>
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
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Property Info */}
          <div className="rounded-2xl p-6" style={cardStyle}>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '1.25rem' }}>Property Information</h2>

            <div className="space-y-4">
              <FormInput label="Property Address" required>
                <input
                  type="text" required value={address} onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main St, City, State 12345"
                  style={inputStyle} onFocus={focusHandler} onBlur={blurHandler}
                />
              </FormInput>

              <div className="grid grid-cols-2 gap-4">
                <FormInput label="Property Type">
                  <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} style={inputStyle} onFocus={focusHandler} onBlur={blurHandler}>
                    {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </FormInput>
                <FormInput label="Purchase Price">
                  <input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="500000" min="0" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
                </FormInput>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormInput label="Estimated Closing Date">
                  <input type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
                </FormInput>
                <FormInput label="Contract Execution Date">
                  <input type="date" value={executionDate} onChange={(e) => setExecutionDate(e.target.value)} style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
                </FormInput>
              </div>
            </div>
          </div>

          {/* Parties */}
          <div className="rounded-2xl p-6" style={cardStyle}>
            <div className="flex items-center justify-between mb-5">
              <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0' }}>Parties</h2>
              <button type="button" onClick={addParty} className="inline-flex items-center gap-1.5 transition-colors" style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#3b82f6' }}>
                <Plus className="h-4 w-4" />
                Add Party
              </button>
            </div>

            <div className="space-y-4">
              {parties.map((party, index) => (
                <div key={index} className="rounded-xl p-4" style={{ background: 'rgba(148,163,184,0.04)', border: '1px solid rgba(148,163,184,0.08)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Party {index + 1}</span>
                    {index >= 2 && (
                      <button type="button" onClick={() => removeParty(index)} className="transition-colors" style={{ color: '#2d3f55' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#f87171'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#2d3f55'; }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { field: 'role' as const, label: 'Role', type: 'select' },
                      { field: 'full_name' as const, label: 'Full Name', type: 'text', placeholder: 'John Smith' },
                      { field: 'email' as const, label: 'Email', type: 'email', placeholder: 'john@example.com' },
                      { field: 'phone' as const, label: 'Phone', type: 'tel', placeholder: '(555) 123-4567' },
                    ].map(({ field, label, type, placeholder }) => (
                      <div key={field}>
                        <label style={{ ...labelStyle, marginBottom: '0.25rem' }}>{label}</label>
                        {type === 'select' ? (
                          <select value={party[field]} onChange={(e) => updateParty(index, field, e.target.value)} style={{ ...inputStyle, padding: '0.4375rem 0.75rem' }} onFocus={focusHandler} onBlur={blurHandler}>
                            {PARTY_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        ) : (
                          <input type={type} value={party[field]} onChange={(e) => updateParty(index, field, e.target.value)} placeholder={placeholder} style={{ ...inputStyle, padding: '0.4375rem 0.75rem' }} onFocus={focusHandler} onBlur={blurHandler} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {submitError && (
            <div className="rounded-lg px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.8125rem', color: '#f87171' }}>
              <AlertCircle className="h-4 w-4 shrink-0" />
              {submitError}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit" disabled={submitting}
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
          {/* Success notice */}
          <div className="rounded-xl px-5 py-4 flex items-center gap-3" style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: '#34d399' }} />
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#34d399' }}>Transaction created successfully!</div>
              <div style={{ fontSize: '0.75rem', color: '#2d3f55', marginTop: '2px' }}>{createdTx.address}</div>
            </div>
          </div>

          {/* Upload area */}
          <div className="rounded-2xl p-6" style={cardStyle}>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.5rem' }}>Upload Contract PDF</h2>
            <p style={{ fontSize: '0.8125rem', color: '#3d5068', marginBottom: '1.25rem' }}>
              Upload the purchase agreement to automatically extract key dates, deadlines, and parties.
            </p>

            {/* Drop zone */}
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
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#e2e8f0' }}>{file.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#3d5068' }}>{(file.size / 1024).toFixed(1)} KB</div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8" style={{ color: '#2d3f55' }} />
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#4a5568' }}>Drop PDF here or click to browse</div>
                  <div style={{ fontSize: '0.75rem', color: '#2d3f55' }}>PDF files only</div>
                </div>
              )}
            </div>

            {/* Status messages */}
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

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={() => router.push(`/transactions/${createdTx.id}`)}
              style={{ fontSize: '0.875rem', color: '#3d5068', transition: 'color 150ms' }}
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
    </div>
  );
}
