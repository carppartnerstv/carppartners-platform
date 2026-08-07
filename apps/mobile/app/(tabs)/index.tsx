import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSearch, IconPlayerPlayFilled, IconInfoCircle } from '@tabler/icons-react-native';
import type { Video, Category, Series, WatchHistoryItem } from '@carp-partners/api-client';
import { ApiError } from '@carp-partners/api-client';
import { colors, textStyles, spacing } from '../../theme';
import { Spinner } from '../../components/ui';
import { Row } from '../../components/ui/Row';
import type { VideoCardItem } from '../../components/ui/VideoCard';
import { apiClient } from '../../lib/apiClient';
import { useResetScrollOnFocus } from '../../hooks/useResetScrollOnFocus';

const CONTENT_BOTTOM_PADDING = 96;

interface CategoryRow {
  category: Category;
  series: Series[];
}

export default function HomeScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  useResetScrollOnFocus(useCallback(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), []));

  const [hero, setHero] = useState<Video | null>(null);
  const [continueItems, setContinueItems] = useState<WatchHistoryItem[]>([]);
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [{ categories }, { items: continueWatching }, { video: featured }] = await Promise.all([
          apiClient.getCategories(),
          apiClient.getContinueWatching(),
          apiClient.getFeaturedVideo(),
        ]);
        if (cancelled) return;
        setContinueItems(continueWatching);
        setHero(featured);

        const rowsData = await Promise.all(
          categories.map(async (category) => {
            const { series } = await apiClient.getSeries({ category: category.id });
            return { category, series };
          }),
        );
        if (cancelled) return;
        setRows(rowsData.filter((r) => r.series.length > 0));
      } catch (err) {
        if (err instanceof ApiError && err.code === 'SUBSCRIPTION_REQUIRED') {
          // Sin pantalla de planes en la app todavía — se gestiona desde la web.
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const continueCards: VideoCardItem[] = continueItems.map((item) => ({
    id: item.id,
    title: item.title,
    thumbnail_url: item.thumbnail_url,
    progressPct: item.duration_sec > 0 ? Math.round((item.progress_sec / item.duration_sec) * 100) : 0,
  }));

  const seriesToCards = (series: Series[]): VideoCardItem[] =>
    series.map((s) => ({
      id: s.id,
      title: s.title,
      thumbnail_url: s.cover_url,
      metaLabel: s.episode_count > 0 ? `${s.episode_count} ep.` : undefined,
    }));

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Spinner centered />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.safe}>
      {/* Barra superior transparente, flota sobre el hero */}
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <Text style={styles.logo}>
          CARP<Text style={{ color: colors.brandBright, fontSize: 13 }}>◆</Text>PARTNERS
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/explore')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.searchButton}
        >
          <IconSearch size={19} color={colors.textPrimary} />
        </TouchableOpacity>
      </SafeAreaView>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: CONTENT_BOTTOM_PADDING }}
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
              <View style={styles.heroActions}>
                <TouchableOpacity
                  style={styles.playButton}
                  onPress={() => router.push(`/watch/${hero.id}/play`)}
                  activeOpacity={0.85}
                >
                  <IconPlayerPlayFilled size={17} color={colors.textInverse} />
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
          {continueCards.length > 0 && (
            <Row
              title="Continuar viendo"
              items={continueCards}
              variant="continue"
              onItemPress={(item) => router.push(`/watch/${item.id}/play`)}
            />
          )}

          {rows.map(({ category, series }) => (
            <Row
              key={category.id}
              title={category.name}
              items={seriesToCards(series)}
              onItemPress={(item) => router.push(`/serie/${item.id}`)}
            />
          ))}

          {rows.length === 0 && continueCards.length === 0 && (
            <Text style={styles.emptyText}>No hay vídeos disponibles todavía.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.pagePaddingH + 2,
    paddingTop: 10,
  },
  logo: {
    flex: 1,
    fontFamily: 'Sora_800ExtraBold',
    fontSize: 15,
    letterSpacing: -0.2,
    color: colors.white,
  },
  searchButton: {
    width: 34, height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    marginBottom: 14,
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
    backgroundColor: colors.white,
  },
  playButtonText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14.5,
    color: colors.textInverse,
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
