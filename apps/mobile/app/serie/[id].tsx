import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { IconArrowLeft, IconChevronDown, IconPlayerPlayFilled } from '@tabler/icons-react-native';
import type { SeriesDetail, SeriesSeason, Video } from '@carp-partners/api-client';
import { colors, textStyles, spacing, radii } from '../../theme';
import { Spinner, ReadMoreText } from '../../components/ui';
import { apiClient } from '../../lib/apiClient';
import { stripHtml, formatDurationShort } from '../../lib/format';

export default function SeriesDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [detail, setDetail] = useState<SeriesDetail | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<SeriesSeason | null>(null);
  const [episodes, setEpisodes] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEpisodes, setLoadingEpisodes] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    apiClient.getSeriesDetail(id).then((data) => {
      if (cancelled) return;
      setDetail(data);
      setSelectedSeason(data.seasons[0] ?? null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!detail) return;
    const seriesId = selectedSeason ? selectedSeason.id : detail.series.id;
    let cancelled = false;
    setLoadingEpisodes(true);
    apiClient.getVideos({ series: seriesId, limit: 100 }).then(({ videos }) => {
      if (cancelled) return;
      setEpisodes(videos);
      setLoadingEpisodes(false);
    });
    return () => { cancelled = true; };
  }, [detail, selectedSeason]);

  if (loading || !detail) {
    return (
      <SafeAreaView style={styles.safe}>
        <Spinner centered />
      </SafeAreaView>
    );
  }

  const { series, seasons } = detail;
  const hasSeasons = seasons.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {series.cover_url ? (
            <Image source={{ uri: series.cover_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />
          )}
          <LinearGradient
            colors={[colors.scrimNone, colors.scrimHalf, colors.scrimFull]}
            locations={[0.35, 0.7, 1]}
            style={StyleSheet.absoluteFill}
          />
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <IconArrowLeft size={18} color={colors.white} />
          </TouchableOpacity>
          {episodes[0] && (
            <TouchableOpacity
              style={styles.playCircle}
              onPress={() => router.push(`/watch/${episodes[0].id}/play`)}
              activeOpacity={0.85}
            >
              <IconPlayerPlayFilled size={26} color={colors.textInverse} style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{series.title}</Text>
          {series.description && (
            <View style={{ marginTop: spacing.md, marginBottom: spacing.lg }}>
              <ReadMoreText text={stripHtml(series.description)} />
            </View>
          )}

          {hasSeasons && (
            <View style={styles.seasonWrap}>
              <TouchableOpacity style={styles.seasonButton} onPress={() => setMenuOpen((o) => !o)}>
                <IconChevronDown size={14} color={colors.textPrimary} />
                <Text style={styles.seasonButtonText}>
                  {selectedSeason ? `Temporada ${selectedSeason.season_num ?? ''}` : series.title}
                </Text>
              </TouchableOpacity>
              {menuOpen && (
                <View style={styles.seasonMenu}>
                  {seasons.map((s) => {
                    const active = selectedSeason?.id === s.id;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.seasonOption, active && { backgroundColor: colors.brandDim }]}
                        onPress={() => { setSelectedSeason(s); setMenuOpen(false); }}
                      >
                        <Text style={[styles.seasonOptionText, { color: active ? colors.white : colors.textSecondary, fontFamily: active ? 'Inter_700Bold' : 'Inter_500Medium' }]}>
                          Temporada {s.season_num ?? ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          <View style={styles.episodeList}>
            {loadingEpisodes ? (
              <Spinner centered />
            ) : episodes.length === 0 ? (
              <Text style={styles.emptyText}>Todavía no hay episodios publicados.</Text>
            ) : (
              episodes.map((ep, index) => (
                <TouchableOpacity
                  key={ep.id}
                  style={styles.episodeRow}
                  activeOpacity={0.75}
                  onPress={() => router.push(`/watch/${ep.id}`)}
                >
                  <Text style={styles.episodeNum}>{ep.episode_num ?? index + 1}</Text>
                  <View style={styles.episodeThumb}>
                    {ep.thumbnail_url && <Image source={{ uri: ep.thumbnail_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
                    <View style={styles.episodePlayIcon}>
                      <IconPlayerPlayFilled size={11} color={colors.white} />
                    </View>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.episodeTitle} numberOfLines={1}>{ep.title}</Text>
                    <Text style={styles.episodeDur}>{formatDurationShort(ep.duration_sec)}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const HERO_HEIGHT_RATIO = 4 / 3;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  hero: { aspectRatio: HERO_HEIGHT_RATIO, backgroundColor: colors.surface },
  backButton: {
    position: 'absolute', top: spacing.lg, left: spacing.pagePaddingH,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(6,9,12,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  playCircle: {
    position: 'absolute', left: '50%', top: '50%',
    marginLeft: -30, marginTop: -30,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center',
  },
  content: { paddingHorizontal: spacing.pagePaddingH, paddingTop: spacing.lg, paddingBottom: spacing['4xl'] },
  title: {
    fontFamily: 'Sora_800ExtraBold',
    fontSize: 22, lineHeight: 27,
    color: colors.white,
  },
  seasonWrap: { marginBottom: spacing.lg },
  seasonButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radii.md,
    backgroundColor: colors.surface2,
  },
  seasonButtonText: { ...textStyles.label, color: colors.textPrimary },
  seasonMenu: {
    marginTop: 6,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.menu,
    overflow: 'hidden',
    minWidth: 160,
  },
  seasonOption: { paddingHorizontal: 14, paddingVertical: 10 },
  seasonOptionText: { fontSize: 13 },
  episodeList: { gap: spacing.md },
  emptyText: { ...textStyles.bodySm, color: colors.textFaint, textAlign: 'center', paddingVertical: spacing['2xl'] },
  episodeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  episodeNum: {
    fontFamily: 'Sora_700Bold', fontSize: 15,
    color: colors.textFaint,
    width: 18, textAlign: 'center',
  },
  episodeThumb: {
    width: 88, height: 52, borderRadius: 7,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  episodePlayIcon: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.15)' },
  episodeTitle: { ...textStyles.bodySm, color: colors.textPrimary, fontFamily: 'Inter_600SemiBold' },
  episodeDur: { ...textStyles.bodyXs, color: colors.textFaint, marginTop: 2 },
});
