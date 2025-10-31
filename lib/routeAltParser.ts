import type { RouteAlternative } from './types';
import { RouteAlternativeSchema } from './schema';

export interface ParsedRouteAltResponse {
  baselineDistance: string;
  baselineTime: string;
  alternatives: RouteAlternative[];
}

/**
 * Parse markdown response from You.com RouteAlt agent.
 * Expected format:
 * 
 * ## Summary
 * - Baseline distance/time: X mi, Y min
 * - Alternatives generated: N
 * 
 * ## Alternatives
 * **Alt A — Name**
 * - Distance/Time: X mi, Y min (Δ vs baseline: +Z min)
 * - Curvy %: NN%
 * - Why this route: bullet list
 * - Key roads/segments: comma-separated
 */
export function parseRouteAltMarkdown(markdown: string, origin: string, destination: string): ParsedRouteAltResponse {
  const lines = markdown.split('\n').map(l => l.trim()).filter(Boolean);
  
  let baselineDistance = '';
  let baselineTime = '';
  const alternatives: RouteAlternative[] = [];
  
  let currentSection: 'summary' | 'alternatives' | null = null;
  let currentAlt: Partial<RouteAlternative> | null = null;
  let inWhySection = false;
  let inKeyRoads = false;
  const whyBullets: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect section headers
    if (line.startsWith('## Summary')) {
      currentSection = 'summary';
      continue;
    }
    if (line.startsWith('## Alternatives')) {
      currentSection = 'alternatives';
      continue;
    }
    
    // Parse summary section
    if (currentSection === 'summary') {
      const baselineMatch = line.match(/Baseline distance\/time:\s*([\d.]+)\s*mi,?\s*([\d.]+)\s*(?:min|h|m)/i);
      if (baselineMatch) {
        baselineDistance = `${baselineMatch[1]} mi`;
        baselineTime = baselineMatch[2].includes('h') ? baselineMatch[2] : `${baselineMatch[2]} min`;
      }
    }
    
    // Parse alternatives section
    if (currentSection === 'alternatives') {
      // Detect new alternative header: **Alt {A|B|C} — Name**
      const altHeaderMatch = line.match(/\*\*Alt\s+([ABC])\s*—\s*(.+?)\*\*/);
      if (altHeaderMatch) {
        // Save previous alternative if exists
        if (currentAlt) {
          alternatives.push(completeAlternative(currentAlt, origin, destination, whyBullets));
        }
        
        // Start new alternative
        const altId = `alt-${altHeaderMatch[1].toLowerCase()}`;
        currentAlt = {
          id: altId,
          name: altHeaderMatch[2].trim(),
          isRecommended: altId === 'alt-a',
        };
        whyBullets.length = 0;
        inWhySection = false;
        inKeyRoads = false;
        continue;
      }
      
      // Distance/Time line
      if (line.match(/Distance\/Time:/i) && currentAlt) {
        const distMatch = line.match(/([\d.]+)\s*mi[,\s]+([\d.]+)\s*(?:h|m)/i);
        const deltaMatch = line.match(/[ΔΔ]\s*vs\s*baseline:\s*([+-]?\d+)\s*min/i);
        if (distMatch) {
          currentAlt.distanceText = `${distMatch[1]} mi`;
          currentAlt.durationText = distMatch[2].includes('h') ? distMatch[2] : `${distMatch[2]} min`;
        }
        if (deltaMatch) {
          currentAlt.deltaMinutes = parseInt(deltaMatch[1], 10);
        }
        continue;
      }
      
      // Curvy % line
      if (line.match(/Curvy\s*%/i) && currentAlt) {
        const curvyMatch = line.match(/(\d+)%/);
        if (curvyMatch) {
          currentAlt.curvyPercent = parseInt(curvyMatch[1], 10);
        }
        continue;
      }
      
      // Why this route section
      if (line.match(/Why\s+this\s+route:/i)) {
        inWhySection = true;
        inKeyRoads = false;
        continue;
      }
      
      // Key roads/segments line
      if (line.match(/Key\s+roads\/segments:/i)) {
        inWhySection = false;
        inKeyRoads = true;
        const roadsPart = line.split(':').slice(1).join(':').trim();
        if (roadsPart && currentAlt) {
          currentAlt.keyRoads = roadsPart.split(',').map(r => r.trim()).filter(Boolean);
        }
        continue;
      }
      
      // Collect why bullets (lines starting with - or •)
      if (inWhySection && currentAlt && (line.startsWith('-') || line.startsWith('•'))) {
        whyBullets.push(line.replace(/^[-•]\s*/, '').trim());
        continue;
      }
      
      // Collect key roads if on separate lines
      if (inKeyRoads && currentAlt) {
        const roads = line.split(',').map(r => r.trim()).filter(Boolean);
        if (roads.length > 0) {
          currentAlt.keyRoads = [...(currentAlt.keyRoads || []), ...roads];
        }
      }
    }
  }
  
  // Save last alternative
  if (currentAlt) {
    alternatives.push(completeAlternative(currentAlt, origin, destination, whyBullets));
  }
  
  return {
    baselineDistance,
    baselineTime,
    alternatives: alternatives.map(alt => {
      const validated = RouteAlternativeSchema.safeParse(alt);
      if (!validated.success) {
        console.warn('Invalid alternative after parsing:', alt, validated.error);
        // Return a minimal valid alternative
        return {
          id: alt.id || 'alt-unknown',
          name: alt.name || 'Unknown Route',
          origin: alt.origin || origin,
          destination: alt.destination || destination,
          distanceText: alt.distanceText || '—',
          durationText: alt.durationText || '—',
          deltaMinutes: alt.deltaMinutes || 0,
          curvyPercent: alt.curvyPercent ?? 0,
          whyText: alt.whyText || [],
          keyRoads: alt.keyRoads || [],
          isRecommended: alt.isRecommended || false,
        };
      }
      return validated.data;
    }),
  };
}

function completeAlternative(
  alt: Partial<RouteAlternative>,
  defaultOrigin: string,
  defaultDestination: string,
  whyBullets: string[]
): RouteAlternative {
  return {
    id: alt.id || 'alt-unknown',
    name: alt.name || 'Unknown Route',
    origin: alt.origin || defaultOrigin,
    destination: alt.destination || defaultDestination,
    waypoints: alt.waypoints,
    distanceText: alt.distanceText || '—',
    durationText: alt.durationText || '—',
    deltaMinutes: alt.deltaMinutes || 0,
    curvyPercent: alt.curvyPercent ?? 0,
    whyText: whyBullets.length > 0 ? whyBullets : ['No description provided'],
    keyRoads: alt.keyRoads || [],
    isRecommended: alt.isRecommended || false,
  };
}

