import React, { useRef } from 'react';
import { View, Image, Animated, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { IconSearch } from '@tabler/icons-react-native';
import { colors, spacing } from '../../theme';

// Alto del contenido de la cabecera (sin contar el inset de la safe area
// superior) — úsalo para calcular cuánto padding superior necesita el
// contenido de pantallas que no deban quedar tapadas por la cabecera.
export const APP_HEADER_CONTENT_HEIGHT = 46;

interface AppHeaderProps {
  /** Animated.Value del scroll de la pantalla — si se pasa, el fondo pasa de
   * transparente a cristal esmerilado al superar 40px (igual que en la web).
   * Si no se pasa, el fondo se queda siempre visible. */
  scrollY?: Animated.Value;
}

// Cabecera superior (logo + buscador), persistente en las 4 pestañas —
// antes solo vivía en Home.
export function AppHeader({ scrollY }: AppHeaderProps) {
  const router = useRouter();
  // Si no se pasa scrollY (pantalla sin seguimiento de scroll), usamos un
  // valor fijo ya por encima del umbral para que el fondo quede siempre visible.
  const staticScrollY = useRef(new Animated.Value(40)).current;
  const headerBgOpacity = (scrollY ?? staticScrollY).interpolate({
    inputRange: [0, 40],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView edges={['top']} style={styles.topBar}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: headerBgOpacity }]} pointerEvents="none">
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(6,9,12,0.82)' }]} />
        <View style={styles.topBarBorder} />
      </Animated.View>
      <Image
        source={require('../../assets/carp-partners-logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <TouchableOpacity
        onPress={() => router.push('/(tabs)/explore')}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.searchButton}
      >
        <IconSearch size={19} color={colors.textPrimary} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.pagePaddingH + 2,
    paddingTop: 10,
    paddingBottom: 10,
    overflow: 'hidden',
  },
  topBarBorder: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  logo: {
    width: 150,
    height: 26,
  },
  searchButton: {
    width: 34, height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
