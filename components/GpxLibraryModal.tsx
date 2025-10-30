'use client';
import { useEffect, useMemo, useState } from 'react';
import type { GpxMeta } from '@/lib/types';

export default function GpxLibraryModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [items, setItems] = useState<GpxMeta[]>([]);
  const [q, setQ] = useState('');
  const [view, setView] = useState<'grid' | 'table'>('grid');

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const res = await fetch('/gpx/index.json');
        if (res.ok) setItems(await res.json());
        else setItems([]);
      } catch {
        setItems([]);
      }
    })();
  }, [isOpen]);

  const filtered = useMemo(() => {
    const k = q.toLowerCase().trim();
    if (!k) return items;
    return items.filter((i) =>
      [i.name, i.region, i.difficulty, ...(i.tags || [])]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(k))
    );
  }, [items, q]);

  function useAsRoute(file: string) {
    const channel = new BroadcastChannel('gpx-map-communication');
    channel.postMessage({ type: 'gpx-use-route', file });
    channel.close();
    onClose(); // Close modal after selecting route
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] m-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">GPX Library</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>
                      {item.region ?? '—'} • {item.difficulty ?? '—'}
                    </div>
                    {item.miles !== undefined && (
                      <div className="font-medium">
                        {item.miles} mi
                        {item.estimatedMinutes !== undefined && (
                          <span className="ml-2 text-gray-500">
                            • {item.estimatedMinutes < 60 ? `${item.estimatedMinutes}m` : `${Math.floor(item.estimatedMinutes / 60)}h ${item.estimatedMinutes % 60}m`}
                          </span>
                        )}
                      </div>
                    )}
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
                    <button className="border rounded px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700" onClick={() => useAsRoute(item.file)}>
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
                    <th className="text-left p-2">Distance / Time</th>
                    <th className="text-left p-2">Difficulty</th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.file} className="border-t">
                      <td className="p-2">{item.name}</td>
                      <td className="p-2">{item.region ?? '—'}</td>
                      <td className="p-2">
                        {item.miles !== undefined ? (
                          <div>
                            {item.miles} mi
                            {item.estimatedMinutes !== undefined && (
                              <div className="text-xs text-gray-500">
                                {item.estimatedMinutes < 60 ? `${item.estimatedMinutes}m` : `${Math.floor(item.estimatedMinutes / 60)}h ${item.estimatedMinutes % 60}m`}
                              </div>
                            )}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="p-2">{item.difficulty ?? '—'}</td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          <button className="border rounded px-2 py-1 bg-blue-600 text-white hover:bg-blue-700" onClick={() => useAsRoute(item.file)}>
                            Use as Route
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
      </div>
    </div>
  );
}
