'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@carp-partners/api-client';
import type { CrewMember, Video } from '@carp-partners/api-client';
import { VideoRow } from '@carp-partners/ui';

const ROLE_LABELS: Record<string, string> = {
  socio: 'Socio',
  crew: 'Miembro de la crew',
};

const BIO_WORD_THRESHOLD = 55;

function wordCount(html: string): number {
  const plain = html.replace(/<[^>]+>/g, ' ');
  return plain.trim().split(/\s+/).filter(Boolean).length;
}

export default function CrewMemberPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();

  const [member, setMember] = useState<CrewMember | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bioExpanded, setBioExpanded] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setError('');

    async function load() {
      try {
        const { crew } = await apiClient.getCrew();
        const found = crew.find((c) => c.slug === slug) ?? null;
        if (cancelled) return;
        if (!found) {
          setError('No se encontró este miembro.');
          setLoading(false);
          return;
        }
        setMember(found);

        const { videos } = await apiClient.getVideos({ crew: slug, limit: 50 });
        if (cancelled) return;
        setVideos(videos);
      } catch {
        if (!cancelled) setError('No se pudo cargar el perfil.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slug]);

  const bioIsLong = useMemo(() => (member?.bio ? wordCount(member.bio) > BIO_WORD_THRESHOLD : false), [member]);

  if (error) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-red-400 text-lg">{error}</p>
        <button onClick={() => router.back()} className="text-white/60 hover:text-white text-sm underline">
          ← Volver
        </button>
      </div>
    );
  }

  if (loading || !member) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <svg className="animate-spin w-10 h-10 text-brand" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* ── Cabecera — mismo patrón que /serie/[id] y /watch/[id]: imagen a
          sangre + degradados + Volver + título superpuesto abajo a la
          izquierda. Por ahora usa la misma foto que la de perfil
          (member.avatar_url); si el resultado visual convence, más adelante
          se añadirá una portada independiente (ver comentario del usuario). */}
      <section className="relative w-full h-[42vh] min-h-[320px] max-h-[420px] md:h-[54vh] md:min-h-[380px] md:max-h-[600px]">
        {member.avatar_url ? (
          <img src={member.avatar_url} alt="" className="absolute inset-0 w-full h-full object-cover" aria-hidden />
        ) : (
          <div className="absolute inset-0 bg-surface-raised" />
        )}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(90deg, rgba(6,9,12,0.9) 0%, rgba(6,9,12,0.4) 45%, rgba(6,9,12,0) 75%)' }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(0deg, #06090c 1%, rgba(6,9,12,0.1) 40%, rgba(6,9,12,0) 60%)' }}
        />

        <button
          onClick={() => router.back()}
          className="absolute top-6 left-6 md:left-12 inline-flex items-center gap-2 px-4 py-[9px] rounded-[9px] text-[13.5px] font-medium z-10"
          style={{ background: 'rgba(6,9,12,0.55)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(6px)', color: '#e9efeb' }}
        >
          <i className="ti ti-arrow-left text-[18px]" />
          Volver
        </button>

        <div className="absolute left-6 md:left-12 z-10 bottom-[2.5vh] md:bottom-[3.5vh]" style={{ maxWidth: 620 }}>
          <div className="text-[12.5px] font-semibold uppercase tracking-[0.1em] mb-3 text-brand-bright">
            {ROLE_LABELS[member.role] ?? member.role}
          </div>
          <h1 className="font-display font-extrabold text-white text-[32px] md:text-[50px] leading-[1.05] tracking-[-0.02em] mb-4 break-words">
            {member.name}
          </h1>
          <div className="flex items-center gap-[10px] flex-wrap text-[13px]" style={{ color: '#c4d0cb' }}>
            <span>{videos.length} vídeo{videos.length === 1 ? '' : 's'}</span>
          </div>
        </div>
      </section>

      {/* Biografía — mismas clases que la sinopsis de la ficha de vídeo
          (px-6 md:px-12 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8
          lg:gap-12 max-w-[1180px]) para que la columna 1fr mida exactamente
          lo mismo en cualquier ancho de pantalla. */}
      {member.bio && (
        <div className="px-6 md:px-12 pt-2 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 lg:gap-12 max-w-[1180px] mb-10">
          <div>
            {/* .rich-editor .ProseMirror trae su propio font-size/line-height/color
                (pensados para el editor de admin) — el style inline de aquí los
                sobreescribe para que el texto se vea exactamente igual que la
                sinopsis del vídeo (text-[16px] leading-[1.7], color #cdd6d2). */}
            <div className={`rich-editor ${!bioExpanded && bioIsLong ? 'line-clamp-4' : ''}`}>
              <div
                className="ProseMirror"
                style={{ fontSize: 16, lineHeight: 1.7, color: '#cdd6d2' }}
                dangerouslySetInnerHTML={{ __html: member.bio }}
              />
            </div>
            {bioIsLong && (
              <button
                onClick={() => setBioExpanded((e) => !e)}
                className="mt-2.5 text-[13px] font-semibold hover:underline"
                style={{ color: '#cf4a35' }}
              >
                {bioExpanded ? 'Leer menos' : 'Leer más'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Vídeos con {nombre} — mismo carrusel horizontal que en Home */}
      {videos.length > 0 && (
        <div className="px-6 md:px-12 pt-6 pb-16">
          <VideoRow
            title={`Vídeos con ${member.name}`}
            videos={videos}
            onVideoClick={(v) => router.push(`/watch/${v.id}`)}
          />
        </div>
      )}
    </div>
  );
}
