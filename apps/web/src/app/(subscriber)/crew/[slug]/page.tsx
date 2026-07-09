'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@carp-partners/api-client';
import type { CrewMember, Video } from '@carp-partners/api-client';
import { VideoCard } from '@carp-partners/ui';

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

  const initials = member.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  // Misma estructura sección-por-sección que la ficha de vídeo: el padding
  // horizontal (px-6 md:px-12) va en CADA sección, no en un wrapper exterior
  // — así el grid [1fr 300px] max-w-[1180px] de la bio mide exactamente
  // igual que el de la sinopsis del vídeo (si el padding estuviera en un
  // contenedor exterior distinto, el max-width se mediría desde otro punto
  // de partida y la columna 1fr saldría más ancha de lo que debería).
  return (
    <div className="min-h-screen bg-surface py-10">
      <div className="px-6 md:px-12">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-4 py-[9px] rounded-[9px] text-[13.5px] font-medium mb-8"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#e9efeb' }}
        >
          <i className="ti ti-arrow-left text-[18px]" />
          Volver
        </button>

        {/* Cabecera compacta: foto grande + nombre + insignia en una fila */}
        <div className="flex items-center gap-7 mb-8 flex-wrap">
          {member.avatar_url ? (
            <img
              src={member.avatar_url}
              alt=""
              className="w-[136px] h-[136px] rounded-full object-cover border border-white/14 shrink-0"
            />
          ) : (
            <div
              className="w-[136px] h-[136px] rounded-full flex items-center justify-center font-display font-semibold text-4xl text-white border border-white/14 shrink-0"
              style={{ background: 'linear-gradient(135deg,#5a241d,#2a1411)' }}
            >
              {initials}
            </div>
          )}
          <div>
            <h1 className="font-display font-extrabold text-white text-[38px] tracking-[-0.02em] mb-0">
              {member.name}
            </h1>
            <span className="text-[14px] font-medium" style={{ color: '#cf4a35' }}>
              {ROLE_LABELS[member.role] ?? member.role}
            </span>
          </div>
        </div>
      </div>

      {/* Biografía — mismas clases que la sinopsis de la ficha de vídeo
          (px-6 md:px-12 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8
          lg:gap-12 max-w-[1180px]) para que la columna 1fr mida exactamente
          lo mismo en cualquier ancho de pantalla. */}
      {member.bio && (
        <div className="px-6 md:px-12 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 lg:gap-12 max-w-[1180px] mb-10">
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

      {/* Vídeos con {nombre} */}
      {videos.length > 0 && (
        <div className="px-6 md:px-12">
          <h2 className="font-display text-[19px] font-semibold text-white mb-4">
            Vídeos con {member.name}
          </h2>
          <div
            className="grid gap-[24px_18px]"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(252px, 1fr))' }}
          >
            {videos.map((v) => (
              <VideoCard key={v.id} video={v} onClick={(v) => router.push(`/watch/${v.id}`)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
