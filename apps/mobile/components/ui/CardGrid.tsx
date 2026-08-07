import React from 'react';
import { View, StyleSheet } from 'react-native';
import { spacing } from '../../theme';
import { GridCard } from './GridCard';
import type { VideoCardItem } from './VideoCard';

interface CardGridProps {
  items: VideoCardItem[];
  onPress?: (item: VideoCardItem) => void;
}

// Grid de 2 columnas dentro de un ScrollView (no una FlatList paginada) —
// para eso usamos GridCard directo con numColumns=2. Aquí, en cambio,
// agrupamos en filas de 2 explícitas: con flexWrap + flex:1 el ancho de
// cada tarjeta queda indefinido en la fila incompleta final.
export function CardGrid({ items, onPress }: CardGridProps) {
  const rows: VideoCardItem[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));

  return (
    <View style={styles.wrap}>
      {rows.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((item) => (
            <GridCard key={item.id} item={item} onPress={onPress} />
          ))}
          {row.length === 1 && <View style={{ flex: 1 }} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.lg },
});
