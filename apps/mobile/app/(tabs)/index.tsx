import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, Animated, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { IconPlayerPlayFilled, IconInfoCircle } from '@tabler/icons-react-native';
import type { Video, Category, Series, WatchHistoryItem } from '@carp-partners/api-client';
import { ApiError } from '@carp-partners/api-client';
import { colors, textStyles, spacing } from '../../theme';
import { Spinner } from '../../components/ui';
import { Row } from '../../components/ui/Row';
import { AppHeader } from '../../components/ui/AppHeader';
import { CuratedRow } from '../../components/ui/CuratedRow';
import type { VideoCardItem } from '../../components/ui/VideoCard';
import { apiClient } from '../../lib/apiClient';
import { useSession } from '../../context/SessionContext';
import { useResetScrollOnFocus } from '../../hooks/useResetScrollOnFocus';
import { stripHtml } from '../../lib/format';

const NEW_BADGE_MAX_AGE_MS = 45 * 24 * 60 * 60 * 1000;

const CONTENT_BOTTOM_PADDING = 96;

interface CategoryRow {
  category: Category;
  series: Series[];
}

export default function HomeScreen() {
  const { refresh } = useSession();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  useResetScrollOnFocus(useCallback(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), []));

  const scrollY = useRef(new Animated.Value(0)).current;

  const [hero, setHero] = useState<Video | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allSeries, setAllSeries] = useState<Series[]>([]);
  const [continueItems, setContinueItems] = useState<WatchHistoryItem[]>([]);
  const [recentVideos, setRecentVideos] = useState<Video[]>([]);
  const [trendingVideos, setTrendingVideos] = useState<Video[]>([]);
  const [curatedSeries, setCuratedSeries] = useState<Series[]>([]);
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [
          { categories }, { series: allSeries }, { items: continueWatching }, { video: featured },
          { videos: recent }, { videos: trending }, { series: curated },
        ] = await Promise.all([
          apiClient.getCategories(),
          apiClient.getSeries(),
          apiClient.getContinueWatching(),
          apiClient.getFeaturedVideo(),
          apiClient.getVideos({ sort: 'recent', limit: 20 }),
          apiClient.getVideos({ trending: true, limit: 10 }),
          apiClient.getSeries({ curated: true }),
        ]);
        if (cancelled) return;
        setCategories(categories);
        setAllSeries(allSeries);
        setContinueItems(continueWatching);
        setHero(featured);
        setRecentVideos(recent);
        setTrendingVideos(trending);
        setCuratedSeries(curated);

        const rowsData = await Promise.all(
          categories.map(async (category) => {
            const { series } = await apiClient.getSeries({ category: category.id });
            return { category, series };
          }),
        );
        if (cancelled) return;
        setRows(rowsData.filter((r) => r.series.length > 0));
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
  }, []);

  const heroCategory = hero ? categories.find((c) => c.id === hero.category_id) : undefined;
  const heroSeries = hero ? allSeries.find((s) => s.id === hero.series_id) : undefined;

  const continueCards: VideoCardItem[] = continueItems.map((item) => ({
    id: item.id,
    title: item.title,
    thumbnail_url: item.cover_vertical_url ?? item.thumbnail_url,
    progressPct: item.duration_sec > 0 ? Math.round((item.progress_sec / item.duration_sec) * 100) : 0,
  }));

  const videosToCards = (videos: Video[], { rank, newBadge }: { rank?: boolean; newBadge?: boolean } = {}): VideoCardItem[] =>
    videos.map((v, i) => ({
      id: v.id,
      title: v.title,
      thumbnail_url: v.cover_vertical_url ?? v.thumbnail_url,
      episodeLabel: v.series_title
        ? `${v.season_num != null ? `T${v.season_num} · ` : ''}E${v.episode_num} · ${v.series_title}`
        : v.episode_num != null ? `Ep. ${v.episode_num}` : undefined,
      isNew: newBadge ? Date.now() - new Date(v.created_at).getTime() <= NEW_BADGE_MAX_AGE_MS : undefined,
      rank: rank ? i + 1 : undefined,
    }));

  const seriesToCards = (series: Series[]): VideoCardItem[] =>
    series.map((s) => ({
      id: s.id,
      title: s.title,
      thumbnail_url: s.cover_vertical_url ?? s.cover_url,
      episodeLabel: s.season_count > 0
        ? `${s.season_count} temporada${s.season_count === 1 ? '' : 's'}`
        : s.episode_count > 0 ? `${s.episode_count} episodio${s.episode_count === 1 ? '' : 's'}` : undefined,
    }));

  const heroMetaParts = hero
    ? [
        String(new Date(hero.created_at).getFullYear()),
        heroCategory?.name,
        heroSeries?.title,
        heroSeries && heroSeries.episode_count > 0
          ? `${heroSeries.episode_count} episodio${heroSeries.episode_count === 1 ? '' : 's'}`
          : undefined,
      ].filter(Boolean) as string[]
    : [];
  const heroDescription = hero?.description ? stripHtml(hero.description) : '';

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Spinner centered />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.safe}>
      <AppHeader scrollY={scrollY} />

      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: CONTENT_BOTTOM_PADDING }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {hero && (
          <View style={styles.hero}>
            {hero.thumbnail_url ? (
              <Image source={{ uri: hero.thumbnail_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />
            )}
            <LinearGradient
              colors={['rgba(6,9,12,0.15)', 'rgba(6,9,12,0.35)', colors.bg]}
              locations={[0, 0.55, 0.96]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroContent}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>DESTACADO</Text>
              </View>
              <Text style={styles.heroTitle} numberOfLines={3}>{hero.title}</Text>

              <View style={styles.heroMetaRow}>
                {heroMetaParts.map((part, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <View style={styles.heroMetaDot} />}
                    <Text style={[styles.heroMetaText, i === 0 && styles.heroMetaPrimary]}>{part}</Text>
                  </React.Fragment>
                ))}
                <View style={styles.uhdPill}>
                  <Text style={styles.uhdPillText}>4K UHD</Text>
                </View>
              </View>

              {!!heroDescription && (
                <Text style={styles.heroDescription} numberOfLines={3}>{heroDescription}</Text>
              )}

              <View style={styles.heroActions}>
                <TouchableOpacity
                  style={styles.playButton}
                  onPress={() => router.push(`/watch/${hero.id}/play`)}
                  activeOpacity={0.85}
                >
                  <IconPlayerPlayFilled size={17} color={colors.white} />
                  <Text style={styles.playButtonText}>Reproducir</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.infoButton}
                  onPress={() => router.push(`/watch/${hero.id}`)}
                  activeOpacity={0.85}
                >
                  <IconInfoCircle size={19} color={colors.white} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        <View style={styles.rows}>
          {/* 1. Continuar viendo */}
          {continueCards.length > 0 && (
            <Row
              title="Continuar viendo"
              items={continueCards}
              variant="continue"
              onItemPress={(item) => router.push(`/watch/${item.id}/play`)}
            />
          )}

          {/* 2. Añadido recientemente */}
          <Row
            title="Añadido recientemente"
            items={videosToCards(recentVideos, { newBadge: true })}
            onItemPress={(item) => router.push(`/watch/${item.id}`)}
          />

          {/* 3. Tendencias en Carp Partners */}
          <Row
            title="Tendencias en Carp Partners"
            items={videosToCards(trendingVideos, { rank: true })}
            variant="rank"
            onItemPress={(item) => router.push(`/watch/${item.id}`)}
          />

          {/* 4. Mejores seleccionados para ti — diseño distinto a las demás filas */}
          <CuratedRow
            title="Mejores seleccionados para ti"
            items={curatedSeries.map((s) => ({ id: s.id, title: s.title, thumbnail_url: s.cover_vertical_url ?? s.cover_url }))}
            onItemPress={(item) => router.push(`/serie/${item.id}`)}
          />

          {/* 5-6. Películas / Series — el orden real lo decide /admin/categorias */}
          {rows.map(({ category, series }) => (
            <Row
              key={category.id}
              title={category.name}
              items={seriesToCards(series)}
              hideCardInfo
              onItemPress={(item) => router.push(`/serie/${item.id}`)}
            />
          ))}

          {rows.length === 0 && continueCards.length === 0 && recentVideos.length === 0 && (
            <Text style={styles.emptyText}>No hay vídeos disponibles todavía.</Text>
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  hero: {
    aspectRatio: 3 / 4,
    backgroundColor: colors.surface,
  },
  heroContent: {
    position: 'absolute',
    left: spacing.pagePaddingH + 2,
    right: spacing.pagePaddingH + 2,
    bottom: 22,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: 'rgba(216,166,74,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(216,166,74,0.4)',
    marginBottom: 12,
  },
  heroBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10.5,
    color: colors.gold,
  },
  heroTitle: {
    fontFamily: 'Sora_800ExtraBold',
    fontSize: 25,
    lineHeight: 30,
    color: colors.white,
    marginBottom: 10,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  heroMetaText: {
    ...textStyles.bodyXs,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  heroMetaPrimary: {
    fontFamily: 'Inter_700Bold',
  },
  heroMetaDot: {
    width: 3, height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textFaint,
  },
  uhdPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  uhdPillText: {
    fontSize: 10.5,
    color: colors.textSecondary,
  },
  heroDescription: {
    ...textStyles.bodySm,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: 18,
  },
  heroActions: { flexDirection: 'row', gap: 10 },
  playButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 46,
    borderRadius: 9,
    backgroundColor: colors.brand,
  },
  playButtonText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14.5,
    color: colors.white,
  },
  infoButton: {
    width: 46, height: 46,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rows: {
    paddingTop: 22,
    gap: spacing.sectionGap,
  },
  emptyText: {
    ...textStyles.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.pagePaddingH,
    paddingTop: spacing['4xl'],
  },
});
