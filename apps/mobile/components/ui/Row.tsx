import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, textStyles, spacing } from '../../theme';
import { VideoCard, type VideoCardItem } from './VideoCard';

type RowVariant = 'default' | 'rank' | 'continue';

interface RowProps {
  title: string;
  items: VideoCardItem[];
  variant?: RowVariant;
  /** Oculta el título/episodios bajo cada tarjeta — ver VideoCard.hideInfo. */
  hideCardInfo?: boolean;
  onItemPress?: (item: VideoCardItem) => void;
  onSeeAll?: () => void;
}

export function Row({ title, items, variant = 'default', hideCardInfo = false, onItemPress, onSeeAll }: RowProps) {
  if (items.length === 0) return null;

  const cardVariant = variant === 'rank' ? 'rank' : variant === 'continue' ? 'continue' : 'default';
  // El numeral grande de "rank" necesita más aire entre tarjetas (igual que
  // gap-6/8 en vez de gap-3/4 en VideoRow.tsx web).
  const itemGap = variant === 'rank' ? spacing.rowGap + 16 : spacing.rowGap;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.seeAll}>Ver todo</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.list, variant === 'rank' && styles.listRank]}
      >
        {items.map((item, index) => (
          <React.Fragment key={item.id}>
            {index > 0 && <View style={{ width: itemGap }} />}
            <VideoCard item={item} variant={cardVariant} hideInfo={hideCardInfo} onPress={onItemPress} />
          </React.Fragment>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.pagePaddingH,
  },
  title: {
    ...textStyles.sectionTitle,
    color: colors.textPrimary,
  },
  seeAll: {
    ...textStyles.labelSm,
    color: colors.brandBright,
  },
  list: {
    paddingHorizontal: spacing.pagePaddingH,
  },
  listRank: {
    paddingTop: 10,
  },
});
