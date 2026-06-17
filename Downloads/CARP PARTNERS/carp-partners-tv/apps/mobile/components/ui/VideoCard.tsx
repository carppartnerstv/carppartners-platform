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
import type { MockVideo } from '../../data/mock/videos';

// Card dimensions — 16:9 ratio
const CARD_WIDTH = 220;
const CARD_HEIGHT = Math.round(CARD_WIDTH * (9 / 16));

// Rank card is wider to show the large number
const RANK_CARD_WIDTH = 260;
const RANK_CARD_HEIGHT = Math.round(RANK_CARD_WIDTH * (9 / 16));

type CardVariant = 'default' | 'rank' | 'continue' | 'full';

interface VideoCardProps {
  video: MockVideo;
  variant?: CardVariant;
  onPress?: (video: MockVideo) => void;
  onLongPress?: (video: MockVideo) => void;
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function VideoCard({ video, variant = 'default', onPress, onLongPress }: VideoCardProps) {
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

  const progressRatio =
    video.progress_sec && video.duration_sec > 0
      ? Math.min(video.progress_sec / video.duration_sec, 1)
      : 0;

  const showProgress = variant === 'continue' && progressRatio > 0;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress?.(video)}
      onLongPress={() => onLongPress?.(video)}
      style={[styles.card, { width: cardWidth }]}
    >
      {/* Thumbnail */}
      <View style={[styles.thumb, { width: cardWidth, height: cardHeight }]}>
        {video.thumbnail_url ? (
          <Image
            source={{ uri: video.thumbnail_url }}
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
        {video.is_new && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NUEVO</Text>
          </View>
        )}

        {/* Duration pill */}
        <View style={styles.durationPill}>
          <Text style={styles.durationText}>{formatDuration(video.duration_sec)}</Text>
        </View>

        {/* Rank number overlay */}
        {variant === 'rank' && video.rank != null && (
          <View style={styles.rankOverlay}>
            <Text style={styles.rankText}>{video.rank}</Text>
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
        {video.episode_num != null && (
          <Text style={styles.episode} numberOfLines={1}>
            EP. {video.episode_num}
          </Text>
        )}
        <Text style={styles.title} numberOfLines={2}>
          {video.title}
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
