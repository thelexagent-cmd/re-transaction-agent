'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { MarketSearch, type GeocodingResult } from '@/components/market/market-search';
import { ZipPanel } from '@/components/market/zip-panel';
import { getWatchlist, type WatchlistEntry } from '@/lib/api';

// Globe and map use WebGL/browser APIs — must be client-only, no SSR
const GlobeScene = dynamic(
  () => import('@/components/market/globe-scene').then((m) => m.GlobeScene),
  { ssr: false }
);
const ZipMap = dynamic(
  () => import('@/components/market/zip-map').then((m) => m.ZipMap),
  { ssr: false }
);

type ViewState =
  | { mode: 'globe' }
  | { mode: 'map'; result: GeocodingResult; stateAbbr: string };

const STATE_NAME_TO_ABBR: Record<string, string> = {
  'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA',
  'Colorado':'CO','Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA',
  'Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA',
  'Kansas':'KS','Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD',
  'Massachusetts':'MA','Michigan':'MI','Minnesota':'MN','Mississippi':'MS',
  'Missouri':'MO','Montana':'MT','Nebraska':'NE','Nevada':'NV','New Hampshire':'NH',
  'New Jersey':'NJ','New Mexico':'NM','New York':'NY','North Carolina':'NC',
  'North Dakota':'ND','Ohio':'OH','Oklahoma':'OK','Oregon':'OR','Pennsylvania':'PA',
  'Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD','Tennessee':'TN',
  'Texas':'TX','Utah':'UT','Vermont':'VT','Virginia':'VA','Washington':'WA',
  'West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY','District of Columbia':'DC',
};

function deriveStateAbbr(placeName: string): string {
  const parts = placeName.split(', ');
  for (const part of parts) {
    const t = part.trim();
    if (STATE_NAME_TO_ABBR[t]) return STATE_NAME_TO_ABBR[t];
    if (/^[A-Z]{2}$/.test(t)) return t;
  }
  return 'FL';
}

export default function MarketPage() {
  const [view, setView]               = useState<ViewState>({ mode: 'globe' });
  const [mapVisible, setMapVisible]   = useState(false);
  const [selectedZip, setSelectedZip] = useState<string | null>(null);
  const [watchlist, setWatchlist]     = useState<WatchlistEntry[]>([]);

  useEffect(() => {
    getWatchlist().then(setWatchlist).catch(() => {});
  }, []);

  function handleSearchResult(result: GeocodingResult) {
    const stateAbbr = deriveStateAbbr(result.place_name);
    setMapVisible(false);
    setSelectedZip(null);
    setView({ mode: 'map', result, stateAbbr });
    setTimeout(() => setMapVisible(true), 80);
  }

  function handleBackToGlobe() {
    setMapVisible(false);
    setSelectedZip(null);
    setTimeout(() => setView({ mode: 'globe' }), 320);
  }

  function handleTracked(entry: WatchlistEntry) {
    setWatchlist((prev) =>
      prev.find((e) => e.zip_code === entry.zip_code) ? prev : [...prev, entry]
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#050a12',
      }}
    >
      {/* Globe layer */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: view.mode === 'globe' ? 1 : 0,
          transition: 'opacity 320ms ease',
          pointerEvents: view.mode === 'globe' ? 'auto' : 'none',
        }}
      >
        <GlobeScene watchlist={watchlist} />
        <MarketSearch onResult={handleSearchResult} />
      </div>

      {/* Map layer */}
      {view.mode === 'map' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: mapVisible ? 1 : 0,
            transition: 'opacity 320ms ease',
          }}
        >
          <ZipMap
            center={view.result.center}
            bbox={view.result.bbox}
            stateAbbr={view.stateAbbr}
            watchlist={watchlist}
            panelOpen={!!selectedZip}
            onZipClick={setSelectedZip}
            onBackToGlobe={handleBackToGlobe}
          />
          {selectedZip && (
            <ZipPanel
              zip={selectedZip}
              onClose={() => setSelectedZip(null)}
              onTracked={handleTracked}
              watchlist={watchlist}
            />
          )}
        </div>
      )}
    </div>
  );
}
