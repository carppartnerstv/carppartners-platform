import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  type TextInputProps,
} from 'react-native';
import { colors, radii, textStyles, spacing } from '../../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  onRightIconPress,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.error
    : focused
    ? colors.brandBright
    : colors.border;

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={[styles.inputRow, { borderColor }]}>
        {leftIcon && <View style={styles.sideIcon}>{leftIcon}</View>}

        <TextInput
          style={[styles.input, leftIcon ? styles.inputWithLeft : null]}
          placeholderTextColor={colors.textFaint}
          selectionColor={colors.brandBright}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />

        {rightIcon && (
          <TouchableOpacity
            style={styles.sideIcon}
            onPress={onRightIconPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>

      {(error || hint) && (
        <Text style={[styles.helperText, error ? styles.errorText : styles.hintText]}>
          {error ?? hint}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: {
    ...textStyles.label,
    color: colors.textSecondary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    ...textStyles.body,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  inputWithLeft: {
    paddingLeft: spacing.sm,
  },
  sideIcon: {
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperText: {
    ...textStyles.bodyXs,
    marginTop: 2,
  },
  errorText: { color: colors.error },
  hintText: { color: colors.textMuted },
});
