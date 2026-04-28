'use client';

import { useEffect, useRef, useCallback } from 'react';
import Map, {
  Source,
  Layer,
} from 'react-map-gl';
import type { MapRef, MapLayerMouseEvent } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { WatchlistEntry } from '@/lib/api';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

// Census TIGER ZCTA GeoJSON per state — jsDelivr CDN (faster/more reliable than raw GitHub)
const ZCTA_BASE = 'https://cdn.jsdelivr.net/gh/OpenDataDE/State-zip-code-GeoJSON@master';

const STATE_ABBR_TO_SLUG: Record<string, string> = {
  AL:'al',AK:'ak',AZ:'az',AR:'ar',CA:'ca',CO:'co',CT:'ct',DE:'de',FL:'fl',
  GA:'ga',HI:'hi',ID:'id',IL:'il',IN:'in',IA:'ia',KS:'ks',KY:'ky',LA:'la',
  ME:'me',MD:'md',MA:'ma',MI:'mi',MN:'mn',MS:'ms',MO:'mo',MT:'mt',NE:'ne',
  NV:'nv',NH:'nh',NJ:'nj',NM:'nm',NY:'ny',NC:'nc',ND:'nd',OH:'oh',OK:'ok',
  OR:'or',PA:'pa',RI:'ri',SC:'sc',SD:'sd',TN:'tn',TX:'tx',UT:'ut',VT:'vt',
  VA:'va',WA:'wa',WV:'wv',WI:'wi',WY:'wy',DC:'dc',
};

interface ZipMapProps {
  center: [number, number];           // [lng, lat]
  bbox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  stateAbbr: string;
  watchlist: WatchlistEntry[];
  panelOpen: boolean;
  onZipClick: (zip: string) => void;
  onBackToGlobe: () => void;
}

export function ZipMap({
  center,
  bbox,
  stateAbbr,
  watchlist,
  panelOpen,
  onZipClick,
  onBackToGlobe,
}: ZipMapProps) {
  const mapRef = useRef<MapRef>(null);
  const slug = STATE_ABBR_TO_SLUG[stateAbbr.toUpperCase()] ?? 'fl';
  const geoJsonUrl = `${ZCTA_BASE}/${slug}_zip_codes_geo.min.json`;
  const trackedZips = watchlist.map((e) => e.zip_code);

  // Fly to location once map loads or center changes
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

  const handleClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const features = e.features;
      if (!features?.length) return;
      const props = features[0].properties ?? {};
      // The ZCTA GeoJSON from OpenDataDE uses ZCTA5CE10
      const zip = props.ZCTA5CE10 ?? props.ZCTA5 ?? props.zip ?? null;
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
        <Source key={geoJsonUrl} id="zcta" type="geojson" data={geoJsonUrl} generateId>
          {/* Clickable fill */}
          <Layer
            id="zip-fill"
            type="fill"
            paint={{
              'fill-color': [
                'case',
                ['in', ['get', 'ZCTA5CE10'], ['literal', trackedZips]],
                'rgba(59,130,246,0.22)',
                'rgba(120,160,255,0.05)',
              ],
              'fill-opacity': 1,
            }}
          />
          {/* Hover highlight — requires feature-state or a separate hover layer */}
          <Layer
            id="zip-fill-hover"
            type="fill"
            paint={{
              'fill-color': 'rgba(255,255,255,0.06)',
              'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0],
            }}
          />
          {/* Border */}
          <Layer
            id="zip-line"
            type="line"
            paint={{
              'line-color': [
                'case',
                ['in', ['get', 'ZCTA5CE10'], ['literal', trackedZips]],
                'rgba(59,130,246,0.9)',
                'rgba(148,163,184,0.45)',
              ],
              'line-width': [
                'case',
                ['in', ['get', 'ZCTA5CE10'], ['literal', trackedZips]],
                2,
                1,
              ],
            }}
          />
          {/* ZIP label */}
          <Layer
            id="zip-label"
            type="symbol"
            layout={{
              'text-field': ['get', 'ZCTA5CE10'],
              'text-size': 11,
              'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
              'text-allow-overlap': false,
            }}
            paint={{
              'text-color': 'rgba(148,163,184,0.65)',
              'text-halo-color': 'rgba(0,0,0,0.6)',
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
