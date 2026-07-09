'use client';

import React, { useRef } from 'react';
import type { Series } from '@carp-partners/api-client';
import { SeriesCard } from './SeriesCard';

export interface SeriesRowProps {
  title: string;
  items: Series[];
  onItemClick?: (series: Series) => void;
}

export function SeriesRow({ title, items, onItemClick }: SeriesRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'right' ? 640 : -640, behavior: 'smooth' });
  };

  if (!items.length) return null;

  return (
    <section className="mb-9">
      <div className="flex items-center justify-between mb-3 px-0">
        <h2 className="font-display text-[19px] font-semibold text-white tracking-[-0.01em]">
          {title}
        </h2>
      </div>

      <div className="relative group/row">
        <ChevronButton dir="left" onClick={() => scroll('left')} />

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-1"
        >
          {items.map((s) => (
            <div key={s.id} className="flex-shrink-0 w-[300px]">
              <SeriesCard series={s} onClick={onItemClick} />
            </div>
          ))}
          <div className="flex-shrink-0 w-2" />
        </div>

        <ChevronButton dir="right" onClick={() => scroll('right')} />
      </div>
    </section>
  );
}

function ChevronButton({ dir, onClick }: { dir: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={dir === 'left' ? 'Anterior' : 'Siguiente'}
      className={[
        'absolute top-0 bottom-6 z-10 w-14',
        dir === 'left' ? 'left-0 bg-gradient-to-r' : 'right-0 bg-gradient-to-l',
        'from-surface to-transparent',
        'hidden md:flex items-center justify-center',
        'opacity-0 group-hover/row:opacity-100 transition-opacity duration-200',
      ].join(' ')}
    >
      <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {dir === 'left' ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          )}
        </svg>
      </div>
    </button>
  );
}
