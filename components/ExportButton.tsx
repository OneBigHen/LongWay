'use client';
import { buildGoogleMapsDirUrl } from '@/lib/export';
import type { LatLng } from '@/lib/gpx';

export default function ExportButton({ origin, destination, waypoints }: { origin: LatLng; destination: LatLng; waypoints: LatLng[] }) {
  const url = buildGoogleMapsDirUrl(origin, destination, waypoints);
  return (
    <a className="border rounded px-3 py-1 text-sm" href={url} target="_blank" rel="noreferrer">
      Export to Google Maps
    </a>
  );
}


