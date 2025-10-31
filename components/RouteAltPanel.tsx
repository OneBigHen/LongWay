'use client';

import { useState } from 'react';
import type { RouteAlternative } from '@/lib/types';
import { buildGoogleMapsDirUrl } from '@/lib/export';
import { ensureMaps } from '@/lib/places';

export default function RouteAltPanel({
  alternatives,
  activeAlternativeId,
  onSelectAlternative,
  loading,
  error,
}: {
  alternatives: RouteAlternative[];
  activeAlternativeId: string | null;
  onSelectAlternative: (alt: RouteAlternative) => void;
  loading?: boolean;
  error?: string | null;
}) {
  const [expanded, setExpanded] = useState(true);

  const generateExportUrl = async (alt: RouteAlternative): Promise<string> => {
    // Geocode origin and destination to get lat/lng if needed
    await ensureMaps();
    const g = google as any;

    async function geocodeAddress(address: string): Promise<{ lat: number; lng: number }> {
      // Check if already lat,lng format
      const coordsMatch = address.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
      if (coordsMatch) {
        return { lat: parseFloat(coordsMatch[1]), lng: parseFloat(coordsMatch[2]) };
      }

      // Geocode the address
      return new Promise((resolve, reject) => {
        const geocoder = new g.maps.Geocoder();
        geocoder.geocode({ address }, (results: any[], status: string) => {
          if (status === 'OK' && results && results[0]) {
            const loc = results[0].geometry.location;
            resolve({ lat: loc.lat(), lng: loc.lng() });
          } else {
            // Fallback to default location if geocoding fails
            resolve({ lat: 40.2206, lng: -74.7597 });
          }
        });
      });
    }

    const origin = await geocodeAddress(alt.origin);
    const destination = await geocodeAddress(alt.destination);
    const waypoints: Array<{ lat: number; lng: number }> = [];

    // Geocode key roads as waypoints first
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

    return buildGoogleMapsDirUrl(origin, destination, waypoints);
  };

  if (loading) {
    return (
      <div className="absolute left-3 top-24 z-40 bg-white/95 backdrop-blur rounded-xl shadow p-4 min-w-[300px]">
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <svg className="h-5 w-5 animate-spin text-gray-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
          Finding alternative routes...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="absolute left-3 top-24 z-40 bg-white/95 backdrop-blur rounded-xl shadow p-4 min-w-[300px]">
        <div className="text-sm text-red-600">{error}</div>
      </div>
    );
  }

  if (alternatives.length === 0) {
    return null;
  }

  return (
    <div className="absolute left-3 top-24 z-40 bg-white/95 backdrop-blur rounded-xl shadow min-w-[320px] max-w-[380px]">
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Alternative Routes</h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-500 hover:text-gray-700 transition-colors"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <svg
            className={`w-5 h-5 transition-transform ${expanded ? '' : '-rotate-90'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      {expanded && (
        <div className="max-h-[calc(100vh-180px)] overflow-y-auto">
          {alternatives.map((alt) => (
            <div
              key={alt.id}
              className={`p-4 border-b border-gray-100 last:border-b-0 ${
                activeAlternativeId === alt.id ? 'bg-blue-50' : 'hover:bg-gray-50'
              } transition-colors`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-gray-900 text-sm">{alt.name}</h4>
                    {alt.isRecommended && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                        Recommended
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-600 mb-2">
                    <span>{alt.distanceText}</span>
                    <span>•</span>
                    <span>{alt.durationText}</span>
                    {alt.deltaMinutes !== 0 && (
                      <span className={alt.deltaMinutes > 0 ? 'text-orange-600' : 'text-green-600'}>
                        ({alt.deltaMinutes > 0 ? '+' : ''}
                        {alt.deltaMinutes} min)
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                      {alt.curvyPercent}% Curvy
                    </span>
                  </div>
                </div>
              </div>

              {alt.keyRoads.length > 0 && (
                <div className="text-xs text-gray-500 mb-2">
                  <span className="font-medium">Roads:</span> {alt.keyRoads.slice(0, 2).join(', ')}
                  {alt.keyRoads.length > 2 && ` +${alt.keyRoads.length - 2} more`}
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => onSelectAlternative(alt)}
                  className={`flex-1 px-3 py-1.5 text-sm rounded transition-colors ${
                    activeAlternativeId === alt.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {activeAlternativeId === alt.id ? 'Selected' : 'Select'}
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const url = await generateExportUrl(alt);
                    window.open(url, '_blank', 'noopener');
                  }}
                  className="px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                >
                  Export
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

