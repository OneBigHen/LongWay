import type { RouteSamplePoint } from './types';

export function debounce<T extends (...args: any[]) => void>(fn: T, delayMs = 300) {
  let handle: any;
  return (...args: Parameters<T>) => {
    clearTimeout(handle);
    handle = setTimeout(() => fn(...args), delayMs);
  };
}

export async function backoff<T>(
  task: () => Promise<T>,
  retries = 3,
  baseDelayMs = 400
): Promise<T> {
  let attempt = 0;
  let lastErr: unknown;
  while (attempt <= retries) {
    try {
      return await task();
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
      const wait = baseDelayMs * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, wait));
      attempt++;
    }
  }
  throw lastErr;
}

// Sample approximately every ~25 miles (40.23 km). Caller maps along polyline.
export function sampleRouteLatLngs(path: google.maps.LatLngLiteral[], stepKm = 40): RouteSamplePoint[] {
  if (path.length === 0) return [];
  const result: RouteSamplePoint[] = [];
  let accumulated = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const segKm = haversineKm(a, b);
    accumulated += segKm;
    if (accumulated >= stepKm) {
      result.push(b);
      accumulated = 0;
    }
  }
  // Always include final point
  result.push(path[path.length - 1]);
  return result;
}

function haversineKm(a: google.maps.LatLngLiteral, b: google.maps.LatLngLiteral): number {
  const R = 6371; // km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

// Client-side photo cache (persists for the session via localStorage)
type PhotoPayload = { photoUrl: string | null; attribution: string | null; website: string | null };
const photoCacheMemory: Record<string, PhotoPayload> = {};

export function getCachedPhoto(name: string): PhotoPayload | null {
  if (photoCacheMemory[name]) return photoCacheMemory[name];
  try {
    const ls = localStorage.getItem('photo-cache');
    if (ls) {
      const obj = JSON.parse(ls);
      Object.assign(photoCacheMemory, obj);
    }
  } catch {}
  return photoCacheMemory[name] ?? null;
}

export function setCachedPhoto(name: string, payload: PhotoPayload) {
  photoCacheMemory[name] = payload;
  try {
    localStorage.setItem('photo-cache', JSON.stringify(photoCacheMemory));
  } catch {}
}


