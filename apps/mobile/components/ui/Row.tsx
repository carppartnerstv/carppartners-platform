import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, textStyles, spacing } from '../../theme';
import { VideoCard, type VideoCardItem } from './VideoCard';

type RowVariant = 'default' | 'rank' | 'continue';

interface RowProps {
  title: string;
  items: VideoCardItem[];
  variant?: RowVariant;
  onItemPress?: (item: VideoCardItem) => void;
  onSeeAll?: () => void;
}

export function Row({ title, items, variant = 'default', onItemPress, onSeeAll }: RowProps) {
  if (items.length === 0) return null;

  const cardVariant = variant === 'rank' ? 'rank' : variant === 'continue' ? 'continue' : 'default';

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
        contentContainerStyle={styles.list}
      >
        {items.map((item, index) => (
          <React.Fragment key={item.id}>
            {index > 0 && <View style={{ width: spacing.rowGap }} />}
            <VideoCard item={item} variant={cardVariant} onPress={onItemPress} />
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
});
