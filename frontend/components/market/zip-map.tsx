'use client';

import { useEffect, useRef, useCallback } from 'react';
import Map, { Source, Layer } from 'react-map-gl';
import type { MapRef, MapLayerMouseEvent } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { WatchlistEntry } from '@/lib/api';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

// Uses Mapbox Streets v8 vector tiles — postal_code layer is built into the
// map tiles, no external GeoJSON fetch needed. Loads instantly, works for all states.
const STREETS_SOURCE = 'mapbox://mapbox.mapbox-streets-v8';
const POSTAL_LAYER   = 'postal_code';

interface ZipMapProps {
  center: [number, number];
  bbox?: [number, number, number, number];
  watchlist: WatchlistEntry[];
  onZipClick: (zip: string) => void;
  onBackToGlobe: () => void;
}

export function ZipMap({
  center,
  bbox,
  watchlist,
  onZipClick,
  onBackToGlobe,
}: ZipMapProps) {
  const mapRef = useRef<MapRef>(null);
  const trackedZips = watchlist.map((e) => e.zip_code);

  // Fly to searched location once map loads or location changes
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (bbox) {
      map.fitBounds(
        [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
        { padding: 60, duration: 900, maxZoom: 11 }
      );
    } else {
      map.flyTo({ center, zoom: 11, duration: 900 });
    }
  }, [center, bbox]);

  // Click: read ZIP from the Mapbox Streets postal_code layer (property: name)
  const handleClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const features = e.features;
      if (!features?.length) return;
      const zip = features[0].properties?.name ?? null;
      if (zip) onZipClick(String(zip));
    },
    [onZipClick]
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{ longitude: center[0], latitude: center[1], zoom: 9 }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        interactiveLayerIds={['zip-fill']}
        onClick={handleClick}
        cursor="pointer"
      >
        {/*
          Source: Mapbox Streets v8 vector tileset (same data the map style uses).
          postal_code source-layer contains ZIP code polygon boundaries.
          These tiles are already being fetched for the base map — zero extra cost.
        */}
        <Source id="postal-codes" type="vector" url={STREETS_SOURCE}>

          {/* Clickable fill — tracked ZIPs get a blue tint */}
          <Layer
            id="zip-fill"
            type="fill"
            source-layer={POSTAL_LAYER}
            paint={{
              'fill-color': [
                'case',
                ['in', ['get', 'name'], ['literal', trackedZips]],
                'rgba(59,130,246,0.18)',
                'rgba(239,68,68,0.04)',
              ],
              'fill-opacity': 1,
            }}
          />

          {/* ZIP border lines */}
          <Layer
            id="zip-line"
            type="line"
            source-layer={POSTAL_LAYER}
            paint={{
              'line-color': [
                'case',
                ['in', ['get', 'name'], ['literal', trackedZips]],
                '#3b82f6',
                'rgba(239,68,68,0.65)',
              ],
              'line-width': [
                'case',
                ['in', ['get', 'name'], ['literal', trackedZips]],
                2.5,
                1.2,
              ],
            }}
          />

          {/* ZIP code labels */}
          <Layer
            id="zip-label"
            type="symbol"
            source-layer={POSTAL_LAYER}
            layout={{
              'text-field': ['get', 'name'],
              'text-size': 11,
              'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
              'text-allow-overlap': false,
            }}
            paint={{
              'text-color': 'rgba(148,163,184,0.7)',
              'text-halo-color': 'rgba(0,0,0,0.7)',
              'text-halo-width': 1,
            }}
          />
        </Source>
      </Map>

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
          transition: 'border-color 0.2s, color 0.2s',
        }}
      >
        ← Globe
      </button>
    </div>
  );
}
