import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { colors } from '../../theme';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  centered?: boolean;
}

const sizes = { sm: 'small', md: 'large', lg: 'large' } as const;

export function Spinner({ size = 'md', color = colors.brandBright, centered = false }: SpinnerProps) {
  const indicator = <ActivityIndicator size={sizes[size]} color={color} />;
  if (!centered) return indicator;
  return <View style={styles.centered}>{indicator}</View>;
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
