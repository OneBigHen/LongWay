'use client';

import { useEffect } from 'react';
import type { RouteAlternative } from '@/lib/types';

export default function RecommendationPopup({
  alternative,
  onDismiss,
  onViewAlternatives,
}: {
  alternative: RouteAlternative;
  onDismiss: () => void;
  onViewAlternatives?: () => void;
}) {
  // No auto-dismiss - user must click "Got it" to dismiss

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center p-4">
      <div className="pointer-events-auto bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-gray-200">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                Recommended Route
              </span>
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded">
                {alternative.curvyPercent}% Curvy
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{alternative.name}</h3>
          </div>
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <div className="text-sm text-gray-600 mb-2">
            <span className="font-medium">Distance:</span> {alternative.distanceText} •{' '}
            <span className="font-medium">Time:</span> {alternative.durationText}
            {alternative.deltaMinutes !== 0 && (
              <span className={alternative.deltaMinutes > 0 ? 'text-orange-600' : 'text-green-600'}>
                {' '}
                ({alternative.deltaMinutes > 0 ? '+' : ''}
                {alternative.deltaMinutes} min vs baseline)
              </span>
            )}
          </div>
        </div>

        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Why we recommend this route:</h4>
          <ul className="space-y-1 text-sm text-gray-700">
            {alternative.whyText.map((text, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {alternative.keyRoads.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-gray-700 mb-1">Key roads:</h4>
            <p className="text-xs text-gray-600">{alternative.keyRoads.slice(0, 3).join(', ')}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onDismiss}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Got it
          </button>
          {onViewAlternatives && (
            <button
              onClick={onViewAlternatives}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              View all alternatives
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

