'use client';

import { useEffect, useRef, useState } from 'react';
import { ensureMaps } from '@/lib/places';
import { sampleRouteLatLngs } from '@/lib/utils';
import type { POI, RouteSamplePoint } from '@/lib/types';

type RouteRequest = { id: number; origin: string; destination: string } | null;

export default function MapView({
  routeRequest,
  pois,
  onRouteReady,
  waypoints,
  onMarkerClick,
  avoidHighways,
  avoidTolls,
}: {
  routeRequest: RouteRequest;
  pois?: POI[];
  onRouteReady?: (data: { samples: RouteSamplePoint[]; bounds: google.maps.LatLngBoundsLiteral; distanceText: string; durationText: string; summary?: string }) => void;
  waypoints?: Array<{ lat: number; lng: number } | string>;
  onMarkerClick?: (id: string) => void;
  avoidHighways?: boolean;
  avoidTolls?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const rendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const serviceRef = useRef<google.maps.DirectionsService | null>(null);
  const markerRefs = useRef<google.maps.Marker[]>([]);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const [ready, setReady] = useState(false);

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
    };
  }, []);

  // Respond to new route requests
  useEffect(() => {
    if (!routeRequest || !ready || !mapInstanceRef.current || !serviceRef.current) return;
    const { origin, destination } = routeRequest;
    const g = google as any;
    const service = serviceRef.current;

    // Clear previous renderer
    if (rendererRef.current) {
      rendererRef.current.setMap(null);
      rendererRef.current = null;
    }

    const renderer = new g.maps.DirectionsRenderer({ suppressMarkers: true, preserveViewport: false });
    renderer.setMap(mapInstanceRef.current);
    rendererRef.current = renderer;

    service.route(
      {
        origin,
        destination,
        travelMode: g.maps.TravelMode.DRIVING,
        optimizeWaypoints: true,
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
            // Fit the map to the full route with padding (extra bottom padding for drawer)
            const map = mapInstanceRef.current;
            if (map) {
              const padding: google.maps.Padding = { top: 80, right: 80, bottom: 260, left: 80 };
              map.fitBounds(b, padding);
            }
          } catch (e) {
            console.warn('Failed to sample route', e);
          }
        } else {
          console.warn('Directions request failed:', status, { origin, destination });
        }
      }
    );
  }, [routeRequest, ready, waypoints, avoidHighways, avoidTolls]);

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

  return <div ref={containerRef} className="h-full w-full" />;
}


