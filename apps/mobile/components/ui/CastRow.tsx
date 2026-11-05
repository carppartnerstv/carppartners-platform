import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import type { CrewMember } from '@carp-partners/api-client';
import { colors, spacing } from '../../theme';
import { Avatar } from './Avatar';
import { ROLE_LABELS } from '../../lib/constants';

type CastMember = Pick<CrewMember, 'id' | 'name' | 'slug' | 'role' | 'avatar_url'>;

interface CastRowProps {
  crew: CastMember[];
  onPressMember?: (member: CastMember) => void;
}

// Sección "Reparto" de la ficha de vídeo. No se renderiza si el vídeo no
// tiene nadie asignado — nunca se muestra vacía ni con un placeholder.
export function CastRow({ crew, onPressMember }: CastRowProps) {
  if (crew.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Reparto</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
        {crew.map((member, index) => (
          <React.Fragment key={member.id}>
            {index > 0 && <View style={{ width: spacing.lg }} />}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => onPressMember?.(member)}
              style={styles.item}
            >
              <Avatar uri={member.avatar_url} name={member.name} size="lg" />
              <Text style={styles.name}>{member.name}</Text>
              <Text style={styles.role} numberOfLines={1}>{ROLE_LABELS[member.role]}</Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 14 },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textFaint,
    paddingHorizontal: spacing.pagePaddingH,
  },
  list: { paddingHorizontal: spacing.pagePaddingH },
  item: { width: 88, alignItems: 'center', gap: 6 },
  name: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    lineHeight: 16,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  role: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 14,
    color: colors.brandBright,
    textAlign: 'center',
  },
});
