'use client';

import { Loader2, SearchX } from 'lucide-react';
import BusinessCard from './BusinessCard';
import { Business } from '@/types';

interface Props {
  businesses: Business[];
  loading: boolean;
  error: string | null;
  onSelect: (b: Business) => void;
  competitors?: string[];
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

export default function BusinessGrid({ businesses, loading, error, onSelect, competitors, selectMode, selectedIds, onToggleSelect }: Props) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-4 text-center">
        <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
        <p className="text-gray-400 font-medium">Scanning Google Maps…</p>
        <p className="text-gray-600 text-sm">Checking which businesses have websites</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-4 text-center">
        <div className="w-16 h-16 bg-red-500/15 rounded-full flex items-center justify-center">
          <SearchX className="w-7 h-7 text-red-400" />
        </div>
        <p className="text-red-400 font-semibold">Search failed</p>
        <p className="text-gray-500 text-sm max-w-sm">{error}</p>
       
      </div>
    );
  }

  if (businesses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-4 text-center">
        <span className="text-5xl">🔍</span>
        <p className="text-gray-400 font-semibold">No businesses found</p>
        <p className="text-gray-600 text-sm">Try a broader industry term or a different location</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {businesses.map((b) => {
        const isSelected = selectedIds?.has(b.id) ?? false;
        return (
          <div key={b.id} className="relative">
            {selectMode && (
              <button
                onClick={() => onToggleSelect?.(b.id)}
                className={`absolute top-2 left-2 z-10 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  isSelected ? 'bg-green-500 border-green-400' : 'bg-gray-900/80 border-gray-600 hover:border-green-400'
                }`}
              >
                {isSelected && <span className="text-white text-[10px] font-bold">✓</span>}
              </button>
            )}
            <div
              onClick={selectMode ? () => onToggleSelect?.(b.id) : undefined}
              className={selectMode ? 'cursor-pointer' : undefined}
            >
              <BusinessCard business={b} onClick={selectMode ? () => {} : () => onSelect(b)} competitors={competitors} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
