// Parse KML and extract coordinates from LineString elements with simplification
export interface LatLng { lat: number; lng: number; }

// Douglas-Peucker simplification for performance with large KML files
function simplifyKmlPath(points: LatLng[], epsilonMeters = 10): LatLng[] {
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

export function parseKml(xmlText: string, simplifyEpsilon = 10): LatLng[][] {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  const lineStrings = Array.from(doc.getElementsByTagName('LineString'));
  const paths: LatLng[][] = [];

  lineStrings.forEach((lineString) => {
    const coordinates = lineString.getElementsByTagName('coordinates')[0];
    if (!coordinates || !coordinates.textContent) return;

    // KML coordinates format: "lng,lat[,alt] lng,lat[,alt] ..."
    const coords = coordinates.textContent
      .trim()
      .split(/\s+/)
      .map((coordStr) => {
        const parts = coordStr.split(',');
        if (parts.length < 2) return null;
        const lng = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
        return { lat, lng };
      })
      .filter((c): c is LatLng => c !== null);

    if (coords.length > 0) {
      // Simplify paths for performance (10m epsilon for KML - more aggressive than GPX)
      const simplified = simplifyKmlPath(coords, simplifyEpsilon);
      if (simplified.length > 1) {
        paths.push(simplified);
      }
    }
  });

  return paths;
}

