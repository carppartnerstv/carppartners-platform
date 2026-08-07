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
import { useRouter } from 'expo-router';
import { IconArrowLeft, IconMail, IconMailCheck } from '@tabler/icons-react-native';
import { colors, textStyles, spacing, radii } from '../../theme';
import { Input, Button } from '../../components/ui';
import { apiClient } from '../../lib/apiClient';

export default function ForgotScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setSending(true);
    try {
      // Responde siempre igual, exista o no la cuenta — no revela emails registrados.
      await apiClient.forgotPassword(email.trim());
    } catch {
      /* silencioso a propósito: mismo comportamiento que el backend */
    } finally {
      setSending(false);
      setSent(true);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.backButton}
          >
            <IconArrowLeft size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          {sent ? (
            <View style={styles.sentWrap}>
              <View style={styles.sentIcon}>
                <IconMailCheck size={30} color={colors.brandBright} />
              </View>
              <Text style={styles.title}>Revisa tu correo</Text>
              <Text style={styles.sentBody}>
                Si <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' }}>{email.trim()}</Text> tiene
                una cuenta, te hemos enviado un enlace para restablecer tu contraseña. Caduca en 30 minutos.
              </Text>
              <Button variant="primary" size="lg" fullWidth onPress={() => router.replace('/(auth)/login')}>
                Volver a iniciar sesión
              </Button>
            </View>
          ) : (
            <>
              <Text style={styles.title}>Recupera tu acceso</Text>
              <Text style={styles.subtitle}>Te enviaremos un enlace para restablecer tu contraseña.</Text>

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
                <Button variant="primary" size="lg" fullWidth loading={sending} onPress={handleSubmit}>
                  Enviar enlace
                </Button>
              </View>
            </>
          )}
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
  backButton: { marginBottom: spacing['2xl'] },
  title: {
    ...textStyles.heroTitle,
    fontSize: 24,
    color: colors.white,
    marginBottom: 6,
  },
  subtitle: {
    ...textStyles.bodySm,
    color: colors.textMuted,
    marginBottom: spacing['2xl'],
  },
  form: { gap: spacing.lg },
  sentWrap: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.lg },
  sentIcon: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: colors.brandDim,
    borderWidth: 1,
    borderColor: 'rgba(207,74,53,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  sentBody: {
    ...textStyles.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
});
