import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type TextStyle } from 'react-native';
import { colors, textStyles, spacing } from '../../theme';

interface ReadMoreTextProps {
  text: string;
  /** Nº de líneas visibles cuando está colapsado */
  numberOfLines?: number;
  /** Por debajo de este nº de palabras, se muestra siempre entera (sin "Leer más") */
  wordThreshold?: number;
  style?: TextStyle;
}

export function ReadMoreText({ text, numberOfLines = 4, wordThreshold = 55, style }: ReadMoreTextProps) {
  const [expanded, setExpanded] = useState(false);

  const isLong = useMemo(
    () => text.trim().split(/\s+/).filter(Boolean).length > wordThreshold,
    [text, wordThreshold],
  );

  return (
    <View>
      <Text style={[styles.text, style]} numberOfLines={isLong && !expanded ? numberOfLines : undefined}>
        {text}
      </Text>
      {isLong && (
        <TouchableOpacity
          onPress={() => setExpanded((e) => !e)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.toggle}
        >
          <Text style={styles.toggleText}>{expanded ? 'Leer menos' : 'Leer más'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    ...textStyles.body,
    color: colors.textSecondary,
  },
  toggle: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  toggleText: {
    ...textStyles.labelSm,
    color: colors.brandBright,
  },
});
