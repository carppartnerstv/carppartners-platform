'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient, ApiError } from '@carp-partners/api-client';
import type { Video } from '@carp-partners/api-client';
import { VideoCard } from '@carp-partners/ui';

const PROGRESS_INTERVAL_MS = 15_000;

export default function WatchPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<import('hls.js').default | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [video, setVideo] = useState<Video | null>(null);
  const [related, setRelated] = useState<Video[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [error, setError] = useState('');

  // La URL HLS y el punto de inicio se guardan en estado
  // para que el segundo useEffect los reciba una vez el <video> ya está en el DOM
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [startAt, setStartAt] = useState(0);
  const [playerReady, setPlayerReady] = useState(false);

  // ── Guarda progreso ──────────────────────────────────────────────────────────
  const saveProgress = useCallback((videoId: string, completed = false) => {
    const el = videoRef.current;
    if (!el || isNaN(el.currentTime)) return;
    apiClient.saveProgress(videoId, Math.floor(el.currentTime), completed).catch(() => null);
  }, []);

  // ── Efecto 1: carga metadatos + obtiene URL HLS ──────────────────────────────
  // No toca el <video> — solo actualiza estado para que React renderice el elemento
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      try {
        const [{ video, related }, { items: history }, { hlsUrl }] = await Promise.all([
          apiClient.getVideo(id),
          apiClient.getContinueWatching(),
          apiClient.getVideoStream(id),
        ]);

        if (cancelled) return;

        const resume = history.find((i) => i.id === id)?.progress_sec ?? 0;

        setVideo(video);
        setRelated(related);
        setStartAt(resume);
        setStreamUrl(hlsUrl); // ← esto dispara el Efecto 2
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          if (err.code === 'SUBSCRIPTION_REQUIRED') { router.replace('/?planes=1'); return; }
          setError(err.message);
        } else {
          setError('No se pudo cargar el vídeo.');
        }
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id, router]);

  // ── Efecto 2: inicializa HLS.js cuando <video> ya está en el DOM ─────────────
  // Se dispara tras el render que sigue al setStreamUrl del Efecto 1
  useEffect(() => {
    if (!streamUrl) return;
    const url = streamUrl;
    const el = videoRef.current;
    if (!el) return;
    const videoEl = el; // variable no-nullable para el closure async

    let destroyed = false;

    async function initHls() {
      const Hls = (await import('hls.js')).default;

      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true });
        hlsRef.current = hls;

        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) setError('Error al cargar el vídeo. Inténtalo de nuevo.');
        });

        hls.loadSource(url);
        hls.attachMedia(videoEl);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (destroyed) return;
          videoEl.currentTime = startAt;
          videoEl.play().catch(() => null);
          setPlayerReady(true);
        });
      } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari: HLS nativo
        videoEl.src = url;
        videoEl.currentTime = startAt;
        videoEl.play().catch(() => null);
        setPlayerReady(true);
      } else {
        setError('Tu navegador no soporta reproducción HLS.');
      }
    }

    initHls();

    return () => {
      destroyed = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [streamUrl, startAt]);

  // ── Timer de progreso cada 15 s ──────────────────────────────────────────────
  useEffect(() => {
    if (!playerReady || !video) return;
    progressTimerRef.current = setInterval(() => saveProgress(video.id), PROGRESS_INTERVAL_MS);
    return () => { if (progressTimerRef.current) clearInterval(progressTimerRef.current); };
  }, [playerReady, video, saveProgress]);

  // ── Al desmontar: guarda progreso ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (video) saveProgress(video.id);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [video, saveProgress]);

  const handleEnded = () => { if (video) saveProgress(video.id, true); };

  // ── UI ───────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-red-400 text-lg">{error}</p>
        <button onClick={() => router.back()} className="text-white/60 hover:text-white text-sm underline">
          ← Volver
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* ── Reproductor — siempre en el DOM para que videoRef esté disponible ── */}
      <div className="relative w-full bg-black" style={{ aspectRatio: '16/9', maxHeight: '90vh' }}>

        {/* Spinner encima del video mientras carga */}
        {(loadingMeta || (!playerReady && !error)) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
            <svg className="animate-spin w-10 h-10 text-brand" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        <video
          ref={videoRef}
          className="w-full h-full"
          controls
          playsInline
          onEnded={handleEnded}
        />

        <Link
          href="/home"
          className="absolute top-4 left-4 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors z-20"
          aria-label="Volver al inicio"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
      </div>

      {/* ── Info ── */}
      {!loadingMeta && video && (
        <div className="px-6 md:px-12 py-8 max-w-4xl">
          {video.episode_num != null && (
            <p className="text-brand text-xs font-semibold uppercase tracking-widest mb-1">
              Episodio {video.episode_num}
            </p>
          )}
          <h1 className="text-white text-2xl md:text-3xl font-bold mb-3">{video.title}</h1>
          {video.description && (
            <p className="text-white/60 text-sm leading-relaxed max-w-2xl">{video.description}</p>
          )}
        </div>
      )}

      {/* ── Relacionados ── */}
      {!loadingMeta && related.length > 0 && (
        <div className="px-6 md:px-12 pb-16">
          <h2 className="text-white text-xl font-bold mb-4">Relacionados</h2>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
            {related.map((v) => (
              <VideoCard key={v.id} video={v} onClick={(v) => router.push(`/watch/${v.id}`)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
