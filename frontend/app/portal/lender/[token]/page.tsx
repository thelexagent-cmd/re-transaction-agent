'use client';

import { useParams } from 'next/navigation';
import { useRef, useState } from 'react';
import useSWR from 'swr';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-bb87.up.railway.app';

async function fetchLenderPortal(token: string) {
  const res = await fetch(`${API_URL}/portal/lender/${token}`);
  if (!res.ok) throw new Error('Portal link is invalid or expired.');
  return res.json();
}

const API_URL_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-bb87.up.railway.app';

export default function LenderPortalPage() {
  const { token } = useParams<{ token: string }>();
  const { data, error, isLoading, mutate } = useSWR(
    token ? `/portal/lender/${token}` : null,
    () => fetchLenderPortal(token),
    { revalidateOnFocus: false }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Loading lender portal...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Link Expired</h1>
          <p className="text-slate-500">This lender portal link is invalid or has expired. Please contact the agent for a new link.</p>
        </div>
      </div>
    );
  }

  // Backend response shape: { transaction: { id, address, status, closing_date }, lender_name, required_docs: string[], uploaded_docs: [...] }
  const tx = data?.transaction ?? data;
  const address = tx?.address ?? 'Transaction Details';
  const status = tx?.status ?? data?.status;
  const closingDate = tx?.closing_date ?? data?.closing_date;
  const purchasePrice = tx?.purchase_price ?? data?.purchase_price;
  const lenderName = data?.lender_name ?? 'Loan Officer';
  const requiredDocs: string[] = data?.required_docs ?? data?.required_documents ?? [];
  const uploadedDocs: Array<{ id: number; name: string; status: string; uploaded_at?: string }> = data?.uploaded_docs ?? data?.documents ?? [];
  const parties = data?.parties ?? tx?.parties ?? [];
  const deadlines = data?.deadlines ?? tx?.deadlines ?? [];

  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [docName, setDocName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setUploadError('Please select a file.'); return; }
    setUploading(true);
    setUploadError('');
    setUploadSuccess('');
    try {
      const form = new FormData();
      form.append('file', file);
      if (docName.trim()) form.append('document_name', docName.trim());
      const res = await fetch(`${API_URL_BASE}/portal/lender/${token}/upload`, { method: 'POST', body: form });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || 'Upload failed.'); }
      setUploadSuccess(`"${docName || file.name}" uploaded successfully.`);
      setDocName('');
      if (fileRef.current) fileRef.current.value = '';
      mutate();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    closed: 'bg-blue-100 text-blue-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-green-700 text-white py-6 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-6 w-6 rounded bg-white/20 flex items-center justify-center text-xs font-bold">L</div>
            <span className="text-sm opacity-75">Lex Transaction Agent &mdash; Lender Portal</span>
          </div>
          <h1 className="text-xl font-bold">{address}</h1>
          <div className="flex items-center gap-3 mt-2">
            {status && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[status] || 'bg-slate-100 text-slate-600'}`}>
                {status}
              </span>
            )}
            {closingDate && (
              <span className="text-sm opacity-75">Closing: {new Date(closingDate).toLocaleDateString()}</span>
            )}
            {purchasePrice && (
              <span className="text-sm opacity-75">${Number(purchasePrice).toLocaleString()}</span>
            )}
          </div>
          <div className="mt-2 text-sm opacity-75">
            Portal for: {lenderName}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
        {/* Required Documents Checklist */}
        {requiredDocs.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-800 mb-4">Required Documents</h2>
            <div className="space-y-2">
              {requiredDocs.map((docName: string, i: number) => {
                const uploaded = uploadedDocs.find((d) => d.name === docName);
                return (
                  <div key={i} className="flex items-center justify-between py-2.5 px-3 rounded-lg border border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center text-xs ${
                        uploaded ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'
                      }`}>
                        {uploaded ? '\u2713' : ''}
                      </div>
                      <span className="text-sm text-slate-700">{docName}</span>
                    </div>
                    <span className={`text-xs font-medium ${uploaded ? 'text-green-600' : 'text-slate-500'}`}>
                      {uploaded ? 'Received' : 'Pending'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Uploaded Documents */}
        {uploadedDocs.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-800 mb-4">Uploaded Documents</h2>
            <div className="space-y-2">
              {uploadedDocs.map((doc, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <span className="text-sm text-slate-700">{doc.name}</span>
                  {doc.uploaded_at && (
                    <span className="text-xs text-slate-400">{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Form */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-1">Upload a Document</h2>
          <p className="text-sm text-slate-500 mb-4">Upload loan documents directly. The agent will be notified automatically.</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Document Name <span className="text-slate-400">(optional — defaults to file name)</span></label>
              <input
                type="text"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="e.g. Commitment Letter, Clear to Close"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">File</label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                className="w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
              />
            </div>
            {uploadError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{uploadError}</p>}
            {uploadSuccess && <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">✓ {uploadSuccess}</p>}
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Upload Document'}
            </button>
          </div>
        </div>

        {/* Deadlines */}
        {deadlines.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-800 mb-4">Key Deadlines</h2>
            <div className="space-y-3">
              {deadlines.map((d: { name: string; due_date: string; status: string }, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <span className="text-sm text-slate-700">{d.name}</span>
                  <div className="text-right">
                    <div className="text-sm font-medium">{new Date(d.due_date).toLocaleDateString()}</div>
                    <div className={`text-xs ${
                      d.status === 'missed' ? 'text-red-600 font-semibold' :
                      d.status === 'warning' ? 'text-amber-600 font-semibold' :
                      d.status === 'completed' ? 'text-green-600' : 'text-slate-600'
                    }`}>{d.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Parties */}
        {parties.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-800 mb-4">Transaction Parties</h2>
            <div className="grid grid-cols-2 gap-3">
              {parties.map((p: { role: string; full_name: string }, i: number) => (
                <div key={i} className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">{p.role.replace(/_/g, ' ')}</div>
                  <div className="text-sm font-medium text-slate-800 mt-0.5">{p.full_name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-center text-slate-400 pb-4">
          Powered by Lex Transaction Agent &bull; Lender Portal &bull; For questions, contact the transaction agent directly.
        </p>
      </div>
    </div>
  );
}
