import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Animated, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconBookmark } from '@tabler/icons-react-native';
import type { WatchlistItem } from '@carp-partners/api-client';
import { ApiError } from '@carp-partners/api-client';
import { colors, textStyles, spacing } from '../../theme';
import { Spinner, GridCard, EmptyState } from '../../components/ui';
import { AppHeader, APP_HEADER_CONTENT_HEIGHT } from '../../components/ui/AppHeader';
import type { VideoCardItem } from '../../components/ui';
import { apiClient } from '../../lib/apiClient';
import { useSession } from '../../context/SessionContext';
import { formatDurationShort } from '../../lib/format';
import { useResetScrollOnFocus } from '../../hooks/useResetScrollOnFocus';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<VideoCardItem>);

const CONTENT_BOTTOM_PADDING = 96;

export default function ListScreen() {
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

  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.getWatchlist()
      .then(({ items }) => setItems(items))
      .catch((err) => {
        if (err instanceof ApiError && err.code === 'SUBSCRIPTION_REQUIRED') refresh().catch(() => {}); // el guardián de rutas (_layout) lleva a no-subscription
      })
      .finally(() => setLoading(false));
  }, []);

  const cards: VideoCardItem[] = items.map((item) => ({
    id: item.id,
    title: item.title,
    thumbnail_url: item.thumbnail_url,
    metaLabel: item.duration_sec > 0 ? formatDurationShort(item.duration_sec) : undefined,
  }));

  const countLabel = items.length === 0
    ? 'Aún no has guardado nada'
    : `${items.length} ${items.length === 1 ? 'vídeo guardado' : 'vídeos guardados'}`;

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + APP_HEADER_CONTENT_HEIGHT + spacing.md }]}>
      {!loading && <Text style={styles.count}>{countLabel}</Text>}
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

  if (items.length === 0) {
    return (
      <View style={styles.safe}>
        <AppHeader scrollY={scrollY} />
        {header}
        <EmptyState
          icon={<IconBookmark size={38} color={colors.textFaint} />}
          title="Tu lista está vacía"
          body="Guarda vídeos para verlos más tarde desde cualquier ficha."
        />
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <AppHeader scrollY={scrollY} />
      <AnimatedFlatList
        ref={listRef}
        data={cards}
        keyExtractor={(c) => c.id}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={{ paddingHorizontal: spacing.pagePaddingH, paddingBottom: CONTENT_BOTTOM_PADDING, gap: spacing.lg }}
        ListHeaderComponent={header}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <GridCard item={item} onPress={(v) => router.push(`/watch/${v.id}`)} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.pagePaddingH, paddingBottom: spacing.lg },
  count: { ...textStyles.bodySm, color: colors.textFaint },
  column: { gap: spacing.lg },
});
