// Perfil de miembro — se abre al pulsar un avatar del Reparto en la ficha
// de vídeo. "Volver" siempre regresa a esa ficha exacta: como se llega aquí
// con router.push() desde la ficha, router.back() ya hace lo correcto (a
// diferencia de la web, aquí el stack de navegación es real, no hace falta
// ningún truco de replace).
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { IconArrowLeft } from '@tabler/icons-react-native';
import { colors, textStyles, spacing } from '../../theme';
import { Spinner, Avatar, Badge, VideoCard, ReadMoreText } from '../../components/ui';
import { getCrewMember, getVideosForCrewMember, ROLE_LABELS } from '../../data';
import type { MockCrewMember } from '../../data/mock/crew';
import type { MockVideo } from '../../data/mock/videos';

export default function CrewMemberScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();

  const [member, setMember] = useState<MockCrewMember | null>(null);
  const [videos, setVideos] = useState<MockVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCrewMember(slug).then((m) => {
      if (cancelled || !m) return;
      setMember(m);
      getVideosForCrewMember(m.id).then((vs) => { if (!cancelled) setVideos(vs); });
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Cabecera con volver */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.backButton}
        >
          <IconArrowLeft size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Perfil</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Cabecera compacta: foto + nombre + insignia en una fila */}
        <View style={styles.header}>
          <Avatar uri={member.avatar_url} name={member.name} size="xl" />
          <View style={styles.headerText}>
            <Text style={styles.name}>{member.name}</Text>
            <Badge label={ROLE_LABELS[member.role]} variant={member.role === 'socio' ? 'gold' : 'muted'} />
          </View>
        </View>

        {/* Biografía */}
        <View style={styles.bioWrap}>
          <ReadMoreText text={member.bio} />
        </View>

        {/* Vídeos con {nombre} */}
        {videos.length > 0 && (
          <View style={styles.videosSection}>
            <Text style={styles.sectionTitle}>Vídeos con {member.name}</Text>
            <View style={styles.grid}>
              {videos.map((v) => (
                <VideoCard key={v.id} video={v} onPress={(video) => router.push(`/video/${video.id}`)} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.pagePaddingH,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    ...textStyles.sectionTitle,
    color: colors.textPrimary,
  },
  content: {
    paddingHorizontal: spacing.pagePaddingH,
    paddingBottom: spacing['4xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  headerText: {
    gap: spacing.sm,
    flexShrink: 1,
  },
  name: {
    ...textStyles.detailTitle,
    fontSize: 22,
    color: colors.textPrimary,
  },
  bioWrap: {
    marginTop: spacing['2xl'],
    maxWidth: 760,
    alignSelf: 'stretch',
  },
  videosSection: {
    marginTop: spacing.sectionGap,
    gap: spacing.md,
  },
  sectionTitle: {
    ...textStyles.sectionTitle,
    color: colors.textPrimary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.rowGap,
  },
});
