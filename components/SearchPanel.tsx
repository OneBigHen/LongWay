'use client';

import { useEffect, useRef, useState } from 'react';
import { ensureMaps } from '@/lib/places';
import type { PlannerType, RoutePreferences } from '@/lib/types';
import { loadPlannerType, savePlannerType, loadPreferences, savePreferences } from '@/lib/preferences';

export default function SearchPanel({
  onPlan,
  onClear,
  onMidway,
  onExport,
  hasRoute,
  waypointValue,
  onWaypointChange,
}: {
  onPlan: (p: { origin: string; destination: string; dateISO: string; preference?: string; plannerType: PlannerType; routePreferences?: RoutePreferences }) => void;
  onClear: () => void;
  onMidway: (mid: string) => void;
  onExport: () => void;
  hasRoute: boolean;
  waypointValue?: string;
  onWaypointChange?: (value: string) => void;
}) {
  const originInputRef = useRef<HTMLInputElement | null>(null);
  const destInputRef = useRef<HTMLInputElement | null>(null);
  const waypointInputRef = useRef<HTMLInputElement | null>(null);
  const [ready, setReady] = useState(false);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [dateISO, setDateISO] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [preference, setPreference] = useState('');
  const [waypoint, setWaypoint] = useState(waypointValue || '');
  const [plannerType, setPlannerType] = useState<PlannerType>('google');
  const [preferCurvy, setPreferCurvy] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Load preferences on client only to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
    setPlannerType(loadPlannerType());
    setPreferCurvy(loadPreferences().prefer_curvy);
  }, []);

  useEffect(() => {
    if (waypointValue !== undefined) {
      setWaypoint(waypointValue);
    }
  }, [waypointValue]);

  useEffect(() => {
    savePlannerType(plannerType);
  }, [plannerType]);

  useEffect(() => {
    const prefs = loadPreferences();
    savePreferences({ ...prefs, prefer_curvy: preferCurvy });
  }, [preferCurvy]);

  useEffect(() => {
    let mounted = true;
    ensureMaps().then(() => {
      if (!mounted) return;
      setReady(true);
      try {
        // Progressive enhancement: attach legacy Autocomplete to our inputs
        const g = google as any;
        if (originInputRef.current) {
          const ac = new g.maps.places.Autocomplete(originInputRef.current, {
            fields: ['formatted_address', 'name'],
          });
          ac.addListener('place_changed', () => {
            const p = ac.getPlace();
            setOrigin(p?.formatted_address || p?.name || originInputRef.current?.value || '');
          });
        }
        if (destInputRef.current) {
          const ac = new g.maps.places.Autocomplete(destInputRef.current, {
            fields: ['formatted_address', 'name'],
          });
          ac.addListener('place_changed', () => {
            const p = ac.getPlace();
            setDestination(p?.formatted_address || p?.name || destInputRef.current?.value || '');
          });
        }
      } catch {
        // If Places isn't available or key restrictions block it, plain inputs still work
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const canPlan = ready; // We will read current values from elements on click
  
  const handlePlanRoute = () => {
    const o = origin.trim();
    const d = destination.trim();
    console.log('[PlanRoute] final values', { o, d, dateISO, plannerType });
    if (o && d) {
      const pref = preference.trim();
      const routePrefs: RoutePreferences | undefined = plannerType === 'you-com' ? {
        avoid_highways: false,
        avoid_tolls: false,
        prefer_curvy: preferCurvy,
        max_extra_time_min: 40,
        region_hint: undefined,
      } : undefined;
      onPlan({ 
        origin: o, 
        destination: d, 
        dateISO, 
        preference: pref.length >= 3 ? pref : undefined,
        plannerType,
        routePreferences: routePrefs,
      });
    } else {
      // Highlight missing fields
      if (!o && originInputRef.current) {
        originInputRef.current.focus();
        originInputRef.current.classList.add('ring-2', 'ring-red-500');
        setTimeout(() => originInputRef.current?.classList.remove('ring-2', 'ring-red-500'), 2000);
      }
      if (!d && destInputRef.current) {
        destInputRef.current.focus();
        destInputRef.current.classList.add('ring-2', 'ring-red-500');
        setTimeout(() => destInputRef.current?.classList.remove('ring-2', 'ring-red-500'), 2000);
      }
    }
  };

  return (
    <div className="absolute top-0 left-0 right-0 p-3 z-50">
      <div className="max-w-6xl w-[calc(100%-24px)] mx-auto bg-white/95 backdrop-blur rounded-xl shadow p-3 flex flex-col gap-2">
        {/* Planner selection row */}
        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium text-gray-700">Planner:</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="planner"
              value="google"
              checked={plannerType === 'google'}
              onChange={(e) => setPlannerType(e.target.value as PlannerType)}
              className="w-4 h-4"
            />
            <span>Google Maps</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="planner"
              value="you-com"
              checked={plannerType === 'you-com'}
              onChange={(e) => setPlannerType(e.target.value as PlannerType)}
              className="w-4 h-4"
            />
            <span>You.com Planner</span>
          </label>
          {mounted && plannerType === 'you-com' && (
            <label className="flex items-center gap-2 cursor-pointer ml-4">
              <input
                type="checkbox"
                checked={preferCurvy}
                onChange={(e) => setPreferCurvy(e.target.checked)}
                className="w-4 h-4"
              />
              <span>Prefer curvy</span>
            </label>
          )}
        </div>
        {/* Input row */}
        <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
        <input
          ref={originInputRef}
          type="text"
          placeholder="Origin"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && origin.trim() && destination.trim()) {
              handlePlanRoute();
            }
          }}
          className="flex-1 min-w-[160px] border rounded px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {(waypointValue || waypoint) && (
          <input
            ref={waypointInputRef}
            type="text"
            placeholder="Waypoint (optional)"
            value={waypointValue !== undefined ? waypointValue : waypoint}
            onChange={(e) => {
              const val = e.target.value;
              setWaypoint(val);
              onWaypointChange?.(val);
              onMidway(val);
            }}
            className="w-[220px] sm:w-[240px] min-w-[160px] border rounded px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
        <input
          ref={destInputRef}
          type="text"
          placeholder="Destination"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handlePlanRoute();
            }
          }}
          className="flex-1 min-w-[160px] border rounded px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="What's the plan today? (optional)"
          value={preference}
          onChange={(e) => setPreference(e.target.value)}
          className="w-[260px] sm:w-[300px] min-w-[200px] border rounded px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {/* Hidden placeholders no longer needed; autocomplete attached to inputs directly */}
        <div className="relative">
          <input
            type="date"
            value={dateISO}
            onChange={(e) => setDateISO(e.target.value)}
            className="border rounded px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-[140px]"
            title="Select travel date"
          />
        </div>
        <button
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50 hover:bg-gray-900 shrink-0"
          disabled={!canPlan}
          onClick={handlePlanRoute}
        >
          Plan Route
        </button>
        <button
          className="px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 shrink-0"
          onClick={onExport}
          disabled={!hasRoute}
        >
          Open in Google Maps
        </button>
        <button
          className="px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 shrink-0"
          onClick={() => {
            setOrigin('');
            setDestination('');
            setWaypoint('');
            onWaypointChange?.('');
            onClear();
          }}
        >
          Clear All
        </button>
        </div>
      </div>
    </div>
  );
}


