'use client';

import type { ReactNode } from 'react';

// Lightweight, non-blocking bottom sheet (no dialogs/overlays/aria). Mobile-friendly scroll area.
export default function POIDrawer({ children }: { children: ReactNode }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 mx-auto max-w-5xl rounded-t-2xl bg-white shadow-2xl drawer-touch-area pointer-events-auto z-30">
      <div className="mx-auto h-1.5 w-10 rounded-full bg-gray-300 my-3" />
      <div className="p-3 overflow-x-auto">
        <div className="flex gap-3">{children}</div>
      </div>
    </div>
  );
}


