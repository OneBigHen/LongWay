export interface LatLng { lat: number; lng: number; }

export function parseGpx(xmlText: string): LatLng[] {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  const pts = Array.from(doc.getElementsByTagName('trkpt'));
  return pts
    .map((pt) => ({
      lat: parseFloat(pt.getAttribute('lat') || '0'),
      lng: parseFloat(pt.getAttribute('lon') || '0'),
    }))
    .filter((p) => !Number.isNaN(p.lat) && !Number.isNaN(p.lng));
}

// Douglas–Peucker simplification (epsilon in meters)
export function simplify(points: LatLng[], epsilonMeters = 50): LatLng[] {
  if (points.length <= 2) return points;
  const epsilon = epsilonMeters / 111320; // rough deg conversion
  const d = (a: LatLng, b: LatLng, p: LatLng) => {
    const A = { x: a.lng, y: a.lat }, B = { x: b.lng, y: b.lat }, P = { x: p.lng, y: p.lat };
    const ABx = B.x - A.x, ABy = B.y - A.y;
    const APx = P.x - A.x, APy = P.y - A.y;
    const t = Math.max(0, Math.min(1, (APx * ABx + APy * ABy) / (ABx * ABx + ABy * ABy)));
    const proj = { x: A.x + t * ABx, y: A.y + t * ABy };
    const dx = P.x - proj.x, dy = P.y - proj.y;
    return Math.sqrt(dx * dx + dy * dy);
  };
  const rdp = (pts: LatLng[], s: number, e: number, out: number[]) => {
    let maxD = 0, idx = s + 1;
    for (let i = s + 1; i < e; i++) {
      const dist = d(pts[s], pts[e], pts[i]);
      if (dist > maxD) { maxD = dist; idx = i; }
    }
    if (maxD > epsilon) {
      rdp(pts, s, idx, out);
      rdp(pts, idx, e, out);
    } else {
      out.push(s, e);
    }
  };
  const outIdx: number[] = [];
  rdp(points, 0, points.length - 1, outIdx);
  const uniq = Array.from(new Set(outIdx)).sort((a, b) => a - b);
  return uniq.map((i) => points[i]);
}

export function gpxStartEnd(points: LatLng[]) {
  return { start: points[0], end: points[points.length - 1] };
}

// Calculate total distance in meters along a path using Haversine formula
export function calculatePathDistance(points: LatLng[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    const R = 6371000; // Earth radius in meters
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    total += R * c;
  }
  return total;
}


