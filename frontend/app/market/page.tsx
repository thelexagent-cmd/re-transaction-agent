'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
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
  | { mode: 'map'; result: GeocodingResult };


export default function MarketPage() {
  const [view, setView]               = useState<ViewState>({ mode: 'globe' });
  const [mapVisible, setMapVisible]   = useState(false);
  const [selectedZip, setSelectedZip] = useState<string | null>(null);
  const { data: watchlist = [], mutate: mutateWatchlist } = useSWR('/market/watchlist', getWatchlist);

  function handleSearchResult(result: GeocodingResult) {
    setMapVisible(false);
    setSelectedZip(null);
    setView({ mode: 'map', result });
    setTimeout(() => setMapVisible(true), 80);
  }

  function handleBackToGlobe() {
    setMapVisible(false);
    setSelectedZip(null);
    setTimeout(() => setView({ mode: 'globe' }), 320);
  }

  function handleTracked(_entry: WatchlistEntry) {
    mutateWatchlist();
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
            watchlist={watchlist}
            selectedZip={selectedZip}
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
