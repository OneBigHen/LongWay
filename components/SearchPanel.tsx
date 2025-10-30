'use client';

import { useEffect, useRef, useState } from 'react';
import { ensureMaps } from '@/lib/places';

export default function SearchPanel({
  onPlan,
  onClear,
  onMidway,
  onExport,
  hasRoute,
}: {
  onPlan: (p: { origin: string; destination: string; dateISO: string; preference?: string }) => void;
  onClear: () => void;
  onMidway: (mid: string) => void;
  onExport: () => void;
  hasRoute: boolean;
}) {
  const originInputRef = useRef<HTMLInputElement | null>(null);
  const destInputRef = useRef<HTMLInputElement | null>(null);
  const [ready, setReady] = useState(false);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [dateISO, setDateISO] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [preference, setPreference] = useState('');

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

  return (
    <div className="absolute top-0 left-0 right-0 p-3 z-50">
      <div className="max-w-6xl w-[calc(100%-24px)] mx-auto bg-white/95 backdrop-blur rounded-xl shadow p-3 flex flex-wrap sm:flex-nowrap gap-2 items-center">
        <input
          ref={originInputRef}
          type="text"
          placeholder="Origin"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          className="flex-1 min-w-[160px] border rounded px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Waypoint (optional)"
          onChange={(e) => onMidway(e.target.value)}
          className="w-[220px] sm:w-[240px] min-w-[160px] border rounded px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          ref={destInputRef}
          type="text"
          placeholder="Destination"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
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
        <input
          type="date"
          value={dateISO}
          onChange={(e) => setDateISO(e.target.value)}
          className="border rounded px-2 py-1 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50 hover:bg-gray-900 shrink-0"
          disabled={!canPlan}
          onClick={() => {
            const o = origin.trim();
            const d = destination.trim();
            console.log('[PlanRoute] final values', { o, d, dateISO });
            if (o && d) {
              const pref = preference.trim();
              onPlan({ origin: o, destination: d, dateISO, preference: pref.length >= 3 ? pref : undefined });
            } else {
              console.log('[PlanRoute] no valid addresses found');
            }
          }}
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
            onClear();
          }}
        >
          Clear All
        </button>
      </div>
    </div>
  );
}


