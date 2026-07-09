'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@carp-partners/api-client';
import type { Video, RelatedVideo, Category, Series } from '@carp-partners/api-client';

const PROGRESS_INTERVAL_MS = 15_000;
const SPEEDS = [1, 1.25, 1.5, 2, 0.5];

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

export default function PlayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerSectionRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<import('hls.js').default | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [video, setVideo] = useState<Video | null>(null);
  const [related, setRelated] = useState<RelatedVideo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [error, setError] = useState('');

  // La URL HLS y el punto de inicio se guardan en estado
  // para que el segundo useEffect los reciba una vez el <video> ya está en el DOM
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [startAt, setStartAt] = useState(0);
  const [playerReady, setPlayerReady] = useState(false);

  // ── Estado de controles del reproductor ──────────────────────────────────────
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playingRef = useRef(playing);

  // ── Guarda progreso ──────────────────────────────────────────────────────────
  const saveProgress = useCallback((videoId: string, completed = false) => {
    const el = videoRef.current;
    if (!el || isNaN(el.currentTime)) return;
    apiClient
      .saveProgress(videoId, Math.floor(el.currentTime), completed)
      // No interrumpimos la reproducción si falla, pero lo dejamos visible en
      // consola — antes se silenciaba del todo y era imposible depurarlo.
      .catch((err) => console.error('[watch-history] No se pudo guardar el progreso', err));
  }, []);

  // ── Efecto 1: carga metadatos + obtiene URL HLS ──────────────────────────────
  // No toca el <video> — solo actualiza estado para que React renderice el elemento
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setPlayerReady(false);
    setError('');

    async function load() {
      try {
        const [{ video, related }, { items: history }, { hlsUrl }, { categories }, { series: allSeries }] =
          await Promise.all([
            apiClient.getVideo(id),
            apiClient.getContinueWatching(),
            apiClient.getVideoStream(id),
            apiClient.getCategories(),
            apiClient.getSeries(),
          ]);

        if (cancelled) return;

        const resume = history.find((i) => i.id === id)?.progress_sec ?? 0;

        setVideo(video);
        setRelated(related);
        setCategories(categories);
        setSeries(allSeries);
        setStartAt(resume);
        setDuration(video.duration_sec || 0);
        setStreamUrl(hlsUrl); // ← esto dispara el Efecto 2
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          if (err.code === 'SUBSCRIPTION_REQUIRED') { router.replace('/planes'); return; }
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

  // ── Eventos nativos del <video> → estado de los controles custom ────────────
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTimeUpdate = () => setCurrentTime(el.currentTime);
    const onLoadedMeta = () => { if (el.duration && isFinite(el.duration)) setDuration(el.duration); };
    const onVolumeChange = () => { setVolume(el.volume); setMuted(el.muted); };

    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('loadedmetadata', onLoadedMeta);
    el.addEventListener('volumechange', onVolumeChange);

    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('loadedmetadata', onLoadedMeta);
      el.removeEventListener('volumechange', onVolumeChange);
    };
  }, []);

  // ── Fullscreen ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onFsChange = () => setFullscreen(document.fullscreenElement === playerSectionRef.current);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ── Auto-ocultar controles tras 3s de inactividad (solo en reproducción) ────
  useEffect(() => { playingRef.current = playing; }, [playing]);

  const registerActivity = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (playingRef.current) {
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
    }
  }, []);

  // Cualquier movimiento de ratón, toque o tecla reinicia el temporizador
  useEffect(() => {
    window.addEventListener('mousemove', registerActivity);
    window.addEventListener('mousedown', registerActivity);
    window.addEventListener('touchstart', registerActivity);
    window.addEventListener('keydown', registerActivity);
    return () => {
      window.removeEventListener('mousemove', registerActivity);
      window.removeEventListener('mousedown', registerActivity);
      window.removeEventListener('touchstart', registerActivity);
      window.removeEventListener('keydown', registerActivity);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [registerActivity]);

  // Al pausar: controles siempre visibles. Al reanudar: arranca la cuenta atrás.
  useEffect(() => {
    registerActivity();
  }, [playing, registerActivity]);

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

  // ── Controles ─────────────────────────────────────────────────────────────────
  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => null); else el.pause();
  };

  const seekToFraction = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = videoRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = f * duration;
  };

  const rewind = () => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, el.currentTime - 10);
  };

  const forward = () => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = Math.min(duration, el.currentTime + 10);
  };

  const setVolumeFraction = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = videoRef.current;
    if (!el) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.volume = f;
    el.muted = false;
  };

  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
  };

  const cycleSpeed = () => {
    const el = videoRef.current;
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (el) el.playbackRate = next;
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => null);
    } else {
      playerSectionRef.current?.requestFullscreen().catch(() => null);
    }
  };

  // El reproductor se alcanza de dos formas distintas: reemplazando el detalle
  // (botón "Reproducir"/"Reanudar") o saltando aquí directamente desde una
  // tarjeta de "Continuar viendo" (sin pasar por el detalle). En ambos casos
  // "volver" debe llevar siempre al detalle de ESTE vídeo — por eso navegamos
  // explícitamente en vez de usar router.back(), que dependería de por dónde
  // se llegó. Usamos replace (no push) para no apilar detalle+reproductor y
  // que, a su vez, el propio botón de volver del detalle no rebote aquí.
  const backToDetail = () => router.replace(`/watch/${id}`);

  // ── Metadatos para la cabecera ────────────────────────────────────────────────
  const videoCategory = video ? categories.find((c) => c.id === video.category_id) : undefined;
  const videoSeries = video ? series.find((s) => s.id === video.series_id) : undefined;
  const kicker = video
    ? videoSeries
      ? `${videoSeries.title}${video.episode_num != null ? ` · Ep ${video.episode_num}` : ''}`
      : videoCategory?.name ?? ''
    : '';

  const nextVideo = related[0] ?? null;
  const showNextCard = duration > 0 && currentTime > duration * 0.6 && !!nextVideo;
  const volEff = muted ? 0 : volume;
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={playerSectionRef}
      className="fixed inset-0 z-[60] bg-black flex flex-col"
      style={{ cursor: controlsVisible ? 'default' : 'none' }}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-contain"
        playsInline
        onEnded={handleEnded}
        onClick={togglePlay}
      />

      {/* Viñeta radial + degradado superior/inferior */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(80% 80% at 50% 42%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 100%)' }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.85) 100%)',
        }}
      />

      {/* Spinner mientras carga */}
      {(loadingMeta || (!playerReady && !error)) && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <svg className="animate-spin w-10 h-10 text-brand" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center z-10">
          <p className="text-red-400 text-lg">{error}</p>
          <button onClick={backToDetail} className="text-white/60 hover:text-white text-sm underline">
            ← Volver
          </button>
        </div>
      )}

      {!error && (
        <>
          {/* Cabecera superior */}
          <div
            className={`relative z-10 flex items-center gap-4 px-8 py-6 transition-opacity duration-300 ease-out ${
              controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <button
              onClick={backToDetail}
              aria-label="Volver al detalle"
              className="w-11 h-11 rounded-full flex items-center justify-center text-white transition-colors"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)' }}
            >
              <i className="ti ti-arrow-left text-[22px]" />
            </button>
            <div>
              {kicker && (
                <div className="text-[12px] uppercase tracking-[0.06em]" style={{ color: '#9aa9a3' }}>
                  {kicker}
                </div>
              )}
              <div className="font-display text-[18px] font-semibold text-white mt-0.5">
                {video?.title}
              </div>
            </div>
          </div>

          {/* Botón central play/pausa */}
          <div className="relative z-10 flex-1 flex items-center justify-center">
            <button
              onClick={togglePlay}
              aria-label={playing ? 'Pausar' : 'Reproducir'}
              className="w-[88px] h-[88px] rounded-full flex items-center justify-center transition-transform hover:scale-[1.07]"
              style={{
                background: 'rgba(0,0,0,0.35)',
                border: '1.5px solid rgba(255,255,255,0.5)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <i
                className={`ti ti-${playing ? 'player-pause-filled' : 'player-play-filled'} text-[42px] text-white`}
                style={{ marginLeft: playing ? 0 : 4 }}
              />
            </button>
          </div>

          {/* Tarjeta "A continuación" — continúa la reproducción sin pasar por el detalle */}
          {showNextCard && nextVideo && (
            <div
              onClick={() => router.replace(`/watch/${nextVideo.id}/play`)}
              className="absolute right-8 z-10 w-[300px] p-3.5 rounded-xl cursor-pointer flex items-center gap-3"
              style={{
                bottom: 128,
                background: 'rgba(10,16,20,0.9)',
                border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div className="flex-none w-[92px] h-[52px] rounded-[7px] bg-surface-raised overflow-hidden relative">
                {nextVideo.thumbnail_url && (
                  <img src={nextVideo.thumbnail_url} alt="" className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <i className="ti ti-player-play-filled text-[18px] text-white" />
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[11px] mb-[3px]" style={{ color: '#85958e' }}>A continuación</div>
                <div className="text-[13.5px] font-semibold truncate" style={{ color: '#eef3f0' }}>
                  {nextVideo.title}
                </div>
              </div>
            </div>
          )}

          {/* Barra de controles inferior */}
          <div
            className={`relative z-10 px-8 pb-[26px] transition-opacity duration-300 ease-out ${
              controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            {/* Scrubber */}
            <div
              onClick={seekToFraction}
              className="relative h-[6px] rounded-[4px] cursor-pointer mb-4"
              style={{ background: 'rgba(255,255,255,0.22)' }}
            >
              <div
                className="absolute left-0 top-0 h-full rounded-[4px] bg-brand-bright"
                style={{ width: `${progressPct}%` }}
              />
              <div
                className="absolute top-1/2 w-[14px] h-[14px] rounded-full bg-white"
                style={{ left: `${progressPct}%`, transform: 'translate(-50%,-50%)', boxShadow: '0 1px 6px rgba(0,0,0,0.5)' }}
              />
            </div>

            <div className="flex items-center gap-5 text-white">
              <button onClick={togglePlay} aria-label={playing ? 'Pausar' : 'Reproducir'} className="hover:opacity-80">
                <i className={`ti ti-${playing ? 'player-pause-filled' : 'player-play-filled'} text-[30px]`} />
              </button>
              <button onClick={rewind} aria-label="Retroceder 10s" className="hover:opacity-80">
                <i className="ti ti-rewind-backward-10 text-[25px]" />
              </button>
              <button onClick={forward} aria-label="Avanzar 10s" className="hover:opacity-80">
                <i className="ti ti-rewind-forward-10 text-[25px]" />
              </button>

              <div className="flex items-center gap-[9px]">
                <button onClick={toggleMute} aria-label={volEff === 0 ? 'Activar sonido' : 'Silenciar'}>
                  <i className={`ti ti-${volEff === 0 ? 'volume-off' : volEff < 0.5 ? 'volume-2' : 'volume'} text-[24px]`} />
                </button>
                <div
                  onClick={setVolumeFraction}
                  className="relative w-[84px] h-[5px] rounded-[3px] cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.25)' }}
                >
                  <div className="absolute left-0 top-0 h-full rounded-[3px] bg-white" style={{ width: `${volEff * 100}%` }} />
                </div>
              </div>

              <div className="text-[13px] tabular-nums" style={{ color: '#dfe7e3', letterSpacing: '0.02em' }}>
                {fmt(currentTime)} <span style={{ color: '#7d8d86' }}>/ {fmt(duration)}</span>
              </div>

              <div className="flex-1" />

              <button
                onClick={cycleSpeed}
                className="text-[13.5px] font-semibold px-[11px] py-[5px] rounded-[7px] min-w-[52px] text-center hover:bg-white/10"
                style={{ border: '1px solid rgba(255,255,255,0.25)' }}
              >
                {speed}x
              </button>
              <button aria-label="Ajustes" className="hover:opacity-80">
                <i className="ti ti-settings text-[24px]" />
              </button>
              <button onClick={toggleFullscreen} aria-label="Pantalla completa" className="hover:opacity-80">
                <i className={`ti ti-${fullscreen ? 'minimize' : 'maximize'} text-[24px]`} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
