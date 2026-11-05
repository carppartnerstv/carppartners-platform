import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView, VideoAirPlayButton } from 'expo-video';
import { useEventListener } from 'expo';
import * as ScreenOrientation from 'expo-screen-orientation';
import GoogleCast, { CastButton, CastState, useCastState, useRemoteMediaClient } from 'react-native-google-cast';
import {
  IconChevronLeft,
  IconPlayerPlayFilled,
  IconPlayerPauseFilled,
  IconRewindBackward10,
  IconRewindForward10,
  IconVolume,
  IconVolume2,
  IconVolumeOff,
  IconGauge,
  IconCheck,
  IconSettings,
  IconCast,
} from '@tabler/icons-react-native';
import type { Video as VideoType, NextEpisode, VideoQuality, Series } from '@carp-partners/api-client';
import { colors, textStyles, spacing } from '../../../theme';
import { Spinner } from '../../../components/ui';
import { apiClient } from '../../../lib/apiClient';
import { formatClock } from '../../../lib/format';

const PROGRESS_INTERVAL_MS = 15_000;
const SPEEDS_SORTED = [0.5, 1, 1.25, 1.5, 2];
const AUTOPLAY_THRESHOLD = 0.6; // aparece la tarjeta de "siguiente" a partir del 60% reproducido
// expo-video no manda timeUpdate si este valor es 0 (por defecto) — cada
// 0.25s es suficiente para que la barra de progreso se vea fluida sin
// saturar de eventos.
const TIME_UPDATE_INTERVAL_SEC = 0.25;

export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const positionRef = useRef(0);

  const [video, setVideo] = useState<VideoType | null>(null);
  const [allSeries, setAllSeries] = useState<Series[]>([]);
  const [nextEpisode, setNextEpisode] = useState<NextEpisode | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [qualities, setQualities] = useState<VideoQuality[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<VideoQuality | null>(null); // null = Auto (HLS adaptativo)
  const [startAtMs, setStartAtMs] = useState(0);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [error, setError] = useState('');

  const [playerReady, setPlayerReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [progressBarWidth, setProgressBarWidth] = useState(0);
  const [autoplayDismissed, setAutoplayDismissed] = useState(false);
  const [speedPopupOpen, setSpeedPopupOpen] = useState(false);
  const [qualityPopupOpen, setQualityPopupOpen] = useState(false);

  // Player de expo-video — se crea una sola vez (sin fuente todavía, se
  // asigna con player.replace() en cuanto streamUrl esté listo, más abajo).
  // No usamos el `source` del propio hook porque streamUrl llega async, y
  // reemplazar explícitamente nos da control total sobre cuándo arrancar
  // la reproducción y a qué posición.
  const player = useVideoPlayer(null, (p) => {
    p.timeUpdateEventInterval = TIME_UPDATE_INTERVAL_SEC;
  });

  // Chromecast — igual que en la web: el dispositivo de cast decodifica el
  // HLS él solo, así que el player local se pausa mientras se está emitiendo.
  const castClient = useRemoteMediaClient();
  const castState = useCastState();
  const casting = castState === CastState.CONNECTED;

  useEffect(() => {
    if (!castClient || !streamUrl || !video) return;
    castClient.loadMedia({
      mediaInfo: {
        contentUrl: streamUrl,
        contentType: 'application/x-mpegurl',
        metadata: { type: 'movie', title: video.title },
      },
      startTime: positionRef.current / 1000,
      autoplay: true,
    }).catch(() => null);
    player.pause();
    // Solo nos interesa en el momento en que se conecta una sesión de cast
    // (castClient pasa de null a un cliente real), no en cada cambio de
    // streamUrl/video por separado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [castClient]);

  const stopCasting = () => {
    GoogleCast.sessionManager.endCurrentSession(true).catch(() => null);
  };

  // Pantalla completa en horizontal mientras se reproduce — forzada de
  // entrada (no es una opción: nadie ve un vídeo con el móvil en vertical),
  // sin depender de girar físicamente el teléfono ni del bloqueo de
  // orientación del sistema.
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => null);
    RNStatusBar.setHidden(true, 'fade');
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => null);
      RNStatusBar.setHidden(false, 'fade');
    };
  }, []);

  // Carga metadatos + URL de streaming
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadingMeta(true);
    setError('');
    setAutoplayDismissed(false);

    async function load() {
      try {
        const [{ video }, { series }, { items: history }, { hlsUrl, qualities }, { next }] = await Promise.all([
          apiClient.getVideo(id),
          apiClient.getSeries(),
          apiClient.getContinueWatching(),
          apiClient.getVideoStream(id),
          apiClient.getNextEpisode(id).catch(() => ({ next: null })),
        ]);
        if (cancelled) return;
        const resumeSec = history.find((i) => i.id === id)?.progress_sec ?? 0;
        setVideo(video);
        setAllSeries(series);
        setNextEpisode(next);
        setStartAtMs(resumeSec * 1000);
        setStreamUrl(hlsUrl);
        setQualities(qualities);
        setSelectedQuality(null);
      } catch {
        if (!cancelled) setError('No se pudo cargar el vídeo.');
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  // En cuanto hay URL de streaming, se asigna al player ya creado y arranca
  // desde donde se había quedado (si la había).
  useEffect(() => {
    if (!streamUrl) return;
    player.replace({ uri: streamUrl, contentType: 'hls' });
    if (startAtMs > 0) player.currentTime = startAtMs / 1000;
    player.play();
    // startAtMs no va en las dependencias a propósito: solo nos interesa en
    // el momento en que streamUrl cambia (misma carga), no si por lo que
    // sea se recalculase después sin cambiar de vídeo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamUrl, player]);

  const saveProgress = useCallback((completed = false) => {
    if (!video) return;
    apiClient.saveProgress(video.id, Math.floor(positionRef.current / 1000), completed).catch(() => null);
  }, [video]);

  useEffect(() => {
    if (!playerReady || !video) return;
    progressTimer.current = setInterval(() => saveProgress(), PROGRESS_INTERVAL_MS);
    return () => { if (progressTimer.current) clearInterval(progressTimer.current); };
  }, [playerReady, video, saveProgress]);

  useEffect(() => () => { saveProgress(); }, [saveProgress]);

  const registerActivity = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
  }, []);

  useEffect(() => {
    if (playing) registerActivity();
    else setControlsVisible(true);
  }, [playing, registerActivity]);

  useEffect(() => {
    if (!controlsVisible) {
      setSpeedPopupOpen(false);
      setQualityPopupOpen(false);
    }
  }, [controlsVisible]);

  // --- Eventos del player (expo-video) ----------------------------------
  useEventListener(player, 'statusChange', ({ status, error: playerError }) => {
    if (status === 'error') {
      setError('Error al cargar el vídeo. Inténtalo de nuevo.');
      return;
    }
    if (status === 'readyToPlay') setPlayerReady(true);
    if (playerError) setError('Error al cargar el vídeo. Inténtalo de nuevo.');
  });

  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    setPlaying(isPlaying);
  });

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    const ms = currentTime * 1000;
    setPositionMs(ms);
    positionRef.current = ms;
    if (player.duration) setDurationMs(player.duration * 1000);
  });

  useEventListener(player, 'playToEnd', () => {
    saveProgress(true);
    if (nextEpisode && !autoplayDismissed) {
      router.replace(`/watch/${nextEpisode.id}/play`);
    }
  });

  const togglePlay = () => {
    if (playing) player.pause(); else player.play();
    registerActivity();
  };

  const seekBy = (deltaSec: number) => {
    if (!durationMs) return;
    const nextSec = Math.min(Math.max(positionMs / 1000 + deltaSec, 0), durationMs / 1000);
    player.currentTime = nextSec;
    registerActivity();
  };

  const seekToFraction = (fraction: number) => {
    if (!durationMs) return;
    player.currentTime = fraction * (durationMs / 1000);
    registerActivity();
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    player.muted = next;
    registerActivity();
  };

  const openSpeedPopup = () => {
    setQualityPopupOpen(false);
    setSpeedPopupOpen((o) => !o);
    registerActivity();
  };

  const selectSpeed = (next: number) => {
    setSpeed(next);
    player.playbackRate = next;
    setSpeedPopupOpen(false);
    registerActivity();
  };

  const openQualityPopup = () => {
    setSpeedPopupOpen(false);
    setQualityPopupOpen((o) => !o);
    registerActivity();
  };

  // Cambia de fuente manteniendo la posición y el estado de reproducción —
  // null = Auto (vuelve al HLS adaptativo), o una calidad fija (MP4
  // progressive): expo-video no puede forzar una pista dentro del HLS (ver
  // nota en vimeo.js), así que la selección manual cambia de URL entera.
  const selectQuality = (quality: VideoQuality | null) => {
    const resumeSec = positionRef.current / 1000;
    const wasPlaying = playing;
    if (quality) {
      player.replace({ uri: quality.url });
    } else if (streamUrl) {
      player.replace({ uri: streamUrl, contentType: 'hls' });
    }
    player.currentTime = resumeSec;
    if (wasPlaying) player.play();
    setSelectedQuality(quality);
    setQualityPopupOpen(false);
    registerActivity();
  };

  // volume inicial del player.
  useEffect(() => { player.volume = volume; }, [player, volume]);

  const backToDetail = () => router.replace(`/watch/${id}`);

  const videoSeries = allSeries.find((s) => s.id === video?.series_id);
  const kicker = videoSeries && video?.episode_num != null ? `${videoSeries.title} · EP ${video.episode_num}` : '';
  const progressFraction = durationMs > 0 ? positionMs / durationMs : 0;
  const showNextCard = !!nextEpisode && !autoplayDismissed && durationMs > 0 && progressFraction >= AUTOPLAY_THRESHOLD;
  const volEff = muted ? 0 : volume;

  return (
    <View style={styles.root}>
      {streamUrl && (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          nativeControls={false}
        />
      )}

      {(loadingMeta || (!playerReady && !error)) && (
        <View style={styles.centerOverlay} pointerEvents="none">
          <Spinner size="lg" />
        </View>
      )}

      {!!error && (
        <View style={styles.centerOverlay}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={backToDetail}>
            <Text style={styles.errorLink}>← Volver</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* El Chromecast decodifica el HLS él solo — mientras está conectado
          se sustituyen los controles normales por este aviso, igual que en
          la web ("Reproduciendo en tu Chromecast"). */}
      {casting && (
        <View style={styles.castingOverlay}>
          <TouchableOpacity
            onPress={backToDetail}
            style={[styles.backButton, { position: 'absolute', top: insets.top + 12, left: insets.left + spacing.lg }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <IconChevronLeft size={22} color={colors.white} />
          </TouchableOpacity>
          <IconCast size={48} color="rgba(255,255,255,0.7)" />
          <Text style={styles.castingText}>Reproduciendo en tu Chromecast</Text>
          <TouchableOpacity onPress={stopCasting} style={styles.castingStopButton}>
            <Text style={styles.castingStopText}>Dejar de emitir</Text>
          </TouchableOpacity>
        </View>
      )}

      {!error && !casting && (
        <TouchableWithoutFeedback onPress={() => (controlsVisible ? setControlsVisible(false) : registerActivity())}>
          <View style={StyleSheet.absoluteFill}>
            {controlsVisible && (
              <>
                {/* Cabecera — botón Volver + título/capítulo al lado */}
                <View style={[styles.header, { top: insets.top + 12, left: insets.left + spacing.lg, right: insets.right + spacing.lg }]}>
                  <TouchableOpacity onPress={backToDetail} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <IconChevronLeft size={22} color={colors.white} />
                  </TouchableOpacity>
                  <View style={styles.headerMeta}>
                    {!!kicker && <Text style={styles.videoKicker} numberOfLines={1}>{kicker}</Text>}
                    <Text style={styles.videoTitle} numberOfLines={1}>{video?.title}</Text>
                  </View>
                </View>

                {/* Play/pausa central */}
                <View style={styles.centerButtonWrap} pointerEvents="box-none">
                  <TouchableOpacity onPress={togglePlay} style={styles.centerButton}>
                    {playing
                      ? <IconPlayerPauseFilled size={30} color={colors.white} />
                      : <IconPlayerPlayFilled size={30} color={colors.white} style={{ marginLeft: 3 }} />}
                  </TouchableOpacity>
                </View>

                {/* Tarjeta siguiente episodio */}
                {showNextCard && nextEpisode && (
                  <TouchableOpacity
                    style={styles.nextCard}
                    activeOpacity={0.85}
                    onPress={() => { saveProgress(true); router.replace(`/watch/${nextEpisode.id}/play`); }}
                  >
                    <View style={styles.nextThumb}>
                      {nextEpisode.thumbnail_url && (
                        <Image source={{ uri: nextEpisode.thumbnail_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      )}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.nextLabel}>Siguiente</Text>
                      <Text style={styles.nextTitle} numberOfLines={1}>{nextEpisode.title}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation?.(); setAutoplayDismissed(true); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.nextDismiss}>Cancelar</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}

                {/* Controles inferiores */}
                <View
                  style={[
                    styles.bottomBar,
                    { paddingBottom: insets.bottom + spacing.md, paddingLeft: spacing['2xl'] + insets.left, paddingRight: spacing['2xl'] + insets.right },
                  ]}
                >
                  <View style={styles.progressRow}>
                    <TouchableWithoutFeedback
                      onPress={(e) => {
                        if (!progressBarWidth) return;
                        const x = e.nativeEvent.locationX;
                        seekToFraction(Math.min(Math.max(x / progressBarWidth, 0), 1));
                      }}
                    >
                      <View
                        style={styles.progressTrack}
                        onLayout={(e) => setProgressBarWidth(e.nativeEvent.layout.width)}
                      >
                        <View style={[styles.progressFill, { width: `${progressFraction * 100}%` }]} />
                        <View style={[styles.progressKnob, { left: `${progressFraction * 100}%` }]} />
                      </View>
                    </TouchableWithoutFeedback>
                    <Text style={styles.clock}>{formatClock(positionMs / 1000)} / {formatClock(durationMs / 1000)}</Text>
                  </View>

                  <View style={styles.controlsRow}>
                    <View style={styles.controlsGroup}>
                      <ControlButton icon={<IconRewindBackward10 size={22} color={colors.white} />} label="-10s" onPress={() => seekBy(-10)} />
                      <ControlButton icon={<IconRewindForward10 size={22} color={colors.white} />} label="+10s" onPress={() => seekBy(10)} />
                      <ControlButton
                        icon={volEff === 0 ? <IconVolumeOff size={22} color={colors.white} /> : volEff < 0.5 ? <IconVolume2 size={22} color={colors.white} /> : <IconVolume size={22} color={colors.white} />}
                        label="Volumen"
                        onPress={toggleMute}
                      />
                    </View>

                    <View style={styles.controlsGroup}>
                      <View>
                        {speedPopupOpen && (
                          <View style={styles.speedPopup}>
                            {SPEEDS_SORTED.map((s) => (
                              <TouchableOpacity key={s} style={styles.speedOption} onPress={() => selectSpeed(s)}>
                                <Text style={[styles.speedOptionText, s === speed && styles.speedOptionTextActive]}>{s}x</Text>
                                {s === speed && <IconCheck size={14} color={colors.brandBright} />}
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                        <ControlButton icon={<IconGauge size={22} color={colors.white} />} label={`${speed}x`} onPress={openSpeedPopup} />
                      </View>

                      {qualities.length > 0 && (
                        <View>
                          {qualityPopupOpen && (
                            <View style={styles.speedPopup}>
                              <TouchableOpacity style={styles.speedOption} onPress={() => selectQuality(null)}>
                                <Text style={[styles.speedOptionText, !selectedQuality && styles.speedOptionTextActive]}>Auto</Text>
                                {!selectedQuality && <IconCheck size={14} color={colors.brandBright} />}
                              </TouchableOpacity>
                              {qualities.map((q) => (
                                <TouchableOpacity key={q.label} style={styles.speedOption} onPress={() => selectQuality(q)}>
                                  <Text style={[styles.speedOptionText, selectedQuality?.label === q.label && styles.speedOptionTextActive]}>{q.label}</Text>
                                  {selectedQuality?.label === q.label && <IconCheck size={14} color={colors.brandBright} />}
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}
                          <ControlButton icon={<IconSettings size={22} color={colors.white} />} label={selectedQuality?.label ?? 'Auto'} onPress={openQualityPopup} />
                        </View>
                      )}

                      {/* AirPlay — nativo de iOS (AVRoutePickerView vía expo-video), igual que en la web. */}
                      {Platform.OS === 'ios' && (
                        <VideoAirPlayButton
                          style={styles.airplayButton}
                          tint="white"
                          activeTint={colors.brandBright}
                        />
                      )}

                      {/* Chromecast — mismo "Default Media Receiver" que usa la web
                          (CC1AD845), funciona tanto desde iPhone como desde Android. */}
                      {castState != null && castState !== CastState.NO_DEVICES_AVAILABLE && (
                        <CastButton style={styles.castButton} tintColor={casting ? colors.brandBright : colors.white} />
                      )}
                    </View>
                  </View>
                </View>
              </>
            )}
          </View>
        </TouchableWithoutFeedback>
      )}
    </View>
  );
}

function ControlButton({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.controlButton}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityLabel={label}
    >
      {icon}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  centerOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  errorText: { ...textStyles.body, color: colors.error, textAlign: 'center', paddingHorizontal: spacing['2xl'] },
  errorLink: { ...textStyles.labelSm, color: colors.textSecondary, marginTop: spacing.sm },
  header: {
    position: 'absolute', zIndex: 10,
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerMeta: { flexShrink: 1, minWidth: 0 },
  centerButtonWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  centerButton: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  nextCard: {
    position: 'absolute', right: spacing['2xl'], bottom: 150,
    width: 300, padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(10,16,20,0.94)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  nextThumb: { width: 72, height: 44, borderRadius: 6, backgroundColor: colors.surface, overflow: 'hidden' },
  nextLabel: { ...textStyles.bodyXs, color: colors.textMuted, marginBottom: 2 },
  nextTitle: { ...textStyles.bodySm, color: colors.textPrimary, fontFamily: 'Inter_600SemiBold' },
  nextDismiss: { ...textStyles.bodyXs, color: colors.textFaint },
  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  progressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 2, backgroundColor: colors.brandBright },
  progressKnob: {
    position: 'absolute', top: -5, width: 14, height: 14, borderRadius: 7,
    backgroundColor: colors.white, marginLeft: -7,
  },
  videoKicker: {
    fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.6,
    textTransform: 'uppercase', color: colors.brandBright,
  },
  videoTitle: { fontFamily: 'Sora_700Bold', fontSize: 15, color: colors.white, marginTop: 2 },
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  controlsGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  controlButton: { alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44 },
  airplayButton: { width: 44, height: 44 },
  castButton: { width: 44, height: 44 },
  castingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
    alignItems: 'center', justifyContent: 'center', gap: spacing.md,
  },
  castingText: { ...textStyles.body, color: colors.white, fontFamily: 'Inter_600SemiBold' },
  castingStopButton: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.sm,
    borderRadius: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  castingStopText: { ...textStyles.bodySm, color: colors.textSecondary },
  clock: { ...textStyles.bodyXs, color: colors.textFaint },
  speedPopup: {
    position: 'absolute', bottom: '100%', left: '50%',
    marginLeft: -44, marginBottom: 10,
    width: 88, borderRadius: 10,
    backgroundColor: 'rgba(10,16,20,0.96)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    paddingVertical: 4,
  },
  speedOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 9,
  },
  speedOptionText: { ...textStyles.bodySm, color: colors.textSecondary },
  speedOptionTextActive: { color: colors.brandBright, fontFamily: 'Inter_700Bold' },
});
