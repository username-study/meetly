'use client';

import React from 'react';
import { Place } from '../lib/types';
import DirectionsButton from './DirectionsButton';

interface PlaceCardProps {
  place: Place;
}

export default function PlaceCard({ place }: PlaceCardProps) {
  const categoryLabel = place.category === 'cafe' ? '☕ 카페' 
                    : place.category === 'restaurant' ? '🍽️ 식사' 
                    : '🍺 술모임';

  return (
    <div className="flex items-start justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
          <span className="rounded-full bg-gray-100 px-2 py-0.5">
            {categoryLabel}
          </span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900">{place.name}</h3>
        {place.description && (
          <p className="mt-1 text-sm text-gray-600">{place.description}</p>
        )}
        <p className="mt-2 text-xs text-gray-500">{place.address}</p>
      </div>
      
      <div className="ml-4 shrink-0">
        <DirectionsButton place={place} />
      </div>
    </div>
  );
}
