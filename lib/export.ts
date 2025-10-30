import type { LatLng } from './gpx';

export function buildGoogleMapsDirUrl(
  origin: LatLng,
  destination: LatLng,
  waypoints: LatLng[] = []
) {
  const toStr = (p: LatLng) => `${p.lat},${p.lng}`;
  const capped = waypoints.slice(0, 23);
  const wp = capped.map(toStr).join('|');
  const params = new URLSearchParams({
    api: '1',
    origin: toStr(origin),
    destination: toStr(destination),
    travelmode: 'driving',
  });
  if (wp) params.set('waypoints', wp);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}


