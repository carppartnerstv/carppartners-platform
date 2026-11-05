import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Image, Animated, TouchableOpacity, StyleSheet, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  IconArrowLeft,
  IconPlayerPlayFilled,
  IconCheck,
  IconPlus,
  IconThumbUp,
  IconThumbUpFilled,
  IconShare2,
  IconHome,
  IconCompass,
  IconBookmark,
  IconUser,
} from '@tabler/icons-react-native';
import type { Video, RelatedVideo, Category, Series } from '@carp-partners/api-client';
import { ApiError } from '@carp-partners/api-client';
import { colors, textStyles, spacing } from '../../../theme';
import { Spinner, CastRow, RatingSheet, ReadMoreText } from '../../../components/ui';
import { AppHeader, APP_HEADER_CONTENT_HEIGHT } from '../../../components/ui/AppHeader';
import { Row } from '../../../components/ui/Row';
import type { VideoCardItem, RatingValue } from '../../../components/ui';
import { apiClient } from '../../../lib/apiClient';
import { useSession } from '../../../context/SessionContext';
import { formatDurationLong } from '../../../lib/format';

const RATING_TO_VALUE: Record<number, RatingValue> = { [-1]: 'down', 1: 'like', 2: 'love' };
const VALUE_TO_RATING: Record<RatingValue, -1 | 1 | 2> = { down: -1, like: 1, love: 2 };

const FOOTER_TABS = [
  { href: '/(tabs)', label: 'Inicio', Icon: IconHome },
  { href: '/(tabs)/explore', label: 'Explorar', Icon: IconCompass },
  { href: '/(tabs)/list', label: 'Mi Lista', Icon: IconBookmark },
  { href: '/(tabs)/profile', label: 'Perfil', Icon: IconUser },
] as const;

export default function VideoDetailScreen() {
  const { refresh } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;

  const [video, setVideo] = useState<Video | null>(null);
  const [related, setRelated] = useState<RelatedVideo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allSeries, setAllSeries] = useState<Series[]>([]);
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
        const [
          { video, related }, { categories }, { series }, { items: watchlist }, { rating: myRating }, { items: continueItems },
        ] = await Promise.all([
          apiClient.getVideo(id),
          apiClient.getCategories(),
          apiClient.getSeries(),
          apiClient.getWatchlist(),
          apiClient.getVideoRating(id),
          apiClient.getContinueWatching(),
        ]);
        if (cancelled) return;
        setVideo(video);
        setRelated(related);
        setCategories(categories);
        setAllSeries(series);
        setInList(watchlist.some((i) => i.id === id));
        setRating(myRating != null ? RATING_TO_VALUE[myRating] : null);
        setResumeProgress(continueItems.find((i) => i.id === id)?.progress_sec ?? null);
      } catch (err) {
        // El guardián de rutas (_layout) lleva a no-subscription al ver que
        // la sesión ya no tiene suscripción vigente.
        if (err instanceof ApiError && err.code === 'SUBSCRIPTION_REQUIRED') refresh().catch(() => {});
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

  const handleShare = useCallback(async () => {
    if (!video) return;
    const webBase = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/api\/?$/, '');
    try {
      await Share.share({ title: video.title, message: `${video.title} — ${webBase}/watch/${video.id}` });
    } catch {
      /* el usuario canceló el diálogo de compartir */
    }
  }, [video]);

  if (loading || !video) {
    return (
      <View style={styles.safe}>
        <Spinner centered />
      </View>
    );
  }

  const relatedCards: VideoCardItem[] = related.map((r) => ({
    id: r.id,
    title: r.title,
    thumbnail_url: r.thumbnail_url,
    metaLabel: r.duration_sec > 0 ? formatDurationLong(r.duration_sec) : undefined,
    episodeLabel: r.episode_num != null ? `EP. ${r.episode_num}` : undefined,
  }));

  const videoCategory = categories.find((c) => c.id === video.category_id);
  const videoSeries = allSeries.find((s) => s.id === video.series_id);
  const year = new Date(video.created_at).getFullYear();
  const kicker = videoSeries
    ? `${videoSeries.title}${video.episode_num != null ? ` · Ep ${video.episode_num}` : ''}`
    : videoCategory?.name ?? '';
  const chips = [videoCategory?.name, videoSeries?.title].filter(Boolean) as string[];

  return (
    <View style={styles.safe}>
      <AppHeader scrollY={scrollY} />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
      >
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
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backButton, { top: insets.top + APP_HEADER_CONTENT_HEIGHT + spacing.sm }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
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
          {!!kicker && <Text style={styles.kicker}>{kicker}</Text>}
          <Text style={styles.title}>{video.title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaline}>{year}</Text>
            {videoCategory && (
              <>
                <View style={styles.metaDot} />
                <Text style={styles.metaline}>{videoCategory.name}</Text>
              </>
            )}
            <View style={styles.metaDot} />
            <Text style={styles.metaline}>{formatDurationLong(video.duration_sec)}</Text>
            <View style={styles.uhdPill}>
              <Text style={styles.uhdPillText}>4K UHD</Text>
            </View>
          </View>

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
            <TouchableOpacity style={styles.iconButton} onPress={handleShare} activeOpacity={0.8}>
              <IconShare2 size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {video.description && (
            <View style={{ marginBottom: spacing['2xl'] }}>
              <ReadMoreText text={video.description} />
            </View>
          )}

          {chips.length > 0 && (
            <View style={styles.chipsRow}>
              {chips.map((c) => (
                <View key={c} style={styles.chip}>
                  <Text style={styles.chipText}>{c}</Text>
                </View>
              ))}
            </View>
          )}

        </View>

        <View style={styles.castSection}>
          <CastRow crew={video.crew ?? []} onPressMember={(m) => router.push({ pathname: '/crew/[slug]', params: { slug: m.slug } })} />
        </View>

        {relatedCards.length > 0 && (
          <View style={styles.relatedSection}>
            <Row title="Más como esto" items={relatedCards} onItemPress={(v) => router.push(`/watch/${v.id}`)} />
          </View>
        )}
      </Animated.ScrollView>

      {/* Barra inferior — esta pantalla vive fuera del Tab Navigator (stack
          real para que "volver" funcione bien), así que no hay tab bar
          nativa aquí; réplica visual que navega a la pestaña al tocarla
          (mismo patrón que crew/[slug].tsx y serie/[id].tsx). */}
      <View style={[styles.footer, { paddingBottom: Math.max(10, insets.bottom) }]}>
        {FOOTER_TABS.map(({ href, label, Icon }) => (
          <TouchableOpacity
            key={href}
            style={styles.footerTab}
            onPress={() => router.push(href)}
            activeOpacity={0.7}
          >
            <Icon size={22} color={colors.textFaint} />
            <Text style={styles.footerLabel}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <RatingSheet
        visible={ratingOpen}
        videoTitle={video.title}
        value={rating}
        onChange={handleRatingChange}
        onClose={() => setRatingOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingBottom: spacing['4xl'] },
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
  kicker: { ...textStyles.kicker, color: colors.brandBright, textTransform: 'uppercase', marginBottom: 6 },
  title: {
    fontFamily: 'Sora_800ExtraBold',
    fontSize: 22, lineHeight: 27,
    color: colors.white,
    marginBottom: 10,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
  metaline: { ...textStyles.bodyXs, fontSize: 12.5, color: colors.textSecondary },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.textFaint },
  uhdPill: {
    paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: 4, borderWidth: 1, borderColor: colors.borderStrong,
  },
  uhdPillText: { fontSize: 10.5, color: colors.textSecondary },
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
  sectionTitle: { ...textStyles.sectionTitle, color: colors.textPrimary, marginBottom: spacing.md },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing['2xl'] },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: colors.border,
  },
  chipText: { ...textStyles.bodyXs, fontSize: 12.5, color: colors.textSecondary },
  castSection: { marginTop: spacing.sm },
  relatedSection: { marginTop: spacing.sectionGap, paddingBottom: spacing['2xl'] },
  footer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: 'rgba(10,14,17,0.96)',
    paddingTop: 8,
  },
  footerTab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  footerLabel: {
    ...textStyles.tabLabel,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textFaint,
  },
});
