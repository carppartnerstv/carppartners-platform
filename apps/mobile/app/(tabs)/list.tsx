import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconBookmark } from '@tabler/icons-react-native';
import type { WatchlistItem } from '@carp-partners/api-client';
import { ApiError } from '@carp-partners/api-client';
import { colors, textStyles, spacing } from '../../theme';
import { Spinner, GridCard, EmptyState } from '../../components/ui';
import type { VideoCardItem } from '../../components/ui';
import { apiClient } from '../../lib/apiClient';
import { formatDurationShort } from '../../lib/format';
import { useResetScrollOnFocus } from '../../hooks/useResetScrollOnFocus';

const CONTENT_BOTTOM_PADDING = 96;

export default function ListScreen() {
  const router = useRouter();
  const listRef = useRef<FlatList>(null);
  useResetScrollOnFocus(useCallback(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }), []));

  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.getWatchlist()
      .then(({ items }) => setItems(items))
      .catch((err) => {
        if (err instanceof ApiError && err.code === 'SUBSCRIPTION_REQUIRED') { /* sin pantalla de planes en la app todavía */ }
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
    <View style={styles.header}>
      <Text style={styles.pageTitle}>Mi Lista</Text>
      {!loading && <Text style={styles.count}>{countLabel}</Text>}
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

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {header}
        <EmptyState
          icon={<IconBookmark size={38} color={colors.textFaint} />}
          title="Tu lista está vacía"
          body="Guarda vídeos para verlos más tarde desde cualquier ficha."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        ref={listRef}
        data={cards}
        keyExtractor={(c) => c.id}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={{ paddingHorizontal: spacing.pagePaddingH, paddingBottom: CONTENT_BOTTOM_PADDING, gap: spacing.lg }}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <GridCard item={item} onPress={(v) => router.push(`/watch/${v.id}`)} />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.pagePaddingH, paddingTop: spacing.sm, paddingBottom: spacing.lg },
  pageTitle: { ...textStyles.pageTitle, color: colors.textPrimary, marginBottom: 4 },
  count: { ...textStyles.bodySm, color: colors.textFaint },
  column: { gap: spacing.lg },
});
