'use client';
import { useEffect, useMemo, useState } from 'react';
import type { GpxMeta } from '@/lib/types';

export default function GpxLibraryPage() {
  const [items, setItems] = useState<GpxMeta[]>([]);
  const [q, setQ] = useState('');
  const [view, setView] = useState<'grid' | 'table'>('grid');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/gpx/index.json');
        if (res.ok) setItems(await res.json());
        else setItems([]);
      } catch {
        setItems([]);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const k = q.toLowerCase().trim();
    if (!k) return items;
    return items.filter((i) =>
      [i.name, i.region, i.difficulty, ...(i.tags || [])]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(k))
    );
  }, [items, q]);

  function preview(file: string) {
    console.log('[GPX Library] Preview clicked for:', file);
    
    // Use BroadcastChannel for cross-tab communication (doesn't need window.opener)
    try {
      const channel = new BroadcastChannel('gpx-map-communication');
      channel.postMessage({ type: 'gpx-preview', file });
      channel.close();
      console.log('[GPX Library] Preview message sent via BroadcastChannel');
    } catch (e) {
      console.error('[GPX Library] Error using BroadcastChannel:', e);
      alert('Unable to communicate with the map. Please make sure the map page is open.');
    }
  }
  
  function useAsRoute(file: string) {
    console.log('[GPX Library] Use as route clicked for:', file);
    
    // Use BroadcastChannel for cross-tab communication (doesn't need window.opener)
    try {
      const channel = new BroadcastChannel('gpx-map-communication');
      channel.postMessage({ type: 'gpx-use-route', file });
      channel.close();
      console.log('[GPX Library] Use route message sent via BroadcastChannel');
    } catch (e) {
      console.error('[GPX Library] Error using BroadcastChannel:', e);
      alert('Unable to communicate with the map. Please make sure the map page is open.');
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <input
          className="border rounded px-3 py-2 w-full max-w-md"
          placeholder="Search by name, region, tag…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="border rounded px-3 py-2" onClick={() => setView((v) => (v === 'grid' ? 'table' : 'grid'))}>
          {view === 'grid' ? 'Table' : 'Grid'}
        </button>
      </div>

      {view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {filtered.map((item) => (
            <div key={item.file} className="rounded-2xl border p-3 shadow-sm">
              <div className="font-semibold">{item.name}</div>
              <div className="text-sm text-gray-600">
                {item.region ?? '—'} • {item.miles ? `${item.miles} mi` : '—'} • {item.difficulty ?? '—'}
              </div>
              {!!item.tags?.length && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.tags.map((t) => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-full border">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-3 flex items-center gap-2">
                <button className="border rounded px-3 py-1 text-sm" onClick={() => preview(item.file)}>
                  Preview on Map
                </button>
                <button className="border rounded px-3 py-1 text-sm" onClick={() => useAsRoute(item.file)}>
                  Use as Route
                </button>
                <a className="border rounded px-3 py-1 text-sm" href={`/gpx/${item.file}`} download>
                  Download
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Region</th>
                <th className="text-left p-2">Miles</th>
                <th className="text-left p-2">Difficulty</th>
                <th className="text-left p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.file} className="border-t">
                  <td className="p-2">{item.name}</td>
                  <td className="p-2">{item.region ?? '—'}</td>
                  <td className="p-2">{item.miles ?? '—'}</td>
                  <td className="p-2">{item.difficulty ?? '—'}</td>
                  <td className="p-2">
                    <div className="flex gap-2">
                      <button className="border rounded px-2 py-1" onClick={() => preview(item.file)}>
                        Preview
                      </button>
                      <button className="border rounded px-2 py-1" onClick={() => useAsRoute(item.file)}>
                        Use
                      </button>
                      <a className="border rounded px-2 py-1" href={`/gpx/${item.file}`} download>
                        Download
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Export to Google Maps appears on the main map page after you "Use as Route".
      </p>
    </div>
  );
}