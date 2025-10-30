import { getPublicGoogleMapsKey } from '@/lib/config';

// Simple in-memory cache to reduce duplicate lookups during a dev session
const memoryCache = new Map<string, { photoUrl: string | null; attribution: string | null; website: string | null }>();

export async function POST(req: Request) {
  const { name, bounds } = await req.json().catch(() => ({}));
  if (!name) {
    return new Response(JSON.stringify({ error: 'Missing name' }), { status: 400 });
  }
  const key = getPublicGoogleMapsKey();
  try {
    if (memoryCache.has(name)) {
      return new Response(JSON.stringify(memoryCache.get(name)), { headers: { 'Content-Type': 'application/json' } });
    }
    // Build a location bias if bounds provided
    let bias = '';
    if (bounds && typeof bounds === 'object') {
      const b = bounds as { north: number; south: number; east: number; west: number };
      bias = `&locationbias=rectangle:${b.south},${b.west}|${b.north},${b.east}`;
    }

    const textUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      name
    )}${bias}&key=${key}`;
    const res = await fetch(textUrl);
    const data = await res.json();
    const candidate = data?.results?.[0];
    const photoRef = candidate?.photos?.[0]?.photo_reference;
    const attributions: string[] | undefined = candidate?.photos?.[0]?.html_attributions;
    let website: string | null = null;

    // Try to enrich with website via Place Details when we have a place_id
    if (candidate?.place_id) {
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
        candidate.place_id
      )}&fields=website,url&key=${key}`;
      try {
        const d = await fetch(detailsUrl).then((r) => r.json());
        website = d?.result?.website || d?.result?.url || null;
      } catch {}
    }
    if (!photoRef) {
      const payload = { photoUrl: null, attribution: null, website };
      memoryCache.set(name, payload);
      return new Response(JSON.stringify(payload), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=480&photo_reference=${encodeURIComponent(
      photoRef
    )}&key=${key}`;
    const payload = { photoUrl, attribution: attributions?.join(' ') ?? null, website };
    memoryCache.set(name, payload);
    return new Response(JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
}


