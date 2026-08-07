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
import { colors, radii, textStyles, spacing } from '../../theme';

// Card dimensions — 16:9 ratio
const CARD_WIDTH = 220;
const CARD_HEIGHT = Math.round(CARD_WIDTH * (9 / 16));

// Rank card is wider to show the large number
const RANK_CARD_WIDTH = 260;
const RANK_CARD_HEIGHT = Math.round(RANK_CARD_WIDTH * (9 / 16));

type CardVariant = 'default' | 'rank' | 'continue' | 'full';

// Forma mínima y desacoplada del modelo real (Video/Series de
// @carp-partners/api-client) — cada pantalla adapta sus datos a esta forma.
// Todo lo que no sea id/title/thumbnail_url es opcional y puramente visual.
export interface VideoCardItem {
  id: string;
  title: string;
  thumbnail_url: string | null;
  /** Etiqueta de la píldora inferior derecha (p. ej. "34 min" o "8 episodios"). Si no se pasa, no se muestra píldora. */
  metaLabel?: string | null;
  /** Etiqueta pequeña sobre el título (p. ej. "EP. 3"). */
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

  if (variant === 'rank') {
    cardWidth = RANK_CARD_WIDTH;
    cardHeight = RANK_CARD_HEIGHT;
  } else if (variant === 'full') {
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
      {/* Thumbnail */}
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
          locations={[0.3, 0.7, 1]}
          style={styles.scrim}
        />

        {/* NEW badge */}
        {item.isNew && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NUEVO</Text>
          </View>
        )}

        {/* Meta pill */}
        {item.metaLabel && (
          <View style={styles.durationPill}>
            <Text style={styles.durationText}>{item.metaLabel}</Text>
          </View>
        )}

        {/* Rank number overlay */}
        {variant === 'rank' && item.rank != null && (
          <View style={styles.rankOverlay}>
            <Text style={styles.rankText}>{item.rank}</Text>
          </View>
        )}
      </View>

      {/* Progress bar */}
      {showProgress && (
        <View style={[styles.progressTrack, { width: cardWidth }]}>
          <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
        </View>
      )}

      {/* Info */}
      <View style={styles.info}>
        {item.episodeLabel && (
          <Text style={styles.episode} numberOfLines={1}>
            {item.episodeLabel}
          </Text>
        )}
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
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
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  newBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.brandBright,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.badge,
  },
  newBadgeText: {
    ...textStyles.kicker,
    fontSize: 9,
    color: colors.white,
  },
  durationPill: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
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
    bottom: -6,
    left: 6,
  },
  rankText: {
    fontFamily: 'Sora_800ExtraBold',
    fontSize: 72,
    lineHeight: 80,
    color: colors.textPrimary,
    opacity: 0.15,
  },
  progressTrack: {
    height: 3,
    backgroundColor: colors.surface2,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: -6, // sit just below the card
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.brandBright,
    borderRadius: 2,
  },
  info: {
    gap: 2,
    paddingHorizontal: 2,
  },
  episode: {
    ...textStyles.kicker,
    color: colors.brandBright,
  },
  title: {
    ...textStyles.cardTitle,
    color: colors.textPrimary,
  },
});
