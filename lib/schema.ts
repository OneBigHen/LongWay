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


