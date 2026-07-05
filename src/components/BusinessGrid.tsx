'use client';

import { memo } from 'react';
import { SearchX } from 'lucide-react';
import BusinessCard from './BusinessCard';
import { SkeletonGrid } from './SkeletonCard';
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
  hasSearched?: boolean;
}

function BusinessGrid({ businesses, loading, error, onSelect, competitors, selectMode, selectedIds, onToggleSelect, hasSearched }: Props) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 px-1">
          <div className="flex gap-1.5">
            {[1,2,3].map((i) => (
              <span key={i} className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <p className="text-gray-500 text-sm animate-pulse">Scanning Google Maps…</p>
        </div>
        <SkeletonGrid count={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="w-16 h-16 bg-red-500/15 rounded-2xl flex items-center justify-center">
          <SearchX className="w-7 h-7 text-red-400" />
        </div>
        <div>
          <p className="text-red-400 font-bold text-base">Search failed</p>
          <p className="text-gray-500 text-sm mt-1 max-w-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!hasSearched) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
        <div className="w-20 h-20 rounded-3xl bg-purple-600/15 border border-purple-500/20 flex items-center justify-center text-4xl">
          🎯
        </div>
        <div>
          <p className="text-white font-bold text-lg">Find your next client</p>
          <p className="text-gray-500 text-sm mt-1 max-w-xs leading-relaxed">
            Search any business type in any city — we'll surface every one with no website.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-xs text-gray-600 max-w-xs">
          {['🍽️ Restaurants in Lagos', '💇 Salons in Accra', '⚖️ Law firms in Nairobi'].map((ex) => (
            <div key={ex} className="bg-white/4 border border-white/8 rounded-xl px-4 py-2">{ex}</div>
          ))}
        </div>
      </div>
    );
  }

  if (businesses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center text-3xl">
          🔍
        </div>
        <div>
          <p className="text-gray-300 font-bold">No results found</p>
          <p className="text-gray-600 text-sm mt-1 max-w-xs leading-relaxed">
            Try a broader search term, a different area, or remove active filters.
          </p>
        </div>
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

export default memo(BusinessGrid);
