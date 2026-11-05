import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Image, Animated, TouchableOpacity, StyleSheet, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  IconArrowLeft,
  IconChevronDown,
  IconPlayerPlayFilled,
  IconCheck,
  IconPlus,
  IconThumbUp,
  IconThumbUpFilled,
  IconShare2,
  IconHome,
  IconCompass,
  IconBookmark,
  IconUser,
} from '@tabler/icons-react-native';
import type { Category, SeriesDetail, SeriesSeason, Video } from '@carp-partners/api-client';
import { colors, textStyles, spacing, radii } from '../../theme';
import { Spinner, ReadMoreText, RatingSheet } from '../../components/ui';
import { AppHeader, APP_HEADER_CONTENT_HEIGHT } from '../../components/ui/AppHeader';
import type { RatingValue } from '../../components/ui';
import { apiClient } from '../../lib/apiClient';
import { stripHtml, formatDurationShort, formatDurationLong } from '../../lib/format';
import { renderRichText } from '../../lib/richText';

const FOOTER_TABS = [
  { href: '/(tabs)', label: 'Inicio', Icon: IconHome },
  { href: '/(tabs)/explore', label: 'Explorar', Icon: IconCompass },
  { href: '/(tabs)/list', label: 'Mi Lista', Icon: IconBookmark },
  { href: '/(tabs)/profile', label: 'Perfil', Icon: IconUser },
] as const;

const RATING_TO_VALUE: Record<number, RatingValue> = { [-1]: 'down', 1: 'like', 2: 'love' };
const VALUE_TO_RATING: Record<RatingValue, -1 | 1 | 2> = { down: -1, like: 1, love: 2 };

export default function SeriesDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;

  const [detail, setDetail] = useState<SeriesDetail | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<SeriesSeason | null>(null);
  const [episodes, setEpisodes] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEpisodes, setLoadingEpisodes] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  // Solo relevantes para películas (ver `isMovie` más abajo) — Mi Lista,
  // valoración y compartir, igual que en el detalle de un vídeo suelto.
  const [inList, setInList] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [rating, setRating] = useState<RatingValue | null>(null);
  const [ratingOpen, setRatingOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([apiClient.getSeriesDetail(id), apiClient.getCategories()]).then(([data, { categories }]) => {
      if (cancelled) return;
      setDetail(data);
      setCategories(categories);
      setSelectedSeason(data.seasons[0] ?? null);
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
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
    }).catch(() => { if (!cancelled) setLoadingEpisodes(false); });
    return () => { cancelled = true; };
  }, [detail, selectedSeason]);

  // Una "película" es una serie plana con un único episodio: no tiene
  // sentido mostrarle una lista de episodios de 1 elemento — se reproduce
  // directamente desde aquí, como en el detalle de un vídeo suelto, con sus
  // mismas acciones (Mi Lista, valorar, compartir). Calculado antes del
  // `return` de carga para poder usarlo como dependencia de un efecto sin
  // romper las reglas de los hooks.
  const isMovie = !!detail && detail.seasons.length === 0 && !loadingEpisodes && episodes.length === 1;
  const movie = isMovie ? episodes[0] : null;

  useEffect(() => {
    if (!movie) return;
    let cancelled = false;
    Promise.all([apiClient.getWatchlist(), apiClient.getVideoRating(movie.id)]).then(([{ items }, { rating: myRating }]) => {
      if (cancelled) return;
      setInList(items.some((i) => i.id === movie.id));
      setRating(myRating != null ? RATING_TO_VALUE[myRating] : null);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [movie?.id]);

  const toggleList = useCallback(async () => {
    if (!movie || listLoading) return;
    setListLoading(true);
    try {
      if (inList) {
        await apiClient.removeFromWatchlist(movie.id);
        setInList(false);
      } else {
        await apiClient.addToWatchlist(movie.id);
        setInList(true);
      }
    } catch {
      /* deja el estado como estaba */
    } finally {
      setListLoading(false);
    }
  }, [movie, inList, listLoading]);

  const handleRatingChange = useCallback(async (value: RatingValue | null) => {
    if (!movie) return;
    const previous = rating;
    setRating(value); // optimista
    try {
      if (value === null) await apiClient.deleteVideoRating(movie.id);
      else await apiClient.rateVideo(movie.id, VALUE_TO_RATING[value]);
    } catch {
      setRating(previous);
    }
  }, [movie, rating]);

  const handleShare = useCallback(async () => {
    if (!movie) return;
    const webBase = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/api\/?$/, '');
    try {
      await Share.share({ title: movie.title, message: `${movie.title} — ${webBase}/serie/${id}` });
    } catch {
      /* el usuario canceló el diálogo de compartir */
    }
  }, [movie, id]);

  if (loading || !detail) {
    return (
      <View style={styles.safe}>
        <Spinner centered />
      </View>
    );
  }

  const { series, seasons } = detail;
  const hasSeasons = seasons.length > 0;
  const category = categories.find((c) => c.id === series.category_id);
  const metaline = isMovie && movie
    ? `${new Date(movie.created_at).getFullYear()} · ${formatDurationLong(movie.duration_sec)}`
    : hasSeasons
      ? `${seasons.length} temporada${seasons.length === 1 ? '' : 's'}`
      : `${episodes.length} episodio${episodes.length === 1 ? '' : 's'}`;

  return (
    <View style={styles.safe}>
      <AppHeader scrollY={scrollY} />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
      >
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
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backButton, { top: insets.top + APP_HEADER_CONTENT_HEIGHT + spacing.sm }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
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
          {category && <Text style={styles.kicker}>{category.name}</Text>}
          <Text style={styles.title}>{series.title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaline}>{metaline}</Text>
            {isMovie && (
              <View style={styles.uhdPill}>
                <Text style={styles.uhdPillText}>4K UHD</Text>
              </View>
            )}
          </View>

          {isMovie && movie && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.playButton}
                onPress={() => router.push(`/watch/${movie.id}/play`)}
                activeOpacity={0.85}
              >
                <IconPlayerPlayFilled size={16} color={colors.white} />
                <Text style={styles.playButtonText}>Reproducir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={toggleList} disabled={listLoading} activeOpacity={0.8}>
                {inList
                  ? <IconCheck size={18} color={colors.brandBright} />
                  : <IconPlus size={18} color={colors.white} />}
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={() => setRatingOpen(true)} activeOpacity={0.8}>
                {rating
                  ? <IconThumbUpFilled size={18} color={colors.brandBright} />
                  : <IconThumbUp size={18} color={colors.textSecondary} />}
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={handleShare} activeOpacity={0.8}>
                <IconShare2 size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {series.description && (
            <View style={{ marginTop: spacing.md, marginBottom: spacing.lg }}>
              <ReadMoreText text={stripHtml(series.description)}>
                {renderRichText(series.description)}
              </ReadMoreText>
            </View>
          )}

          {!isMovie && hasSeasons && (
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

          {!isMovie && (
          <View style={styles.episodeList}>
            {loadingEpisodes ? (
              <Spinner centered />
            ) : episodes.length === 0 ? (
              <Text style={styles.emptyText}>Todavía no hay episodios publicados.</Text>
            ) : (
              episodes.map((ep, index) => (
                <TouchableOpacity
                  key={ep.id}
                  style={styles.episodeItem}
                  activeOpacity={0.75}
                  onPress={() => router.push(`/watch/${ep.id}`)}
                >
                  <View style={styles.episodeRow}>
                    <View style={styles.episodeThumb}>
                      {ep.thumbnail_url && <Image source={{ uri: ep.thumbnail_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
                      <View style={styles.episodePlayIcon}>
                        <IconPlayerPlayFilled size={11} color={colors.white} />
                      </View>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.episodeTitle} numberOfLines={1}>
                        {ep.episode_num ?? index + 1}. {ep.title}
                      </Text>
                      <Text style={styles.episodeDur}>{formatDurationShort(ep.duration_sec)}</Text>
                    </View>
                  </View>
                  {ep.description && (
                    <Text style={styles.episodeDesc} numberOfLines={2}>
                      {stripHtml(ep.description)}
                    </Text>
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* Barra inferior — esta pantalla vive fuera del Tab Navigator (stack
          real para que "volver" funcione bien), así que no hay tab bar
          nativa aquí; réplica visual que navega a la pestaña al tocarla
          (mismo patrón que crew/[slug].tsx). */}
      <View style={[styles.footer, { paddingBottom: Math.max(10, insets.bottom) }]}>
        {FOOTER_TABS.map(({ href, label, Icon }) => (
          <TouchableOpacity
            key={href}
            style={styles.footerTab}
            onPress={() => router.push(href)}
            activeOpacity={0.7}
          >
            <Icon size={22} color={colors.textFaint} />
            <Text style={styles.footerLabel}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isMovie && (
        <RatingSheet
          visible={ratingOpen}
          videoTitle={movie?.title}
          value={rating}
          onChange={handleRatingChange}
          onClose={() => setRatingOpen(false)}
        />
      )}
    </View>
  );
}

const HERO_HEIGHT_RATIO = 4 / 3;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingBottom: spacing['4xl'] },
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
  kicker: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11.5,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.brandBright,
    marginBottom: 6,
  },
  title: {
    fontFamily: 'Sora_800ExtraBold',
    fontSize: 22, lineHeight: 27,
    color: colors.white,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  metaline: {
    ...textStyles.bodySm,
    color: colors.textSecondary,
  },
  uhdPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  uhdPillText: {
    fontSize: 10.5,
    color: colors.textSecondary,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: spacing.lg },
  playButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 46, borderRadius: 9, backgroundColor: colors.brand,
  },
  playButtonText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.white },
  iconButton: {
    width: 46, height: 46, borderRadius: 9,
    backgroundColor: colors.surface2,
    alignItems: 'center', justifyContent: 'center',
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
  episodeItem: { gap: 6 },
  episodeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  episodeThumb: {
    width: 88, height: 52, borderRadius: 7,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  episodePlayIcon: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.15)' },
  episodeTitle: { ...textStyles.bodySm, color: colors.textPrimary, fontFamily: 'Inter_600SemiBold' },
  episodeDur: { ...textStyles.bodyXs, color: colors.textFaint, marginTop: 2 },
  episodeDesc: { ...textStyles.bodyXs, color: colors.textFaint, lineHeight: 16 },
  footer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: 'rgba(10,14,17,0.96)',
    paddingTop: 8,
  },
  footerTab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  footerLabel: {
    ...textStyles.tabLabel,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textFaint,
  },
});
