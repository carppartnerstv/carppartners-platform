// Ficha de vídeo — pantalla MÍNIMA (hero, título, sinopsis, metadatos y
// Reparto). No pretende igualar la ficha completa de la web: sin diálogo de
// valoración, sin Mi Lista, sin reproductor conectado. El objetivo aquí es
// solo dar un sitio real desde el que abrir el Perfil de miembro.
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { IconArrowLeft, IconPlayerPlayFilled } from '@tabler/icons-react-native';
import { colors, textStyles, spacing, radii } from '../../theme';
import { Spinner, CastRow, Button } from '../../components/ui';
import { getVideo } from '../../data';
import type { MockVideo } from '../../data/mock/videos';
import type { MockCrewMember } from '../../data/mock/crew';

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

export default function VideoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [video, setVideo] = useState<MockVideo | null>(null);
  const [crew, setCrew] = useState<MockCrewMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getVideo(id).then((res) => {
      if (cancelled) return;
      setVideo(res.video);
      setCrew(res.crew);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [id]);

  // router.back() desde el perfil de miembro ya vuelve exactamente aquí:
  // al ser un stack de navegación real, no hace falta pasar de dónde venimos.
  const openMember = useCallback(
    (member: MockCrewMember) => router.push({ pathname: '/crew/[slug]', params: { slug: member.slug } }),
    [router],
  );

  if (loading || !video) {
    return (
      <SafeAreaView style={styles.safe}>
        <Spinner centered />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          {video.thumbnail_url ? (
            <Image source={{ uri: video.thumbnail_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
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
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.backButton}
          >
            <IconArrowLeft size={22} color={colors.white} />
          </TouchableOpacity>
        </View>

        {/* Contenido */}
        <View style={styles.content}>
          <Text style={styles.title}>{video.title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{formatDuration(video.duration_sec)}</Text>
            {video.episode_num != null && (
              <>
                <View style={styles.dot} />
                <Text style={styles.metaText}>Episodio {video.episode_num}</Text>
              </>
            )}
          </View>

          <View style={{ marginTop: spacing.lg, alignItems: 'flex-start' }}>
            <Button
              variant="primary"
              size="md"
              icon={<IconPlayerPlayFilled size={18} color={colors.white} />}
            >
              Reproducir
            </Button>
          </View>

          {video.description && (
            <Text style={styles.synopsis}>{video.description}</Text>
          )}
        </View>

        <View style={{ height: spacing.sectionGap }} />

        {/* Reparto — solo aparece si el vídeo tiene personas asignadas */}
        <CastRow crew={crew} onPressMember={openMember} />

        <View style={{ height: spacing['4xl'] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const HERO_HEIGHT = 260;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  hero: { height: HERO_HEIGHT, backgroundColor: colors.surface },
  backButton: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.pagePaddingH,
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: colors.borderMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.pagePaddingH,
    marginTop: -spacing['3xl'],
  },
  title: {
    ...textStyles.detailTitle,
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  metaText: {
    ...textStyles.bodySm,
    color: colors.textMuted,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.textFaint,
  },
  synopsis: {
    ...textStyles.body,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sectionGap,
  },
});
