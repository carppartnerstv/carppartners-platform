import React from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing } from '../../theme';

export interface CuratedItem {
  id: string;
  title: string;
  thumbnail_url: string | null;
}

interface CuratedRowProps {
  title: string;
  items: CuratedItem[];
  onItemPress?: (item: CuratedItem) => void;
}

// Fila deliberadamente distinta del resto — réplica de TopTenCarousel.tsx
// (web) en su breakpoint `base` (<640px): sin autoplay ni arrastre (están
// ocultos/son irrelevantes en un viewport de móvil real), todas las
// tarjetas al mismo tamaño fijo 200x300 (CONTAINER_HEIGHT/POSTER_WIDTH.base
// de ese componente), y solo la primera (la "protagonista" con
// activeIndex=0, ya que aquí no hay autoplay que la mueva) con borde
// resaltado y overlay de degradado+título — las demás solo muestran la
// portada limpia, igual que en la web (ahí el resto solo se revela al
// pasar el ratón, que no existe en touch).
const CARD_WIDTH = 200;
const CARD_HEIGHT = 300;

export function CuratedRow({ title, items, onItemPress }: CuratedRowProps) {
  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {items.map((item, index) => {
          const featured = index === 0;
          return (
            <React.Fragment key={item.id}>
              {index > 0 && <View style={{ width: 14 }} />}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => onItemPress?.(item)}
                style={[styles.card, featured ? styles.cardFeatured : styles.cardDefault]}
              >
                {item.thumbnail_url ? (
                  <Image source={{ uri: item.thumbnail_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : (
                  <View style={[StyleSheet.absoluteFill, styles.thumbFallback]} />
                )}
                {featured && (
                  <>
                    <LinearGradient
                      colors={[colors.scrimNone, colors.scrimHalf, colors.scrimFull]}
                      locations={[0.3, 0.7, 1]}
                      style={StyleSheet.absoluteFill}
                    />
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                  </>
                )}
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  header: {
    paddingHorizontal: spacing.pagePaddingH,
  },
  title: {
    fontFamily: 'Sora_700Bold',
    fontSize: 19,
    color: colors.textPrimary,
  },
  list: {
    paddingHorizontal: spacing.pagePaddingH,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0e151a',
    justifyContent: 'flex-end',
  },
  cardDefault: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardFeatured: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  thumbFallback: {
    backgroundColor: colors.surface2,
  },
  cardTitle: {
    fontFamily: 'Sora_700Bold',
    fontSize: 10.5,
    color: colors.white,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
});
