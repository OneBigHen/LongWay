// Manage KML overlays by parsing KML and rendering as Polylines (works with localhost)
import { parseKml } from './kmlParser';

let layerMap = new Map<string, google.maps.Polyline[]>();
let loadingSet = new Set<string>(); // Track which layers are currently loading

export async function addKmlLayer(id: string, map: google.maps.Map, url: string, kind?: 'twisty' | 'curvy') {
  // Prevent duplicate loads
  if (loadingSet.has(id)) {
    console.log('[KML] Already loading:', id);
    return;
  }
  if (layerMap.has(id)) {
    console.log('[KML] Already loaded:', id);
    return;
  }
  
  loadingSet.add(id);
  removeKmlLayer(id); // Clean up any existing
  
  try {
    console.log('[KML] Fetching:', url);
    const res = await fetch(url);
    if (!res.ok) {
      console.error('[KML] ❌ Failed to fetch:', url, res.status, res.statusText);
      return;
    }
    const xmlText = await res.text();
    const startTime = performance.now();
    
    // Use aggressive simplification (15m epsilon) for large KML files
    const paths = parseKml(xmlText, 15);
    const parseTime = performance.now() - startTime;
    
    if (paths.length === 0) {
      console.warn('[KML] ⚠️ No LineString paths found in:', id);
      return;
    }

    const totalPoints = paths.reduce((sum, p) => sum + p.length, 0);
    console.log('[KML] Parsed', paths.length, 'paths,', totalPoints, 'points in', parseTime.toFixed(0), 'ms');

    // Limit number of paths for very large files (performance safeguard)
    const MAX_PATHS = 3000;
    const pathsToRender = paths.length > MAX_PATHS ? paths.slice(0, MAX_PATHS) : paths;
    if (paths.length > MAX_PATHS) {
      console.warn('[KML] ⚠️ Limiting to', MAX_PATHS, 'paths for performance');
    }

    const renderStart = performance.now();
    const polylines: google.maps.Polyline[] = [];
    const strokeColor = kind === 'twisty' ? '#FF0000' : '#FF6600';

    // Batch polyline creation to avoid blocking the main thread
    const BATCH_SIZE = 50;
    for (let i = 0; i < pathsToRender.length; i += BATCH_SIZE) {
      const batch = pathsToRender.slice(i, i + BATCH_SIZE);
      
      batch.forEach((path) => {
        const polyline = new google.maps.Polyline({
          path: path.map(p => ({ lat: p.lat, lng: p.lng })),
          map,
          strokeColor,
          strokeOpacity: 0.8,
          strokeWeight: 3,
          zIndex: 1,
        });
        polylines.push(polyline);
      });

      // Yield to main thread every batch to prevent freezing
      if (i + BATCH_SIZE < pathsToRender.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    const renderTime = performance.now() - renderStart;
    layerMap.set(id, polylines);
    loadingSet.delete(id);
    console.log('[KML] ✅ Rendered', polylines.length, 'polylines in', renderTime.toFixed(0), 'ms');
  } catch (error) {
    loadingSet.delete(id);
    console.error('[KML] ❌ Error loading:', id, error);
  }
}

export function removeKmlLayer(id: string) {
  const polylines = layerMap.get(id);
  if (polylines) {
    polylines.forEach(poly => poly.setMap(null));
    layerMap.delete(id);
  }
  loadingSet.delete(id); // Also clear loading state
}

export function clearAllKmlLayers() {
  for (const [id, polylines] of layerMap.entries()) {
    polylines.forEach(poly => poly.setMap(null));
    layerMap.delete(id);
  }
}

export function getLoadedLayerIds(): string[] {
  return Array.from(layerMap.keys());
}

export function isLayerLoading(id: string): boolean {
  return loadingSet.has(id);
}

export function isLayerLoaded(id: string): boolean {
  return layerMap.has(id);
}


