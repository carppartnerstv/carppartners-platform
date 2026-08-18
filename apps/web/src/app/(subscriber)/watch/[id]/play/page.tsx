'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@carp-partners/api-client';
import type { Video, RelatedVideo, Category, Series, NextEpisode } from '@carp-partners/api-client';

const PROGRESS_INTERVAL_MS = 15_000;
const SPEEDS = [1, 1.25, 1.5, 2, 0.5];
// Segundos antes del final en los que aparece la tarjeta de "Siguiente episodio"
const AUTOPLAY_LEAD_SEC = 25;

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

function levelLabel(height: number): string {
  if (height >= 2160) return '4K';
  if (height >= 1440) return '2K';
  return `${height}p`;
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

  // Siguiente episodio real (misma temporada/serie) — null si es el último
  // de la temporada/serie, o si el vídeo no tiene serie (película/suelto).
  const [nextEpisode, setNextEpisode] = useState<NextEpisode | null>(null);
  // El usuario cerró la tarjeta de autoplay para ESTE episodio — no debe
  // volver a aparecer aunque retroceda dentro de los últimos 25s.
  const [autoplayDismissed, setAutoplayDismissed] = useState(false);

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

  // ── Calidad de vídeo (niveles HLS reales de este vídeo) ──────────────────────
  // Solo existen cuando hls.js está realmente decodificando vía Media Source
  // (Managed o no) — en reproducción HLS nativa (ver comentario en Efecto 2)
  // no hay ninguna API para leer ni forzar niveles, así que esto se queda
  // vacío y el selector no se muestra.
  const [qualityLevels, setQualityLevels] = useState<{ index: number; height: number; bitrate: number }[]>([]);
  const [rawLevelHeights, setRawLevelHeights] = useState<number[]>([]);
  const [selectedLevel, setSelectedLevel] = useState(-1); // -1 = Automática
  const [activeLevel, setActiveLevel] = useState(-1); // nivel que se está reproduciendo AHORA (informativo en Auto)
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);

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
    setAutoplayDismissed(false); // vídeo nuevo: la tarjeta puede volver a aparecer
    setQualityLevels([]);
    setRawLevelHeights([]);
    setSelectedLevel(-1);
    setActiveLevel(-1);
    setQualityMenuOpen(false);

    async function load() {
      try {
        const [{ video, related }, { items: history }, { hlsUrl }, { categories }, { series: allSeries }, { next }] =
          await Promise.all([
            apiClient.getVideo(id),
            apiClient.getContinueWatching(),
            apiClient.getVideoStream(id),
            apiClient.getCategories(),
            apiClient.getSeries(),
            apiClient.getNextEpisode(id).catch(() => ({ next: null })), // fail-soft: sin autoplay si falla
          ]);

        if (cancelled) return;

        const resume = history.find((i) => i.id === id)?.progress_sec ?? 0;

        setVideo(video);
        setRelated(related);
        setCategories(categories);
        setSeries(allSeries);
        setNextEpisode(next);
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

      // Hls.isSupported() exige Media Source Extensions (o, desde hls.js
      // 1.5+, Managed Media Source — la versión reducida que Apple añadió en
      // iOS/iPadOS 17.1 y que SOLO funciona en contexto seguro, es decir
      // https:// — nunca sobre http://192.168.x.x en local). Solo por esta
      // vía hls.js controla de verdad los niveles de calidad: es la única
      // rama donde tiene sentido ofrecer el selector.
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true });
        hlsRef.current = hls;

        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) setError('Error al cargar el vídeo. Inténtalo de nuevo.');
        });

        hls.loadSource(url);
        hls.attachMedia(videoEl);
        hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
          if (destroyed) return;
          videoEl.currentTime = startAt;
          videoEl.play().catch(() => null);
          setPlayerReady(true);

          // Calidades reales de ESTE vídeo — nunca una lista fija. Varios
          // niveles pueden compartir altura con distinto bitrate (poco
          // habitual en Vimeo, pero posible); nos quedamos con el de mayor
          // bitrate de cada altura para no repetir "1080p" dos veces. Se
          // guarda también la lista SIN deduplicar (rawLevelHeights) para
          // poder traducir el índice que reporta LEVEL_SWITCHED aunque no
          // sea uno de los "elegibles" (p. ej. si el ABR pasa brevemente por
          // un nivel que quedó fuera del deduplicado).
          const byHeight = new Map<number, { index: number; height: number; bitrate: number }>();
          data.levels.forEach((lvl, i) => {
            if (!lvl.height) return;
            const existing = byHeight.get(lvl.height);
            if (!existing || lvl.bitrate > existing.bitrate) {
              byHeight.set(lvl.height, { index: i, height: lvl.height, bitrate: lvl.bitrate });
            }
          });
          setQualityLevels(Array.from(byHeight.values()).sort((a, b) => b.height - a.height));
          setRawLevelHeights(data.levels.map((lvl) => lvl.height));
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
          if (destroyed) return;
          setActiveLevel(data.level);
        });
      } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        // HLS nativo del propio <video> (Safari de escritorio siempre lo
        // evita porque sí soporta MSE; en iOS/iPadOS es la única vía por
        // debajo de 17.1, o en 17.1+ sobre http:// sin TLS). El navegador
        // decodifica y adapta la calidad él solo, dentro de su motor nativo
        // — no existe ninguna API pública para leer ni forzar el nivel, así
        // que qualityLevels se queda vacío y el selector no se pinta.
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

  // Safari en iOS no implementa requestFullscreen() en elementos normales
  // (solo <video> tiene su propio método nativo aparte) — llamarlo ahí
  // lanzaba un TypeError sin hacer nada. Se detecta el soporte real una vez
  // al montar y, si no existe, se oculta el botón en vez de dejarlo roto.
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  useEffect(() => {
    setFullscreenSupported(typeof document.documentElement.requestFullscreen === 'function');
  }, []);

  // ── Móvil en vertical: "gira" el reproductor a horizontal por CSS ───────────
  // No dependemos de la Screen Orientation API (screen.orientation.lock)
  // porque en la mayoría de navegadores móviles solo funciona dentro de un
  // elemento en Fullscreen API real, y ese permiso requiere un gesto de
  // usuario "fresco" que ya se ha perdido al llegar aquí tras la navegación
  // — por eso el truco fiable (funciona en iOS Safari incluido) es rotar el
  // contenedor 90° con CSS cuando el viewport sigue en vertical. Si el
  // usuario gira el móvil de verdad, el listener detecta el cambio de
  // orientación y desactiva la rotación (el navegador ya da un landscape real).
  const [forceRotate, setForceRotate] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px) and (orientation: portrait)');
    const update = () => setForceRotate(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Además, intento de mejora progresiva: en los navegadores que sí soportan
  // bloquear la orientación (Chrome/Android) lo pedimos también — si falla
  // (Safari, sin fullscreen activo, etc.) no pasa nada, ya tenemos el CSS.
  useEffect(() => {
    if (!forceRotate) return;
    const orientation = screen.orientation as (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined;
    orientation?.lock?.('landscape')?.catch(() => null);
    return () => { orientation?.unlock?.(); };
  }, [forceRotate]);

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

  const handleEnded = () => {
    if (video) saveProgress(video.id, true);
    // Autoplay del siguiente episodio: red de seguridad además de la cuenta
    // atrás (si por lo que sea no llegó a mostrarse, esto igualmente salta).
    if (nextEpisode && !autoplayDismissed) {
      router.replace(`/watch/${nextEpisode.id}/play`);
    }
  };

  // Salta ya al siguiente episodio (botón de la tarjeta de autoplay).
  const skipToNext = () => {
    if (!video || !nextEpisode) return;
    saveProgress(video.id, true);
    router.replace(`/watch/${nextEpisode.id}/play`);
  };

  // ── Controles ─────────────────────────────────────────────────────────────────
  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => null); else el.pause();
  };

  // Icono play/pausa en el centro — solo en escritorio (en móvil se quitó a
  // petición). Se deriva del estado real `playing` (no de quién llamó a
  // togglePlay), así que se mantiene correcto pase lo que pase — reanudar
  // el autoplay del siguiente episodio, perder el foco de la pestaña, etc.
  // En pausa se queda visible de forma persistente (invita a reanudar); al
  // reanudar hace un breve destello de confirmación y desaparece.
  const [playFlash, setPlayFlash] = useState<'play' | 'pause' | null>(null);
  const playFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!playerReady) return;
    if (playFlashTimerRef.current) { clearTimeout(playFlashTimerRef.current); playFlashTimerRef.current = null; }

    if (playing) {
      setPlayFlash('pause');
      playFlashTimerRef.current = setTimeout(() => setPlayFlash(null), 500);
    } else {
      setPlayFlash('play');
    }

    return () => { if (playFlashTimerRef.current) clearTimeout(playFlashTimerRef.current); };
  }, [playing, playerReady]);

  // Con forceRotate, todo el reproductor (incluida esta barra) está girado
  // 90° por CSS — su caja de "left/width" en pantalla pasa a ser vertical
  // (angosta y alta), así que la fracción hay que leerla en el eje Y, no en
  // X. Sin esto, arrastrar sobre la barra no hacía nada útil y, al no haber
  // ningún handler de touchmove, el navegador interpretaba el gesto como un
  // scroll normal de página (de ahí que "avanzar la línea de tiempo" se
  // sintiera como si la página entera se desplazara).
  const fractionFromPoint = useCallback(
    (clientX: number, clientY: number, el: Element) => {
      const rect = el.getBoundingClientRect();
      if (forceRotate) {
        return Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
      }
      return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    },
    [forceRotate],
  );

  const handleScrubStart = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = videoRef.current;
    if (!el || !duration) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const f = fractionFromPoint(e.clientX, e.clientY, e.currentTarget);
    el.currentTime = f * duration;
    setCurrentTime(el.currentTime);
  };

  const handleScrubMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = videoRef.current;
    // e.buttons === 0 en pointermove sin el botón/dedo pulsado (o tras un
    // pointerup que no disparó pointercancel a tiempo) — evita "seguir
    // arrastrando" por accidente.
    if (!el || !duration || e.buttons === 0) return;
    const f = fractionFromPoint(e.clientX, e.clientY, e.currentTarget);
    el.currentTime = f * duration;
    setCurrentTime(el.currentTime);
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

  const handleVolumeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = videoRef.current;
    if (!el) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const f = fractionFromPoint(e.clientX, e.clientY, e.currentTarget);
    el.volume = f;
    el.muted = false;
  };

  const handleVolumeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = videoRef.current;
    if (!el || e.buttons === 0) return;
    const f = fractionFromPoint(e.clientX, e.clientY, e.currentTarget);
    el.volume = f;
    el.muted = false;
  };

  // ── Doble toque en el vídeo: retrocede/avanza 10s (mitad izquierda/derecha
  // en local, no en pantalla — con forceRotate eso puede ser arriba/abajo
  // físicamente, pero es "izquierda" en el mismo sentido que el scrubber:
  // el lado del botón de retroceder). Un solo toque sigue siendo play/pausa,
  // pero se retrasa DOUBLE_TAP_MS para poder cancelarlo si llega un segundo
  // toque a tiempo — mismo patrón que YouTube/Netflix. ────────────────────────
  const DOUBLE_TAP_MS = 300;
  const lastTapRef = useRef<{ time: number; side: 'left' | 'right' } | null>(null);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [seekFlash, setSeekFlash] = useState<'left' | 'right' | null>(null);

  const handleVideoAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const side: 'left' | 'right' = fractionFromPoint(e.clientX, e.clientY, e.currentTarget) < 0.5 ? 'left' : 'right';
    const now = Date.now();
    const last = lastTapRef.current;

    if (last && last.side === side && now - last.time < DOUBLE_TAP_MS) {
      if (singleTapTimerRef.current) { clearTimeout(singleTapTimerRef.current); singleTapTimerRef.current = null; }
      lastTapRef.current = null;
      if (side === 'left') rewind(); else forward();
      setSeekFlash(side);
      setTimeout(() => setSeekFlash((s) => (s === side ? null : s)), 500);
      return;
    }

    lastTapRef.current = { time: now, side };
    singleTapTimerRef.current = setTimeout(() => {
      togglePlay();
      singleTapTimerRef.current = null;
      lastTapRef.current = null;
    }, DOUBLE_TAP_MS);
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
      playerSectionRef.current?.requestFullscreen?.().catch(() => null);
    }
  };

  // levelIndex: -1 = Automática (vuelve al ABR de hls.js), o el índice real
  // del nivel dentro de hls.levels. Asignar currentLevel fuerza el cambio de
  // inmediato (puede causar un pequeño corte mientras carga el nuevo
  // fragmento) y se queda fijo ahí hasta que el usuario lo cambie o cargue
  // otro vídeo — hls.js no lo revierte solo.
  const selectQuality = (levelIndex: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = levelIndex;
    setSelectedLevel(levelIndex);
    setQualityMenuOpen(false);
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

  // Tarjeta "A continuación" antigua (basada en related[0]: no filtra por
  // episode_num mayor que el actual, solo coge el más bajo de la temporada/
  // categoría) — SOLO tiene sentido para contenido sin estructura de
  // episodios (películas, vídeos sueltos). Para cualquier vídeo con
  // series_id + episode_num, la fuente fiable es nextEpisode: si es null
  // (último episodio) no se muestra nada, nunca esta tarjeta como
  // respaldo — si no, en el último episodio "sugeriría" volver al primero.
  const isEpisodic = !!video?.series_id && video?.episode_num != null;
  const nextVideo = related[0] ?? null;
  const showNextCard = !isEpisodic && duration > 0 && currentTime > duration * 0.6 && !!nextVideo;

  // Autoplay del siguiente episodio real — cuenta atrás en los últimos
  // AUTOPLAY_LEAD_SEC segundos, solo si hay uno y no se ha cancelado.
  const remainingSec = duration > 0 ? duration - currentTime : Infinity;
  const showAutoplayCard =
    !!nextEpisode && !autoplayDismissed && remainingSec <= AUTOPLAY_LEAD_SEC && remainingSec > 0;
  const autoplayCountdown = Math.max(0, Math.ceil(remainingSec));
  const autoplayRingFraction = Math.min(1, Math.max(0, remainingSec / AUTOPLAY_LEAD_SEC));
  const volEff = muted ? 0 : volume;
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={playerSectionRef}
      className={`fixed z-[60] bg-black flex flex-col ${forceRotate ? '' : 'inset-0'}`}
      style={
        forceRotate
          ? {
              cursor: controlsVisible ? 'default' : 'none',
              top: '50%',
              left: '50%',
              // dvh/dvw (no vh/vw): en Safari/Chrome móvil, "100vh" mide el
              // alto máximo del viewport como si la barra de direcciones
              // estuviera oculta, así que la caja rotada salía más grande
              // que el área visible real y recortaba el borde donde caen el
              // círculo del scrubber y el botón de pantalla completa. Los
              // -16px dejan además un margen de 8px por cada lado.
              width: 'calc(100dvh - 16px)',
              height: 'calc(100dvw - 16px)',
              transform: 'translate(-50%, -50%) rotate(90deg)',
              transformOrigin: 'center center',
            }
          : { cursor: controlsVisible ? 'default' : 'none' }
      }
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
            className={`relative z-10 flex items-center gap-3 sm:gap-4 px-5 sm:px-8 py-4 sm:py-6 transition-opacity duration-300 ease-out ${
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

          {/* Espaciador central — sin botón de play/pausa (se quitó a
              petición). Un toque alterna play/pausa; doble toque en la mitad
              izquierda/derecha retrocede/avanza 10s, como en YouTube/Netflix.
              Se mantiene el div para que el header y la barra de controles
              sigan anclados arriba/abajo con flex-col. */}
          <div className="relative z-10 flex-1" onClick={handleVideoAreaClick}>
            {playFlash && (
              <div className="hidden md:flex absolute inset-0 items-center justify-center pointer-events-none">
                <div
                  className="w-[76px] h-[76px] rounded-full flex items-center justify-center"
                  style={{
                    // Mismo estilo que el botón "Volver" de la cabecera: fondo
                    // blanco muy tenue + línea blanca fina de 1px alrededor.
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    // "pause" = destello transitorio al reanudar → se desvanece.
                    // "play" = en pausa, persistente → SIN animación, si no
                    // seekFlashFade lo deja en opacity:0 a los 0.5s pase lo
                    // que pase (era justo el bug: se quedaba invisible aunque
                    // el estado de React siguiera diciendo que había que
                    // mostrarlo).
                    ...(playFlash === 'pause' ? { animation: 'seekFlashFade 0.5s ease-out forwards' } : {}),
                  }}
                >
                  <i
                    className={`ti ti-${playFlash === 'play' ? 'player-play-filled' : 'player-pause-filled'} text-[34px] text-white`}
                    style={{ marginLeft: playFlash === 'play' ? 4 : 0 }}
                  />
                </div>
              </div>
            )}
            {seekFlash && (
              <div
                className={`absolute top-0 bottom-0 w-1/2 flex items-center pointer-events-none ${
                  seekFlash === 'left' ? 'left-0 justify-start pl-[10%]' : 'right-0 justify-end pr-[10%]'
                }`}
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.4)', animation: 'seekFlashFade 0.5s ease-out forwards' }}
                >
                  <i className={`ti ti-rewind-${seekFlash === 'left' ? 'backward' : 'forward'}-10 text-[30px] text-white`} />
                </div>
              </div>
            )}
          </div>

          {/* Tarjeta de autoplay del siguiente episodio real — cuenta atrás,
              salta sola al llegar a 0 (vía handleEnded) salvo que se cancele */}
          {showAutoplayCard && nextEpisode && (
            <div
              className="absolute right-8 z-10 w-[320px] p-4 rounded-xl flex items-start gap-3"
              style={{
                bottom: 128,
                background: 'rgba(10,16,20,0.94)',
                border: '1px solid rgba(255,255,255,0.14)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div className="flex-none w-11 h-11 relative">
                <svg viewBox="0 0 36 36" className="w-11 h-11 -rotate-90">
                  <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="16" fill="none" stroke="#cf4a35" strokeWidth="3"
                    strokeDasharray={2 * Math.PI * 16}
                    strokeDashoffset={2 * Math.PI * 16 * (1 - autoplayRingFraction)}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.3s linear' }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-white text-[12px] font-semibold tabular-nums">
                  {autoplayCountdown}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] mb-1" style={{ color: '#85958e' }}>Siguiente episodio</div>
                <div className="text-[13.5px] font-semibold leading-snug" style={{ color: '#eef3f0' }}>
                  T{nextEpisode.season_num ?? 1} · E{nextEpisode.episode_num} · {nextEpisode.title}
                </div>
                <div className="flex gap-2 mt-2.5">
                  <button
                    onClick={skipToNext}
                    className="px-3 py-1.5 rounded-md text-[12px] font-semibold text-white transition-opacity hover:opacity-85"
                    style={{ background: '#68140b' }}
                  >
                    Reproducir ya
                  </button>
                  <button
                    onClick={() => setAutoplayDismissed(true)}
                    className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors text-white/60 hover:text-white"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

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
            className={`relative z-10 px-5 sm:px-8 pb-4 sm:pb-[26px] transition-opacity duration-300 ease-out ${
              controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            {/* Scrubber — pointer events (no onClick) para poder arrastrar,
                y touchAction:none para que el navegador no interprete el
                gesto como scroll de la página. */}
            <div
              onPointerDown={handleScrubStart}
              onPointerMove={handleScrubMove}
              className="relative h-[6px] rounded-[4px] cursor-pointer mb-4"
              style={{ background: 'rgba(255,255,255,0.22)', touchAction: 'none' }}
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

            <div className="flex items-center gap-2.5 sm:gap-5 text-white">
              <button onClick={togglePlay} aria-label={playing ? 'Pausar' : 'Reproducir'} className="hover:opacity-80">
                <i className={`ti ti-${playing ? 'player-pause-filled' : 'player-play-filled'} text-[26px] sm:text-[30px]`} />
              </button>
              <button onClick={rewind} aria-label="Retroceder 10s" className="hover:opacity-80">
                <i className="ti ti-rewind-backward-10 text-[21px] sm:text-[25px]" />
              </button>
              <button onClick={forward} aria-label="Avanzar 10s" className="hover:opacity-80">
                <i className="ti ti-rewind-forward-10 text-[21px] sm:text-[25px]" />
              </button>

              <div className="flex items-center gap-[7px] sm:gap-[9px]">
                <button onClick={toggleMute} aria-label={volEff === 0 ? 'Activar sonido' : 'Silenciar'}>
                  <i className={`ti ti-${volEff === 0 ? 'volume-off' : volEff < 0.5 ? 'volume-2' : 'volume'} text-[21px] sm:text-[24px]`} />
                </button>
                <div
                  onPointerDown={handleVolumeStart}
                  onPointerMove={handleVolumeMove}
                  className="relative w-[52px] sm:w-[84px] h-[5px] rounded-[3px] cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.25)', touchAction: 'none' }}
                >
                  <div className="absolute left-0 top-0 h-full rounded-[3px] bg-white" style={{ width: `${volEff * 100}%` }} />
                </div>
              </div>

              <div className="text-[12px] sm:text-[13px] tabular-nums" style={{ color: '#dfe7e3', letterSpacing: '0.02em' }}>
                {fmt(currentTime)} <span style={{ color: '#7d8d86' }}>/ {fmt(duration)}</span>
              </div>

              <div className="flex-1" />

              <button
                onClick={cycleSpeed}
                className="text-[12px] sm:text-[13.5px] font-semibold px-2 sm:px-[11px] py-[5px] rounded-[7px] min-w-[42px] sm:min-w-[52px] text-center hover:bg-white/10"
                style={{ border: '1px solid rgba(255,255,255,0.25)' }}
              >
                {speed}x
              </button>
              {/* Selector de calidad — solo si hay niveles HLS reales que
                  leer (ver Efecto 2): en reproducción HLS nativa (Safari/
                  Chrome de iOS por debajo de 17.1, o 17.1+ sin https://) no
                  hay ninguna API para forzar la calidad, así que no tiene
                  sentido ofrecer un botón que no podría hacer nada. */}
              {qualityLevels.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setQualityMenuOpen((v) => !v)}
                    aria-label="Calidad de vídeo"
                    className="hover:opacity-80"
                  >
                    <i className="ti ti-settings text-[21px] sm:text-[24px]" />
                  </button>
                  {qualityMenuOpen && (
                    <>
                      <div onClick={() => setQualityMenuOpen(false)} className="fixed inset-0 z-[70]" />
                      <div
                        className="absolute z-[71] overflow-hidden"
                        style={{
                          bottom: 'calc(100% + 10px)', right: 0, minWidth: 168,
                          background: '#0e151a', border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 11, boxShadow: '0 18px 44px rgba(0,0,0,0.55)',
                        }}
                      >
                        <button
                          onClick={() => selectQuality(-1)}
                          className="w-full flex items-center justify-between gap-3 px-4 py-[11px] text-[13px] text-left whitespace-nowrap"
                          style={{
                            fontWeight: selectedLevel === -1 ? 700 : 500,
                            color: selectedLevel === -1 ? '#fff' : '#c4d0cb',
                            background: selectedLevel === -1 ? 'rgba(104,20,11,0.14)' : 'transparent',
                          }}
                        >
                          <span>
                            Automática
                            {selectedLevel === -1 && activeLevel >= 0 && rawLevelHeights[activeLevel]
                              ? ` · ${levelLabel(rawLevelHeights[activeLevel])}`
                              : ''}
                          </span>
                          {selectedLevel === -1 && <i className="ti ti-check text-[15px]" />}
                        </button>
                        {qualityLevels.map((lvl) => (
                          <button
                            key={lvl.index}
                            onClick={() => selectQuality(lvl.index)}
                            className="w-full flex items-center justify-between gap-3 px-4 py-[11px] text-[13px] text-left whitespace-nowrap"
                            style={{
                              fontWeight: selectedLevel === lvl.index ? 700 : 500,
                              color: selectedLevel === lvl.index ? '#fff' : '#c4d0cb',
                              background: selectedLevel === lvl.index ? 'rgba(104,20,11,0.14)' : 'transparent',
                            }}
                          >
                            <span>{levelLabel(lvl.height)}</span>
                            {selectedLevel === lvl.index && <i className="ti ti-check text-[15px]" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              {/* Oculto mientras forceRotate está activo: pedir fullscreen
                  real sobre un elemento que ya tiene nuestro
                  transform:rotate(90deg) hace que el navegador (confirmado
                  en Chrome/Android) reajuste esa caja para el fullscreen y
                  se pierda la rotación — son dos mecanismos compitiendo por
                  el mismo elemento. Sin forceRotate (desktop, o el móvil ya
                  girado físicamente a horizontal) no hay transform con el
                  que competir y funciona con normalidad. */}
              {fullscreenSupported && !forceRotate && (
                <button onClick={toggleFullscreen} aria-label="Pantalla completa" className="hover:opacity-80">
                  <i className={`ti ti-${fullscreen ? 'minimize' : 'maximize'} text-[21px] sm:text-[24px]`} />
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
