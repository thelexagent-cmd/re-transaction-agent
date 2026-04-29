import { NextResponse } from 'next/server';

// Proxies the Census TIGERweb ZCTA polygon request server-side.
// Client fetch would be blocked by CORS — Census ArcGIS REST does not
// reliably allow arbitrary origins. Running this server-side eliminates that.
//
// Response is cached for 24 h (revalidate=86400) since ZIP boundaries
// change at most once per census cycle.

const TIGER_BASE =
  'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer';

// Layer 4 = "2020 Census ZIP Code Tabulation Areas" in this service.
// Verified by querying service info — returns Polygon geometry with ZCTA5 field.
// Layer names do NOT contain "zcta" so regex discovery was always falling back
// to layer 2 ("ACS 2025") which returned HTTP 400.
const ZCTA_LAYER = 4;

// Miami-Dade County bounding box
const MIAMI_ENVELOPE = JSON.stringify({
  xmin: -80.875, ymin: 25.13,
  xmax: -80.14,  ymax: 25.98,
  spatialReference: { wkid: 4326 },
});

export async function GET() {
  try {
    const geom = encodeURIComponent(MIAMI_ENVELOPE);
    const url =
      `${TIGER_BASE}/${ZCTA_LAYER}/query` +
      `?geometry=${geom}&geometryType=esriGeometryEnvelope` +
      `&spatialRel=esriSpatialRelIntersects&inSR=4326` +
      `&outFields=*&f=geojson&outSR=4326`;

    const res = await fetch(url, { next: { revalidate: 86400 } });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Census API returned ${res.status}` },
        { status: 502 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json() as { features?: any[] };

    if (!data.features?.length) {
      return NextResponse.json(
        { error: 'No features returned from Census API' },
        { status: 502 }
      );
    }

    // Normalize ZIP field — Census field names vary by data vintage
    data.features = data.features.map((f) => {
      const p = (f.properties ?? {}) as Record<string, unknown>;
      const zip = String(
        p['ZCTA5CE20'] ?? p['ZCTA5CE10'] ?? p['ZCTA5'] ?? p['GEOID'] ?? p['NAME'] ?? ''
      ).replace(/\D/g, '').slice(-5).padStart(5, '0');
      return { ...f, properties: { ...p, zip } };
    });

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
      },
    });
  } catch (err) {
    console.error('[miami-zips]', err);
    return NextResponse.json({ error: 'Failed to fetch ZIP boundaries' }, { status: 500 });
  }
}
