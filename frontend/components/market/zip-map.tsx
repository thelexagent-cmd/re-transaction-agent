'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import Map, { Source, Layer } from 'react-map-gl';
import type { MapRef, MapLayerMouseEvent } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { FeatureCollection } from 'geojson';
import type { WatchlistEntry } from '@/lib/api';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

// Module-level cache — one fetch per browser session
let geoCache: FeatureCollection | null = null;

async function fetchMiamiZips(): Promise<FeatureCollection | null> {
  if (geoCache) return geoCache;
  // Proxy route fetches Census TIGERweb server-side, avoiding CORS rejection
  // that occurs when the browser calls tigerweb.geo.census.gov directly.
  const res = await fetch('/api/miami-zips');
  if (!res.ok) throw new Error(`miami-zips API: ${res.status}`);
  const data = await res.json() as FeatureCollection;
  geoCache = data;
  return data;
}

// ── Component ────────────────────────────────────────────────────────────────

interface ZipMapProps {
  center: [number, number];
  bbox?: [number, number, number, number];
  watchlist: WatchlistEntry[];
  selectedZip: string | null;
  onZipClick: (zip: string) => void;
  onBackToGlobe: () => void;
}

export function ZipMap({
  center,
  bbox,
  watchlist,
  selectedZip,
  onZipClick,
  onBackToGlobe,
}: ZipMapProps) {
  const mapRef    = useRef<MapRef>(null);
  const hoverRef  = useRef<string | null>(null); // tracks hovered zip without re-renders

  const trackedZips = watchlist.map((e) => e.zip_code);

  const [geoData,  setGeoData]  = useState<FeatureCollection | null>(geoCache);
  const [geoError, setGeoError] = useState(false);

  // Fetch Miami ZCTA polygons on mount (no-op if already cached)
  useEffect(() => {
    if (geoCache) return;
    fetchMiamiZips()
      .then((d) => { if (d) setGeoData(d); else setGeoError(true); })
      .catch(() => setGeoError(true));
  }, []);

  // Fly to search result once map has fully loaded — avoids race with map init
  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (bbox) {
      map.fitBounds(
        [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
        { padding: 60, duration: 900, maxZoom: 13 }
      );
    } else {
      map.flyTo({ center, zoom: 12, duration: 900 });
    }
  }, [center, bbox]);

  // Click: extract normalized `zip` property from the GeoJSON feature
  const handleClick = useCallback((e: MapLayerMouseEvent) => {
    const zip = e.features?.[0]?.properties?.zip;
    if (zip) onZipClick(String(zip));
  }, [onZipClick]);

  // Hover: drive highlight through Mapbox featureState — zero React re-renders
  const handleMouseMove = useCallback((e: MapLayerMouseEvent) => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const zip: string | null = e.features?.length
      ? (String(e.features[0].properties?.zip ?? '')) || null
      : null;
    if (zip === hoverRef.current) return;
    if (hoverRef.current) {
      map.setFeatureState(
        { source: 'miami-zips', id: hoverRef.current },
        { hover: false }
      );
    }
    hoverRef.current = zip;
    if (zip) {
      map.setFeatureState(
        { source: 'miami-zips', id: zip },
        { hover: true }
      );
    }
  }, []);

  // Clear hover when cursor leaves the map canvas
  const handleMouseOut = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || !hoverRef.current) return;
    map.setFeatureState(
      { source: 'miami-zips', id: hoverRef.current },
      { hover: false }
    );
    hoverRef.current = null;
  }, []);

  // ── Layer paint ─────────────────────────────────────────────────────────
  // featureState expressions (hover) are evaluated by Mapbox GL itself —
  // they do NOT trigger React re-renders on every mouse move.
  // Only selectedZip / trackedZips changes cause React re-renders.

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const fillPaint: any = {
    'fill-color': [
      'case',
      ['==', ['get', 'zip'], selectedZip ?? '##'],       'rgba(59,130,246,0.35)',  // selected
      ['in', ['get', 'zip'], ['literal', trackedZips]],  'rgba(59,130,246,0.18)',  // tracked
      ['boolean', ['feature-state', 'hover'], false],    'rgba(255,255,255,0.08)', // hovered
      'rgba(0,0,0,0.01)', // near-transparent but preserves hit area for click detection
    ],
    'fill-opacity': 1,
  };

  const linePaint: any = {
    'line-color': [
      'case',
      ['==', ['get', 'zip'], selectedZip ?? '##'],       '#60a5fa',
      ['in', ['get', 'zip'], ['literal', trackedZips]],  '#3b82f6',
      ['boolean', ['feature-state', 'hover'], false],    'rgba(239,68,68,0.9)',
      'rgba(239,68,68,0.6)',
    ],
    'line-width': [
      'case',
      ['==', ['get', 'zip'], selectedZip ?? '##'],       3,
      ['in', ['get', 'zip'], ['literal', trackedZips]],  2.5,
      ['boolean', ['feature-state', 'hover'], false],    2,
      1.2,
    ],
  };

  const labelPaint: any = {
    'text-color': 'rgba(148,163,184,0.7)',
    'text-halo-color': 'rgba(0,0,0,0.75)',
    'text-halo-width': 1,
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{ longitude: center[0], latitude: center[1], zoom: 10 }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        interactiveLayerIds={geoData ? ['zip-fill'] : []}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseOut={handleMouseOut}
        cursor="pointer"
        onLoad={handleMapLoad}
      >
        {/*
          Source type: geojson (not vector tiles).
          promoteId="zip" tells Mapbox GL to use the `zip` property as the
          feature ID, enabling setFeatureState({ id: "33139" }) to work.
        */}
        {geoData && (
          <Source
            id="miami-zips"
            type="geojson"
            data={geoData}
            promoteId="zip"
          >
            {/* Clickable fill — maintains hit area even when transparent */}
            <Layer id="zip-fill"  type="fill"   paint={fillPaint} />

            {/* Visible boundary lines */}
            <Layer id="zip-line"  type="line"   paint={linePaint} />

            {/* ZIP code labels */}
            <Layer
              id="zip-label"
              type="symbol"
              layout={{
                'text-field': ['get', 'zip'],
                'text-size': 11,
                'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
                'text-allow-overlap': false,
                'text-ignore-placement': false,
              }}
              paint={labelPaint}
            />
          </Source>
        )}
      </Map>

      {/* Loading indicator — shows while GeoJSON is in flight */}
      {!geoData && !geoError && (
        <div
          style={{
            position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(6,10,20,0.88)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#94a3b8', borderRadius: 8, padding: '8px 16px',
            fontSize: 12, backdropFilter: 'blur(12px)', zIndex: 20,
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: '2px solid #60a5fa', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
          Loading ZIP boundaries…
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* Error indicator */}
      {geoError && (
        <div
          style={{
            position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(6,10,20,0.88)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#f87171', borderRadius: 8, padding: '8px 16px',
            fontSize: 12, backdropFilter: 'blur(12px)', zIndex: 20,
          }}
        >
          Could not load ZIP boundaries — check connection
        </div>
      )}

      {/* Back to Globe */}
      <button
        onClick={onBackToGlobe}
        style={{
          position: 'absolute', top: 16, left: 16, zIndex: 20,
          background: 'rgba(6,10,20,0.82)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#94a3b8',
          borderRadius: 8,
          padding: '8px 14px',
          fontSize: 12,
          cursor: 'pointer',
          backdropFilter: 'blur(12px)',
          transition: 'border-color 0.15s, color 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.25)';
          (e.currentTarget as HTMLElement).style.color = '#e2e8f0';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
          (e.currentTarget as HTMLElement).style.color = '#94a3b8';
        }}
      >
        ← Globe
      </button>
    </div>
  );
}
