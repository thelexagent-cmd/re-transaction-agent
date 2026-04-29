'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { Plus, Trash2, RefreshCw, MapPin, ArrowLeft } from 'lucide-react';
import {
  getWatchlist,
  addWatchlistEntry,
  deleteWatchlistEntry,
  triggerScan,
  type WatchlistEntry,
} from '@/lib/api';

export default function WatchlistPage() {
  const router = useRouter();
  const { data: watchlist = [], isLoading } = useSWR('/market/watchlist', getWatchlist);
  const [zipInput, setZipInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [scanningId, setScanningId] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const zip = zipInput.trim();
    if (!/^\d{5}$/.test(zip)) { setError('Enter a valid 5-digit ZIP code'); return; }
    setError('');
    setAdding(true);
    try {
      await addWatchlistEntry(zip);
      setZipInput('');
      mutate('/market/watchlist');
      // cache zip codes for sidebar
      const cached = JSON.parse(localStorage.getItem('lex-market-zips') ?? '[]') as string[];
      if (!cached.includes(zip)) {
        localStorage.setItem('lex-market-zips', JSON.stringify([zip, ...cached].slice(0, 100)));
        window.dispatchEvent(new Event('storage'));
      }
    } catch {
      setError('Failed to add ZIP. It may already be on your watchlist.');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Remove this ZIP? All scanned properties and alerts will be deleted.')) return;
    try {
      // Optimistic: remove from local SWR cache immediately
      mutate(
        '/market/watchlist',
        (prev: WatchlistEntry[] = []) => prev.filter((e) => e.id !== id),
        { revalidate: false }
      );
      await deleteWatchlistEntry(id);
      mutate('/market/watchlist'); // confirm with server
    } catch {
      setError('Failed to delete entry. Please try again.');
      mutate('/market/watchlist'); // revert on error
    }
  }

  async function handleScan(id: number, zip: string) {
    setScanningId(id);
    try {
      await triggerScan(id);
      router.push(`/market/${zip}`);
    } finally {
      setScanningId(null);
    }
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <Link
        href="/market"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontSize: '0.8125rem',
          color: 'var(--text-muted)',
          textDecoration: 'none',
          marginBottom: '1.25rem',
          transition: 'color 150ms',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Globe
      </Link>

      <div className="mb-6">
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
          Market Watchlist
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          ZIP codes are scanned nightly at 2 AM ET. Trigger a manual scan anytime.
        </p>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="flex gap-2 mb-6">
        <div className="flex-1 relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={zipInput}
            onChange={(e) => setZipInput(e.target.value)}
            placeholder="Enter ZIP code (e.g. 33101)"
            maxLength={5}
            className="w-full rounded-lg pl-9 pr-3 py-2.5"
            style={{
              background: 'var(--bg-elevated)',
              border: `1px solid ${error ? '#ef4444' : 'var(--border)'}`,
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              outline: 'none',
            }}
          />
        </div>
        <button
          type="submit"
          disabled={adding}
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 transition-opacity"
          style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            color: 'white',
            fontSize: '0.8125rem',
            fontWeight: 600,
            opacity: adding ? 0.6 : 1,
          }}
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </form>
      {error && <p style={{ fontSize: '0.8125rem', color: '#f87171', marginTop: '-1rem', marginBottom: '1rem' }}>{error}</p>}

      {/* Watchlist */}
      {isLoading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading...</p>
      ) : watchlist.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}
        >
          <MapPin className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.25rem' }}>No ZIP codes yet</p>
          <p style={{ fontSize: '0.8125rem' }}>Add a ZIP code above to start tracking deals.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(watchlist as WatchlistEntry[]).map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
            >
              <MapPin className="h-4 w-4 shrink-0" style={{ color: '#60a5fa' }} />
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>{entry.zip_code}</p>
                {entry.last_scanned_at && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Last scan: {new Date(entry.last_scanned_at).toLocaleString()}
                  </p>
                )}
              </div>
              <a
                href={`/market/${entry.zip_code}`}
                style={{ fontSize: '0.8125rem', color: '#60a5fa', textDecoration: 'none', marginRight: '0.5rem' }}
              >
                View
              </a>
              <button
                onClick={() => handleScan(entry.id, entry.zip_code)}
                disabled={scanningId === entry.id}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-opacity"
                style={{
                  background: 'rgba(59,130,246,0.1)',
                  color: '#60a5fa',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  opacity: scanningId === entry.id ? 0.5 : 1,
                }}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${scanningId === entry.id ? 'animate-spin' : ''}`} />
                {scanningId === entry.id ? 'Scanning…' : 'Scan'}
              </button>
              <button
                onClick={() => handleDelete(entry.id)}
                className="rounded-lg p-1.5 transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#f87171'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
    </div>
  );
}
