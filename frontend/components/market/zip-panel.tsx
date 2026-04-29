'use client';

import { useEffect, useState } from 'react';
import { getZipInfo, addWatchlistEntry, type ZipInfo, type WatchlistEntry } from '@/lib/api';

interface ZipPanelProps {
  zip: string;
  onClose: () => void;
  onTracked: (entry: WatchlistEntry) => void;
  watchlist: WatchlistEntry[];
}

export function ZipPanel({ zip, onClose, onTracked, watchlist }: ZipPanelProps) {
  const [info, setInfo]       = useState<ZipInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);
  const [tracked, setTracked] = useState(false);
  const [visible, setVisible] = useState(false);

  const existingEntry = watchlist.find((e) => e.zip_code === zip);

  useEffect(() => {
    setVisible(false);
    setLoading(true);
    setTracked(!!existingEntry);
    const t = setTimeout(() => setVisible(true), 16);
    getZipInfo(zip)
      .then(setInfo)
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
    return () => clearTimeout(t);
  }, [zip]);

  async function handleTrack() {
    setTracking(true);
    try {
      const entry = await addWatchlistEntry(zip);
      setTracked(true);
      onTracked(entry);
      // Keep sidebar recent ZIPs in sync
      try {
        const cached = JSON.parse(localStorage.getItem('lex-market-zips') ?? '[]') as string[];
        if (!cached.includes(zip)) {
          localStorage.setItem('lex-market-zips', JSON.stringify([zip, ...cached].slice(0, 20)));
          window.dispatchEvent(new Event('storage'));
        }
      } catch { /* ignore */ }
    } catch {
      // keep button active so user can retry
    } finally {
      setTracking(false);
    }
  }

  function formatCurrency(v: number | null | undefined) {
    if (!v) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(v);
  }

  return (
    <div
      id="zip-panel"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 288,
        background: 'rgba(6,10,20,0.96)',
        borderLeft: '1px solid rgba(59,130,246,0.18)',
        backdropFilter: 'blur(24px)',
        display: 'flex',
        flexDirection: 'column',
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 300ms ease-out',
        zIndex: 30,
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ padding: '22px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 10, color: '#60a5fa', fontFamily: 'monospace', letterSpacing: 2, marginBottom: 4, textTransform: 'uppercase' }}>
              ZIP Code
            </div>
            <div style={{ fontSize: 34, fontWeight: 700, color: '#f1f5f9', lineHeight: 1 }}>{zip}</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'rgba(148,163,184,0.45)', cursor: 'pointer', fontSize: 20, padding: 4, lineHeight: 1 }}
            aria-label="Close panel"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div style={{ marginTop: 10, height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 4, width: '72%', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ) : info ? (
          <div style={{ marginTop: 8, fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
            {[info.city, info.county, info.state].filter(Boolean).join(', ')}
          </div>
        ) : (
          <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(239,68,68,0.65)' }}>Location data unavailable</div>
        )}
      </div>

      {/* Stats */}
      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <StatRow
          label="Price Per Sq Ft"
          value={loading ? null : (info?.price_per_sqft ? `$${info.price_per_sqft} / sq ft` : '—')}
          highlight
        />
        <StatRow
          label="Avg Days on Market"
          value="—"
          muted={!existingEntry && !tracked}
          hint={!existingEntry && !tracked ? 'Available after first scan' : undefined}
        />
        <StatRow
          label="Opportunity Score"
          value="—"
          muted={!existingEntry && !tracked}
          hint={!existingEntry && !tracked ? 'Available after first scan' : undefined}
        />
      </div>

      {/* Divider */}
      <div style={{ margin: '0 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }} />

      {/* CTA */}
      <div style={{ padding: '18px 20px 28px', marginTop: 'auto' }}>
        {tracked || existingEntry ? (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(52,211,153,0.08)',
              border: '1px solid rgba(52,211,153,0.2)',
              borderRadius: 10, padding: '11px 14px',
              fontSize: 13, color: '#34d399', marginBottom: 10,
            }}>
              <span>✓</span>
              <span>Tracking active</span>
            </div>
            <p style={{ fontSize: 11, color: '#475569', textAlign: 'center', marginBottom: 12 }}>
              Next scan tonight at 2 AM
            </p>
            <a
              href={`/market/${zip}`}
              style={{
                display: 'block', textAlign: 'center',
                fontSize: 13, color: '#60a5fa', textDecoration: 'none',
                padding: '10px 0',
                border: '1px solid rgba(59,130,246,0.2)',
                borderRadius: 10,
              }}
            >
              View Full Analysis →
            </a>
          </div>
        ) : (
          <div>
            <button
              id="start-tracking-btn"
              onClick={handleTrack}
              disabled={tracking}
              style={{
                width: '100%',
                padding: '14px 0',
                background: tracking ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.9)',
                border: 'none',
                borderRadius: 12,
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: tracking ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
                letterSpacing: '0.3px',
              }}
            >
              {tracking ? 'Adding…' : 'Start Tracking'}
            </button>
            <p style={{ marginTop: 10, fontSize: 11, color: '#475569', textAlign: 'center', lineHeight: 1.5 }}>
              Nightly scan at 2 AM — permits, pricing &amp; DOM signals
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  highlight,
  muted,
  hint,
}: {
  label: string;
  value: string | null;
  highlight?: boolean;
  muted?: boolean;
  hint?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 10, color: '#64748b', letterSpacing: 1, textTransform: 'uppercase' }}>
        {label}
      </span>
      {value === null ? (
        <div style={{ height: 22, background: 'rgba(255,255,255,0.06)', borderRadius: 4, width: '55%' }} />
      ) : (
        <span style={{
          fontSize: 20,
          fontWeight: 700,
          color: muted ? '#1e293b' : highlight ? '#f1f5f9' : '#94a3b8',
        }}>
          {value}
        </span>
      )}
      {hint && <span style={{ fontSize: 10, color: '#334155' }}>{hint}</span>}
    </div>
  );
}
