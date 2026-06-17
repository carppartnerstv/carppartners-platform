import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, textStyles, spacing } from '../../theme';
import { VideoCard } from './VideoCard';
import type { MockVideo } from '../../data/mock/videos';

type RowVariant = 'default' | 'rank' | 'continue';

interface RowProps {
  title: string;
  videos: MockVideo[];
  variant?: RowVariant;
  onVideoPress?: (video: MockVideo) => void;
  onSeeAll?: () => void;
}

export function Row({ title, videos, variant = 'default', onVideoPress, onSeeAll }: RowProps) {
  if (videos.length === 0) return null;

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
        {videos.map((item, index) => (
          <React.Fragment key={item.id}>
            {index > 0 && <View style={{ width: spacing.rowGap }} />}
            <VideoCard video={item} variant={cardVariant} onPress={onVideoPress} />
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
