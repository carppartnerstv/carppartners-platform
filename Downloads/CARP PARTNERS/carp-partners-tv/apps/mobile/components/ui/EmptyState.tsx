import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, textStyles, spacing } from '../../theme';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <View style={styles.wrapper}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text style={styles.title}>{title}</Text>
      {body && <Text style={styles.body}>{body}</Text>}
      {action && (
        <View style={styles.action}>
          <Button variant="outline" size="md" onPress={action.onPress}>
            {action.label}
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['4xl'],
    paddingVertical: spacing['3xl'],
    gap: spacing.md,
  },
  icon: {
    marginBottom: spacing.sm,
    opacity: 0.4,
  },
  title: {
    ...textStyles.sectionTitle,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    ...textStyles.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  action: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
});
