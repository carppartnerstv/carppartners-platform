import React from 'react';

// Descripciones/bio pueden venir como HTML enriquecido (Tiptap) — un editor
// "vacío" a veces guarda algo como "<p></p>"; quitamos las etiquetas antes de
// comprobar si hay texto real.
export function hasContent(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.replace(/<[^>]*>/g, '').trim().length > 0;
}

// Icono ✓ / ✕ compacto para columnas de listado tipo "¿tiene X relleno?"
// (descripción de vídeo/serie, bio de crew…).
export function ContentIndicator({ filled, labelFilled, labelEmpty }: {
  filled: boolean;
  labelFilled: string;
  labelEmpty: string;
}) {
  return filled ? (
    <span title={labelFilled}>
      <svg className="w-4 h-4 inline-block text-[#3e9d6b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </span>
  ) : (
    <span title={labelEmpty}>
      <svg className="w-4 h-4 inline-block text-admin-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </span>
  );
}
