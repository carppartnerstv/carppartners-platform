import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Animated,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSearch, IconMoodEmpty } from '@tabler/icons-react-native';
import type { Category, Series, CrewMember } from '@carp-partners/api-client';
import { ApiError } from '@carp-partners/api-client';
import { colors, textStyles, spacing, radii } from '../../theme';
import { Spinner, GridCard } from '../../components/ui';
import { AppHeader, APP_HEADER_CONTENT_HEIGHT } from '../../components/ui/AppHeader';
import type { VideoCardItem } from '../../components/ui';
import { apiClient } from '../../lib/apiClient';
import { useSession } from '../../context/SessionContext';
import { useResetScrollOnFocus } from '../../hooks/useResetScrollOnFocus';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<any>);

const CONTENT_BOTTOM_PADDING = 96;

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

type Tab = 'all' | 'crew' | string;

export default function ExploreScreen() {
  const { refresh } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  useResetScrollOnFocus(useCallback(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }), []));

  const scrollY = useRef(new Animated.Value(0)).current;
  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false },
  );

  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const isCrewTab = tab === 'crew';

  const [series, setSeries] = useState<Series[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(true);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [crewLoading, setCrewLoading] = useState(true);

  useEffect(() => {
    apiClient.getCategories().then(({ categories }) => setCategories(categories)).catch(() => null);
    apiClient.getCrew().then(({ crew }) => setCrew(crew)).catch(() => null).finally(() => setCrewLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (isCrewTab) return;
    let cancelled = false;
    setSeriesLoading(true);
    const categoryFilter = tab === 'all' ? undefined : tab;
    apiClient.getSeries(categoryFilter ? { category: categoryFilter } : undefined)
      .then(({ series }) => { if (!cancelled) setSeries(series); })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === 'SUBSCRIPTION_REQUIRED') refresh().catch(() => {}); // el guardián de rutas (_layout) lleva a no-subscription
      })
      .finally(() => { if (!cancelled) setSeriesLoading(false); });
    return () => { cancelled = true; };
  }, [tab, isCrewTab]);

  const q = normalize(debouncedQuery);
  const filteredSeries = q ? series.filter((s) => normalize(s.title).includes(q)) : series;
  const filteredCrew = q ? crew.filter((m) => normalize(m.name).includes(q)) : crew;

  const loading = isCrewTab ? crewLoading : seriesLoading;
  const resultCount = isCrewTab
    ? `${filteredCrew.length} ${filteredCrew.length === 1 ? 'miembro' : 'miembros'}`
    : `${filteredSeries.length} ${filteredSeries.length === 1 ? 'resultado' : 'resultados'}`;
  const showEmpty = !loading && (isCrewTab ? filteredCrew.length === 0 : filteredSeries.length === 0);

  const seriesCards: VideoCardItem[] = filteredSeries.map((s) => ({
    id: s.id,
    title: s.title,
    thumbnail_url: s.cover_url,
    metaLabel: s.episode_count > 0 ? `${s.episode_count} episodio${s.episode_count === 1 ? '' : 's'}` : undefined,
  }));

  // Mismo formato de tarjeta que series/películas (4:3, sin avatar circular
  // ni distinción socio/crew — no aporta nada en una rejilla densa).
  const crewCards: VideoCardItem[] = filteredCrew.map((m) => ({
    id: m.slug,
    title: m.name,
    thumbnail_url: m.avatar_url,
  }));

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + APP_HEADER_CONTENT_HEIGHT + spacing.md }]}>
      <View style={styles.searchBox}>
        <IconSearch size={17} color={colors.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={isCrewTab ? 'Buscar miembro de la crew...' : 'Buscar series, películas...'}
          placeholderTextColor={colors.textFaint}
          style={styles.searchInput}
          autoCapitalize="none"
        />
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ id: 'all', name: 'Todo' }, ...categories, { id: 'crew', name: 'Crew' }]}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.chipsList}
        renderItem={({ item }) => {
          const active = tab === item.id;
          return (
            <TouchableOpacity
              onPress={() => setTab(item.id)}
              style={[styles.chip, { backgroundColor: active ? colors.brand : colors.surface2, borderColor: active ? colors.brand : colors.border }]}
            >
              <Text style={[styles.chipText, { color: active ? colors.white : colors.textSecondary }]}>{item.name}</Text>
            </TouchableOpacity>
          );
        }}
      />

      <Text style={styles.resultCount}>{resultCount}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.safe}>
        <AppHeader scrollY={scrollY} />
        {header}
        <Spinner centered />
      </View>
    );
  }

  if (showEmpty) {
    return (
      <View style={styles.safe}>
        <AppHeader scrollY={scrollY} />
        {header}
        <View style={styles.empty}>
          <IconMoodEmpty size={38} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Sin resultados</Text>
          <Text style={styles.emptyBody}>
            {isCrewTab ? 'No encontramos a nadie con ese nombre.' : 'No encontramos nada para tu búsqueda. Prueba con otra palabra o cambia los filtros.'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <AppHeader scrollY={scrollY} />
      {isCrewTab ? (
        <AnimatedFlatList
          ref={listRef}
          data={crewCards}
          keyExtractor={(c: VideoCardItem) => c.id}
          numColumns={2}
          columnWrapperStyle={styles.column}
          contentContainerStyle={{ paddingHorizontal: spacing.pagePaddingH, paddingBottom: CONTENT_BOTTOM_PADDING, gap: spacing.lg }}
          ListHeaderComponent={header}
          onScroll={onScroll}
          scrollEventThrottle={16}
          renderItem={({ item }: { item: VideoCardItem }) => (
            <GridCard item={item} onPress={(m) => router.push({ pathname: '/crew/[slug]', params: { slug: m.id } })} />
          )}
        />
      ) : (
        <AnimatedFlatList
          ref={listRef}
          data={seriesCards}
          keyExtractor={(c: VideoCardItem) => c.id}
          numColumns={2}
          columnWrapperStyle={styles.column}
          contentContainerStyle={{ paddingHorizontal: spacing.pagePaddingH, paddingBottom: CONTENT_BOTTOM_PADDING, gap: spacing.lg }}
          ListHeaderComponent={header}
          onScroll={onScroll}
          scrollEventThrottle={16}
          renderItem={({ item }: { item: VideoCardItem }) => (
            <GridCard item={item} onPress={(v) => router.push(`/serie/${v.id}`)} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.pagePaddingH, paddingTop: spacing.sm, gap: spacing.md },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    ...textStyles.body,
    color: colors.textPrimary,
    paddingVertical: 11,
  },
  chipsList: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.chip,
    borderWidth: 1,
  },
  chipText: { ...textStyles.labelSm },
  resultCount: { ...textStyles.bodyXs, color: colors.textFaint },
  column: { gap: spacing.lg },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['4xl'],
    gap: spacing.sm,
  },
  emptyTitle: { ...textStyles.sectionTitle, color: colors.textSecondary, marginTop: spacing.sm },
  emptyBody: { ...textStyles.bodySm, color: colors.textFaint, textAlign: 'center' },
});
