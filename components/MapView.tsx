'use client';

import { useEffect, useRef, useState } from 'react';
import { ensureMaps } from '@/lib/places';
import { sampleRouteLatLngs } from '@/lib/utils';
import type { POI, RouteSamplePoint, TwistySource } from '@/lib/types';
import { addKmlLayer, removeKmlLayer, clearAllKmlLayers, getLoadedLayerIds, isLayerLoading, isLayerLoaded } from '@/lib/kmlManager';
import { parseGpx, simplify, gpxStartEnd, calculatePathDistance, LatLng } from '@/lib/gpx';

type RouteRequest = { id: number; origin: string; destination: string } | null;

export default function MapView({
  routeRequest,
  pois,
  onRouteReady,
  waypoints,
  onMarkerClick,
  avoidHighways,
  avoidTolls,
  twistySources,
  sourcesVersion,
  routeColor,
}: {
  routeRequest: RouteRequest;
  pois?: POI[];
  onRouteReady?: (data: { samples: RouteSamplePoint[]; bounds: google.maps.LatLngBoundsLiteral; distanceText: string; durationText: string; summary?: string }) => void;
  waypoints?: Array<{ lat: number; lng: number } | string>;
  onMarkerClick?: (id: string) => void;
  avoidHighways?: boolean;
  avoidTolls?: boolean;
  twistySources?: TwistySource[];
  sourcesVersion?: number;
  routeColor?: string; // Hex color for route polyline (e.g., '#4285F4' for blue, '#34A853' for green, '#9C27B0' for purple)
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const rendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const serviceRef = useRef<google.maps.DirectionsService | null>(null);
  const markerRefs = useRef<google.maps.Marker[]>([]);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const [ready, setReady] = useState(false);
  const gpxPolylineRef = useRef<google.maps.Polyline | null>(null);
  const lastRouteRequestRef = useRef<RouteRequest | null>(null);
  const hasZoomedRef = useRef(false);
  const lastRouteConfigRef = useRef<{
    origin: string;
    destination: string;
    waypoints: Array<{ lat: number; lng: number } | string>;
    avoidHighways: boolean;
    avoidTolls: boolean;
    routeColor?: string;
  } | null>(null);
  const gpxActionsRef = useRef<{ previewGpxOnMap: (file: string) => Promise<void>; useGpxAsRoute: (file: string) => Promise<void> } | null>(null);

  // Initialize map once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const g = await ensureMaps();
      if (cancelled || !containerRef.current) return;
      const center = { lat: 40.2206, lng: -74.7597 };
      const map = new g.maps.Map(containerRef.current, {
        center,
        zoom: 8,
        disableDefaultUI: true,
        mapTypeControl: false,
        streetViewControl: false,
      });
      mapInstanceRef.current = map;
      serviceRef.current = new g.maps.DirectionsService();
      infoRef.current = new g.maps.InfoWindow();
      setReady(true);
    })();
    return () => {
      cancelled = true;
      clearAllKmlLayers();
      if (gpxPolylineRef.current) {
        gpxPolylineRef.current.setMap(null);
        gpxPolylineRef.current = null;
      }
    };
  }, []);

  // Apply KML overlays when toggles change
  useEffect(() => {
    const map = mapInstanceRef.current;
    console.log('[KML Effect] Triggered. Map ready:', !!map, 'Sources:', twistySources?.length);
    if (!map || !twistySources || !ready) {
      console.log('[KML Effect] Skipping - map:', !!map, 'sources:', !!twistySources, 'ready:', ready);
      return;
    }
    
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    
    // Track which sources should be enabled vs which are currently loaded
    const enabledSources = twistySources.filter(src => src.enabled);
    const enabledIds = new Set(enabledSources.map(s => s.id));
    const loadedIds = new Set(getLoadedLayerIds());
    
    // Remove layers that are no longer enabled (optimization: only remove what changed)
    for (const id of loadedIds) {
      if (!enabledIds.has(id)) {
        console.log('[KML Effect] Removing disabled layer:', id);
        removeKmlLayer(id);
      }
    }
    
    // Only add layers that aren't already loaded or loading
    const sourcesToAdd = enabledSources.filter(src => 
      !isLayerLoaded(src.id) && !isLayerLoading(src.id)
    );
    console.log('[KML Effect] Processing:', enabledSources.length, 'enabled,', sourcesToAdd.length, 'new to add');
    
    // Load new sources only (don't await - let them load in parallel)
    if (sourcesToAdd.length > 0) {
      sourcesToAdd.forEach((src) => {
        console.log('[KML Effect] Adding enabled source:', src.id, 'kind:', src.kind);
        const filePath = src.url.replace(/^\/kml\//, '');
        const apiUrl = `${baseUrl}/api/kml/${filePath}`;
        addKmlLayer(src.id, map, apiUrl, src.kind).catch(err => {
          console.error('[KML Effect] Failed to load:', src.id, err);
        });
      });
    }
  }, [twistySources, ready]);

  // Listen for clear GPX polyline event
  useEffect(() => {
    function handleClearGpx() {
      clearGpxPolyline();
    }
    window.addEventListener('clear-gpx-polyline', handleClearGpx);
    return () => window.removeEventListener('clear-gpx-polyline', handleClearGpx);
  }, []);

  // Clear route renderer when routeRequest is null
  useEffect(() => {
    if (!routeRequest && ready) {
      // Clear the DirectionsRenderer when route is cleared
      if (rendererRef.current) {
        rendererRef.current.setMap(null);
        rendererRef.current = null;
      }
      // Also reset refs
      lastRouteRequestRef.current = null;
      lastRouteConfigRef.current = null;
    }
  }, [routeRequest, ready]);

  // Respond to new route requests
  useEffect(() => {
    if (!routeRequest || !ready || !mapInstanceRef.current || !serviceRef.current) return;
    
    // Build current route config to compare
    const currentConfig = {
      origin: routeRequest.origin,
      destination: routeRequest.destination,
      waypoints: waypoints || [],
      avoidHighways: !!avoidHighways,
      avoidTolls: !!avoidTolls,
      routeColor: routeColor,
    };
    
    // Check if this is actually a new/different route request
    const configChanged = !lastRouteConfigRef.current ||
      lastRouteConfigRef.current.origin !== currentConfig.origin ||
      lastRouteConfigRef.current.destination !== currentConfig.destination ||
      JSON.stringify(lastRouteConfigRef.current.waypoints) !== JSON.stringify(currentConfig.waypoints) ||
      lastRouteConfigRef.current.avoidHighways !== currentConfig.avoidHighways ||
      lastRouteConfigRef.current.avoidTolls !== currentConfig.avoidTolls ||
      lastRouteConfigRef.current.routeColor !== currentConfig.routeColor;
    
    if (!configChanged) {
      console.log('[MapView] Skipping duplicate route request - config unchanged');
      return;
    }
    
    // Update refs
    lastRouteRequestRef.current = routeRequest;
    lastRouteConfigRef.current = currentConfig;
    hasZoomedRef.current = false; // Reset zoom flag for new route
    
    const { origin, destination } = routeRequest;
    const g = google as any;
    const service = serviceRef.current;

    // Clear previous renderer
    if (rendererRef.current) {
      rendererRef.current.setMap(null);
      rendererRef.current = null;
    }

    // Set preserveViewport: true to prevent auto-zooming (we'll handle it manually)
    const rendererOptions: google.maps.DirectionsRendererOptions = {
      suppressMarkers: true,
      preserveViewport: true, // Prevent automatic zoom - we'll do it manually once
    };
    
    // Apply custom route color if provided
    if (routeColor) {
      rendererOptions.polylineOptions = {
        strokeColor: routeColor,
        strokeWeight: 5,
        strokeOpacity: 0.8,
      };
    }
    
    const renderer = new g.maps.DirectionsRenderer(rendererOptions);
    renderer.setMap(mapInstanceRef.current);
    rendererRef.current = renderer;

    service.route(
      {
        origin,
        destination,
        travelMode: g.maps.TravelMode.DRIVING,
        optimizeWaypoints: false, // Don't optimize - preserve order for alternative routes
        waypoints: (waypoints || []).map((w) =>
          typeof w === 'string'
            ? { location: w, stopover: true }
            : { location: new g.maps.LatLng(w.lat, w.lng), stopover: true }
        ),
        avoidHighways: !!avoidHighways,
        avoidTolls: !!avoidTolls,
      },
      (result: google.maps.DirectionsResult | null, status: google.maps.DirectionsStatus) => {
        if (status === 'OK' && result) {
          renderer.setDirections(result);
          try {
            const route = result.routes[0];
            const overview = route.overview_path.map((ll: any) => ({ lat: ll.lat(), lng: ll.lng() }));
            const samples = sampleRouteLatLngs(overview, 40);
            const b = route.bounds;
            const bounds = { north: b.getNorthEast().lat(), east: b.getNorthEast().lng(), south: b.getSouthWest().lat(), west: b.getSouthWest().lng() };
            // Aggregate legs for total distance/duration
            const legs = route.legs || [];
            const totalMeters = legs.reduce((acc, l) => acc + (l.distance?.value || 0), 0);
            const totalSecs = legs.reduce((acc, l) => acc + (l.duration?.value || 0), 0);
            const km = totalMeters / 1000;
            const miles = km * 0.621371;
            const hours = Math.floor(totalSecs / 3600);
            const mins = Math.round((totalSecs % 3600) / 60);
            const distanceText = `${miles.toFixed(1)} mi`;
            const durationText = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
            const summary = route.summary;
            onRouteReady?.({ samples, bounds, distanceText, durationText, summary });
            
            // Fit the map to the full route with padding (only once per route)
            const map = mapInstanceRef.current;
            if (map && !hasZoomedRef.current) {
              hasZoomedRef.current = true;
              const padding: google.maps.Padding = { top: 80, right: 80, bottom: 260, left: 80 };
              // Use setTimeout to ensure fitBounds happens after renderer finishes
              setTimeout(() => {
                if (map && hasZoomedRef.current) {
                  map.fitBounds(b, padding);
                }
              }, 100);
            }
          } catch (e) {
            console.warn('Failed to sample route', e);
          }
        } else {
          console.warn('Directions request failed:', status, { origin, destination });
        }
      }
    );
  }, [routeRequest, ready, waypoints, avoidHighways, avoidTolls, routeColor]);

  // Render POI markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    // Clear existing markers
    markerRefs.current.forEach((m) => m.setMap(null));
    markerRefs.current = [];
    if (!pois || pois.length === 0) return;
    const g = google as any;
    pois.forEach((poi, idx) => {
      const marker = new g.maps.Marker({
        position: { lat: poi.lat, lng: poi.lng },
        map,
        title: poi.name,
        label: { text: `${idx + 1}`, color: 'white', fontSize: '14px', fontWeight: 'bold' },
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          fillColor: '#FF385C',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 2,
          scale: 12,
        },
      });
      marker.addListener('mouseover', () => {
        if (!infoRef.current) return;
        const img = poi.photoUrl ? `<img src="${poi.photoUrl}" style="width:120px;height:80px;object-fit:cover;border-radius:6px;margin-bottom:6px"/>` : '';
        const linkUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(poi.name)}`;
        infoRef.current.setContent(`${img}<div style="font-weight:600">${poi.name}</div><div style="font-size:12px;color:#666">${poi.type ?? ''}</div><div style="margin-top:6px"><a href="${linkUrl}" target="_blank" rel="noopener" style="font-size:12px;color:#2563eb">Open in Google Maps</a></div>`);
        infoRef.current.open({ anchor: marker, map });
      });
      marker.addListener('mouseout', () => {
        infoRef.current?.close();
      });
      marker.addListener('click', () => onMarkerClick?.(poi.id));
      markerRefs.current.push(marker);
    });
  }, [pois]);

  // --- GPX helpers ---
  function clearGpxPolyline() {
    if (gpxPolylineRef.current) {
      gpxPolylineRef.current.setMap(null);
      gpxPolylineRef.current = null;
    }
  }

  async function previewGpxOnMap(file: string) {
    const map = mapInstanceRef.current;
    if (!map) return;
    clearGpxPolyline();
    const res = await fetch(`/gpx/${file}`);
    const xml = await res.text();
    const pts = parseGpx(xml);
    if (pts.length === 0) return;
    const simp = simplify(pts, 20);
    const path = simp.map((p) => ({ lat: p.lat, lng: p.lng }));
    const poly = new google.maps.Polyline({
      path,
      strokeOpacity: 0.95,
      strokeWeight: 4,
      strokeColor: '#ff6600',
    });
    poly.setMap(map);
    gpxPolylineRef.current = poly;
    const bounds = new google.maps.LatLngBounds();
    path.forEach((p) => bounds.extend(p as any));
    map.fitBounds(bounds);
    
    // Calculate and emit route summary for preview
    const totalDistanceMeters = calculatePathDistance(pts);
    const miles = (totalDistanceMeters / 1000) * 0.621371;
    const hours = miles / 45; // assume 45 mph average
    const totalMinutes = Math.round(hours * 60);
    const hoursPart = Math.floor(totalMinutes / 60);
    const minsPart = totalMinutes % 60;
    
    window.dispatchEvent(new CustomEvent('gpx-preview-summary', {
      detail: {
        file,
        distanceText: `${miles.toFixed(1)} mi`,
        durationText: hoursPart > 0 ? `${hoursPart}h ${minsPart}m` : `${minsPart}m`,
      }
    } as any));
  }

  async function useGpxAsRoute(file: string) {
    const res = await fetch(`/gpx/${file}`);
    const xml = await res.text();
    const pts = parseGpx(xml);
    if (pts.length < 2) return;
    const { start, end } = gpxStartEnd(pts);
    // Keep GPX line visible
    await previewGpxOnMap(file);
    // Emit event for HomePage to set routeRequest (triggers POI refresh via onRouteReady)
    const detail = { origin: `${start.lat},${start.lng}`, destination: `${end.lat},${end.lng}` };
    window.dispatchEvent(new CustomEvent('use-gpx-route', { detail } as any));
  }

  // Listen for postMessage from GPX Library page
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Verify origin for security
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'gpx-preview') {
        console.log('[MapView] Received gpx-preview message:', event.data.file);
        // Use ref to get current actions
        const actions = gpxActionsRef.current || (globalThis as any).__mapActions;
        if (actions && actions.previewGpxOnMap) {
          actions.previewGpxOnMap(event.data.file).catch((err: any) => {
            console.error('[MapView] Error previewing GPX:', err);
          });
        } else {
          console.error('[MapView] previewGpxOnMap not available');
        }
      } else if (event.data.type === 'gpx-use-route') {
        console.log('[MapView] Received gpx-use-route message:', event.data.file);
        // Use ref to get current actions
        const actions = gpxActionsRef.current || (globalThis as any).__mapActions;
        if (actions && actions.useGpxAsRoute) {
          actions.useGpxAsRoute(event.data.file).catch((err: any) => {
            console.error('[MapView] Error using GPX as route:', err);
          });
        } else {
          console.error('[MapView] useGpxAsRoute not available');
        }
      }
    }
    
    // Also use BroadcastChannel for cross-tab communication (works without window.opener)
    const bc = new BroadcastChannel('gpx-map-communication');
    bc.onmessage = (event) => {
      // BroadcastChannel doesn't have origin, but it's same-origin only, so safe
      if (event.data.type === 'gpx-preview' || event.data.type === 'gpx-use-route') {
        console.log('[MapView] Received BroadcastChannel message:', event.data);
        const actions = gpxActionsRef.current || (globalThis as any).__mapActions;
        if (event.data.type === 'gpx-preview') {
          if (actions && actions.previewGpxOnMap) {
            actions.previewGpxOnMap(event.data.file).catch((err: any) => {
              console.error('[MapView] Error previewing GPX:', err);
            });
          } else {
            console.error('[MapView] previewGpxOnMap not available');
          }
        } else if (event.data.type === 'gpx-use-route') {
          if (actions && actions.useGpxAsRoute) {
            actions.useGpxAsRoute(event.data.file).catch((err: any) => {
              console.error('[MapView] Error using GPX as route:', err);
            });
          } else {
            console.error('[MapView] useGpxAsRoute not available');
          }
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      bc.close();
    };
  }, []);

  // Expose global actions for GPX Library page (both on current window and ensure it's available)
  useEffect(() => {
    if (ready && mapInstanceRef.current) {
      // Wrap functions to ensure they always use current refs
      const actions = {
        previewGpxOnMap: async (file: string) => {
          const map = mapInstanceRef.current;
          if (!map) {
            console.error('[MapView] previewGpxOnMap called but map not ready');
            return;
          }
          clearGpxPolyline();
          const res = await fetch(`/gpx/${file}`);
          const xml = await res.text();
          const pts = parseGpx(xml);
          if (pts.length === 0) return;
          const simp = simplify(pts, 20);
          const path = simp.map((p) => ({ lat: p.lat, lng: p.lng }));
          const poly = new google.maps.Polyline({
            path,
            strokeOpacity: 0.95,
            strokeWeight: 4,
            strokeColor: '#ff6600',
          });
          poly.setMap(map);
          gpxPolylineRef.current = poly;
          const bounds = new google.maps.LatLngBounds();
          path.forEach((p) => bounds.extend(p as any));
          map.fitBounds(bounds);
          
          // Calculate and emit route summary for preview
          const totalDistanceMeters = calculatePathDistance(pts);
          const miles = (totalDistanceMeters / 1000) * 0.621371;
          const hours = miles / 45; // assume 45 mph average
          const totalMinutes = Math.round(hours * 60);
          const hoursPart = Math.floor(totalMinutes / 60);
          const minsPart = totalMinutes % 60;
          
          window.dispatchEvent(new CustomEvent('gpx-preview-summary', {
            detail: {
              file,
              distanceText: `${miles.toFixed(1)} mi`,
              durationText: hoursPart > 0 ? `${hoursPart}h ${minsPart}m` : `${minsPart}m`,
            }
          } as any));
        },
        useGpxAsRoute: async (file: string) => {
          const res = await fetch(`/gpx/${file}`);
          const xml = await res.text();
          const pts = parseGpx(xml);
          if (pts.length < 2) return;
          const { start, end } = gpxStartEnd(pts);
          
          // Calculate distance and estimated duration from GPX path
          const totalDistanceMeters = calculatePathDistance(pts);
          const km = totalDistanceMeters / 1000;
          const miles = km * 0.621371;
          // Estimate duration: assume average speed of 45 mph for scenic routes
          const hours = miles / 45;
          const totalMinutes = Math.round(hours * 60);
          const hoursPart = Math.floor(totalMinutes / 60);
          const minsPart = totalMinutes % 60;
          
          // Simplify for waypoints (use more points for better route matching)
          const simpForWaypoints = simplify(pts, 100); // 100m simplification for waypoints
          // Distribute up to 23 waypoints evenly along the path (excluding start/end)
          const waypointCount = Math.min(23, Math.max(0, simpForWaypoints.length - 2));
          const waypointSlice: LatLng[] = [];
          if (waypointCount > 0 && simpForWaypoints.length > 2) {
            const interior = simpForWaypoints.slice(1, -1);
            const step = Math.max(1, Math.floor(interior.length / waypointCount));
            for (let i = 0; i < interior.length && waypointSlice.length < waypointCount; i += step) {
              waypointSlice.push(interior[i]);
            }
            // Ensure we have waypoints spread out - if we still have room, fill gaps
            if (waypointSlice.length < waypointCount && interior.length > waypointSlice.length) {
              const remaining = interior.filter((p, idx) => idx % step !== 0);
              const needed = waypointCount - waypointSlice.length;
              waypointSlice.push(...remaining.slice(0, needed));
            }
            // Sort by original order
            waypointSlice.sort((a, b) => {
              const idxA = interior.findIndex(p => p.lat === a.lat && p.lng === a.lng);
              const idxB = interior.findIndex(p => p.lat === b.lat && p.lng === b.lng);
              return idxA - idxB;
            });
          }
          
          // Keep GPX line visible
          const map = mapInstanceRef.current;
          if (map) {
            clearGpxPolyline();
            const simp = simplify(pts, 20);
            const path = simp.map((p) => ({ lat: p.lat, lng: p.lng }));
            const poly = new google.maps.Polyline({
              path,
              strokeOpacity: 0.95,
              strokeWeight: 4,
              strokeColor: '#ff6600',
            });
            poly.setMap(map);
            gpxPolylineRef.current = poly;
          }
          
          // Emit event with waypoints and calculated distance/duration
          const detail = { 
            origin: `${start.lat},${start.lng}`, 
            destination: `${end.lat},${end.lng}`,
            waypoints: waypointSlice,
            gpxFile: file,
            distanceMeters: totalDistanceMeters,
            estimatedDurationMinutes: totalMinutes
          };
          window.dispatchEvent(new CustomEvent('use-gpx-route', { detail } as any));
        }
      };
      
      // Store in ref for message handler access
      gpxActionsRef.current = actions;
      // Also expose globally for direct access
      (globalThis as any).__mapActions = actions;
      console.log('[MapView] Exposed __mapActions globally');
    }
  }, [ready]);

  return <div ref={containerRef} className="h-full w-full" />;
}


