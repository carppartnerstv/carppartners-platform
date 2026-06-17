import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, textStyles } from '../../theme';

type BadgeVariant = 'new' | 'gold' | 'brand' | 'muted' | 'error';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  new: { bg: colors.brandBright, text: colors.white },
  gold: { bg: colors.goldFill, text: colors.textInverse },
  brand: { bg: colors.brand, text: colors.white },
  muted: { bg: colors.surface2, text: colors.textMuted },
  error: { bg: colors.errorDim, text: colors.error },
};

export function Badge({ label, variant = 'muted' }: BadgeProps) {
  const v = variantStyles[variant];
  return (
    <View style={[styles.badge, { backgroundColor: v.bg }]}>
      <Text style={[styles.text, { color: v.text }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.badge,
  },
  text: {
    ...textStyles.kicker,
    fontSize: 10,
  },
});
