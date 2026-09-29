import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconLock } from '@tabler/icons-react-native';
import { colors, textStyles, spacing } from '../theme';
import { Button } from '../components/ui';
import { useSession } from '../context/SessionContext';

// Pantalla para una cuenta con sesión iniciada pero sin suscripción vigente.
// La app es una "Reader App": no vende ni gestiona suscripciones, así que
// esta pantalla es deliberadamente neutra — sin botón/enlace a la web, sin
// precios ni planes. Solo informa y deja dos salidas: volver a comprobar
// (por si se acaba de suscribir desde la web) o cerrar sesión.
export default function NoSubscriptionScreen() {
  const { user, refresh, logout } = useSession();
  const [checking, setChecking] = useState(false);
  const [stillNone, setStillNone] = useState(false);

  const handleRefresh = async () => {
    setChecking(true);
    setStillNone(false);
    try {
      // Si ahora sí tiene suscripción vigente, el _layout raíz redirige solo a (tabs).
      await refresh();
      setStillNone(true);
    } catch {
      setStillNone(true);
    } finally {
      setChecking(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <IconLock size={34} color={colors.textMuted} />
        </View>
        <Text style={styles.title}>Tu cuenta no tiene una suscripción activa</Text>
        <Text style={styles.body}>
          {user?.email ? `Has iniciado sesión como ${user.email}, pero ` : 'Has iniciado sesión, pero '}
          esta cuenta no tiene ahora mismo una suscripción vigente, así que no podemos mostrarte el contenido.
        </Text>
        <Text style={styles.body}>
          Las suscripciones no se gestionan desde la aplicación.
        </Text>

        {stillNone && (
          <Text style={styles.stillNone}>Sigue sin constar una suscripción activa en esta cuenta.</Text>
        )}

        <View style={styles.actions}>
          <Button variant="primary" size="lg" fullWidth loading={checking} onPress={handleRefresh}>
            Volver a comprobar
          </Button>
          <Button variant="ghost" size="md" fullWidth onPress={logout}>
            Cerrar sesión
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    gap: spacing.md,
  },
  iconWrap: { marginBottom: spacing.md, opacity: 0.6 },
  title: {
    ...textStyles.pageTitle,
    color: colors.white,
    textAlign: 'center',
  },
  body: {
    ...textStyles.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  stillNone: {
    ...textStyles.bodySm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  actions: {
    alignSelf: 'stretch',
    marginTop: spacing['2xl'],
    gap: spacing.sm,
  },
});
