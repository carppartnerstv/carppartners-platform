import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, SplashScreen, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
  Sora_800ExtraBold,
} from '@expo-google-fonts/sora';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { colors } from '../theme';
import { SessionProvider, useSession } from '../context/SessionContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
    Sora_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <SessionProvider>
          <AppShell fontsReady={fontsLoaded || !!fontError} />
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Separado del RootLayout para poder leer useSession() (necesita estar
// dentro de <SessionProvider>) y decidir a qué grupo de rutas mandar al
// usuario — login si no hay sesión, tabs si la hay.
function AppShell({ fontsReady }: { fontsReady: boolean }) {
  const { status } = useSession();
  const segments = useSegments();
  const router = useRouter();

  // Mantiene la splash nativa hasta tener fuentes Y sesión resueltas, así no
  // hay parpadeo de spinner propio entre la splash y la pantalla correcta.
  useEffect(() => {
    if (fontsReady && status !== 'loading') {
      SplashScreen.hideAsync();
    }
  }, [fontsReady, status]);

  useEffect(() => {
    if (status === 'loading') return;
    const inAuthGroup = segments[0] === '(auth)';
    if (status === 'unauthenticated' && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (status === 'authenticated' && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [status, segments, router]);

  if (!fontsReady) return null;

  return (
    <>
      <StatusBar style="light" backgroundColor={colors.bg} />
      <View style={styles.root}>
        {/* Cabecera nativa oculta: cada pantalla dibuja la suya propia,
            consistente con el resto del sistema de diseño (fully custom UI). */}
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
