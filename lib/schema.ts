import { z } from 'zod';

export const AgentPOISchema = z.object({
  name: z.string(),
  lat: z.number().finite(),
  lng: z.number().finite(),
  description: z.string().optional(),
  emoji: z.string().optional(),
  type: z.string().optional(),
  tips: z.string().optional(),
});

export const AgentPOIArraySchema = z.array(AgentPOISchema).max(10);

export type AgentPOI = z.infer<typeof AgentPOISchema>;

export const RouteAlternativeSchema = z.object({
  id: z.string(),
  name: z.string(),
  origin: z.string(),
  destination: z.string(),
  waypoints: z.array(z.string()).optional(),
  distanceText: z.string(),
  durationText: z.string(),
  deltaMinutes: z.number(),
  curvyPercent: z.number().min(0).max(100),
  whyText: z.array(z.string()),
  keyRoads: z.array(z.string()),
  exportUrl: z.string().optional(),
  isRecommended: z.boolean().optional(),
});

export const RoutePreferencesSchema = z.object({
  avoid_highways: z.boolean(),
  avoid_tolls: z.boolean(),
  prefer_curvy: z.boolean(),
  max_extra_time_min: z.number().default(40),
  region_hint: z.string().optional(),
});


