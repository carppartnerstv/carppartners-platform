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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Video, ResizeMode, type AVPlaybackStatus } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
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
} from '@tabler/icons-react-native';
import type { Video as VideoType, NextEpisode } from '@carp-partners/api-client';
import { colors, textStyles, spacing } from '../../../theme';
import { Spinner } from '../../../components/ui';
import { apiClient } from '../../../lib/apiClient';
import { formatClock } from '../../../lib/format';

const PROGRESS_INTERVAL_MS = 15_000;
const SPEEDS = [1, 1.25, 1.5, 2, 0.5];
const AUTOPLAY_THRESHOLD = 0.6; // aparece la tarjeta de "siguiente" a partir del 60% reproducido

export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const videoRef = useRef<Video>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const positionRef = useRef(0);

  const [video, setVideo] = useState<VideoType | null>(null);
  const [nextEpisode, setNextEpisode] = useState<NextEpisode | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
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

  // Pantalla completa en horizontal mientras se reproduce.
  useEffect(() => {
    ScreenOrientation.unlockAsync().catch(() => null);
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
        const [{ video }, { items: history }, { hlsUrl }, { next }] = await Promise.all([
          apiClient.getVideo(id),
          apiClient.getContinueWatching(),
          apiClient.getVideoStream(id),
          apiClient.getNextEpisode(id).catch(() => ({ next: null })),
        ]);
        if (cancelled) return;
        const resumeSec = history.find((i) => i.id === id)?.progress_sec ?? 0;
        setVideo(video);
        setNextEpisode(next);
        setStartAtMs(resumeSec * 1000);
        setStreamUrl(hlsUrl);
      } catch {
        if (!cancelled) setError('No se pudo cargar el vídeo.');
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

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

  const onStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) setError('Error al cargar el vídeo. Inténtalo de nuevo.');
      return;
    }
    setPlayerReady(true);
    setPlaying(status.isPlaying);
    setPositionMs(status.positionMillis);
    positionRef.current = status.positionMillis;
    if (status.durationMillis) setDurationMs(status.durationMillis);

    if (status.didJustFinish) {
      saveProgress(true);
      if (nextEpisode && !autoplayDismissed) {
        router.replace(`/watch/${nextEpisode.id}/play`);
      }
    }
  }, [nextEpisode, autoplayDismissed, saveProgress, router]);

  const togglePlay = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) await v.pauseAsync(); else await v.playAsync();
    registerActivity();
  };

  const seekBy = async (deltaSec: number) => {
    const v = videoRef.current;
    if (!v || !durationMs) return;
    const next = Math.min(Math.max(positionMs + deltaSec * 1000, 0), durationMs);
    await v.setPositionAsync(next);
    registerActivity();
  };

  const seekToFraction = async (fraction: number) => {
    const v = videoRef.current;
    if (!v || !durationMs) return;
    await v.setPositionAsync(fraction * durationMs);
    registerActivity();
  };

  const toggleMute = async () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    setMuted(next);
    await v.setIsMutedAsync(next);
    registerActivity();
  };

  const cycleSpeed = async () => {
    const v = videoRef.current;
    if (!v) return;
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    await v.setRateAsync(next, true);
    registerActivity();
  };

  const backToDetail = () => router.replace(`/watch/${id}`);

  const kicker = video?.series_id && video.episode_num != null ? `Episodio ${video.episode_num}` : '';
  const progressFraction = durationMs > 0 ? positionMs / durationMs : 0;
  const showNextCard = !!nextEpisode && !autoplayDismissed && durationMs > 0 && progressFraction >= AUTOPLAY_THRESHOLD;
  const volEff = muted ? 0 : volume;

  return (
    <View style={styles.root}>
      {streamUrl && (
        <Video
          ref={videoRef}
          source={{ uri: streamUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          positionMillis={startAtMs}
          volume={volume}
          isMuted={muted}
          rate={speed}
          useNativeControls={false}
          onPlaybackStatusUpdate={onStatusUpdate}
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

      {!error && (
        <TouchableWithoutFeedback onPress={() => (controlsVisible ? setControlsVisible(false) : registerActivity())}>
          <View style={StyleSheet.absoluteFill}>
            {controlsVisible && (
              <>
                {/* Cabecera */}
                <View style={styles.header}>
                  <TouchableOpacity onPress={backToDetail} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <IconChevronLeft size={22} color={colors.white} />
                  </TouchableOpacity>
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
                <View style={styles.bottomBar}>
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
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={styles.videoTitle} numberOfLines={1}>{video?.title}</Text>
                    {!!kicker && <Text style={styles.videoKicker}>{kicker}</Text>}
                  </View>

                  <View style={styles.controlsRow}>
                    <ControlButton icon={<IconRewindBackward10 size={22} color={colors.textSecondary} />} label="-10s" onPress={() => seekBy(-10)} />
                    <ControlButton icon={<IconGauge size={22} color={colors.textSecondary} />} label={`${speed}x`} onPress={cycleSpeed} />
                    <ControlButton
                      icon={volEff === 0 ? <IconVolumeOff size={22} color={colors.textSecondary} /> : volEff < 0.5 ? <IconVolume2 size={22} color={colors.textSecondary} /> : <IconVolume size={22} color={colors.textSecondary} />}
                      label="Volumen"
                      onPress={toggleMute}
                    />
                    <ControlButton icon={<IconRewindForward10 size={22} color={colors.textSecondary} />} label="+10s" onPress={() => seekBy(10)} />
                  </View>

                  <Text style={styles.clock}>{formatClock(positionMs / 1000)} / {formatClock(durationMs / 1000)}</Text>
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
    <TouchableOpacity onPress={onPress} style={styles.controlButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      {icon}
      <Text style={styles.controlLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  centerOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  errorText: { ...textStyles.body, color: colors.error, textAlign: 'center', paddingHorizontal: spacing['2xl'] },
  errorLink: { ...textStyles.labelSm, color: colors.textSecondary, marginTop: spacing.sm },
  header: {
    position: 'absolute', top: Platform.OS === 'ios' ? 50 : 26, left: spacing.lg, zIndex: 10,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  centerButtonWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
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
    paddingHorizontal: spacing['2xl'], paddingBottom: spacing['2xl'],
  },
  progressRow: { marginBottom: spacing.md },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  progressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 2, backgroundColor: colors.brandBright },
  progressKnob: {
    position: 'absolute', top: -5, width: 14, height: 14, borderRadius: 7,
    backgroundColor: colors.white, marginLeft: -7,
  },
  metaRow: { marginBottom: spacing.md },
  videoTitle: { fontFamily: 'Sora_700Bold', fontSize: 16, color: colors.white },
  videoKicker: { ...textStyles.bodyXs, color: colors.textMuted, marginTop: 2 },
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  controlButton: { alignItems: 'center', gap: 4, minWidth: 44, minHeight: 44, justifyContent: 'center' },
  controlLabel: { ...textStyles.bodyXs, color: colors.textSecondary },
  clock: { ...textStyles.bodyXs, color: colors.textFaint, marginTop: spacing.sm, textAlign: 'right' },
});
