// Perfil de miembro de la crew — se abre desde el Reparto de una ficha de
// vídeo o desde la pestaña "Crew" de Explorar. Al ser un stack de navegación
// real, "volver" ya hace lo correcto sin ningún truco de replace.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Animated, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  IconArrowLeft,
  IconHome,
  IconCompass,
  IconBookmark,
  IconUser,
} from '@tabler/icons-react-native';
import type { CrewMember, Video } from '@carp-partners/api-client';
import { colors, textStyles, spacing } from '../../theme';
import { Spinner, ReadMoreText } from '../../components/ui';
import { AppHeader, APP_HEADER_CONTENT_HEIGHT } from '../../components/ui/AppHeader';
import { Row } from '../../components/ui/Row';
import type { VideoCardItem } from '../../components/ui';
import { apiClient } from '../../lib/apiClient';
import { ROLE_LABELS } from '../../lib/constants';
import { stripHtml } from '../../lib/format';

const FOOTER_TABS = [
  { href: '/(tabs)', label: 'Inicio', Icon: IconHome },
  { href: '/(tabs)/explore', label: 'Explorar', Icon: IconCompass },
  { href: '/(tabs)/list', label: 'Mi Lista', Icon: IconBookmark },
  { href: '/(tabs)/profile', label: 'Perfil', Icon: IconUser },
] as const;

export default function CrewMemberScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;

  const [member, setMember] = useState<CrewMember | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    apiClient.getCrew().then(({ crew }) => {
      if (cancelled) return;
      const found = crew.find((m) => m.slug === slug) ?? null;
      setMember(found);
      if (found) {
        apiClient.getVideos({ crew: found.slug, limit: 24 }).then(({ videos }) => {
          if (!cancelled) setVideos(videos);
        });
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [slug]);

  if (loading || !member) {
    return (
      <SafeAreaView style={styles.safe}>
        <Spinner centered />
      </SafeAreaView>
    );
  }

  // Mismo formato que las filas de vídeo verticales del resto de la app
  // (Home, "Vídeos con..."): portada vertical si existe, T/E/serie debajo.
  const videoCards: VideoCardItem[] = videos.map((v) => ({
    id: v.id,
    title: v.title,
    thumbnail_url: v.cover_vertical_url ?? v.thumbnail_url,
    episodeLabel: v.series_title
      ? `${v.season_num != null ? `T${v.season_num} · ` : ''}E${v.episode_num} · ${v.series_title}`
      : v.episode_num != null ? `Ep. ${v.episode_num}` : undefined,
  }));

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
        {/* Hero — foto a sangre + degradado, con el rol/nombre/nº de vídeos
            superpuestos abajo (igual que el hero de Home y que el de la
            web), y el botón Volver debajo de la cabecera, no solapado. */}
        <View style={styles.hero}>
          {member.avatar_url ? (
            <Image source={{ uri: member.avatar_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />
          )}
          <LinearGradient
            colors={[colors.scrimNone, colors.scrimHalf, colors.scrimFull]}
            locations={[0.2, 0.6, 1]}
            style={StyleSheet.absoluteFill}
          />
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backButton, { top: insets.top + APP_HEADER_CONTENT_HEIGHT + spacing.sm }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <IconArrowLeft size={16} color={colors.white} />
            <Text style={styles.backButtonText}>Volver</Text>
          </TouchableOpacity>

          <View style={styles.heroContent}>
            <Text style={styles.kicker}>{ROLE_LABELS[member.role]}</Text>
            <Text style={styles.name}>{member.name}</Text>
            <Text style={styles.videoCount}>{videos.length} vídeo{videos.length === 1 ? '' : 's'}</Text>
          </View>
        </View>

        <View style={styles.content}>
          {member.bio && (
            <View style={styles.bioWrap}>
              <ReadMoreText text={stripHtml(member.bio)} />
            </View>
          )}

          {videoCards.length > 0 && (
            <View style={styles.videosSection}>
              <Row
                title={`Vídeos con ${member.name.split(' ')[0]}`}
                items={videoCards}
                onItemPress={(v) => router.push(`/watch/${v.id}`)}
              />
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* Barra inferior — esta pantalla vive fuera del Tab Navigator (es un
          stack real para que "volver" funcione bien), así que no hay una
          tab bar nativa aquí; esto es una réplica visual que simplemente
          navega a la pestaña correspondiente al tocarla. */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingBottom: spacing['4xl'] },
  hero: { aspectRatio: 1, backgroundColor: colors.surface },
  backButton: {
    position: 'absolute', left: spacing.pagePaddingH,
    flexDirection: 'row', alignItems: 'center', gap: 7,
    height: 36, paddingHorizontal: 14, borderRadius: 9,
    backgroundColor: 'rgba(6,9,12,0.55)',
  },
  backButtonText: {
    ...textStyles.labelSm,
    color: colors.textPrimary,
  },
  heroContent: {
    position: 'absolute',
    left: spacing.pagePaddingH,
    right: spacing.pagePaddingH,
    bottom: 22,
  },
  kicker: {
    ...textStyles.kicker,
    color: colors.brandBright,
    marginBottom: 10,
  },
  name: {
    fontFamily: 'Sora_800ExtraBold',
    fontSize: 25,
    lineHeight: 30,
    color: colors.white,
    marginBottom: 8,
  },
  videoCount: {
    ...textStyles.bodySm,
    color: colors.textSecondary,
  },
  content: { paddingHorizontal: spacing.pagePaddingH, paddingTop: spacing.lg, gap: spacing.sm },
  bioWrap: {
    marginTop: 0,
  },
  videosSection: {
    marginTop: spacing.sectionGap,
    marginHorizontal: -spacing.pagePaddingH,
  },
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
