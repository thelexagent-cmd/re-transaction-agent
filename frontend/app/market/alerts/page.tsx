'use client';

import useSWR, { mutate } from 'swr';
import { Bell } from 'lucide-react';
import { getMarketAlerts, updateAlertStatus, type MarketAlert } from '@/lib/api';

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

  async function cycle(alert: MarketAlert) {
    const next = NEXT_STATUS[alert.status] ?? 'reviewed';
    await updateAlertStatus(alert.id, next);
    mutate('/market/alerts');
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div className="mb-6">
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
          Market Alerts
        </h1>
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
  );
}
