import { getYouAgentId, getYouApiKey } from '@/lib/config';
import { backoff } from '@/lib/utils';
import { AgentPOIArraySchema } from '@/lib/schema';

export async function POST(req: Request) {
  const { origin, destination, dateISO, samples, preference } = await req.json().catch(() => ({}));
  if (!origin || !destination) {
    return new Response(JSON.stringify({ error: 'Missing origin or destination' }), { status: 400 });
  }

  const apiKey = getYouApiKey();
  const agentId = getYouAgentId();

  const weekday = new Date(dateISO ?? Date.now()).toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const samplesText = Array.isArray(samples)
    ? samples.map((p: any) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(' | ')
    : '';

  const prompt = [
    'You are an expert travel and route assistant helping users create scenic, activity-filled journeys in Pennsylvania or New Jersey.',
    `The user is traveling from ${origin} to ${destination} on ${weekday} (${dateISO || 'today'}).`,
    samplesText ? `Approximate route sample points (lat,lng): ${samplesText}` : '',
    'Recommend up to 10 roadside stops along the route: scenic roads, state parks, hiking trails, local breweries, restaurants, museums, historical sites, and active events.',
    preference ? `User preference: ${preference}. Prioritize results that best match this request.` : '',
    'Focus on actionable travel recommendations near the route. For each stop include: name, lat, lng, type, emoji, short description, and tips if helpful.',
    'Return a strict JSON array only of objects: [{ name: string; lat: number; lng: number; description?: string; emoji?: string; type?: string; tips?: string }]. No markdown or extra keys.',
  ].filter(Boolean).join('\n');

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
    // The API often returns {output: [{ type, text }]} — try to parse JSON from the first text field
    const text = data?.output?.[0]?.text ?? data?.output?.[0]?.content ?? '';
    let parsed: unknown = null;
    try {
      parsed = typeof text === 'string' ? JSON.parse(text) : text;
    } catch {
      // Attempt to extract JSON array from mixed content
      const match = typeof text === 'string' ? text.match(/\[([\s\S]*?)\]/) : null;
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch {}
      }
    }
    const validation = AgentPOIArraySchema.safeParse(parsed);
    if (!validation.success) {
      return new Response(JSON.stringify({ error: 'Invalid agent response' }), { status: 502 });
    }
    return new Response(JSON.stringify({ pois: validation.data }), { headers: { 'Content-Type': 'application/json' } });
  };

  const res = await backoff(run, 3, 400).catch((e) => {
    return new Response(JSON.stringify({ error: String(e) }), { status: 502 });
  });
  return res;
}


