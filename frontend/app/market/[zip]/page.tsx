'use client';

import { use } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { MapPin, Home, TrendingDown, Calendar, Clock, Zap, ArrowLeft } from 'lucide-react';
import { getMarketProperties, type MarketProperty } from '@/lib/api';

const SCORE_COLOR = (s: number) =>
  s >= 80 ? '#34d399' : s >= 60 ? '#f59e0b' : s >= 40 ? '#60a5fa' : 'var(--text-muted)';

function ScoreBadge({ score }: { score: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full h-12 w-12 shrink-0"
      style={{ background: `${SCORE_COLOR(score)}20`, border: `2px solid ${SCORE_COLOR(score)}` }}
    >
      <span style={{ fontSize: '0.9375rem', fontWeight: 800, color: SCORE_COLOR(score) }}>{score}</span>
    </div>
  );
}

function BreakdownPill({ label, pts }: { label: string; pts: number }) {
  if (!pts) return null;
  return (
    <span
      className="rounded-full px-2.5 py-0.5"
      style={{ fontSize: '0.6875rem', fontWeight: 600, background: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}
    >
      +{pts} {label}
    </span>
  );
}

function PropertyCard({ prop }: { prop: MarketProperty }) {
  const bd = prop.score_breakdown;
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      {/* House photo — swap CDN suffix s→od for full resolution */}
      {prop.img_src ? (
        <img
          src={prop.img_src.replace(/s\.jpg$/i, 'od.jpg')}
          alt={prop.address}
          style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div style={{ width: '100%', height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)' }}>
          <Home style={{ width: 32, height: 32, opacity: 0.2, color: 'var(--text-muted)' }} />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <ScoreBadge score={prop.opportunity_score ?? 0} />
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              {prop.address}
            </p>
            {prop.price && (
              <p style={{ fontSize: '0.9375rem', color: '#60a5fa', fontWeight: 600 }}>
                ${prop.price.toLocaleString()}
              </p>
            )}
          </div>
        </div>

        {/* Summary */}
        {prop.claude_summary && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.55 }}>
            {prop.claude_summary}
          </p>
        )}

        {/* Stats row */}
        <div className="flex flex-wrap gap-3 mb-3" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {prop.bedrooms && (
            <span className="flex items-center gap-1">
              <Home className="h-3.5 w-3.5" />
              {prop.bedrooms}bd / {prop.bathrooms}ba
            </span>
          )}
          {prop.living_area && (
            <span>{prop.living_area.toLocaleString()} sqft</span>
          )}
          {prop.year_built && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Built {prop.year_built}
            </span>
          )}
          {prop.days_on_market != null && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {prop.days_on_market}d on market
            </span>
          )}
          {prop.price_reduction_30d != null && prop.price_reduction_30d > 0 && (
            <span className="flex items-center gap-1" style={{ color: '#34d399' }}>
              <TrendingDown className="h-3.5 w-3.5" />
              -${prop.price_reduction_30d.toLocaleString()}
            </span>
          )}
        </div>

        {/* Score breakdown */}
        {bd && Object.keys(bd).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(bd).map(([key, pts]) => (
              <BreakdownPill key={key} label={key.replace(/_/g, ' ')} pts={pts} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ZipPage({ params }: { params: Promise<{ zip: string }> }) {
  const { zip } = use(params);
  const { data: properties = [], isLoading } = useSWR(
    `/market/properties/${zip}`,
    () => getMarketProperties(zip),
  );

  const sorted = [...(properties as MarketProperty[])].sort((a, b) => (b.opportunity_score ?? 0) - (a.opportunity_score ?? 0));

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1.5rem' }}>
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

      <div className="flex items-center gap-2 mb-2">
        <MapPin className="h-5 w-5" style={{ color: '#60a5fa' }} />
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {zip} Market Report
        </h1>
      </div>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        {sorted.length} propert{sorted.length === 1 ? 'y' : 'ies'} · sorted by opportunity score
      </p>

      {isLoading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading listings…</p>
      ) : sorted.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}
        >
          <Zap className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.25rem' }}>No listings yet</p>
          <p style={{ fontSize: '0.8125rem' }}>Trigger a scan from the Watchlist page to populate this report.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sorted.map((prop) => (
            <PropertyCard key={prop.id} prop={prop} />
          ))}
        </div>
      )}
    </div>
    </div>
  );
}
