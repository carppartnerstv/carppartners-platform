import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconThumbDown, IconThumbDownFilled, IconThumbUp, IconThumbUpFilled } from '@tabler/icons-react-native';
import { colors, radii, textStyles, spacing } from '../../theme';

export type RatingValue = 'down' | 'like' | 'love';

interface RatingSheetProps {
  visible: boolean;
  value: RatingValue | null;
  onChange: (value: RatingValue | null) => void;
  onClose: () => void;
}

const CONFIRM_TEXT: Record<RatingValue, string> = {
  down: 'Gracias, ajustaremos tus recomendaciones',
  like: 'Gracias por tu valoración',
  love: '¡Te encanta! Buscaremos más como este',
};

// Bottom sheet (no modal centrado) para valorar un vídeo — thumb-down / up /
// doble-up ("me encantó"). Pulsar la opción ya elegida la quita.
export function RatingSheet({ visible, value, onChange, onClose }: RatingSheetProps) {
  const insets = useSafeAreaInsets();

  const toggle = (v: RatingValue) => onChange(value === v ? null : v);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>¿Qué te ha parecido?</Text>

          <View style={styles.options}>
            <RatingOption
              active={value === 'down'}
              activeColor="#c0392b"
              label="No me gustó"
              onPress={() => toggle('down')}
            >
              {value === 'down' ? <IconThumbDownFilled size={22} color={colors.white} /> : <IconThumbDown size={22} color={colors.textSecondary} />}
            </RatingOption>

            <RatingOption
              active={value === 'like'}
              activeColor={colors.brandBright}
              label="Me gustó"
              onPress={() => toggle('like')}
            >
              {value === 'like' ? <IconThumbUpFilled size={22} color={colors.white} /> : <IconThumbUp size={22} color={colors.textSecondary} />}
            </RatingOption>

            <RatingOption
              active={value === 'love'}
              activeColor={colors.brandBright}
              label="Me encantó"
              onPress={() => toggle('love')}
            >
              <View style={{ flexDirection: 'row', marginLeft: -6 }}>
                {value === 'love' ? (
                  <>
                    <IconThumbUpFilled size={16} color={colors.white} style={{ transform: [{ rotate: '-8deg' }] }} />
                    <IconThumbUpFilled size={16} color={colors.white} style={{ transform: [{ rotate: '8deg' }], marginLeft: -4 }} />
                  </>
                ) : (
                  <>
                    <IconThumbUp size={16} color={colors.textSecondary} style={{ transform: [{ rotate: '-8deg' }] }} />
                    <IconThumbUp size={16} color={colors.textSecondary} style={{ transform: [{ rotate: '8deg' }], marginLeft: -4 }} />
                  </>
                )}
              </View>
            </RatingOption>
          </View>

          {value && <Text style={styles.confirmText}>{CONFIRM_TEXT[value]}</Text>}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function RatingOption({
  active, activeColor, label, onPress, children,
}: {
  active: boolean; activeColor: string; label: string; onPress: () => void; children: React.ReactNode;
}) {
  return (
    <TouchableOpacity style={styles.option} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.circle, { backgroundColor: active ? activeColor : colors.surface2 }]}>
        {children}
      </View>
      <Text style={[styles.optionLabel, { color: active ? colors.textPrimary : colors.textMuted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    ...Platform.select({ web: { cursor: 'default' } as object }),
  },
  sheet: {
    backgroundColor: '#12171b',
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    paddingTop: spacing.xl,
    paddingHorizontal: spacing['2xl'],
  },
  handle: {
    width: 36, height: 4, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...textStyles.sectionTitle,
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  options: { flexDirection: 'row', justifyContent: 'center', gap: spacing['2xl'] },
  option: { alignItems: 'center', gap: 8 },
  circle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { ...textStyles.bodyXs },
  confirmText: {
    ...textStyles.bodySm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
