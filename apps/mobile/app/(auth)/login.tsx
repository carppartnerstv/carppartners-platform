import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { IconMail, IconLock } from '@tabler/icons-react-native';
import { colors, textStyles, spacing } from '../../theme';
import { Input, Button } from '../../components/ui';
import { useSession } from '../../context/SessionContext';
import { ApiError } from '@carp-partners/api-client';

export default function LoginScreen() {
  const { login } = useSession();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      setError('Introduce tu email y contraseña.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      // El _layout raíz redirige solo a (tabs) al detectar status=authenticated.
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.logo}>
            <Text style={styles.logoText}>
              CARP<Text style={{ color: colors.brandBright }}>◆</Text>PARTNERS
            </Text>
          </View>

          <Text style={styles.title}>Bienvenido de nuevo</Text>
          <Text style={styles.subtitle}>Inicia sesión para seguir viendo</Text>

          <View style={styles.form}>
            <Input
              label="Email"
              placeholder="tu@correo.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              leftIcon={<IconMail size={18} color={colors.textFaint} />}
            />
            <Input
              label="Contraseña"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              leftIcon={<IconLock size={18} color={colors.textFaint} />}
            />

            <Link href="/(auth)/forgot" asChild>
              <TouchableOpacity style={styles.forgotLink} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
              </TouchableOpacity>
            </Link>

            {!!error && <Text style={styles.error}>{error}</Text>}

            <Button variant="primary" size="lg" fullWidth loading={loading} onPress={handleSubmit}>
              Iniciar sesión
            </Button>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>¿No tienes cuenta? </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.footerLink}>Regístrate</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['3xl'],
  },
  logo: { marginBottom: spacing['4xl'] },
  logoText: {
    fontFamily: 'Sora_800ExtraBold',
    fontSize: 15,
    letterSpacing: -0.2,
    color: colors.white,
  },
  title: {
    ...textStyles.heroTitle,
    fontSize: 26,
    color: colors.white,
    marginBottom: 6,
  },
  subtitle: {
    ...textStyles.bodySm,
    color: colors.textMuted,
    marginBottom: spacing['2xl'],
  },
  form: { gap: spacing.lg },
  forgotLink: { alignSelf: 'flex-end', marginTop: -4 },
  forgotText: { ...textStyles.bodySm, color: colors.textSecondary },
  error: { ...textStyles.bodySm, color: colors.error },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing['2xl'],
  },
  footerText: { ...textStyles.bodySm, color: colors.textMuted },
  footerLink: { ...textStyles.labelSm, color: colors.brandBright },
});
