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


