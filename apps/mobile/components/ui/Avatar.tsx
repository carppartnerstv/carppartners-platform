import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, textStyles, radii } from '../../theme';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  name?: string | null;
  uri?: string | null;
  size?: AvatarSize;
}

const sizes: Record<AvatarSize, { dim: number; fontSize: number }> = {
  sm: { dim: 28, fontSize: 12 },
  md: { dim: 40, fontSize: 16 },
  lg: { dim: 56, fontSize: 22 },
  xl: { dim: 80, fontSize: 32 },
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, uri, size = 'md' }: AvatarProps) {
  const { dim, fontSize } = sizes[size];

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.base, { width: dim, height: dim, borderRadius: radii.avatar }]}
        resizeMode="cover"
      />
    );
  }

  const initials = name ? getInitials(name) : '?';

  return (
    <View style={[styles.base, styles.fallback, { width: dim, height: dim, borderRadius: radii.avatar }]}>
      <Text style={[textStyles.sectionTitle, { fontSize, color: colors.white }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  fallback: {
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
