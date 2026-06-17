import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  type TouchableOpacityProps,
} from 'react-native';
import { colors, radii, textStyles } from '../../theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  children: React.ReactNode;
}

interface VariantConfig {
  bg: string;
  text: string;
  border?: string;
}

const variants: Record<ButtonVariant, VariantConfig> = {
  primary: { bg: colors.brandBright, text: colors.white },
  secondary: { bg: colors.surface2, text: colors.textPrimary },
  ghost: { bg: colors.transparent, text: colors.textSecondary },
  outline: { bg: colors.transparent, text: colors.textPrimary, border: colors.borderMedium },
  danger: { bg: colors.errorDim, text: colors.error, border: colors.error },
};

const sizeStyles: Record<ButtonSize, { paddingH: number; paddingV: number; textStyle: object }> = {
  sm: { paddingH: 14, paddingV: 8, textStyle: textStyles.buttonSm },
  md: { paddingH: 20, paddingV: 12, textStyle: textStyles.button },
  lg: { paddingH: 28, paddingV: 16, textStyle: textStyles.buttonLg },
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const v = variants[variant];
  const s = sizeStyles[size];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      disabled={isDisabled}
      style={[
        styles.base,
        {
          backgroundColor: v.bg,
          paddingHorizontal: s.paddingH,
          paddingVertical: s.paddingV,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border ?? colors.transparent,
          opacity: isDisabled ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.text} />
      ) : (
        <View style={styles.inner}>
          {icon && <View style={styles.icon}>{icon}</View>}
          <Text style={[s.textStyle, { color: v.text }]}>{children}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
