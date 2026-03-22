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

const PROPERTY_TYPES = ['SFH', 'Condo', 'Townhouse', 'Multi-family', 'Other'];
const PARTY_ROLES = ['Buyer', 'Seller', 'Buyer Agent', 'Seller Agent', 'Lender', 'Title Officer', 'Attorney', 'Other'];

type ParseStatus = 'idle' | 'uploading' | 'parsing' | 'done' | 'error';

export default function NewTransactionPage() {
  const router = useRouter();

  // Step 1: form state
  const [step, setStep] = useState<1 | 2>(1);
  const [createdTx, setCreatedTx] = useState<TransactionListItem | null>(null);

  const [address, setAddress] = useState('');
  const [propertyType, setPropertyType] = useState('SFH');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [closingDate, setClosingDate] = useState('');
  const [executionDate, setExecutionDate] = useState('');
  const [parties, setParties] = useState<Party[]>([
    { role: 'Buyer', full_name: '', email: '', phone: '' },
    { role: 'Seller', full_name: '', email: '', phone: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Step 2: contract upload state
  const [file, setFile] = useState<File | null>(null);
  const [parseStatus, setParseStatus] = useState<ParseStatus>('idle');
  const [parseMessage, setParseMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function addParty() {
    setParties((prev) => [...prev, { role: 'Buyer', full_name: '', email: '', phone: '' }]);
  }

  function removeParty(index: number) {
    setParties((prev) => prev.filter((_, i) => i !== index));
  }

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
        parties: parties
          .filter((p) => p.full_name.trim())
          .map((p) => ({
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
    if (dropped && dropped.type === 'application/pdf') {
      setFile(dropped);
    }
  }, []);

  async function handleUpload() {
    if (!file || !createdTx) return;
    setParseStatus('uploading');
    setParseMessage('Uploading contract...');

    try {
      const result = await parseContract(createdTx.id, file);
      setParseStatus('parsing');
      setParseMessage('Parsing contract...');

      // Poll for status
      const taskId = result.task_id;
      let attempts = 0;
      const maxAttempts = 40;

      const poll = async () => {
        if (attempts >= maxAttempts) {
          setParseStatus('error');
          setParseMessage('Parsing timed out. Please try again.');
          return;
        }
        attempts++;
        try {
          const status = await getParseStatus(createdTx.id, taskId);
          if (status.status === 'completed' || status.status === 'success') {
            setParseStatus('done');
            setParseMessage('Contract parsed successfully!');
          } else if (status.status === 'failed' || status.status === 'error') {
            setParseStatus('error');
            setParseMessage('Contract parsing failed. You can still proceed.');
          } else {
            setTimeout(poll, 3000);
          }
        } catch {
          setTimeout(poll, 3000);
        }
      };

      setTimeout(poll, 3000);
    } catch (err) {
      setParseStatus('error');
      setParseMessage(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Back button */}
      <Link
        href="/transactions"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Transactions
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        {step === 1 ? 'New Transaction' : 'Upload Contract'}
      </h1>
      <p className="text-sm text-slate-500 mb-8">
        {step === 1
          ? 'Fill in the transaction details to get started'
          : 'Optionally upload the contract PDF to automatically extract key dates and deadlines'}
      </p>

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-8">
        <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>1</div>
        <div className="text-xs text-slate-400 font-medium">Transaction Details</div>
        <div className="h-px flex-1 bg-slate-200" />
        <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${step === 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>2</div>
        <div className="text-xs text-slate-400 font-medium">Upload Contract</div>
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Property Info */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-5">Property Information</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Property Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main St, City, State 12345"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Property Type</label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    {PROPERTY_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Purchase Price</label>
                  <input
                    type="number"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    placeholder="500000"
                    min="0"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Estimated Closing Date</label>
                  <input
                    type="date"
                    value={closingDate}
                    onChange={(e) => setClosingDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Contract Execution Date</label>
                  <input
                    type="date"
                    value={executionDate}
                    onChange={(e) => setExecutionDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Parties */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-900">Parties</h2>
              <button
                type="button"
                onClick={addParty}
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <Plus className="h-4 w-4" />
                Add Party
              </button>
            </div>

            <div className="space-y-4">
              {parties.map((party, index) => (
                <div key={index} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-700">Party {index + 1}</span>
                    {index >= 2 && (
                      <button
                        type="button"
                        onClick={() => removeParty(index)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
                      <select
                        value={party.role}
                        onChange={(e) => updateParty(index, 'role', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      >
                        {PARTY_ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={party.full_name}
                        onChange={(e) => updateParty(index, 'full_name', e.target.value)}
                        placeholder="John Smith"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                      <input
                        type="email"
                        value={party.email}
                        onChange={(e) => updateParty(index, 'email', e.target.value)}
                        placeholder="john@example.com"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={party.phone}
                        onChange={(e) => updateParty(index, 'phone', e.target.value)}
                        placeholder="(555) 123-4567"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {submitError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {submitError}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
          <div className="rounded-xl border border-green-200 bg-green-50 p-5 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-green-800">Transaction created successfully!</div>
              <div className="text-xs text-green-700 mt-0.5">{createdTx.address}</div>
            </div>
          </div>

          {/* Upload area */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Upload Contract PDF</h2>
            <p className="text-sm text-slate-500 mb-5">
              Upload the purchase agreement to automatically extract key dates, deadlines, and parties.
            </p>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-blue-400 bg-blue-50'
                  : file
                  ? 'border-green-400 bg-green-50'
                  : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setFile(f);
                }}
              />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="h-8 w-8 text-green-600" />
                  <div className="text-sm font-medium text-slate-900">{file.name}</div>
                  <div className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-slate-400" />
                  <div className="text-sm font-medium text-slate-700">Drop PDF here or click to browse</div>
                  <div className="text-xs text-slate-500">PDF files only</div>
                </div>
              )}
            </div>

            {/* Status messages */}
            {parseStatus === 'uploading' || parseStatus === 'parsing' ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-blue-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                {parseMessage}
              </div>
            ) : parseStatus === 'done' ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                {parseMessage}
              </div>
            ) : parseStatus === 'error' ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4" />
                {parseMessage}
              </div>
            ) : null}

            {/* Upload button */}
            {parseStatus === 'idle' || parseStatus === 'error' ? (
              <button
                onClick={handleUpload}
                disabled={!file}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Upload className="h-4 w-4" />
                Upload &amp; Parse Contract
              </button>
            ) : null}
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={() => router.push(`/transactions/${createdTx.id}`)}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Skip for now
            </button>
            <Link
              href={`/transactions/${createdTx.id}`}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Go to Deal
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
