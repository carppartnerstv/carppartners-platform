import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSearch, IconMoodEmpty } from '@tabler/icons-react-native';
import type { Category, Series, CrewMember } from '@carp-partners/api-client';
import { ApiError } from '@carp-partners/api-client';
import { colors, textStyles, spacing, radii } from '../../theme';
import { Spinner, GridCard, Avatar, Badge } from '../../components/ui';
import type { VideoCardItem } from '../../components/ui';
import { apiClient } from '../../lib/apiClient';
import { ROLE_LABELS } from '../../lib/constants';
import { useResetScrollOnFocus } from '../../hooks/useResetScrollOnFocus';

const CONTENT_BOTTOM_PADDING = 96;

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

type Tab = 'all' | 'crew' | string;

export default function ExploreScreen() {
  const router = useRouter();
  const listRef = useRef<FlatList>(null);
  useResetScrollOnFocus(useCallback(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }), []));

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
        if (err instanceof ApiError && err.code === 'SUBSCRIPTION_REQUIRED') { /* sin pantalla de planes en la app todavía */ }
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
    metaLabel: s.episode_count > 0 ? `${s.episode_count} ep.` : undefined,
  }));

  const header = (
    <View style={styles.header}>
      <Text style={styles.pageTitle}>Explorar</Text>

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
      <SafeAreaView style={styles.safe} edges={['top']}>
        {header}
        <Spinner centered />
      </SafeAreaView>
    );
  }

  if (showEmpty) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {header}
        <View style={styles.empty}>
          <IconMoodEmpty size={38} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Sin resultados</Text>
          <Text style={styles.emptyBody}>
            {isCrewTab ? 'No encontramos a nadie con ese nombre.' : 'No encontramos nada para tu búsqueda. Prueba con otra palabra o cambia los filtros.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {isCrewTab ? (
        <FlatList
          ref={listRef}
          data={filteredCrew}
          keyExtractor={(m) => m.id}
          numColumns={2}
          columnWrapperStyle={styles.column}
          contentContainerStyle={{ paddingHorizontal: spacing.pagePaddingH, paddingBottom: CONTENT_BOTTOM_PADDING, gap: spacing.lg }}
          ListHeaderComponent={header}
          renderItem={({ item }: { item: CrewMember }) => (
            <TouchableOpacity
              style={styles.crewCard}
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/crew/[slug]', params: { slug: item.slug } })}
            >
              <Avatar uri={item.avatar_url} name={item.name} size="lg" />
              <Text style={styles.crewName} numberOfLines={1}>{item.name}</Text>
              <Badge label={ROLE_LABELS[item.role]} variant={item.role === 'socio' ? 'gold' : 'muted'} />
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          ref={listRef}
          data={seriesCards}
          keyExtractor={(c) => c.id}
          numColumns={2}
          columnWrapperStyle={styles.column}
          contentContainerStyle={{ paddingHorizontal: spacing.pagePaddingH, paddingBottom: CONTENT_BOTTOM_PADDING, gap: spacing.lg }}
          ListHeaderComponent={header}
          renderItem={({ item }: { item: VideoCardItem }) => (
            <GridCard item={item} onPress={(v) => router.push(`/serie/${v.id}`)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.pagePaddingH, paddingTop: spacing.sm, gap: spacing.md },
  pageTitle: { ...textStyles.pageTitle, color: colors.textPrimary, marginBottom: 2 },
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
    borderRadius: radii.full,
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
  crewCard: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: spacing.md },
  crewName: { ...textStyles.label, color: colors.textPrimary },
});
