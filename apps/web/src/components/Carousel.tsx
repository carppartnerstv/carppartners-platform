'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@carp-partners/api-client';
import type { CarouselImage } from '@carp-partners/api-client';

/** Carga pública (sin sesión) de un carrousel por slug — hero de la landing, shortcode [carrousel:slug]. */
export function usePublicCarousel(slug: string) {
  const [images, setImages]   = useState<CarouselImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient.getPublicCarousel(slug)
      .then(({ carousel }) => { if (!cancelled) setImages(carousel.images); })
      .catch(() => { /* slug sin carrousel o error de red: se renderiza vacío */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  return { images, loading };
}

// Carrousel genérico embebible (shortcode [carrousel:slug] en el contenido de
// una página) — crossfade cada 6s con puntos de navegación, igual que el hero
// de la landing. Si el slug no existe o no tiene imágenes, no renderiza nada.
export function Carousel({ slug }: { slug: string }) {
  const { images } = usePublicCarousel(slug);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (images.length < 2) return;
    const id = setInterval(() => setActive(s => (s + 1) % images.length), 6000);
    return () => clearInterval(id);
  }, [images.length]);

  if (images.length === 0) return null;

  return (
    <div className="relative w-full rounded-[14px] overflow-hidden my-6" style={{ aspectRatio: '16/9' }}>
      {images.map((img, i) => (
        <img
          key={img.id}
          src={img.image_url}
          alt={img.alt_text ?? ''}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: active === i ? 1 : 0, transition: 'opacity 1.4s ease' }}
        />
      ))}
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActive(i)}
              aria-label={`Mostrar imagen ${i + 1}`}
              className="p-0 border-none cursor-pointer"
              style={{
                width: active === i ? 22 : 12,
                height: 4,
                borderRadius: 2,
                background: active === i ? '#cf4a35' : 'rgba(255,255,255,0.5)',
                transition: 'all .3s',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
