import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radii, textStyles } from '../../theme';
import type { VideoCardItem } from './VideoCard';

interface GridCardProps {
  item: VideoCardItem;
  onPress?: (item: VideoCardItem) => void;
}

// Tarjeta para grids de 2 columnas (Explorar, Mi Lista, vídeos de un miembro
// de la crew) — a diferencia de VideoCard (ancho fijo, para filas
// horizontales), esta ocupa el 100% de su columna.
export function GridCard({ item, onPress }: GridCardProps) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={() => onPress?.(item)} style={styles.card}>
      <View style={styles.thumb}>
        {item.thumbnail_url ? (
          <Image source={{ uri: item.thumbnail_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.fallback]} />
        )}
      </View>
      <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
      {item.metaLabel && <Text style={styles.meta} numberOfLines={1}>{item.metaLabel}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, gap: 5 },
  thumb: {
    aspectRatio: 16 / 10,
    borderRadius: radii.card - 2,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  fallback: { backgroundColor: colors.surface2 },
  title: { ...textStyles.cardTitle, fontSize: 12.5, color: colors.textSecondary },
  meta: { ...textStyles.bodyXs, color: colors.textFaint },
});
