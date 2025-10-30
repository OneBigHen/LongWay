'use client';

import { useEffect, useRef, useState } from 'react';
import type { POI } from '@/lib/types';
import { getCachedPhoto, setCachedPhoto } from '@/lib/utils';
import SearchPanel from '@/components/SearchPanel';
import MapView from '@/components/MapView';
import POIDrawer from '@/components/POIDrawer';
import SettingsCog, { useTwistySources } from '@/components/SettingsCog';
import ExportButton from '@/components/ExportButton';
import POICard from '@/components/POICard';
import GpxLibraryModal from '@/components/GpxLibraryModal';

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

  // Listen for GPX route selections from MapView/app/gpx
  useEffect(() => {
    function onUseGpx(e: any) {
      setCounter((c) => c + 1);
      const { origin, destination, waypoints, gpxFile, distanceMeters, estimatedDurationMinutes } = e.detail || {};
      if (origin && destination) {
        setRouteReq({ id: counter + 1, origin, destination });
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
      }
    }
    window.addEventListener('use-gpx-route', onUseGpx as any);
    return () => window.removeEventListener('use-gpx-route', onUseGpx as any);
  }, [counter]);

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

  return (
    <main className="h-screen w-screen overflow-hidden relative">
      <SearchPanel
        onPlan={({ origin, destination, dateISO, preference }) => {
          console.log('[HomePage] onPlan called', { origin, destination, dateISO, preference });
          setCounter((c) => c + 1);
          setDateISO(dateISO);
          setRouteReq({ id: counter + 1, origin, destination });
          setPreference(preference);
          // Clear preview info when planning new route
          setPreviewRouteInfo(null);
          setCurrentGpxFile(null);
          // Immediately show loading indicator for user feedback when re-querying
          setPoiError(null);
          setLoadingPois(true);
          console.log('[HomePage] routeReq set');
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
          // Clear GPX polyline from map
          window.dispatchEvent(new CustomEvent('clear-gpx-polyline'));
        }}
        onMidway={(mid) => {
          setMidText(mid);
        }}
        onExport={() => {
          if (!routeReq) return;
          const origin = encodeURIComponent(routeReq.origin);
          const destination = encodeURIComponent(routeReq.destination);
          const waypointParts: string[] = [];
          if (midText && midText.trim()) waypointParts.push(encodeURIComponent(midText.trim()))
          waypoints.forEach((w) => waypointParts.push(encodeURIComponent(`${w.lat},${w.lng}`)));
          const waypointsParam = waypointParts.length ? `&waypoints=${waypointParts.join('%7C')}` : '';
          const url = `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${origin}&destination=${destination}${waypointsParam}`;
          window.open(url, '_blank', 'noopener');
        }}
        hasRoute={!!routeReq}
      />
      <div className="h-full w-full">
        <MapView
          routeRequest={routeReq}
          pois={pois}
          waypoints={[...waypoints, ...(midText ? [midText] : [])]}
          avoidHighways={avoidHighways}
          avoidTolls={avoidTolls}
          twistySources={twistySources}
          onMarkerClick={(id) => {
            const el = document.getElementById(`card-${id}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
          }}
          onRouteReady={async ({ samples, bounds, distanceText, durationText, summary }) => {
            setRouteInfo({ distanceText, durationText, summary });
            setLastSamples(samples);
            if (!routeReq) return;
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
                id: `${i}-${p.name}`,
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
      <div className="absolute right-3 top-24 z-40">
        <div className="relative">
          <button onClick={() => setSettingsOpen((o) => !o)} className="h-10 w-10 rounded-full bg-white shadow grid place-items-center hover:bg-gray-50">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.936a7.963 7.963 0 000-1.872l2.036-1.58a.5.5 0 00.12-.64l-1.93-3.344a.5.5 0 00-.6-.22l-2.397.96a7.994 7.994 0 00-1.62-.94l-.36-2.54A.5.5 0 0012.89 2h-3.78a.5.5 0 00-.495.42l-.36 2.54a7.994 7.994 0 00-1.62.94l-2.397-.96a.5.5 0 00-.6.22L1.71 8.04a.5.5 0 00.12.64l2.036 1.58c-.048.308-.072.624-.072.94s.024.632.072.94L1.83 13.72a.5.5 0 00-.12.64l1.93 3.344a.5.5 0 00.6.22l2.397-.96c.5.36 1.04.67 1.62.94l.36 2.54a.5.5 0 00.495.42h3.78a.5.5 0 00.495-.42l.36-2.54c.58-.27 1.12-.58 1.62-.94l2.397.96a.5.5 0 00.6-.22l1.93-3.344a.5.5 0 00-.12-.64l-2.036-1.58zM11 15a3 3 0 110-6 3 3 0 010 6z"/></svg>
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
      {/* Route info panel (only visible when a route is active or GPX preview is shown) */}
      {(routeReq || previewRouteInfo) ? (
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
                <ExportButton
                  origin={{ lat: parseFloat(routeReq.origin.split(',')[0]), lng: parseFloat(routeReq.origin.split(',')[1]) }}
                  destination={{ lat: parseFloat(routeReq.destination.split(',')[0]), lng: parseFloat(routeReq.destination.split(',')[1]) }}
                  waypoints={gpxWaypoints.length > 0 ? gpxWaypoints : (lastSamples.length > 0 ? lastSamples.slice(1, -1).slice(0, 23) : [])}
                />
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
                <POICard poi={p} index={i} onAdd={(poi) => {
                  setWaypoints((wps) => [...wps, { lat: poi.lat, lng: poi.lng }]);
                  // bump route id to re-trigger directions with new waypoint
                  setCounter((c) => c + 1);
                  if (routeReq) setRouteReq({ ...routeReq, id: counter + 1 });
                }} />
              </div>
            ))}
          </POIDrawer>
        </div>
      ) : null}
      
      {/* GPX Library Modal */}
      <GpxLibraryModal isOpen={gpxLibraryOpen} onClose={() => setGpxLibraryOpen(false)} />
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


