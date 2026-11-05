import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
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

// Réplica de TopTenCarousel.tsx (web) en su breakpoint `base` (<640px):
// todas las tarjetas al mismo tamaño fijo 200x300 (CONTAINER_HEIGHT/
// POSTER_WIDTH.base de ese componente), pero con el mismo movimiento que
// la web SÍ tiene también en móvil — el autoplay (useEffect de
// setInterval, sin comprobación de breakpoint) avanza sola cada
// AUTOPLAY_MS, desplazando la fila para que la tarjeta "activa" quede
// siempre a la izquierda con borde resaltado + degradado/título; el resto
// solo muestra la portada limpia (en la web se revelan al pasar el ratón,
// que no existe en touch). Arrastrar pausa el autoplay y, al soltar, el
// snap dejará la tarjeta más cercana como nueva activa.
const CARD_WIDTH = 200;
const CARD_HEIGHT = 300;
const CARD_GAP = 14;
const STEP = CARD_WIDTH + CARD_GAP;
const AUTOPLAY_MS = 6000;

export function CuratedRow({ title, items, onItemPress }: CuratedRowProps) {
  const scrollRef = useRef<ScrollView>(null);
  const pausedRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => {
      if (pausedRef.current) return;
      setActiveIndex((i) => {
        const next = (i + 1) % items.length;
        scrollRef.current?.scrollTo({ x: next * STEP, animated: true });
        return next;
      });
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [items.length]);

  const settleOnNearestCard = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      pausedRef.current = false;
      const index = Math.round(e.nativeEvent.contentOffset.x / STEP);
      setActiveIndex(Math.max(0, Math.min(items.length - 1, index)));
    },
    [items.length],
  );

  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={STEP}
        decelerationRate="fast"
        contentContainerStyle={styles.list}
        onScrollBeginDrag={() => { pausedRef.current = true; }}
        onScrollEndDrag={settleOnNearestCard}
        onMomentumScrollEnd={settleOnNearestCard}
      >
        {items.map((item, index) => {
          const featured = index === activeIndex;
          return (
            <React.Fragment key={item.id}>
              {index > 0 && <View style={{ width: CARD_GAP }} />}
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
