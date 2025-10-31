import type { RoutePreferences, PlannerType } from './types';

const PREFERENCES_KEY = 'routeAltPreferences';
const PLANNER_TYPE_KEY = 'routeAltPlannerType';

const DEFAULT_PREFERENCES: RoutePreferences = {
  avoid_highways: false,
  avoid_tolls: false,
  prefer_curvy: false,
  max_extra_time_min: 40,
  region_hint: undefined,
};

const DEFAULT_PLANNER_TYPE: PlannerType = 'google';

export function loadPreferences(): RoutePreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: RoutePreferences): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.warn('Failed to save preferences:', err);
  }
}

export function loadPlannerType(): PlannerType {
  if (typeof window === 'undefined') return DEFAULT_PLANNER_TYPE;
  try {
    const raw = localStorage.getItem(PLANNER_TYPE_KEY);
    if (!raw) return DEFAULT_PLANNER_TYPE;
    return (raw === 'you-com' ? 'you-com' : 'google') as PlannerType;
  } catch {
    return DEFAULT_PLANNER_TYPE;
  }
}

export function savePlannerType(type: PlannerType): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PLANNER_TYPE_KEY, type);
  } catch (err) {
    console.warn('Failed to save planner type:', err);
  }
}

