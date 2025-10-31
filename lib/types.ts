export interface POI {
  id: string;
  name: string;
  lat: number;
  lng: number;
  emoji?: string;
  type?: string;
  description?: string;
  tips?: string;
  photoUrl?: string;
  attribution?: string;
  website?: string;
}

export interface RouteSamplePoint {
  lat: number;
  lng: number;
}

// Twisty overlays
export type StateCode = 'PA' | 'NJ';

export type TwistyKind = 'twisty' | 'curvy';

export interface TwistySource {
  id: string; // e.g., 'PA_twisty'
  state: StateCode;
  kind: TwistyKind;
  url: string; // e.g., '/kml/pa_twisty.kml'
  enabled: boolean;
}

// GPX Library
export interface GpxMeta {
  file: string; // filename under /gpx
  name: string;
  region?: string; // 'PA' | 'NJ' etc
  miles?: number;
  estimatedMinutes?: number; // estimated time in minutes at 45 mph
  difficulty?: 'easy' | 'moderate' | 'hard';
  tags?: string[];
}

// Route Alternatives (You.com Planner)
export type PlannerType = 'google' | 'you-com';

export interface RoutePreferences {
  avoid_highways: boolean;
  avoid_tolls: boolean;
  prefer_curvy: boolean;
  max_extra_time_min: number;
  region_hint?: string;
}

export interface RouteAlternative {
  id: string; // 'alt-a', 'alt-b', 'alt-c'
  name: string; // e.g., "Scenic Pine Barrens Byway Loop"
  origin: string; // address or lat,lng
  destination: string; // address or lat,lng
  waypoints?: string[]; // optional waypoint addresses/coordinates
  distanceText: string; // e.g., "80 mi"
  durationText: string; // e.g., "2h 15m"
  deltaMinutes: number; // time difference vs baseline (+ or -)
  curvyPercent: number; // 0-100
  whyText: string[]; // bullet points explaining why this route
  keyRoads: string[]; // road names/segments
  exportUrl?: string; // generated client-side
  isRecommended?: boolean; // true for first/default alternative
}


