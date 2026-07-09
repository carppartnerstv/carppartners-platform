import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { colors, textStyles, spacing } from '../../theme';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { ROLE_LABELS } from '../../data';
import type { MockCrewMember } from '../../data/mock/crew';

interface CastRowProps {
  crew: MockCrewMember[];
  onPressMember?: (member: MockCrewMember) => void;
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
              <Text style={styles.name} numberOfLines={1}>{member.name}</Text>
              <Badge label={ROLE_LABELS[member.role]} variant={member.role === 'socio' ? 'gold' : 'muted'} />
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  title: {
    ...textStyles.sectionTitle,
    color: colors.textPrimary,
    paddingHorizontal: spacing.pagePaddingH,
  },
  list: { paddingHorizontal: spacing.pagePaddingH },
  item: { width: 84, alignItems: 'center', gap: 6 },
  name: {
    ...textStyles.labelSm,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
