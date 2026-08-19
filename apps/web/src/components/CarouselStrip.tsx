'use client';

import React from 'react';
import { usePublicCarousel } from '@/components/Carousel';

// Tira de fotos a sangre completa (100% del ancho de la pantalla), cada una
// recortada en vertical 2:3 — pensada para carrousels de fotografías del
// equipo/ambiente, no para el hero (que usa el <Carousel> genérico, 16:9,
// una imagen a la vez con crossfade). Si el carrousel no existe o no tiene
// imágenes, no renderiza nada.
export function CarouselStrip({ slug }: { slug: string }) {
  const { images } = usePublicCarousel(slug);
  if (images.length === 0) return null;

  return (
    <section className="w-full overflow-x-auto scrollbar-hide">
      <div className="flex gap-[2px]">
        {images.map((img) => (
          <div key={img.id} className="relative flex-shrink-0 w-[46%] sm:w-[32%] md:w-[24%] lg:w-[19%] aspect-[2/3]">
            <img src={img.image_url} alt={img.alt_text ?? ''} className="absolute inset-0 w-full h-full object-cover" />
          </div>
        ))}
      </div>
    </section>
  );
}
