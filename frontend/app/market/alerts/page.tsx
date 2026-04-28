'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Bell } from 'lucide-react';
import { getMarketAlerts, updateAlertStatus, type MarketAlert } from '@/lib/api';

const ALERT_TYPES = [
  {
    id: 'infrastructure_appreciation',
    label: 'Infrastructure & Construction',
    description: 'New permits, zoning changes, and construction activity near tracked ZIPs',
    icon: '🏗️',
  },
  {
    id: 'undervalued_listings',
    label: 'Undervalued Listings',
    description: 'Properties priced below estimated market value in tracked ZIPs',
    icon: '💰',
  },
  {
    id: 'aging_inventory',
    label: 'Aging Inventory (40+ DOM)',
    description: 'Listings sitting 40+ days — motivated sellers, price reduction potential',
    icon: '📅',
  },
  {
    id: 'seller_opportunity',
    label: 'Seller Opportunity Signals',
    description: 'Market conditions favoring sellers: low inventory, rising prices',
    icon: '📈',
  },
  {
    id: 'market_anomaly',
    label: 'Market Anomaly Detection',
    description: 'Unusual price movements, volume spikes, or outlier activity',
    icon: '⚡',
  },
];

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  new:        { label: 'New',        color: '#60a5fa', bg: 'rgba(59,130,246,0.12)' },
  reviewed:   { label: 'Reviewed',   color: 'var(--text-muted)', bg: 'rgba(148,163,184,0.08)' },
  interested: { label: 'Interested', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  passed:     { label: 'Passed',     color: '#f87171', bg: 'rgba(239,68,68,0.1)' },
};

const NEXT_STATUS: Record<string, string> = {
  new: 'reviewed', reviewed: 'interested', interested: 'passed', passed: 'new',
};

export default function AlertsPage() {
  const { data: alerts = [], isLoading } = useSWR('/market/alerts', getMarketAlerts);
  const [enabledTypes, setEnabledTypes] = useState<Set<string>>(
    () => new Set(ALERT_TYPES.map((t) => t.id))
  );

  function toggleType(id: string) {
    setEnabledTypes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function cycle(alert: MarketAlert) {
    const next = NEXT_STATUS[alert.status] ?? 'reviewed';
    await updateAlertStatus(alert.id, next);
    mutate('/market/alerts');
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Alert Configuration Section */}
      <div className="mb-8">
        <div className="mb-4">
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Alert Configuration
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Nightly scan at 2 AM ET across your tracked ZIPs
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '0.75rem',
          }}
        >
          {ALERT_TYPES.map((type) => {
            const isEnabled = enabledTypes.has(type.id);
            return (
              <div
                key={type.id}
                className="rounded-xl p-4"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{type.icon}</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {type.label}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleType(type.id)}
                    style={{
                      flexShrink: 0,
                      width: 36,
                      height: 20,
                      borderRadius: 10,
                      border: 'none',
                      cursor: 'pointer',
                      background: isEnabled ? 'rgba(52,211,153,0.7)' : 'rgba(148,163,184,0.2)',
                      position: 'relative',
                      transition: 'background 0.2s',
                      padding: 0,
                    }}
                    aria-label={isEnabled ? `Disable ${type.label}` : `Enable ${type.label}`}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: 2,
                        left: isEnabled ? 18 : 2,
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: '#fff',
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      }}
                    />
                  </button>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '0.5rem' }}>
                  {type.description}
                </p>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    color: isEnabled ? '#34d399' : 'var(--text-muted)',
                  }}
                >
                  {isEnabled ? 'Active' : 'Paused'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Alerts Section */}
      <div>
        <div className="mb-4">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Recent Alerts
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Properties flagged by the nightly scan. Click the status badge to cycle through.
          </p>
        </div>

        {isLoading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading...</p>
        ) : (alerts as MarketAlert[]).length === 0 ? (
          <div
            className="rounded-xl p-8 text-center"
            style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}
          >
            <Bell className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.25rem' }}>No alerts yet</p>
            <p style={{ fontSize: '0.8125rem' }}>Alerts fire when a property scores ≥ 60. Run a scan to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(alerts as MarketAlert[]).map((alert) => {
              const badge = STATUS_LABELS[alert.status] ?? STATUS_LABELS.reviewed;
              const prop = alert.property;
              return (
                <div
                  key={alert.id}
                  className="rounded-xl px-4 py-3"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <a
                          href={`/market/${prop.zip_code}`}
                          style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#60a5fa'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                        >
                          {prop.address}
                        </a>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{prop.zip_code}</span>
                      </div>
                      {prop.claude_summary && (
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                          {prop.claude_summary}
                        </p>
                      )}
                      <div className="flex items-center gap-3 flex-wrap">
                        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#f59e0b' }}>
                          Score {alert.score_at_alert}
                        </span>
                        {prop.price && (
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                            ${prop.price.toLocaleString()}
                          </span>
                        )}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(alert.fired_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => cycle(alert)}
                      className="shrink-0 rounded-full px-3 py-1 transition-opacity"
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: badge.color,
                        background: badge.bg,
                      }}
                    >
                      {badge.label}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
