import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { IconPlayerPlayFilled } from '@tabler/icons-react-native';
import { colors, radii, textStyles, spacing } from '../../theme';

// Póster vertical 2:3 (estilo Netflix), igual proporción que el w-[23vw] de
// la web — pensado para que se vean 3 tarjetas enteras y un trozo de la 4ª.
const CARD_WIDTH = Math.round(Dimensions.get('window').width * 0.23);
const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.5);

type CardVariant = 'default' | 'rank' | 'continue' | 'full';

// Forma mínima y desacoplada del modelo real (Video/Series de
// @carp-partners/api-client) — cada pantalla adapta sus datos a esta forma.
// Todo lo que no sea id/title/thumbnail_url es opcional y puramente visual.
export interface VideoCardItem {
  id: string;
  title: string;
  thumbnail_url: string | null;
  /** Etiqueta de la píldora superior derecha (duración/episodios). Solo se pinta en variant="continue" (la web la oculta en el resto en móvil). */
  metaLabel?: string | null;
  /** Línea bajo el título (p. ej. "T1 · E3 · Nombre de la serie" o "8 episodios"). */
  episodeLabel?: string | null;
  isNew?: boolean;
  rank?: number;
  /** 0-100. Solo se pinta con variant="continue". */
  progressPct?: number | null;
}

interface VideoCardProps {
  item: VideoCardItem;
  variant?: CardVariant;
  onPress?: (item: VideoCardItem) => void;
  onLongPress?: (item: VideoCardItem) => void;
}

export function VideoCard({ item, variant = 'default', onPress, onLongPress }: VideoCardProps) {
  const screenWidth = Dimensions.get('window').width;

  let cardWidth = CARD_WIDTH;
  let cardHeight = CARD_HEIGHT;

  if (variant === 'full') {
    cardWidth = screenWidth - spacing.pagePaddingH * 2;
    cardHeight = Math.round(cardWidth * (9 / 16));
  }

  const progressRatio = item.progressPct != null ? Math.min(Math.max(item.progressPct / 100, 0), 1) : 0;
  const showProgress = variant === 'continue' && progressRatio > 0;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress?.(item)}
      onLongPress={() => onLongPress?.(item)}
      style={[styles.card, { width: cardWidth }]}
    >
      {/* Envoltorio del mismo tamaño que la miniatura, SIN overflow:hidden —
          así el numeral de rank puede sangrar por fuera del borde (igual
          que en VideoCard.tsx web), cosa que el overflow:hidden del thumb
          (necesario para las esquinas redondeadas) recortaría. */}
      <View style={{ width: cardWidth, height: cardHeight }}>
        <View style={[styles.thumb, { width: cardWidth, height: cardHeight }]}>
          {item.thumbnail_url ? (
            <Image
              source={{ uri: item.thumbnail_url }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.thumbFallback]} />
          )}

          {/* Bottom scrim */}
          <LinearGradient
            colors={[colors.scrimNone, colors.scrimHalf, colors.scrimFull]}
            locations={[0.38, 0.72, 1]}
            style={StyleSheet.absoluteFill}
          />

          {/* NEW badge */}
          {item.isNew && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NUEVO</Text>
            </View>
          )}

          {/* Meta pill — solo en "Continuar viendo" */}
          {variant === 'continue' && item.metaLabel && (
            <View style={styles.durationPill}>
              <Text style={styles.durationText}>{item.metaLabel}</Text>
            </View>
          )}

          {/* Círculo de reproducción — solo "Continuar viendo" */}
          {variant === 'continue' && (
            <View style={styles.playCircle}>
              <IconPlayerPlayFilled size={18} color={colors.white} style={{ marginLeft: 2 }} />
            </View>
          )}

          {/* Barra de progreso — pegada al borde inferior de la miniatura */}
          {showProgress && (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
            </View>
          )}
        </View>

        {/* Numeral de rank — fuera del thumb a propósito, para que sangre por el borde */}
        {variant === 'rank' && item.rank != null && (
          <View style={styles.rankOverlay}>
            <Text style={styles.rankText}>{item.rank}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        {item.episodeLabel && (
          <Text style={styles.episode} numberOfLines={1}>
            {item.episodeLabel}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 6,
  },
  thumb: {
    borderRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  thumbFallback: {
    backgroundColor: colors.surface2,
  },
  newBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.goldFill,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.badge,
  },
  newBadgeText: {
    ...textStyles.kicker,
    fontSize: 8.5,
    color: '#1a1206',
  },
  durationPill: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(4,8,10,0.72)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  durationText: {
    ...textStyles.bodyXs,
    color: colors.white,
  },
  rankOverlay: {
    position: 'absolute',
    bottom: -14,
    left: 4,
  },
  rankText: {
    fontFamily: 'Sora_800ExtraBold',
    fontSize: 84,
    lineHeight: 88,
    color: colors.textPrimary,
    opacity: 0.4,
  },
  playCircle: {
    position: 'absolute',
    left: '50%', top: '50%',
    marginLeft: -18, marginTop: -18,
    width: 36, height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  progressTrack: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.brandBright,
  },
  info: {
    gap: 2,
    paddingHorizontal: 2,
  },
  title: {
    ...textStyles.cardTitle,
    fontSize: 12,
    color: colors.textPrimary,
  },
  episode: {
    ...textStyles.bodyXs,
    color: colors.textFaint,
  },
});
