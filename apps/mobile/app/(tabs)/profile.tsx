import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Animated,
  TouchableOpacity,
  Linking,
  Modal as RNModal,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { File, UploadType } from 'expo-file-system';
import {
  IconPencil,
  IconLogout,
  IconPlayerPlayFilled,
  IconLock,
  IconX,
  IconUser,
  IconUpload,
  IconTrash,
  IconCircleCheckFilled,
  IconClock,
  IconShieldLock,
} from '@tabler/icons-react-native';
import type { WatchHistoryItem, NotificationPreferences } from '@carp-partners/api-client';
import { colors, textStyles, spacing, radii } from '../../theme';
import { Spinner, Input, Button, Toast, useToast } from '../../components/ui';
import { AppHeader, APP_HEADER_CONTENT_HEIGHT } from '../../components/ui/AppHeader';
import { useSession, ApiError } from '../../context/SessionContext';
import { apiClient } from '../../lib/apiClient';
import { formatDurationLong, formatRelativeDay } from '../../lib/format';
import { useResetScrollOnFocus } from '../../hooks/useResetScrollOnFocus';

const CONTENT_BOTTOM_PADDING = 96;

type ProfileTab = 'account' | 'history' | 'notifs';

const PLAN_LABELS: Record<string, string> = { monthly: 'Mensual', annual: 'Anual', courtesy: 'Cortesía' };

// Precios de referencia (los mismos que en /planes) — no hay endpoint que los devuelva.
const PLAN_PRICES: Record<string, string> = {
  monthly: '9,99€ / mes',
  annual: '89,99€ / año',
  courtesy: 'Acceso de cortesía',
};

const NOTIF_ROWS = [
  { key: 'estrenos', label: 'Nuevos estrenos', desc: 'Cuando se publique contenido nuevo' },
  { key: 'recomendaciones', label: 'Recomendaciones', desc: 'Sugerencias basadas en lo que ves' },
  { key: 'promos', label: 'Novedades de Carp Partners', desc: 'Noticias y comunicaciones de la plataforma' },
  { key: 'push', label: 'Notificaciones push', desc: 'Avisos en tu móvil' },
] as const;

export default function ProfileScreen() {
  const { user, subscription, logout, setUser } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  useResetScrollOnFocus(useCallback(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), []));

  const scrollY = useRef(new Animated.Value(0)).current;
  const { toastProps, show: showToast } = useToast();

  const [tab, setTab] = useState<ProfileTab>('account');
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [pendingPhoto, setPendingPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [editError, setEditError] = useState('');

  const [notifs, setNotifs] = useState<NotificationPreferences>({
    estrenos: true, recomendaciones: true, promos: false, push: true,
  });
  useEffect(() => {
    if (user?.notification_preferences) setNotifs(user.notification_preferences);
  }, [user?.notification_preferences]);

  const toggleNotif = async (key: keyof NotificationPreferences) => {
    const previous = notifs;
    const next = { ...notifs, [key]: !notifs[key] };
    setNotifs(next);
    try {
      const { user: updated } = await apiClient.updateNotificationPreferences(next);
      setUser(updated);
      showToast('Preferencias de notificación actualizadas', 'success');
    } catch (err) {
      setNotifs(previous);
      showToast(err instanceof ApiError ? err.message : 'No se pudo actualizar la preferencia', 'error');
    }
  };

  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState('');

  const [changePwOpen, setChangePwOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    apiClient.getContinueWatching()
      .then(({ items }) => setHistory(items))
      .catch(() => null)
      .finally(() => setLoadingHistory(false));
  }, []);

  const initials = user?.name
    ? user.name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
    : user?.email?.[0]?.toUpperCase() ?? '?';

  const startEdit = () => {
    setEditName(user?.name ?? '');
    setPendingPhoto(null);
    setEditError('');
    setEditing(true);
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setEditError('Necesitamos permiso para acceder a tus fotos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setPendingPhoto(result.assets[0]);
    }
  };

  const deletePhoto = async () => {
    setAvatarBusy(true);
    setEditError('');
    try {
      await apiClient.deleteAvatar();
      if (user) setUser({ ...user, avatar_url: null });
      setPendingPhoto(null);
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : 'No se pudo eliminar la foto.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    setEditError('');
    try {
      let updated = user;
      if (editName.trim() && editName.trim() !== user?.name) {
        updated = (await apiClient.updateProfile(editName.trim())).user;
      }
      if (pendingPhoto) {
        // RN 0.86 (New Architecture) tira "Unsupported FormDataPart
        // implementation" al subir un archivo con fetch+FormData — bug
        // nativo, no de nuestro código (el shape {uri,name,type} es el
        // documentado). Rodeamos el fetch/FormData del api-client del todo
        // y usamos el uploader nativo de expo-file-system para este caso.
        const ext = pendingPhoto.uri.split('.').pop() || 'jpg';
        const file = new File(pendingPhoto.uri);
        const result = await file.upload(`${apiClient.getBaseUrl()}/auth/me/avatar`, {
          httpMethod: 'POST',
          uploadType: UploadType.MULTIPART,
          fieldName: 'avatar',
          mimeType: pendingPhoto.mimeType ?? `image/${ext}`,
          headers: { Authorization: `Bearer ${apiClient.getAccessToken() ?? ''}` },
        });
        const body = result.body ? JSON.parse(result.body) : {};
        if (result.status < 200 || result.status >= 300) {
          throw new ApiError(body?.error?.code ?? 'API_ERROR', body?.error?.message ?? `Error ${result.status}`, result.status);
        }
        updated = body.user;
      }
      if (updated) setUser(updated);
      setEditing(false);
      showToast('Perfil actualizado correctamente', 'success');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('saveProfile failed:', err);
      setEditError(
        err instanceof ApiError
          ? err.message
          : `No se pudieron guardar los cambios (${err instanceof Error ? err.message : String(err)}).`,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const openAdminPanel = () => {
    const webBase = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/api\/?$/, '');
    Linking.openURL(`${webBase}/admin`);
  };

  const openBillingPortal = async () => {
    setPortalError('');
    setPortalLoading(true);
    try {
      const { url } = await apiClient.getBillingPortal();
      await Linking.openURL(url);
    } catch {
      setPortalError('No se pudo abrir el portal de facturación. Inténtalo de nuevo.');
    } finally {
      setPortalLoading(false);
    }
  };

  const openChangePassword = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPwError('');
    setChangePwOpen(true);
  };

  const submitChangePassword = async () => {
    setPwError('');
    if (newPassword.length < 8) {
      setPwError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Las contraseñas no coinciden.');
      return;
    }
    setPwSaving(true);
    try {
      await apiClient.changePassword(currentPassword, newPassword);
      setChangePwOpen(false);
      showToast('Contraseña actualizada correctamente', 'success');
    } catch (err) {
      setPwError(err instanceof ApiError ? err.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setPwSaving(false);
    }
  };

  const planLabel = subscription ? PLAN_LABELS[subscription.plan] ?? subscription.plan : '';
  const planPrice = subscription ? PLAN_PRICES[subscription.plan] : undefined;
  const pendingCancel = subscription?.status !== 'cancelled' && !!subscription?.cancel_at_period_end;

  return (
    <View style={styles.safe}>
      <AppHeader scrollY={scrollY} />
      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.pagePaddingH,
          paddingTop: insets.top + APP_HEADER_CONTENT_HEIGHT + spacing.md,
          paddingBottom: CONTENT_BOTTOM_PADDING,
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
      >
        {/* Cabecera: avatar + nombre + email + editar */}
        <View style={styles.headerRow}>
          {user?.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
          <View style={styles.headerText}>
            <Text style={styles.name} numberOfLines={1}>{user?.name ?? user?.email}</Text>
            <Text style={styles.email} numberOfLines={1}>{user?.email}</Text>
          </View>
          <TouchableOpacity onPress={startEdit} style={styles.editButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <IconPencil size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>


        {/* Segmented control */}
        <View style={styles.segmented}>
          <SegmentButton label="Cuenta" active={tab === 'account'} onPress={() => setTab('account')} />
          <SegmentButton label="Historial" active={tab === 'history'} onPress={() => setTab('history')} />
          <SegmentButton label="Avisos" active={tab === 'notifs'} onPress={() => setTab('notifs')} />
        </View>

        {tab === 'account' && (
          <>
            <LinearGradient
              colors={['rgba(104,20,11,0.14)', 'rgba(104,20,11,0.03)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.subCard}
            >
              {subscription && (
                pendingCancel ? (
                  <View style={[styles.planBadge, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                    <IconClock size={12} color="rgba(255,255,255,0.7)" />
                    <Text style={[styles.planBadgeText, { color: 'rgba(255,255,255,0.7)' }]}>CANCELACIÓN PROGRAMADA</Text>
                  </View>
                ) : (
                  <View style={[styles.planBadge, { backgroundColor: colors.brandDim }]}>
                    <IconCircleCheckFilled size={12} color={colors.brandBright} />
                    <Text style={[styles.planBadgeText, { color: colors.brandBright }]}>PLAN {planLabel.toUpperCase()} ACTIVO</Text>
                  </View>
                )
              )}
              <Text style={styles.subPlan}>{planPrice ?? 'Sin suscripción'}</Text>
              {subscription?.period_end && (
                <Text style={styles.subMeta}>
                  {subscription.status === 'cancelled' || pendingCancel ? 'Acceso hasta el ' : 'Se renueva el '}
                  {new Date(subscription.period_end).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              )}

              {!!user?.stripe_customer_id && (
                <View style={{ marginTop: 14, alignSelf: 'flex-start' }}>
                  <Button variant="primary" size="sm" loading={portalLoading} onPress={openBillingPortal}>
                    Gestionar suscripción
                  </Button>
                </View>
              )}
              {!!portalError && <Text style={[styles.error, { marginTop: 8 }]}>{portalError}</Text>}
            </LinearGradient>

            <View style={styles.accountCard}>
              <Text style={styles.accountCardTitle}>Datos de la cuenta</Text>
              <View style={styles.accountRow}>
                <Text style={styles.accountRowLabel}>Correo electrónico</Text>
                <Text style={styles.accountRowValue} numberOfLines={1}>{user?.email}</Text>
              </View>
              <TouchableOpacity style={[styles.accountRow, styles.accountRowLast]} onPress={openChangePassword} activeOpacity={0.7}>
                <Text style={styles.accountRowLabel}>Contraseña</Text>
                <Text style={styles.changePasswordLink}>Cambiar contraseña</Text>
              </TouchableOpacity>
            </View>

            {user?.role === 'admin' && (
              // El panel admin solo existe en la web (no hay pantalla nativa) — se abre en el navegador.
              <TouchableOpacity style={styles.adminLink} onPress={openAdminPanel} activeOpacity={0.7}>
                <IconShieldLock size={16} color={colors.textMuted} />
                <Text style={styles.adminLinkText}>Admin</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.85}>
              <IconLogout size={18} color={colors.white} />
              <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
            </TouchableOpacity>
          </>
        )}

        {tab === 'history' && (
          <View style={styles.accountCard}>
            <Text style={styles.accountCardTitle}>Visto recientemente</Text>
            <Text style={styles.accountCardSubtitle}>Tu actividad de los últimos días</Text>

            {loadingHistory ? (
              <Spinner centered />
            ) : history.length === 0 ? (
              <Text style={styles.emptyText}>Todavía no has visto ningún vídeo.</Text>
            ) : (
              <View>
                {history.map((item, i) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.historyRow, i < history.length - 1 && styles.rowDivider]}
                    activeOpacity={0.75}
                    onPress={() => router.push(`/watch/${item.id}/play`)}
                  >
                    <View style={styles.historyThumb}>
                      {item.thumbnail_url && <Image source={{ uri: item.thumbnail_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
                      <View style={styles.historyPlayIcon}>
                        <IconPlayerPlayFilled size={14} color={colors.white} />
                      </View>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.historyTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.historyWhen}>{formatRelativeDay(item.last_watched_at)}</Text>
                    </View>
                    <Text style={styles.historyDur}>{formatDurationLong(item.duration_sec)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {tab === 'notifs' && (
          <View style={styles.accountCard}>
            <Text style={styles.accountCardTitle}>Preferencias de notificación</Text>
            <Text style={styles.accountCardSubtitle}>Estas preferencias se aplicarán a los avisos que recibas en la app móvil.</Text>

            {NOTIF_ROWS.map((n, i) => {
              const on = notifs[n.key];
              return (
                <View key={n.key} style={[styles.notifRow, i < NOTIF_ROWS.length - 1 && styles.rowDivider]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notifLabel}>{n.label}</Text>
                    <Text style={styles.notifDesc}>{n.desc}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => toggleNotif(n.key)}
                    style={[styles.switchTrack, { backgroundColor: on ? colors.brandBright : 'rgba(255,255,255,0.14)' }]}
                  >
                    <View style={[styles.switchKnob, { left: on ? 20 : 2 }]} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </Animated.ScrollView>

      {/* Diálogo centrado (no bottom-sheet) — igual que en la web */}
      <RNModal
        visible={changePwOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setChangePwOpen(false)}
      >
        <TouchableOpacity style={styles.pwBackdrop} activeOpacity={1} onPress={() => setChangePwOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.pwCard}>
            <View style={styles.pwHeader}>
              <Text style={styles.pwTitle}>Cambiar contraseña</Text>
              <TouchableOpacity onPress={() => setChangePwOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <IconX size={20} color={colors.textFaint} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: spacing.md }}>
              <Input
                label="Contraseña actual"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                autoCapitalize="none"
                leftIcon={<IconLock size={16} color={colors.textFaint} />}
              />
              <Input
                label="Nueva contraseña"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
                leftIcon={<IconLock size={16} color={colors.textFaint} />}
              />
              <Input
                label="Confirmar nueva contraseña"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                leftIcon={<IconLock size={16} color={colors.textFaint} />}
              />
              {!!pwError && <Text style={styles.error}>{pwError}</Text>}
              <Button variant="primary" size="md" fullWidth loading={pwSaving} onPress={submitChangePassword}>
                Guardar contraseña
              </Button>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </RNModal>

      {/* Editar perfil — mismo diálogo centrado que Cambiar contraseña */}
      <RNModal
        visible={editing}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setEditing(false)}
      >
        <TouchableOpacity style={styles.pwBackdrop} activeOpacity={1} onPress={() => setEditing(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.pwCard}>
            <View style={styles.pwHeader}>
              <Text style={styles.pwTitle}>Editar perfil</Text>
              <TouchableOpacity onPress={() => setEditing(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <IconX size={20} color={colors.textFaint} />
              </TouchableOpacity>
            </View>

            <View style={styles.avatarUploadRow}>
              <View style={styles.avatarPreviewWrap}>
                {pendingPhoto ? (
                  <Image source={{ uri: pendingPhoto.uri }} style={styles.avatarPreview} />
                ) : user?.avatar_url ? (
                  <Image source={{ uri: user.avatar_url }} style={styles.avatarPreview} />
                ) : (
                  <View style={[styles.avatarPreview, styles.avatarFallback]}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  </View>
                )}
                {avatarBusy && (
                  <View style={styles.avatarBusyOverlay}>
                    <Spinner />
                  </View>
                )}
              </View>

              <View style={{ gap: 6, flex: 1 }}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={avatarBusy}
                  onPress={pickPhoto}
                  icon={<IconUpload size={14} color={colors.textSecondary} />}
                >
                  {pendingPhoto || user?.avatar_url ? 'Reemplazar' : 'Subir imagen'}
                </Button>
                {!!user?.avatar_url && !pendingPhoto && (
                  <TouchableOpacity onPress={deletePhoto} disabled={avatarBusy} style={styles.deletePhotoButton}>
                    <IconTrash size={13} color={colors.error} />
                    <Text style={styles.deletePhotoText}>Eliminar</Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.avatarHint}>JPG, PNG o WebP · máx. 5 MB</Text>
              </View>
            </View>

            <View style={{ gap: spacing.md }}>
              <Input
                label="Nombre"
                value={editName}
                onChangeText={setEditName}
                placeholder="Tu nombre"
                leftIcon={<IconUser size={16} color={colors.textFaint} />}
              />

              <View>
                <View style={{ opacity: 0.6 }}>
                  <Text style={styles.label}>Correo electrónico</Text>
                  <View style={styles.lockedRow}>
                    <IconLock size={16} color={colors.textFaint} />
                    <Text style={styles.lockedValue} numberOfLines={1}>{user?.email}</Text>
                  </View>
                </View>
                <Text style={styles.lockedHint}>Está vinculado a tu facturación de Stripe y no se puede cambiar aquí.</Text>
              </View>

              {!!editError && <Text style={styles.error}>{editError}</Text>}
              <Button variant="primary" size="md" fullWidth loading={saving} onPress={saveProfile}>
                Guardar cambios
              </Button>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </RNModal>

      <Toast {...toastProps} />
    </View>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.segmentButton, active && { backgroundColor: colors.brandDim }]}
    >
      <Text style={[styles.segmentText, { color: active ? colors.white : colors.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  avatar: { width: 60, height: 60, borderRadius: radii.full },
  avatarFallback: { backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontFamily: 'Sora_700Bold', fontSize: 20, color: colors.white },
  headerText: { flex: 1, minWidth: 0 },
  name: { ...textStyles.sectionTitle, fontSize: 17, color: colors.white },
  email: { ...textStyles.bodySm, color: colors.textMuted, marginTop: 1 },
  editButton: {
    width: 36, height: 36, borderRadius: 9,
    backgroundColor: colors.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarUploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: spacing.lg,
  },
  avatarPreviewWrap: { position: 'relative' },
  avatarPreview: { width: 64, height: 64, borderRadius: radii.full },
  avatarBusyOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deletePhotoButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 2 },
  deletePhotoText: { ...textStyles.bodyXs, color: colors.error },
  avatarHint: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 13, color: colors.textFaint, marginTop: 2 },
  label: { ...textStyles.label, color: colors.textSecondary, marginBottom: 6 },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    height: 46,
  },
  lockedValue: { ...textStyles.body, color: colors.textMuted, flex: 1 },
  lockedHint: { fontFamily: 'Inter_400Regular', fontSize: 11.5, lineHeight: 15, color: colors.textFaint, marginTop: 6 },
  error: { ...textStyles.bodySm, color: colors.error },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface2,
    borderRadius: radii.lg,
    padding: 3,
    marginBottom: 18,
  },
  segmentButton: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radii.md },
  segmentText: { ...textStyles.labelSm },
  subCard: {
    borderWidth: 1,
    borderColor: 'rgba(207,74,53,0.3)',
    borderRadius: radii['2xl'],
    padding: 18,
    marginBottom: 14,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 10,
  },
  planBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 0.3,
  },
  subPlan: { ...textStyles.sectionTitle, fontSize: 18, color: colors.white, marginBottom: 4 },
  subMeta: { ...textStyles.bodySm, color: colors.textMuted },
  accountCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii['2xl'],
    padding: 18,
    marginBottom: 20,
  },
  accountCardTitle: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 15.5,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  accountCardSubtitle: {
    ...textStyles.bodyXs,
    color: colors.textFaint,
    marginBottom: 16,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  accountRowLast: { borderBottomWidth: 0 },
  accountRowLabel: { ...textStyles.bodySm, color: colors.textFaint },
  accountRowValue: { ...textStyles.bodySm, color: colors.textPrimary, flexShrink: 1, marginLeft: 12 },
  changePasswordLink: { ...textStyles.bodySm, fontFamily: 'Inter_600SemiBold', color: colors.brandBright },
  adminLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    marginBottom: 12,
  },
  adminLinkText: { ...textStyles.labelSm, color: colors.textMuted },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radii.button,
    backgroundColor: colors.brand,
  },
  logoutButtonText: { fontFamily: 'Inter_700Bold', fontSize: 14.5, color: colors.white },
  emptyText: { ...textStyles.bodySm, color: colors.textFaint },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  historyThumb: { width: 64, height: 40, borderRadius: 6, backgroundColor: colors.surface, overflow: 'hidden' },
  historyPlayIcon: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  historyTitle: { ...textStyles.bodySm, color: colors.textPrimary, fontFamily: 'Inter_600SemiBold' },
  historyWhen: { ...textStyles.bodyXs, color: colors.textFaint, marginTop: 2 },
  historyDur: { ...textStyles.bodyXs, color: colors.textMuted },
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15 },
  notifLabel: { ...textStyles.bodySm, color: colors.textPrimary, fontFamily: 'Inter_600SemiBold' },
  notifDesc: { ...textStyles.bodyXs, color: colors.textFaint, marginTop: 2 },
  switchTrack: { width: 42, height: 25, borderRadius: 13, justifyContent: 'center' },
  switchKnob: { position: 'absolute', width: 21, height: 21, borderRadius: 11, backgroundColor: colors.white },
  pwBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  pwCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  pwHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pwTitle: {
    ...textStyles.sectionTitle,
    fontSize: 18,
    color: colors.white,
  },
});
