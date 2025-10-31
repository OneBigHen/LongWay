'use client';

import { useEffect, useRef, useState } from 'react';
import type { POI, PlannerType, RouteAlternative, RoutePreferences } from '@/lib/types';
import { getCachedPhoto, setCachedPhoto } from '@/lib/utils';
import { ensureMaps } from '@/lib/places';
import { loadPreferences } from '@/lib/preferences';
import { buildGoogleMapsDirUrl } from '@/lib/export';
import SearchPanel from '@/components/SearchPanel';
import MapView from '@/components/MapView';
import POIDrawer from '@/components/POIDrawer';
import SettingsCog, { useTwistySources } from '@/components/SettingsCog';
import ExportButton from '@/components/ExportButton';
import POICard from '@/components/POICard';
import GpxLibraryModal from '@/components/GpxLibraryModal';
import RouteAltPanel from '@/components/RouteAltPanel';
import RecommendationPopup from '@/components/RecommendationPopup';

export default function HomePage() {
  const [routeReq, setRouteReq] = useState<{ id: number; origin: string; destination: string } | null>(null);
  const [counter, setCounter] = useState(0);
  const [dateISO, setDateISO] = useState<string | null>(null);
  const [pois, setPois] = useState<POI[]>([]);
  const [loadingPois, setLoadingPois] = useState(false);
  const [poiError, setPoiError] = useState<string | null>(null);
  const [waypoints, setWaypoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const [midText, setMidText] = useState<string>('');
  const [preference, setPreference] = useState<string | undefined>(undefined);
  const agentKeyRef = useRef<string | null>(null);
  const agentInFlightRef = useRef(false);
  const cancelPoiFetchRef = useRef(false);
  const [routeInfo, setRouteInfo] = useState<{ distanceText: string; durationText: string; summary?: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [avoidHighways, setAvoidHighways] = useState(false);
  const [avoidTolls, setAvoidTolls] = useState(false);
  const { sources: hookSources } = useTwistySources();
  // Store sources in local state so we can update when SettingsCog changes
  const [twistySources, setTwistySources] = useState(hookSources);
  const [sourcesVersion, setSourcesVersion] = useState(0);
  
  // Update local state when hook sources change
  useEffect(() => {
    setTwistySources(hookSources);
  }, [hookSources]);
  const [lastSamples, setLastSamples] = useState<{ lat: number; lng: number }[]>([]);
  const [gpxWaypoints, setGpxWaypoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const [gpxLibraryOpen, setGpxLibraryOpen] = useState(false);
  const [currentGpxFile, setCurrentGpxFile] = useState<string | null>(null);
  const [previewRouteInfo, setPreviewRouteInfo] = useState<{ distanceText: string; durationText: string } | null>(null);
  const [gpxRouteOriginDest, setGpxRouteOriginDest] = useState<{ origin: string; destination: string } | null>(null);
  
  // Route alternatives state (You.com Planner)
  const [alternatives, setAlternatives] = useState<RouteAlternative[]>([]);
  const [activeAlternativeId, setActiveAlternativeId] = useState<string | null>(null);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);
  const [alternativesError, setAlternativesError] = useState<string | null>(null);
  const [showRecommendationPopup, setShowRecommendationPopup] = useState(false);
  const [recommendedAlternative, setRecommendedAlternative] = useState<RouteAlternative | null>(null);
  const [alternativePois, setAlternativePois] = useState<Map<string, POI[]>>(new Map());
  const [currentPlannerType, setCurrentPlannerType] = useState<PlannerType>('google');
  const [routeColor, setRouteColor] = useState<string | undefined>(undefined);
  const [alternativeWaypoints, setAlternativeWaypoints] = useState<Array<{ lat: number; lng: number } | string>>([]);

  // Listen for GPX route selections from MapView/app/gpx
  useEffect(() => {
    function onUseGpx(e: any) {
      setCounter((c) => c + 1);
      const { origin, destination, waypoints, gpxFile, distanceMeters, estimatedDurationMinutes } = e.detail || {};
      if (origin && destination) {
        // Don't set routeReq for GPX routes - we only want to show the GPX polyline, not a DirectionsRenderer route
        // setRouteReq({ id: counter + 1, origin, destination });
        // Store GPX origin/destination for export
        setGpxRouteOriginDest({ origin, destination });
        // Store GPX waypoints for export and route calculation
        setGpxWaypoints(waypoints || []);
        // Also set waypoints state so MapView uses them for route calculation
        if (waypoints && waypoints.length > 0) {
          setWaypoints(waypoints);
        }
        // Store GPX file for download button
        setCurrentGpxFile(gpxFile || null);
        // Update route info immediately with GPX-calculated values
        if (distanceMeters && estimatedDurationMinutes) {
          const miles = (distanceMeters / 1000) * 0.621371;
          const hours = Math.floor(estimatedDurationMinutes / 60);
          const mins = estimatedDurationMinutes % 60;
          setRouteInfo({
            distanceText: `${miles.toFixed(1)} mi`,
            durationText: hours > 0 ? `${hours}h ${mins}m` : `${mins}m`,
            summary: 'GPX Route'
          });
        }
        // Trigger POI fetching based on GPX route
        // We need to sample the GPX path to get route samples for POI fetching
        if (gpxFile) {
          (async () => {
            try {
              const res = await fetch(`/gpx/${gpxFile}`);
              const xml = await res.text();
              const { parseGpx, simplify } = await import('@/lib/gpx');
              const pts = parseGpx(xml);
              if (pts.length > 0) {
                // Simplify and sample points for POI fetching
                const simp = simplify(pts, 100);
                const samples = simp.filter((_, i) => i % Math.max(1, Math.floor(simp.length / 8)) === 0).slice(0, 8);
                const { sampleRouteLatLngs } = await import('@/lib/utils');
                const routeSamples = sampleRouteLatLngs(simp, 40);
                // Calculate bounds
                const bounds = {
                  north: Math.max(...simp.map(p => p.lat)),
                  south: Math.min(...simp.map(p => p.lat)),
                  east: Math.max(...simp.map(p => p.lng)),
                  west: Math.min(...simp.map(p => p.lng)),
                };
                // Trigger POI fetching
                setLoadingPois(true);
                setPoiError(null);
                const poiRes = await fetch('/api/agent', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    origin,
                    destination,
                    dateISO: dateISO ?? new Date().toISOString().slice(0, 10),
                    samples: samples.map(p => ({ lat: p.lat, lng: p.lng })),
                    preference,
                  }),
                });
                const poiData = await poiRes.json();
                if (poiRes.ok && Array.isArray(poiData.pois)) {
                  const basePois: POI[] = poiData.pois.map((p: any, i: number) => ({
                    id: `gpx-${counter + 1}-${i}-${p.name}`,
                    name: p.name,
                    lat: p.lat,
                    lng: p.lng,
                    description: p.description,
                    emoji: p.emoji,
                    type: p.type,
                    tips: p.tips,
                  }));
                  // Enrich with photos
                  const poolSize = 4;
                  let index = 0;
                  const results: POI[] = new Array(basePois.length);
                  let fetched = 0;
                  let cached = 0;
                  async function worker() {
                    while (index < basePois.length) {
                      const myIndex = index++;
                      const poi = basePois[myIndex];
                      const cachedPayload = getCachedPhoto(poi.name);
                      if (cachedPayload) {
                        cached++;
                        results[myIndex] = { ...poi, photoUrl: cachedPayload.photoUrl ?? undefined, attribution: cachedPayload.attribution ?? undefined, website: cachedPayload.website ?? undefined };
                        continue;
                      }
                      try {
                        const pr = await fetch('/api/photos', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: poi.name, bounds }),
                        });
                        const pj = await pr.json();
                        setCachedPhoto(poi.name, { photoUrl: pj.photoUrl ?? null, attribution: pj.attribution ?? null, website: pj.website ?? null });
                        fetched++;
                        results[myIndex] = {
                          ...poi,
                          photoUrl: pj.photoUrl ?? undefined,
                          attribution: pj.attribution ?? undefined,
                          website: pj.website ?? undefined,
                        };
                        if (pj.photoUrl) {
                          const img = new Image();
                          img.src = pj.photoUrl;
                        }
                      } catch {
                        results[myIndex] = poi;
                      }
                    }
                  }
                  await Promise.all(new Array(poolSize).fill(0).map(() => worker()));
                  setPois(results);
                  setLoadingPois(false);
                } else {
                  setLoadingPois(false);
                  setPoiError(poiData?.error ?? 'Unable to fetch POIs');
                  setPois([]);
                }
              }
            } catch (err) {
              console.error('[HomePage] Error fetching POIs for GPX route:', err);
              setLoadingPois(false);
              setPoiError('Failed to fetch POIs');
            }
          })();
        }
      }
    }
    window.addEventListener('use-gpx-route', onUseGpx as any);
    return () => window.removeEventListener('use-gpx-route', onUseGpx as any);
  }, [counter, dateISO, preference]);

  // Listen for GPX Library open event
  useEffect(() => {
    function onOpenGpxLibrary() {
      setGpxLibraryOpen(true);
    }
    window.addEventListener('open-gpx-library', onOpenGpxLibrary);
    return () => window.removeEventListener('open-gpx-library', onOpenGpxLibrary);
  }, []);

  // Listen for GPX preview summary
  useEffect(() => {
    function onGpxPreviewSummary(e: any) {
      const { file, distanceText, durationText } = e.detail || {};
      setCurrentGpxFile(file);
      setPreviewRouteInfo({ distanceText, durationText });
    }
    window.addEventListener('gpx-preview-summary', onGpxPreviewSummary as any);
    return () => window.removeEventListener('gpx-preview-summary', onGpxPreviewSummary as any);
  }, []);

  // Helper function to fetch POIs for alternatives in background
  const fetchPoisForAlternatives = async (alts: RouteAlternative[], dtISO: string | null, pref: string | undefined) => {
    for (const alt of alts) {
      // Fetch POIs in background (don't block UI)
      (async () => {
        try {
          // First get route samples by calling DirectionsService
          await ensureMaps();
          const g = google as any;
          const service = new g.maps.DirectionsService();
          
          const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
            service.route(
              {
                origin: alt.origin,
                destination: alt.destination,
                travelMode: g.maps.TravelMode.DRIVING,
              },
              (res: google.maps.DirectionsResult | null, status: google.maps.DirectionsStatus) => {
                if (status === 'OK' && res) {
                  resolve(res);
                } else {
                  reject(new Error(status));
                }
              }
            );
          });

          const route = result.routes[0];
          const overview = route.overview_path.map((ll: any) => ({ lat: ll.lat(), lng: ll.lng() }));
          const samples = overview.filter((_, i) => i % Math.max(1, Math.floor(overview.length / 8)) === 0).slice(0, 8);
          const b = route.bounds;
          const bounds = { north: b.getNorthEast().lat(), east: b.getNorthEast().lng(), south: b.getSouthWest().lat(), west: b.getSouthWest().lng() };

          // Fetch POIs from agent API
          const res = await fetch('/api/agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              origin: alt.origin,
              destination: alt.destination,
              dateISO: dtISO ?? new Date().toISOString().slice(0, 10),
              samples,
              preference: pref,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.pois)) {
              // Enrich with cached photos immediately (don't re-fetch)
              const basePois: POI[] = data.pois.map((p: any, i: number) => ({
                id: `${alt.id}-${i}-${p.name}`,
                name: p.name,
                lat: p.lat,
                lng: p.lng,
                description: p.description,
                emoji: p.emoji,
                type: p.type,
                tips: p.tips,
              }));
              
              // Enrich with cached photos - fetch missing ones in background
              const enrichedPois = await Promise.all(basePois.map(async (poi) => {
                const cached = getCachedPhoto(poi.name);
                if (cached) {
                  return {
                    ...poi,
                    photoUrl: cached.photoUrl ?? undefined,
                    attribution: cached.attribution ?? undefined,
                    website: cached.website ?? undefined,
                  };
                }
                // Fetch photo in background and cache it
                try {
                  const pr = await fetch('/api/photos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: poi.name, bounds }),
                  });
                  if (pr.ok) {
                    const pj = await pr.json();
                    setCachedPhoto(poi.name, { photoUrl: pj.photoUrl ?? null, attribution: pj.attribution ?? null, website: pj.website ?? null });
                    return {
                      ...poi,
                      photoUrl: pj.photoUrl ?? undefined,
                      attribution: pj.attribution ?? undefined,
                      website: pj.website ?? undefined,
                    };
                  }
                } catch {
                  // Ignore photo fetch errors
                }
                return poi;
              }));
              
              // Store enriched POIs for this alternative
              setAlternativePois((prev) => {
                const next = new Map(prev);
                next.set(alt.id, enrichedPois);
                return next;
              });
            }
          }
        } catch (err) {
          console.error(`[HomePage] Failed to fetch POIs for ${alt.id}:`, err);
        }
      })();
    }
  };

  // Handler for selecting an alternative route
  const handleSelectAlternative = async (alt: RouteAlternative) => {
    setActiveAlternativeId(alt.id);
    const newCounter = counter + 1;
    setCounter(newCounter);
    
    // Geocode key roads to create waypoints
    const geocodedWaypoints: Array<{ lat: number; lng: number } | string> = [];
    if (alt.keyRoads && alt.keyRoads.length > 0) {
      try {
        await ensureMaps();
        const g = google as any;
        
        // Geocode each key road with context from origin/destination region
        for (const road of alt.keyRoads.slice(0, 23)) { // Max 23 waypoints for Google
          try {
            // Try to geocode with region context (add PA or NJ if in the route)
            const originRegion = alt.origin.includes('PA') || alt.origin.includes('Pennsylvania') ? 'PA' : 
                                 alt.origin.includes('NJ') || alt.origin.includes('New Jersey') ? 'NJ' : '';
            const searchQuery = originRegion ? `${road}, ${originRegion}` : road;
            
            const geocoder = new g.maps.Geocoder();
            const result = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
              geocoder.geocode({ address: searchQuery }, (results: any[], status: string) => {
                if (status === 'OK' && results && results[0]) {
                  const loc = results[0].geometry.location;
                  resolve({ lat: loc.lat(), lng: loc.lng() });
                } else {
                  // Try without region
                  geocoder.geocode({ address: road }, (results2: any[], status2: string) => {
                    if (status2 === 'OK' && results2 && results2[0]) {
                      const loc2 = results2[0].geometry.location;
                      resolve({ lat: loc2.lat(), lng: loc2.lng() });
                    } else {
                      resolve(null);
                    }
                  });
                }
              });
            });
            
            if (result) {
              geocodedWaypoints.push(result);
            }
          } catch (err) {
            console.warn(`Failed to geocode road: ${road}`, err);
          }
        }
      } catch (err) {
        console.error('Error geocoding key roads:', err);
      }
    }
    
    // Also include explicit waypoints from alt if present
    if (alt.waypoints && alt.waypoints.length > 0) {
      for (const wp of alt.waypoints.slice(0, 23 - geocodedWaypoints.length)) {
        geocodedWaypoints.push(wp); // Can be string or lat,lng
      }
    }
    
    setAlternativeWaypoints(geocodedWaypoints);
    
    // Update route request to trigger map update
    setRouteReq({ id: newCounter, origin: alt.origin, destination: alt.destination });
    
    // Set route color
    const colors = { 'alt-a': '#4285F4', 'alt-b': '#34A853', 'alt-c': '#9C27B0' };
    setRouteColor(colors[alt.id as keyof typeof colors] || '#4285F4');
    
    // Load POIs for this alternative if available (cached, including photos)
    const cachedPois = alternativePois.get(alt.id);
    if (cachedPois && cachedPois.length > 0) {
      setPois(cachedPois);
      setLoadingPois(false);
    } else {
      // If not cached yet, will be fetched in background or via onRouteReady
      setPois([]);
      setLoadingPois(true);
    }
    
    // Show recommendation popup for selected alternative
    setRecommendedAlternative(alt);
    setShowRecommendationPopup(true);
  };

  return (
    <main className="h-screen w-screen overflow-hidden relative">
      <SearchPanel
        waypointValue={midText}
        onWaypointChange={(val) => setMidText(val)}
        onPlan={({ origin, destination, dateISO, preference, plannerType, routePreferences }) => {
          console.log('[HomePage] onPlan called', { origin, destination, dateISO, preference, plannerType, routePreferences });
          setCounter((c) => c + 1);
          setDateISO(dateISO);
          setPreference(preference);
          setCurrentPlannerType(plannerType);
          setPreviewRouteInfo(null);
          setCurrentGpxFile(null);
          setPoiError(null);
          setAlternativesError(null);
          setShowRecommendationPopup(false);
          setRecommendedAlternative(null);
          setAlternativePois(new Map());
          
          if (plannerType === 'google') {
            // Google Maps mode: use existing flow
            setRouteReq({ id: counter + 1, origin, destination });
            setAlternatives([]);
            setActiveAlternativeId(null);
            setRouteColor(undefined);
            setLoadingPois(true);
            console.log('[HomePage] routeReq set (Google Maps mode)');
          } else {
            // You.com Planner mode: fetch alternatives
            setLoadingAlternatives(true);
            setAlternatives([]);
            setActiveAlternativeId(null);
            setRouteReq(null);
            
            // Fetch alternatives from API
            fetch('/api/route-alt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                origin,
                destination,
                waypoints: midText ? [midText] : [],
                prefs: routePreferences || {
                  avoid_highways: false,
                  avoid_tolls: false,
                  prefer_curvy: false,
                  max_extra_time_min: 40,
                },
              }),
            })
              .then(async (res) => {
                if (!res.ok) {
                  const err = await res.json().catch(() => ({ error: 'Failed to fetch alternatives' }));
                  throw new Error(err.error || 'Failed to fetch alternatives');
                }
                return res.json();
              })
              .then((data) => {
                setLoadingAlternatives(false);
                if (data.alternatives && data.alternatives.length > 0) {
                  setAlternatives(data.alternatives);
                  // Auto-select first alternative as recommended
                  const firstAlt = data.alternatives[0];
                  setActiveAlternativeId(firstAlt.id);
                  setRecommendedAlternative(firstAlt);
                  setShowRecommendationPopup(true);
                          // Set route with first alternative - geocode waypoints
                  (async () => {
                    const geocodedWaypoints: Array<{ lat: number; lng: number } | string> = [];
                    if (firstAlt.keyRoads && firstAlt.keyRoads.length > 0) {
                      try {
                        await ensureMaps();
                        const g = google as any;
                        
                        for (const road of firstAlt.keyRoads.slice(0, 23)) {
                          try {
                            const originRegion = firstAlt.origin.includes('PA') || firstAlt.origin.includes('Pennsylvania') ? 'PA' : 
                                                 firstAlt.origin.includes('NJ') || firstAlt.origin.includes('New Jersey') ? 'NJ' : '';
                            const searchQuery = originRegion ? `${road}, ${originRegion}` : road;
                            
                            const geocoder = new g.maps.Geocoder();
                            const result = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
                              geocoder.geocode({ address: searchQuery }, (results: any[], status: string) => {
                                if (status === 'OK' && results && results[0]) {
                                  const loc = results[0].geometry.location;
                                  resolve({ lat: loc.lat(), lng: loc.lng() });
                                } else {
                                  geocoder.geocode({ address: road }, (results2: any[], status2: string) => {
                                    if (status2 === 'OK' && results2 && results2[0]) {
                                      const loc2 = results2[0].geometry.location;
                                      resolve({ lat: loc2.lat(), lng: loc2.lng() });
                                    } else {
                                      resolve(null);
                                    }
                                  });
                                }
                              });
                            });
                            
                            if (result) {
                              geocodedWaypoints.push(result);
                            }
                          } catch (err) {
                            console.warn(`Failed to geocode road: ${road}`, err);
                          }
                        }
                      } catch (err) {
                        console.error('Error geocoding key roads:', err);
                      }
                    }
                    
                    if (firstAlt.waypoints && firstAlt.waypoints.length > 0) {
                      for (const wp of firstAlt.waypoints.slice(0, 23 - geocodedWaypoints.length)) {
                        geocodedWaypoints.push(wp);
                      }
                    }
                    
                    setAlternativeWaypoints(geocodedWaypoints);
                  })();
                  
                  setRouteReq({ id: counter + 1, origin: firstAlt.origin, destination: firstAlt.destination });
                  // Set route color (Alt A: blue, Alt B: green, Alt C: purple)
                  const colors = { 'alt-a': '#4285F4', 'alt-b': '#34A853', 'alt-c': '#9C27B0' };
                  setRouteColor(colors[firstAlt.id as keyof typeof colors] || '#4285F4');
                  
                  // Start background POI fetching for all alternatives
                  fetchPoisForAlternatives(data.alternatives, dateISO, preference);
                } else {
                  setAlternativesError('No alternatives found');
                }
              })
              .catch((err) => {
                console.error('[HomePage] Failed to fetch alternatives:', err);
                setLoadingAlternatives(false);
                setAlternativesError(err.message || 'Failed to fetch alternatives');
              });
          }
        }}
        onClear={() => {
          // Cancel any ongoing POI fetching
          cancelPoiFetchRef.current = true;
          agentInFlightRef.current = false;
          setRouteReq(null);
          setPois([]);
          setPoiError(null);
          setLoadingPois(false);
          setWaypoints([]);
          setGpxWaypoints([]);
          setMidText('');
          setRouteInfo(null);
          setCurrentGpxFile(null);
          setPreviewRouteInfo(null);
          setGpxRouteOriginDest(null);
          // Clear alternatives state
          setAlternatives([]);
          setActiveAlternativeId(null);
          setLoadingAlternatives(false);
          setAlternativesError(null);
          setShowRecommendationPopup(false);
          setRecommendedAlternative(null);
          setAlternativePois(new Map());
          setRouteColor(undefined);
          setAlternativeWaypoints([]);
          // Clear GPX polyline from map
          window.dispatchEvent(new CustomEvent('clear-gpx-polyline'));
        }}
        onMidway={(mid) => {
          setMidText(mid);
        }}
        onExport={() => {
          // For GPX routes, use stored origin/destination; for regular routes, use routeReq
          const originDest = currentGpxFile && gpxRouteOriginDest ? gpxRouteOriginDest : (routeReq ? { origin: routeReq.origin, destination: routeReq.destination } : null);
          if (!originDest) return;
          const origin = encodeURIComponent(originDest.origin);
          const destination = encodeURIComponent(originDest.destination);
          const waypointParts: string[] = [];
          // For regular routes, use waypoint text input; for GPX routes, use GPX waypoints
          if (gpxWaypoints.length > 0) {
            // GPX route: use GPX waypoints (lat/lng coordinates)
            gpxWaypoints.forEach((w) => waypointParts.push(encodeURIComponent(`${w.lat},${w.lng}`)));
          } else if (midText && midText.trim()) {
            // Regular route: use waypoint text input (address string)
            waypointParts.push(encodeURIComponent(midText.trim()));
          }
          const waypointsParam = waypointParts.length ? `&waypoints=${waypointParts.join('%7C')}` : '';
          const url = `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${origin}&destination=${destination}${waypointsParam}`;
          window.open(url, '_blank', 'noopener');
        }}
        hasRoute={!!routeReq || !!currentGpxFile}
      />
      <div className="h-full w-full">
        <MapView
          routeRequest={routeReq}
          pois={pois}
          waypoints={currentPlannerType === 'you-com' && alternativeWaypoints.length > 0 
            ? alternativeWaypoints 
            : (gpxWaypoints.length > 0 ? gpxWaypoints : (midText ? [midText] : []))}
          avoidHighways={avoidHighways}
          avoidTolls={avoidTolls}
          twistySources={twistySources}
          routeColor={routeColor}
          onMarkerClick={(id) => {
            const el = document.getElementById(`card-${id}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
          }}
          onRouteReady={async ({ samples, bounds, distanceText, durationText, summary }) => {
            setRouteInfo({ distanceText, durationText, summary });
            setLastSamples(samples);
            if (!routeReq) return;
            
            // For You.com Planner, handle POI loading from cache or fetch
            if (currentPlannerType === 'you-com' && activeAlternativeId) {
              const cachedPois = alternativePois.get(activeAlternativeId);
              if (cachedPois) {
                // POIs already cached, use them
                setPois(cachedPois);
                setLoadingPois(false);
                return;
              }
              // If no cached POIs, continue with normal fetch below
            }
            
            // Prevent duplicate agent fetches for same route
            const key = JSON.stringify({ id: routeReq.id, o: routeReq.origin, d: routeReq.destination, dt: dateISO, s: samples.slice(0, 8), pref: preference || '' });
            if (agentInFlightRef.current || agentKeyRef.current === key) {
              return;
            }
            agentInFlightRef.current = true;
            agentKeyRef.current = key;
            // If a middle waypoint text is present, include it as a waypoint string
            if (midText && midText.trim()) {
              // Add a soft waypoint by geocoder-less string; DirectionsService accepts this
              // Keep lat/lng waypoints added from cards as well
              // We store only lat/lng in state; pass text separately by updating routeReq id to retrigger
              // For simplicity, append to waypoints for display: no-op here
            }
            setPoiError(null);
            setLoadingPois(true);
            cancelPoiFetchRef.current = false; // Reset cancel flag for new fetch
            const res = await fetch('/api/agent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                origin: routeReq.origin,
                destination: routeReq.destination,
                dateISO: dateISO ?? new Date().toISOString().slice(0, 10),
                samples,
                preference,
              }),
            });
            const data = await res.json();
            // Check if fetch was cancelled
            if (cancelPoiFetchRef.current || !routeReq) {
              setLoadingPois(false);
              agentInFlightRef.current = false;
              return;
            }
            if (res.ok && Array.isArray(data.pois)) {
              const basePois: POI[] = data.pois.map((p: any, i: number) => ({
                id: `route-${routeReq.id}-${i}-${p.name}`,
                name: p.name,
                lat: p.lat,
                lng: p.lng,
                description: p.description,
                emoji: p.emoji,
                type: p.type,
                tips: p.tips,
              }));
              // Enrich with photos (rate-limited sequentially for reliability)
              // Concurrency-limited photo enrichment (4 at a time) with caching
              const poolSize = 4;
              let index = 0;
              const results: POI[] = new Array(basePois.length);
              let fetched = 0;
              let cached = 0;
              async function worker() {
                while (index < basePois.length) {
                  // Check if cancelled before processing next POI
                  if (cancelPoiFetchRef.current || !routeReq) {
                    break;
                  }
                  const myIndex = index++;
                  const poi = basePois[myIndex];
                  const cachedPayload = getCachedPhoto(poi.name);
                  if (cachedPayload) {
                    cached++;
                    results[myIndex] = { ...poi, photoUrl: cachedPayload.photoUrl ?? undefined, attribution: cachedPayload.attribution ?? undefined, website: cachedPayload.website ?? undefined };
                    continue;
                  }
                  try {
                    // Check again before fetching photo
                    if (cancelPoiFetchRef.current || !routeReq) break;
                    const pr = await fetch('/api/photos', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: poi.name, bounds }),
                    });
                    // Check once more after fetch
                    if (cancelPoiFetchRef.current || !routeReq) break;
                    const pj = await pr.json();
                    setCachedPhoto(poi.name, { photoUrl: pj.photoUrl ?? null, attribution: pj.attribution ?? null, website: pj.website ?? null });
                    fetched++;
                    results[myIndex] = {
                      ...poi,
                      photoUrl: pj.photoUrl ?? undefined,
                      attribution: pj.attribution ?? undefined,
                      website: pj.website ?? undefined,
                    };
                    // Preload image into browser cache
                    if (pj.photoUrl) {
                      const img = new Image();
                      img.src = pj.photoUrl;
                    }
                  } catch {
                    results[myIndex] = poi;
                  }
                }
              }
              await Promise.all(new Array(poolSize).fill(0).map(() => worker()));
              // Check if cancelled before updating state
              if (cancelPoiFetchRef.current || !routeReq) {
                setLoadingPois(false);
                agentInFlightRef.current = false;
                return;
              }
              console.log(`[Photos] completed. fetched=${fetched}, cached=${cached}, total=${basePois.length}`);
              setPois(results);
              setLoadingPois(false);
            } else {
              setLoadingPois(false);
              setPoiError(data?.error ?? 'Unable to fetch POIs');
              setPois([]);
            }
            agentInFlightRef.current = false;
          }}
        />
      </div>
      {/* Settings cog */}
      <div className="absolute right-3 top-24 z-[60] pointer-events-none">
        <div className="relative pointer-events-auto">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setSettingsOpen((o) => !o);
            }} 
            className="h-12 w-12 rounded-full bg-white shadow-lg grid place-items-center hover:bg-gray-50 active:bg-gray-100 cursor-pointer select-none transition-colors"
            style={{ minWidth: '48px', minHeight: '48px', touchAction: 'manipulation' }}
            type="button"
            aria-label="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700 pointer-events-none" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.936a7.963 7.963 0 000-1.872l2.036-1.58a.5.5 0 00.12-.64l-1.93-3.344a.5.5 0 00-.6-.22l-2.397.96a7.994 7.994 0 00-1.62-.94l-.36-2.54A.5.5 0 0012.89 2h-3.78a.5.5 0 00-.495.42l-.36 2.54a7.994 7.994 0 00-1.62.94l-2.397-.96a.5.5 0 00-.6.22L1.71 8.04a.5.5 0 00.12.64l2.036 1.58c-.048.308-.072.624-.072.94s.024.632.072.94L1.83 13.72a.5.5 0 00-.12.64l1.93 3.344a.5.5 0 00.6.22l2.397-.96c.5.36 1.04.67 1.62.94l.36 2.54a.5.5 0 00.495.42h3.78a.5.5 0 00.495-.42l.36-2.54c.58-.27 1.12-.58 1.62-.94l2.397.96a.5.5 0 00.6-.22l1.93-3.344a.5.5 0 00-.12-.64l-2.036-1.58zM11 15a3 3 0 110-6 3 3 0 010 6z"/></svg>
          </button>
          {settingsOpen ? (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow p-3 text-sm">
              <label className="flex items-center gap-2 py-1">
                <input type="checkbox" checked={avoidHighways} onChange={(e) => setAvoidHighways(e.target.checked)} />
                Avoid highways
              </label>
              <label className="flex items-center gap-2 py-1">
                <input type="checkbox" checked={avoidTolls} onChange={(e) => setAvoidTolls(e.target.checked)} />
                Avoid tolls
              </label>
              <div className="border-t my-2" />
              <SettingsCog onChange={(sources) => {
                // Only update if sources actually changed (prevent infinite loop)
                setTwistySources(prev => {
                  const prevKey = prev.map(s => `${s.id}:${s.enabled}`).sort().join('|');
                  const newKey = sources.map(s => `${s.id}:${s.enabled}`).sort().join('|');
                  if (prevKey === newKey) return prev; // No change
                  return sources;
                });
              }} />
            </div>
          ) : null}
        </div>
      </div>
      {/* Route info panel (only visible for Google Maps planner when a route is active, GPX route is active, or GPX preview is shown) */}
      {currentPlannerType === 'google' && (routeReq || previewRouteInfo || currentGpxFile) ? (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-40">
          <div className="bg-white/95 backdrop-blur rounded-xl shadow p-4 min-w-[220px] text-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Route Summary</div>
              <button
                onClick={() => {
                  // Cancel any ongoing POI fetching
                  cancelPoiFetchRef.current = true;
                  agentInFlightRef.current = false;
                  setRouteReq(null);
                  setPois([]);
                  setPoiError(null);
                  setLoadingPois(false);
                  setWaypoints([]);
                  setGpxWaypoints([]);
                  setMidText('');
                  setRouteInfo(null);
                  setCurrentGpxFile(null);
                  setPreviewRouteInfo(null);
                  setGpxRouteOriginDest(null);
                  setGpxWaypoints([]);
                  window.dispatchEvent(new CustomEvent('clear-gpx-polyline'));
                }}
                className="text-gray-500 hover:text-gray-700 text-xs px-2 py-1 border rounded hover:bg-gray-50"
                title="Clear route"
              >
                Clear
              </button>
            </div>
            <div className="text-gray-700"><span className="font-medium">Distance:</span> {routeInfo?.distanceText ?? previewRouteInfo?.distanceText ?? '—'}</div>
            <div className="text-gray-700"><span className="font-medium">Time:</span> {routeInfo?.durationText ?? previewRouteInfo?.durationText ?? '—'}</div>
            {routeInfo?.summary && (
              <div className="text-gray-700"><span className="font-medium">Summary:</span> {routeInfo.summary}</div>
            )}
            {currentGpxFile && (
              <div className="mt-2">
                <a 
                  className="border rounded px-3 py-1 text-sm inline-block hover:bg-gray-50"
                  href={`/gpx/${currentGpxFile}`}
                  download
                >
                  Download GPX
                </a>
              </div>
            )}
            {routeReq && routeInfo && (
              <div className="mt-3">
                {currentPlannerType === 'you-com' && activeAlternativeId ? (
                  <a
                    className="border rounded px-3 py-1 text-sm inline-block hover:bg-gray-50"
                    href="#"
                    onClick={async (e) => {
                      e.preventDefault();
                      const alt = alternatives.find(a => a.id === activeAlternativeId);
                      if (!alt) return;
                      // Use RouteAltPanel's export function logic
                      await ensureMaps();
                      const g = google as any;
                      async function geocodeAddress(address: string): Promise<{ lat: number; lng: number }> {
                        const coordsMatch = address.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
                        if (coordsMatch) {
                          return { lat: parseFloat(coordsMatch[1]), lng: parseFloat(coordsMatch[2]) };
                        }
                        return new Promise((resolve) => {
                          const geocoder = new g.maps.Geocoder();
                          geocoder.geocode({ address }, (results: any[], status: string) => {
                            if (status === 'OK' && results && results[0]) {
                              const loc = results[0].geometry.location;
                              resolve({ lat: loc.lat(), lng: loc.lng() });
                            } else {
                              resolve({ lat: 40.2206, lng: -74.7597 });
                            }
                          });
                        });
                      }
                      const origin = await geocodeAddress(alt.origin);
                      const destination = await geocodeAddress(alt.destination);
                      const waypoints: Array<{ lat: number; lng: number }> = [];
                      
                      // Add geocoded key roads as waypoints
                      if (alt.keyRoads && alt.keyRoads.length > 0) {
                        for (const road of alt.keyRoads.slice(0, 23)) {
                          try {
                            const originRegion = alt.origin.includes('PA') || alt.origin.includes('Pennsylvania') ? 'PA' : 
                                                 alt.origin.includes('NJ') || alt.origin.includes('New Jersey') ? 'NJ' : '';
                            const searchQuery = originRegion ? `${road}, ${originRegion}` : road;
                            const geocoder = new g.maps.Geocoder();
                            const result = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
                              geocoder.geocode({ address: searchQuery }, (results: any[], status: string) => {
                                if (status === 'OK' && results && results[0]) {
                                  const loc = results[0].geometry.location;
                                  resolve({ lat: loc.lat(), lng: loc.lng() });
                                } else {
                                  geocoder.geocode({ address: road }, (results2: any[], status2: string) => {
                                    if (status2 === 'OK' && results2 && results2[0]) {
                                      const loc2 = results2[0].geometry.location;
                                      resolve({ lat: loc2.lat(), lng: loc2.lng() });
                                    } else {
                                      resolve(null);
                                    }
                                  });
                                }
                              });
                            });
                            if (result) {
                              waypoints.push(result);
                            }
                          } catch {
                            // Skip failed geocoding
                          }
                        }
                      }
                      
                      // Also include explicit waypoints from alt if present
                      if (alt.waypoints && alt.waypoints.length > 0) {
                        const remaining = 23 - waypoints.length;
                        if (remaining > 0) {
                          const wpPromises = alt.waypoints.slice(0, remaining).map((wp) => geocodeAddress(wp));
                          const wpResults = await Promise.all(wpPromises);
                          waypoints.push(...wpResults.filter(w => w != null) as Array<{ lat: number; lng: number }>);
                        }
                      }
                      
                      const url = buildGoogleMapsDirUrl(origin, destination, waypoints);
                      window.open(url, '_blank', 'noopener');
                    }}
                  >
                    Export to Google Maps
                  </a>
                ) : (
                  <ExportButton
                    origin={{ lat: parseFloat(routeReq.origin.split(',')[0]), lng: parseFloat(routeReq.origin.split(',')[1]) }}
                    destination={{ lat: parseFloat(routeReq.destination.split(',')[0]), lng: parseFloat(routeReq.destination.split(',')[1]) }}
                    waypoints={gpxWaypoints.length > 0 ? gpxWaypoints : (lastSamples.length > 0 ? lastSamples.slice(1, -1).slice(0, 23) : [])}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}
      {/* Only show POI drawer if there are POIs, loading, or error */}
      {(pois.length > 0 || loadingPois || poiError) ? (
        <div className="pointer-events-none">
          <POIDrawer>
            {loadingPois ? (
              <div className="pointer-events-auto w-[280px] bg-white rounded-xl shadow p-4 text-sm text-gray-600 flex items-center gap-3">
                <svg className="h-5 w-5 animate-spin text-gray-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                Fetching stops…
              </div>
            ) : null}
            {poiError ? (
              <div className="pointer-events-auto w-[280px] bg-white rounded-xl shadow p-4 text-sm text-red-600">{poiError}</div>
            ) : null}
            {pois.map((p, i) => (
              <div key={p.id} id={`card-${p.id}`} className="pointer-events-auto">
                <POICard poi={p} index={i} onAdd={async (poi) => {
                  // Clear GPX waypoints when adding a POI waypoint (separate systems)
                  if (currentGpxFile) {
                    setGpxWaypoints([]);
                    setCurrentGpxFile(null);
                    setPreviewRouteInfo(null);
                    window.dispatchEvent(new CustomEvent('clear-gpx-polyline'));
                  }
                  
                  // Reverse geocode POI coordinates to get address for waypoint input
                  try {
                    await ensureMaps();
                    const g = google as any;
                    const geocoder = new g.maps.Geocoder();
                    const result = await new Promise<string>((resolve) => {
                      geocoder.geocode({ location: { lat: poi.lat, lng: poi.lng } }, (results: any[], status: string) => {
                        if (status === 'OK' && results && results[0]) {
                          resolve(results[0].formatted_address || poi.name);
                        } else {
                          // Fallback to POI name or coordinates
                          resolve(poi.name || `${poi.lat},${poi.lng}`);
                        }
                      });
                    });
                    setMidText(result);
                    // If we have a route, update it to include the new waypoint
                    if (routeReq) {
                      setCounter((c) => c + 1);
                      setRouteReq({ ...routeReq, id: counter + 1 });
                    }
                  } catch (err) {
                    // Fallback: just use POI name
                    setMidText(poi.name || `${poi.lat},${poi.lng}`);
                    if (routeReq) {
                      setCounter((c) => c + 1);
                      setRouteReq({ ...routeReq, id: counter + 1 });
                    }
                  }
                  // Don't add to waypoints array - we use the waypoint text input instead
                }} />
              </div>
            ))}
          </POIDrawer>
        </div>
      ) : null}
      
      {/* GPX Library Modal */}
      <GpxLibraryModal isOpen={gpxLibraryOpen} onClose={() => setGpxLibraryOpen(false)} />
      
      {/* Route Alternatives Panel (You.com Planner) */}
      {currentPlannerType === 'you-com' && (
        <RouteAltPanel
          alternatives={alternatives}
          activeAlternativeId={activeAlternativeId}
          onSelectAlternative={handleSelectAlternative}
          loading={loadingAlternatives}
          error={alternativesError}
        />
      )}
      
      {/* Recommendation Popup */}
      {showRecommendationPopup && recommendedAlternative && (
        <RecommendationPopup
          alternative={recommendedAlternative}
          onDismiss={() => setShowRecommendationPopup(false)}
          onViewAlternatives={() => {
            // Popup handles its own dismissal, this is just for future expansion
            setShowRecommendationPopup(false);
          }}
        />
      )}
    </main>
  );
}

function SmartExport({ samples }: { samples: Array<{ lat: number; lng: number }> }) {
  if (samples.length < 2) return null;
  const origin = samples[0];
  const destination = samples[samples.length - 1];
  // Build <=23 interior waypoints sampled evenly
  const interior = samples.slice(1, -1);
  const maxWp = 23;
  const step = Math.ceil(interior.length / maxWp) || 1;
  const selected: Array<{ lat: number; lng: number }> = [];
  for (let i = 0; i < interior.length && selected.length < maxWp; i += step) {
    selected.push(interior[i]);
  }
  return <ExportButton origin={origin} destination={destination} waypoints={selected} />;
}


