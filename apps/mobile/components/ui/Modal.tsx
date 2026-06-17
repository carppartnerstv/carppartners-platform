import React from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, textStyles, spacing } from '../../theme';
import { Button } from './Button';

interface ModalAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  actions?: ModalAction[];
}

export function Modal({ visible, onClose, title, children, actions }: ModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, spacing.lg) },
          ]}
        >
          {title && <Text style={styles.title}>{title}</Text>}
          {children && <View style={styles.body}>{children}</View>}
          {actions && actions.length > 0 && (
            <View style={styles.actions}>
              {actions.map((a) => (
                <Button
                  key={a.label}
                  variant={a.variant ?? 'secondary'}
                  size="md"
                  fullWidth
                  onPress={a.onPress}
                >
                  {a.label}
                </Button>
              ))}
            </View>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
    ...Platform.select({ web: { cursor: 'default' } as object }),
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.modal,
    borderTopRightRadius: radii.modal,
    paddingTop: spacing['2xl'],
    paddingHorizontal: spacing.pagePaddingH,
    gap: spacing.md,
  },
  title: {
    ...textStyles.sectionTitle,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  body: { gap: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
