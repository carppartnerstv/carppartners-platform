'use client';

import React, { useRef } from 'react';

interface AvatarUploaderProps {
  /** URL actual almacenada en la BD (puede ser null si no tiene avatar) */
  currentUrl: string | null;
  /** Data-URL de previsualización local (antes de subir) */
  pendingPreview: string | null;
  /** Iniciales para el placeholder cuando no hay imagen */
  initials: string;
  /** Estado de carga mientras se sube o elimina */
  uploading?: boolean;
  /** Se llama cuando el usuario selecciona un archivo */
  onFileSelect: (file: File) => void;
  /** Se llama cuando el usuario pulsa "Eliminar" (solo visible si hay imagen real) */
  onDelete?: () => void;
}

export function AvatarUploader({
  currentUrl,
  pendingPreview,
  initials,
  uploading = false,
  onFileSelect,
  onDelete,
}: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const displayUrl = pendingPreview ?? currentUrl;
  const hasRealAvatar = !!currentUrl && !pendingPreview;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onFileSelect(file);
    // Resetea el input para poder volver a elegir el mismo archivo
    e.target.value = '';
  };

  return (
    <div className="flex items-center gap-4">
      {/* Previsualización */}
      <div className="relative shrink-0">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-surface-raised border border-white/12 flex items-center justify-center">
          {displayUrl ? (
            <img src={displayUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-white/30 text-lg font-bold select-none">{initials}</span>
          )}
        </div>
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
            <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md
                     border border-white/15 text-white/70 hover:text-white hover:border-white/30
                     disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          {displayUrl ? 'Reemplazar' : 'Subir imagen'}
        </button>

        {hasRealAvatar && onDelete && (
          <button
            type="button"
            disabled={uploading}
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md
                       text-red-400/70 hover:text-red-400 hover:bg-red-500/10
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Eliminar
          </button>
        )}

        <p className="text-white/25 text-[10px]">JPG, PNG o WebP · máx. 5 MB</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
