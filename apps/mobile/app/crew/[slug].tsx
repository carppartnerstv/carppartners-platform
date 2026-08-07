// Perfil de miembro de la crew — se abre desde el Reparto de una ficha de
// vídeo o desde la pestaña "Crew" de Explorar. Al ser un stack de navegación
// real, "volver" ya hace lo correcto sin ningún truco de replace.
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { IconArrowLeft } from '@tabler/icons-react-native';
import type { CrewMember, Video } from '@carp-partners/api-client';
import { colors, textStyles, spacing } from '../../theme';
import { Spinner, Avatar, Badge, ReadMoreText, CardGrid } from '../../components/ui';
import type { VideoCardItem } from '../../components/ui';
import { apiClient } from '../../lib/apiClient';
import { ROLE_LABELS } from '../../lib/constants';
import { stripHtml, formatDurationLong } from '../../lib/format';

export default function CrewMemberScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();

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

  const videoCards: VideoCardItem[] = videos.map((v) => ({
    id: v.id,
    title: v.title,
    thumbnail_url: v.thumbnail_url,
    metaLabel: v.duration_sec > 0 ? formatDurationLong(v.duration_sec) : undefined,
    episodeLabel: v.episode_num != null ? `EP. ${v.episode_num}` : undefined,
  }));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
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
        <View style={styles.header}>
          <Avatar uri={member.avatar_url} name={member.name} size="xl" />
          <View style={styles.headerText}>
            <Text style={styles.name}>{member.name}</Text>
            <Badge label={ROLE_LABELS[member.role]} variant={member.role === 'socio' ? 'gold' : 'muted'} />
          </View>
        </View>

        {member.bio && (
          <View style={styles.bioWrap}>
            <ReadMoreText text={stripHtml(member.bio)} />
          </View>
        )}

        {videoCards.length > 0 && (
          <View style={styles.videosSection}>
            <Text style={styles.sectionTitle}>Vídeos con {member.name.split(' ')[0]}</Text>
            <CardGrid items={videoCards} onPress={(v) => router.push(`/watch/${v.id}`)} />
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
});
