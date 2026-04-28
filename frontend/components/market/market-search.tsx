'use client';

import { useState, useRef } from 'react';

export type GeocodingResult = {
  text: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  bbox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  isZip: boolean;
};

interface MarketSearchProps {
  onResult: (result: GeocodingResult) => void;
}

export function MarketSearch({ onResult }: MarketSearchProps) {
  const [query, setQuery]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q || !token) return;
    setError('');
    setLoading(true);
    try {
      const isZip = /^\d{5}$/.test(q);
      const types = isZip ? 'postcode' : 'place,region,district';
      const url =
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json` +
        `?country=US&types=${types}&access_token=${token}`;
      const res  = await fetch(url);
      const data = await res.json();
      if (!data.features?.length) {
        setError('Location not found. Try a city name or ZIP code.');
        return;
      }
      const feat = data.features[0];
      onResult({
        text:       feat.text,
        place_name: feat.place_name,
        center:     feat.center,
        bbox:       feat.bbox,
        isZip,
      });
    } catch {
      setError('Search failed. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 48,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        width: 360,
      }}
    >
      <form onSubmit={handleSubmit}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(8,14,26,0.75)',
            border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'rgba(59,130,246,0.4)'}`,
            borderRadius: 40,
            padding: '14px 22px',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 0 40px rgba(59,130,246,0.1), 0 8px 32px rgba(0,0,0,0.5)',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
        >
          <span style={{ color: 'rgba(96,165,250,0.7)', fontSize: 16, flexShrink: 0 }}>⌕</span>
          <input
            id="market-search-input"
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="City, state, or ZIP code"
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#e2e8f0',
              fontSize: 14,
              width: '100%',
              letterSpacing: '0.3px',
            }}
          />
          <span style={{ color: 'rgba(148,163,184,0.35)', fontSize: 11, fontFamily: 'monospace', flexShrink: 0 }}>
            {loading ? '…' : '↵'}
          </span>
        </div>
      </form>
      {error && (
        <p style={{ marginTop: 8, textAlign: 'center', fontSize: 12, color: 'rgba(239,68,68,0.8)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
