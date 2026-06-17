import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, Platform } from 'react-native';
import { colors, radii, textStyles, spacing } from '../../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  variant?: ToastVariant;
  visible: boolean;
  duration?: number;
  onHide?: () => void;
}

const variantColor: Record<ToastVariant, string> = {
  success: colors.success,
  error: colors.error,
  info: colors.info,
};

export function Toast({
  message,
  variant = 'info',
  visible,
  duration = 3000,
  onHide,
}: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(duration),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => onHide?.());
    } else {
      opacity.setValue(0);
    }
  }, [visible, duration, opacity, onHide]);

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity, bottom: insets.bottom + spacing['4xl'] },
        { borderLeftColor: variantColor[variant] },
      ]}
      pointerEvents="none"
    >
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

// Convenience hook for imperative usage
interface ToastState {
  message: string;
  variant: ToastVariant;
  visible: boolean;
}

export function useToast() {
  const [state, setState] = React.useState<ToastState>({
    message: '',
    variant: 'info',
    visible: false,
  });

  const show = React.useCallback((message: string, variant: ToastVariant = 'info') => {
    setState({ message, variant, visible: true });
  }, []);

  const hide = React.useCallback(() => {
    setState((s) => ({ ...s, visible: false }));
  }, []);

  return { toastProps: { ...state, onHide: hide }, show, hide };
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.pagePaddingH,
    right: spacing.pagePaddingH,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderLeftWidth: 3,
    padding: spacing.lg,
    ...Platform.select({ web: { cursor: 'default' } as object }),
  },
  message: {
    ...textStyles.bodySm,
    color: colors.textPrimary,
  },
});
