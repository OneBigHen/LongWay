'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void; }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="h-screen w-screen grid place-items-center p-6">
      <div className="max-w-md text-center">
        <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
        <p className="text-sm text-gray-600 mb-4">Please try again. If the issue persists, refresh the page.</p>
        <button onClick={() => reset()} className="px-4 py-2 rounded bg-black text-white">Try again</button>
      </div>
    </div>
  );
}


