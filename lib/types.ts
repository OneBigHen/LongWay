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


