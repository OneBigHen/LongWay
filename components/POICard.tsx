import type { POI } from '@/lib/types';
import { useState } from 'react';

export default function POICard({ poi, index, onAdd }: { poi: POI; index: number; onAdd?: (poi: POI) => void }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  return (
    <div className="w-[320px] flex-shrink-0 bg-white rounded-xl shadow hover:shadow-md transition-transform hover:scale-[1.02] overflow-hidden">
      <div className="relative aspect-[4/3] bg-gray-200">
        {poi.photoUrl ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 animate-pulse bg-gray-200" />
            )}
            <img
              src={poi.photoUrl}
              alt={poi.name}
              loading="lazy"
              className={`h-full w-full object-cover ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImgLoaded(true)}
            />
          </>
        ) : (
          <div className="grid place-items-center h-full w-full text-3xl">{poi.emoji ?? '📍'}</div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-lg">
            {index + 1}. {poi.name}
          </h3>
          {poi.type ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{poi.type}</span>
          ) : null}
        </div>
        {poi.description ? (
          <p className="text-sm text-gray-600 line-clamp-2 mb-2">{poi.description}</p>
        ) : null}
        <div className="flex items-center justify-between">
          <a
            href={poi.website || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(poi.name)}`}
            target="_blank"
            rel="noopener"
            className="text-sm text-blue-600 hover:underline"
          >
            {poi.website ? 'Website' : 'Open in Maps'}
          </a>
          <button
            onClick={() => onAdd?.(poi)}
            className="text-sm px-2 py-1 rounded bg-black text-white"
          >
            Add to Route
          </button>
        </div>
      </div>
    </div>
  );
}


