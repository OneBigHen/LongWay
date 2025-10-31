import { getYouApiKey, getRouteAltAgentId } from '@/lib/config';
import { backoff } from '@/lib/utils';
import { parseRouteAltMarkdown } from '@/lib/routeAltParser';
import type { RoutePreferences } from '@/lib/types';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { origin, destination, waypoints = [], prefs }: { 
    origin?: string; 
    destination?: string; 
    waypoints?: string[];
    prefs?: RoutePreferences;
  } = body;

  if (!origin || !destination) {
    return new Response(JSON.stringify({ error: 'Missing origin or destination' }), { status: 400 });
  }

  const apiKey = getYouApiKey();
  const agentId = getRouteAltAgentId();

  // Build preferences with defaults
  const preferences: RoutePreferences = {
    avoid_highways: prefs?.avoid_highways ?? false,
    avoid_tolls: prefs?.avoid_tolls ?? false,
    prefer_curvy: prefs?.prefer_curvy ?? false,
    max_extra_time_min: prefs?.max_extra_time_min ?? 40,
    region_hint: prefs?.region_hint,
  };

  // Build JSON input for agent (matches expected format)
  const agentInput = {
    origin,
    destination,
    waypoints,
    prefs: {
      avoid_highways: preferences.avoid_highways,
      avoid_tolls: preferences.avoid_tolls,
      prefer_curvy: preferences.prefer_curvy,
      max_extra_time_min: preferences.max_extra_time_min,
      region_hint: preferences.region_hint,
      need_export_url: false, // We generate on client
    },
  };

  const prompt = `You are RouteAlt Pro. Analyze the following route request and provide 2-3 high-quality alternative routes.

${JSON.stringify(agentInput, null, 2)}

Return your response in the exact Markdown format specified in your instructions, with Summary and Alternatives sections.`;

  const run = async () => {
    const resp = await fetch('https://api.you.com/v1/agents/runs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agent: agentId, input: prompt, stream: false }),
    });
    
    if (!resp.ok) {
      if (resp.status === 502 || resp.status === 503) throw new Error(`Transient ${resp.status}`);
      const text = await resp.text();
      return new Response(JSON.stringify({ error: text }), { status: resp.status });
    }
    
    const data = await resp.json();
    // Extract text from agent response
    const text = data?.output?.[0]?.text ?? data?.output?.[0]?.content ?? '';
    
    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Empty or invalid agent response' }), { status: 502 });
    }
    
    // Parse markdown response
    try {
      const parsed = parseRouteAltMarkdown(text, origin, destination);
      
      // If agent didn't provide explicit origin/destination in alternatives, use the input ones
      parsed.alternatives = parsed.alternatives.map(alt => ({
        ...alt,
        origin: alt.origin || origin,
        destination: alt.destination || destination,
      }));
      
      return new Response(JSON.stringify(parsed), { 
        headers: { 'Content-Type': 'application/json' } 
      });
    } catch (parseError) {
      console.error('Failed to parse route alternatives:', parseError);
      return new Response(JSON.stringify({ 
        error: 'Failed to parse route alternatives response',
        details: parseError instanceof Error ? parseError.message : String(parseError)
      }), { status: 502 });
    }
  };

  const res = await backoff(run, 3, 400).catch((e) => {
    return new Response(JSON.stringify({ error: String(e) }), { status: 502 });
  });
  return res;
}

