'use client';
import { useEffect, useState } from 'react';
import type { TwistySource, StateCode } from '@/lib/types';

const DEFAULT_SOURCES: TwistySource[] = [
  { id: 'PA_twisty', state: 'PA', kind: 'twisty', url: '/kml/pa_twisty.kml', enabled: false },
  { id: 'PA_curvy', state: 'PA', kind: 'curvy', url: '/kml/pa_curvy.kml', enabled: false },
  { id: 'NJ_twisty', state: 'NJ', kind: 'twisty', url: '/kml/nj_twisty.kml', enabled: false },
  { id: 'NJ_curvy', state: 'NJ', kind: 'curvy', url: '/kml/nj_curvy.kml', enabled: false },
];

const KEY = 'twistyOverlayState';

export function useTwistySources() {
  const [sources, setSources] = useState<TwistySource[]>(DEFAULT_SOURCES);
  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(KEY) : null;
    let saved: TwistySource[] | null = null;
    if (raw) {
      try { saved = JSON.parse(raw); } catch {}
    }
    (async () => {
      try {
        const res = await fetch('/kml/index.json', { cache: 'no-store' });
        if (res.ok) {
          const idx: TwistySource[] = await res.json();
          // merge enabled flags from saved state if ids match
          if (saved) {
            const enabledById = new Map(saved.map((s) => [s.id, s.enabled] as const));
            for (const item of idx) {
              if (enabledById.has(item.id)) item.enabled = !!enabledById.get(item.id);
            }
          }
          console.log('[SettingsCog] Loaded', idx.length, 'sources from index.json:', idx);
          setSources(idx);
          return;
        } else {
          console.log('[SettingsCog] Failed to load index.json:', res.status);
        }
      } catch (err) {
        console.error('[SettingsCog] Error loading index.json:', err);
      }
      if (saved) {
        console.log('[SettingsCog] Using saved sources:', saved.length);
        setSources(saved);
      }
    })();
  }, []);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(KEY, JSON.stringify(sources));
    }
  }, [sources]);
  const setEnabled = (id: string, enabled: boolean) => {
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, enabled } : s)));
  };
  return { sources, setEnabled, setSources };
}

export default function SettingsCog({ onChange }: { onChange?: (sources: TwistySource[]) => void }) {
  const { sources, setEnabled, setSources } = useTwistySources();
  useEffect(() => { onChange?.(sources); }, [sources, onChange]);

  const anyEnabledByKind = (kind: 'twisty' | 'curvy') => sources.some((s) => s.kind === kind && s.enabled);
  const hasSourcesByKind = (kind: 'twisty' | 'curvy') => sources.some((s) => s.kind === kind);
  const setAllByKind = (kind: 'twisty' | 'curvy', enabled: boolean) => {
    console.log('[SettingsCog] setAllByKind called:', kind, enabled);
    setSources((prev) => {
      const updated = prev.map((s) => (s.kind === kind ? { ...s, enabled } : s));
      console.log('[SettingsCog] Updated sources:', updated.filter(s => s.kind === kind).map(s => ({ id: s.id, enabled: s.enabled })));
      return updated;
    });
  };

  return (
    <div className="p-4 w-64" onClick={(e) => e.stopPropagation()}>
      <h3 className="text-sm font-semibold mb-2">Overlays</h3>
      <div className="space-y-3">
        <div>
          <div className="font-medium mb-1 text-sm">Twisty Roads</div>
          <label className={`flex items-center gap-2 text-sm py-0.5 ${hasSourcesByKind('twisty') ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`} onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={anyEnabledByKind('twisty')}
              disabled={!hasSourcesByKind('twisty')}
              onChange={(e) => {
                e.stopPropagation();
                if (hasSourcesByKind('twisty')) {
                  setAllByKind('twisty', e.target.checked);
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
            Very Twisty {!hasSourcesByKind('twisty') && <span className="text-xs text-gray-400">(none available)</span>}
          </label>
          <label className={`flex items-center gap-2 text-sm py-0.5 ${hasSourcesByKind('curvy') ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`} onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={anyEnabledByKind('curvy')}
              disabled={!hasSourcesByKind('curvy')}
              onChange={(e) => {
                e.stopPropagation();
                if (hasSourcesByKind('curvy')) {
                  setAllByKind('curvy', e.target.checked);
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
            Curvy {!hasSourcesByKind('curvy') && <span className="text-xs text-gray-400">(none available)</span>}
          </label>
        </div>
        <div className="border-t my-2" />
        <div>
          <div className="font-medium mb-1 text-sm">GPX Library</div>
                 <button 
                   className="border rounded px-3 py-1 text-sm"
                   onClick={() => {
                     window.dispatchEvent(new CustomEvent('open-gpx-library'));
                   }}
                 >
                   Open GPX Library
                 </button>
        </div>
      </div>
    </div>
  );
}


