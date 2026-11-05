import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { colors, radii, textStyles, spacing } from '../../theme';
import type { VideoCardItem } from './VideoCard';

interface GridCardProps {
  item: VideoCardItem;
  onPress?: (item: VideoCardItem) => void;
}

// Tarjeta para grids de 2 columnas (Explorar, Mi Lista, vídeos de un miembro
// de la crew). Ancho FIJO calculado (no flex:1): con flex:1 dentro de un
// FlatList numColumns=2 + columnWrapperStyle, la última fila cuando el total
// es impar queda con un único elemento que se estira a flex:1 del ancho de
// TODA la fila (el doble de grande que el resto) — con ancho fijo todas las
// tarjetas miden siempre lo mismo, haya o no fila incompleta al final.
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - spacing.pagePaddingH * 2 - spacing.lg) / 2;

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
  card: { width: CARD_WIDTH, gap: 5 },
  thumb: {
    aspectRatio: 2 / 3,
    borderRadius: radii.card - 2,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  fallback: { backgroundColor: colors.surface2 },
  title: { ...textStyles.cardTitle, fontSize: 12.5, color: colors.textSecondary },
  meta: { ...textStyles.bodyXs, color: colors.textFaint },
});
