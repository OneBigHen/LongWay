'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

// Lightweight, non-blocking bottom sheet (no dialogs/overlays/aria). Mobile-friendly scroll area.
export default function POIDrawer({ children }: { children: ReactNode }) {
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <div className={`fixed bottom-0 left-0 right-0 mx-auto max-w-5xl rounded-t-2xl bg-white shadow-2xl drawer-touch-area pointer-events-auto z-30 transition-all duration-300 ease-in-out ${isMinimized ? 'max-h-12' : 'max-h-[80vh]'}`}>
      <button
        onClick={() => setIsMinimized(!isMinimized)}
        className="w-full flex items-center justify-center py-2 hover:bg-gray-50 transition-colors rounded-t-2xl cursor-pointer"
        aria-label={isMinimized ? 'Expand POI drawer' : 'Minimize POI drawer'}
      >
        <div className="mx-auto h-1.5 w-10 rounded-full bg-gray-300" />
        {isMinimized && (
          <span className="ml-3 text-sm text-gray-600 font-medium">Points of Interest</span>
        )}
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${isMinimized ? 'max-h-0' : 'max-h-[calc(80vh-3rem)]'}`}>
        <div className="p-3 overflow-x-auto">
          <div className="flex gap-3">{children}</div>
        </div>
      </div>
    </div>
  );
}


