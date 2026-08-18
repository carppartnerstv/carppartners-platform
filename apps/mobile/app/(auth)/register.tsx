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
import { IconArrowLeft, IconUser, IconMail, IconLock } from '@tabler/icons-react-native';
import { ApiError } from '@carp-partners/api-client';
import { colors, textStyles, spacing } from '../../theme';
import { Input, Button } from '../../components/ui';
import { useSession } from '../../context/SessionContext';

export default function RegisterScreen() {
  const { register } = useSession();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || password.length < 8) {
      setError('Introduce un email válido y una contraseña de al menos 8 caracteres.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register(email.trim(), password, name.trim() || undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
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

          <Text style={styles.title}>Crea tu cuenta</Text>
          <Text style={styles.subtitle}>Empieza a ver carpfishing en minutos</Text>

          <View style={styles.form}>
            <Input
              label="Nombre"
              placeholder="Juan Antonio"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              leftIcon={<IconUser size={18} color={colors.textFaint} />}
            />
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
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              leftIcon={<IconLock size={18} color={colors.textFaint} />}
            />

            {!!error && <Text style={styles.error}>{error}</Text>}

            <Button variant="primary" size="lg" fullWidth loading={loading} onPress={handleSubmit}>
              Crear cuenta
            </Button>
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
  backButton: { marginBottom: spacing['2xl'] },
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
  error: { ...textStyles.bodySm, color: colors.error },
});
