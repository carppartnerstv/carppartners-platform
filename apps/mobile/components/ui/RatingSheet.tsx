import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { IconThumbDown, IconThumbDownFilled, IconThumbUp, IconThumbUpFilled, IconX, IconCheck } from '@tabler/icons-react-native';
import { colors, radii, textStyles, spacing } from '../../theme';

export type RatingValue = 'down' | 'like' | 'love';

interface RatingSheetProps {
  visible: boolean;
  /** Título del vídeo — se muestra como subtítulo, igual que en la web. */
  videoTitle?: string;
  value: RatingValue | null;
  onChange: (value: RatingValue | null) => void;
  onClose: () => void;
}

interface RatingMeta {
  color: string;
  borderColor: string;
  bgColor: string;
}

// Mismo icono/color por voto que RatingDialog.tsx (web) — única fuente de
// verdad visual, para que coincida con el botón disparador del detalle.
const RATING_META: Record<RatingValue, RatingMeta> = {
  down: { color: '#c0392b', borderColor: 'rgba(192,57,43,0.55)', bgColor: 'rgba(192,57,43,0.12)' },
  like: { color: colors.brandBright, borderColor: 'rgba(207,74,53,0.55)', bgColor: 'rgba(104,20,11,0.12)' },
  love: { color: colors.brandBright, borderColor: 'rgba(207,74,53,0.55)', bgColor: 'rgba(104,20,11,0.12)' },
};

const LABELS: Record<RatingValue, string> = {
  down: 'No es\npara mí',
  like: 'Me gusta',
  love: 'Me encanta',
};

const CONFIRM_TEXT: Record<RatingValue, string> = {
  down: 'Gracias, ajustaremos tus recomendaciones',
  like: 'Gracias por tu valoración',
  love: '¡Te encanta! Buscaremos más como este',
};

const OPTIONS: RatingValue[] = ['down', 'like', 'love'];

// Diálogo centrado (no bottom sheet) — igual que RatingDialog.tsx (web):
// tarjeta con esquinas redondeadas en los 4 lados, botón de cerrar arriba a
// la derecha, título + título del vídeo como subtítulo, y las 3 opciones
// como tarjetas con borde (no solo círculo + etiqueta suelta).
export function RatingSheet({ visible, videoTitle, value, onChange, onClose }: RatingSheetProps) {
  const toggle = (v: RatingValue) => onChange(value === v ? null : v);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.card}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <IconX size={17} color={colors.textSecondary} />
          </TouchableOpacity>

          <Text style={styles.title}>¿Qué te ha parecido?</Text>
          {!!videoTitle && <Text style={styles.subtitle} numberOfLines={1}>{videoTitle}</Text>}

          <View style={styles.options}>
            {OPTIONS.map((key) => {
              const meta = RATING_META[key];
              const selected = value === key;
              const iconColor = selected ? colors.white : colors.textSecondary;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => toggle(key)}
                  activeOpacity={0.75}
                  style={[
                    styles.option,
                    {
                      backgroundColor: selected ? meta.bgColor : 'rgba(255,255,255,0.03)',
                      borderColor: selected ? meta.borderColor : 'rgba(255,255,255,0.08)',
                    },
                  ]}
                >
                  <View style={[styles.circle, { backgroundColor: selected ? meta.color : 'rgba(255,255,255,0.06)' }]}>
                    {key === 'love' ? (
                      <View style={{ width: 38, height: 38 }}>
                        {selected ? (
                          <>
                            <IconThumbUpFilled size={19} color={iconColor} style={[styles.loveIcon, { left: 2, transform: [{ rotate: '-8deg' }] }]} />
                            <IconThumbUpFilled size={19} color={iconColor} style={[styles.loveIcon, { right: 2, transform: [{ rotate: '8deg' }] }]} />
                          </>
                        ) : (
                          <>
                            <IconThumbUp size={19} color={iconColor} style={[styles.loveIcon, { left: 2, transform: [{ rotate: '-8deg' }] }]} />
                            <IconThumbUp size={19} color={iconColor} style={[styles.loveIcon, { right: 2, transform: [{ rotate: '8deg' }] }]} />
                          </>
                        )}
                      </View>
                    ) : key === 'down' ? (
                      selected ? <IconThumbDownFilled size={24} color={iconColor} /> : <IconThumbDown size={24} color={iconColor} />
                    ) : (
                      selected ? <IconThumbUpFilled size={24} color={iconColor} /> : <IconThumbUp size={24} color={iconColor} />
                    )}
                  </View>
                  <Text style={[styles.optionLabel, { color: selected ? colors.textPrimary : colors.textSecondary }]}>
                    {LABELS[key]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {value && (
            <View style={styles.confirmRow}>
              <IconCheck size={15} color={colors.brandBright} />
              <Text style={styles.confirmText}>{CONFIRM_TEXT[value]}</Text>
            </View>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,6,8,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    ...Platform.select({ web: { cursor: 'default' } as object }),
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#0e151a',
    borderRadius: radii['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingTop: 30,
    paddingBottom: 26,
    paddingHorizontal: spacing['2xl'],
  },
  closeButton: {
    position: 'absolute', top: 14, right: 14,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontFamily: 'Sora_700Bold',
    fontSize: 19,
    color: colors.white,
    textAlign: 'center',
  },
  subtitle: {
    ...textStyles.bodySm,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.xl,
  },
  options: { flexDirection: 'row', gap: 12 },
  option: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  circle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  loveIcon: { position: 'absolute', top: 10 },
  optionLabel: { ...textStyles.bodyXs, fontFamily: 'Inter_600SemiBold', textAlign: 'center', lineHeight: 15 },
  confirmRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: spacing.xl,
  },
  confirmText: { ...textStyles.bodyXs, color: colors.brandBright, textAlign: 'center' },
});
