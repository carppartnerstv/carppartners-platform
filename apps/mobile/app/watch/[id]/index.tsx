import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  IconArrowLeft,
  IconPlayerPlayFilled,
  IconCheck,
  IconPlus,
  IconThumbUp,
  IconThumbUpFilled,
} from '@tabler/icons-react-native';
import type { Video, RelatedVideo } from '@carp-partners/api-client';
import { ApiError } from '@carp-partners/api-client';
import { colors, textStyles, spacing, radii } from '../../../theme';
import { Spinner, CardGrid, CastRow, RatingSheet } from '../../../components/ui';
import type { VideoCardItem, RatingValue } from '../../../components/ui';
import { apiClient } from '../../../lib/apiClient';
import { formatDurationLong } from '../../../lib/format';

const RATING_TO_VALUE: Record<number, RatingValue> = { [-1]: 'down', 1: 'like', 2: 'love' };
const VALUE_TO_RATING: Record<RatingValue, -1 | 1 | 2> = { down: -1, like: 1, love: 2 };

export default function VideoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [video, setVideo] = useState<Video | null>(null);
  const [related, setRelated] = useState<RelatedVideo[]>([]);
  const [seasonEpisodes, setSeasonEpisodes] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  const [inList, setInList] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [rating, setRating] = useState<RatingValue | null>(null);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [resumeProgress, setResumeProgress] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const [{ video, related }, { items: watchlist }, { rating: myRating }, { items: continueItems }] =
          await Promise.all([
            apiClient.getVideo(id),
            apiClient.getWatchlist(),
            apiClient.getVideoRating(id),
            apiClient.getContinueWatching(),
          ]);
        if (cancelled) return;
        setVideo(video);
        setRelated(related);
        setInList(watchlist.some((i) => i.id === id));
        setRating(myRating != null ? RATING_TO_VALUE[myRating] : null);
        setResumeProgress(continueItems.find((i) => i.id === id)?.progress_sec ?? null);

        if (video.series_id) {
          const { videos } = await apiClient.getVideos({ series: video.series_id, limit: 100 });
          if (!cancelled) setSeasonEpisodes(videos);
        } else {
          setSeasonEpisodes([]);
        }
      } catch (err) {
        if (err instanceof ApiError && err.code === 'SUBSCRIPTION_REQUIRED') {
          // Sin pantalla de planes en la app todavía.
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  const toggleList = useCallback(async () => {
    if (!video || listLoading) return;
    setListLoading(true);
    try {
      if (inList) {
        await apiClient.removeFromWatchlist(video.id);
        setInList(false);
      } else {
        await apiClient.addToWatchlist(video.id);
        setInList(true);
      }
    } catch {
      /* deja el estado como estaba, sin toasts en esta primera versión */
    } finally {
      setListLoading(false);
    }
  }, [video, inList, listLoading]);

  const handleRatingChange = useCallback(async (value: RatingValue | null) => {
    if (!video) return;
    const previous = rating;
    setRating(value); // optimista
    try {
      if (value === null) await apiClient.deleteVideoRating(video.id);
      else await apiClient.rateVideo(video.id, VALUE_TO_RATING[value]);
    } catch {
      setRating(previous);
    }
  }, [video, rating]);

  if (loading || !video) {
    return (
      <SafeAreaView style={styles.safe}>
        <Spinner centered />
      </SafeAreaView>
    );
  }

  const relatedCards: VideoCardItem[] = related.map((r) => ({
    id: r.id,
    title: r.title,
    thumbnail_url: r.thumbnail_url,
    metaLabel: r.duration_sec > 0 ? formatDurationLong(r.duration_sec) : undefined,
    episodeLabel: r.episode_num != null ? `EP. ${r.episode_num}` : undefined,
  }));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {video.thumbnail_url ? (
            <Image source={{ uri: video.thumbnail_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />
          )}
          <LinearGradient
            colors={[colors.scrimNone, colors.scrimHalf, colors.scrimFull]}
            locations={[0.2, 0.6, 1]}
            style={StyleSheet.absoluteFill}
          />
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <IconArrowLeft size={18} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.playCircle}
            onPress={() => router.push(`/watch/${video.id}/play`)}
            activeOpacity={0.85}
          >
            <IconPlayerPlayFilled size={26} color={colors.textInverse} style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {video.episode_num != null && (
            <Text style={styles.kicker}>EPISODIO {video.episode_num}</Text>
          )}
          <Text style={styles.title}>{video.title}</Text>
          <Text style={styles.duration}>{formatDurationLong(video.duration_sec)}</Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.playButton}
              onPress={() => router.push(`/watch/${video.id}/play`)}
              activeOpacity={0.85}
            >
              <IconPlayerPlayFilled size={16} color={colors.white} />
              <Text style={styles.playButtonText}>{resumeProgress ? 'Reanudar' : 'Reproducir'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={toggleList} disabled={listLoading} activeOpacity={0.8}>
              {inList
                ? <IconCheck size={18} color={colors.brandBright} />
                : <IconPlus size={18} color={colors.white} />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => setRatingOpen(true)} activeOpacity={0.8}>
              {rating
                ? <IconThumbUpFilled size={18} color={colors.brandBright} />
                : <IconThumbUp size={18} color={colors.textSecondary} />}
            </TouchableOpacity>
          </View>

          {video.description && <Text style={styles.synopsis}>{video.description}</Text>}

          {seasonEpisodes.length > 1 && (
            <View style={styles.episodesSection}>
              <Text style={styles.sectionTitle}>Episodios</Text>
              <View style={{ gap: spacing.md }}>
                {seasonEpisodes.map((ep) => {
                  const isCurrent = ep.id === video.id;
                  return (
                    <TouchableOpacity
                      key={ep.id}
                      style={styles.episodeRow}
                      activeOpacity={0.75}
                      onPress={() => (isCurrent ? router.push(`/watch/${ep.id}/play`) : router.push(`/watch/${ep.id}`))}
                    >
                      <Text style={[styles.episodeNum, isCurrent && { color: colors.brandBright }]}>
                        {ep.episode_num ?? '–'}
                      </Text>
                      <View style={[styles.episodeThumb, isCurrent && styles.episodeThumbActive]}>
                        {ep.thumbnail_url && <Image source={{ uri: ep.thumbnail_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
                        <View style={[styles.episodePlayIcon, isCurrent && { backgroundColor: colors.brandBright }]}>
                          <IconPlayerPlayFilled size={11} color={colors.white} />
                        </View>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={[styles.episodeTitle, isCurrent && { color: colors.brandBright, fontFamily: 'Inter_700Bold' }]}
                          numberOfLines={1}
                        >
                          {ep.title}
                        </Text>
                        <Text style={styles.episodeDur}>{formatDurationLong(ep.duration_sec)}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <CastRow crew={video.crew ?? []} onPressMember={(m) => router.push({ pathname: '/crew/[slug]', params: { slug: m.slug } })} />

          {relatedCards.length > 0 && (
            <View style={styles.relatedSection}>
              <Text style={styles.sectionTitle}>Más como esto</Text>
              <CardGrid items={relatedCards} onPress={(v) => router.push(`/watch/${v.id}`)} />
            </View>
          )}
        </View>
      </ScrollView>

      <RatingSheet
        visible={ratingOpen}
        value={rating}
        onChange={handleRatingChange}
        onClose={() => setRatingOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  hero: { aspectRatio: 4 / 3, backgroundColor: colors.surface },
  backButton: {
    position: 'absolute', top: spacing.lg, left: spacing.pagePaddingH,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(6,9,12,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  playCircle: {
    position: 'absolute', left: '50%', top: '50%',
    marginLeft: -30, marginTop: -30,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center',
  },
  content: { paddingHorizontal: spacing.pagePaddingH, paddingTop: spacing.lg, paddingBottom: spacing['4xl'] },
  kicker: { ...textStyles.kicker, color: colors.brandBright, marginBottom: 6 },
  title: {
    fontFamily: 'Sora_800ExtraBold',
    fontSize: 22, lineHeight: 27,
    color: colors.white,
    marginBottom: 10,
  },
  duration: { ...textStyles.bodySm, color: colors.textMuted, marginBottom: spacing.lg },
  actions: { flexDirection: 'row', gap: 10, marginBottom: spacing.lg },
  playButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 46, borderRadius: 9, backgroundColor: colors.brand,
  },
  playButtonText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.white },
  iconButton: {
    width: 46, height: 46, borderRadius: 9,
    backgroundColor: colors.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  synopsis: { ...textStyles.body, color: colors.textSecondary, marginBottom: spacing['2xl'] },
  sectionTitle: { ...textStyles.sectionTitle, color: colors.textPrimary, marginBottom: spacing.md },
  episodesSection: { marginBottom: spacing['2xl'] },
  episodeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  episodeNum: { fontFamily: 'Sora_700Bold', fontSize: 15, color: colors.textFaint, width: 18, textAlign: 'center' },
  episodeThumb: { width: 88, height: 52, borderRadius: 7, backgroundColor: colors.surface, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  episodeThumbActive: { borderWidth: 1.5, borderColor: colors.brandBright },
  episodePlayIcon: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.15)' },
  episodeTitle: { ...textStyles.bodySm, color: colors.textPrimary, fontFamily: 'Inter_600SemiBold' },
  episodeDur: { ...textStyles.bodyXs, color: colors.textFaint, marginTop: 2 },
  relatedSection: { marginTop: spacing.sm },
});
