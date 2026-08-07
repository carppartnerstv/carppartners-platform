import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  IconPencil,
  IconLogout,
  IconPlayerPlayFilled,
  IconCamera,
} from '@tabler/icons-react-native';
import type { WatchHistoryItem } from '@carp-partners/api-client';
import { colors, textStyles, spacing, radii } from '../../theme';
import { Spinner, Input, Button } from '../../components/ui';
import { useSession, ApiError } from '../../context/SessionContext';
import { apiClient } from '../../lib/apiClient';
import { formatDurationLong, formatRelativeDay } from '../../lib/format';
import { useResetScrollOnFocus } from '../../hooks/useResetScrollOnFocus';

const CONTENT_BOTTOM_PADDING = 96;

type ProfileTab = 'account' | 'history' | 'notifs';

const PLAN_LABELS: Record<string, string> = { monthly: 'Mensual', annual: 'Anual', courtesy: 'Cortesía' };

const NOTIF_ROWS = [
  { key: 'estrenos', label: 'Nuevos estrenos', desc: 'Cuando se publique contenido nuevo' },
  { key: 'recomendaciones', label: 'Recomendaciones', desc: 'Sugerencias basadas en lo que ves' },
  { key: 'promos', label: 'Ofertas y promociones', desc: 'Descuentos y novedades de planes' },
  { key: 'push', label: 'Notificaciones push', desc: 'Avisos en tu móvil' },
] as const;

export default function ProfileScreen() {
  const { user, subscription, logout, setUser } = useSession();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  useResetScrollOnFocus(useCallback(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), []));

  const [tab, setTab] = useState<ProfileTab>('account');
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [pendingPhoto, setPendingPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [notifs, setNotifs] = useState<Record<string, boolean>>({
    estrenos: true, recomendaciones: true, promos: false, push: true,
  });

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

  const saveProfile = async () => {
    setSaving(true);
    setEditError('');
    try {
      let updated = user;
      if (editName.trim() && editName.trim() !== user?.name) {
        updated = (await apiClient.updateProfile(editName.trim())).user;
      }
      if (pendingPhoto) {
        const ext = pendingPhoto.uri.split('.').pop() || 'jpg';
        const filePart = {
          uri: pendingPhoto.uri,
          name: `avatar.${ext}`,
          type: pendingPhoto.mimeType ?? `image/${ext}`,
          // El api-client tipa `file: File` (pensado para web) — en RN el
          // FormData real espera {uri,name,type}, que es lo que de verdad
          // hace falta en tiempo de ejecución.
        } as unknown as File;
        updated = (await apiClient.uploadAvatar(filePart)).user;
      }
      if (updated) setUser(updated);
      setEditing(false);
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const planLabel = subscription ? PLAN_LABELS[subscription.plan] ?? subscription.plan : '';
  const pendingCancel = subscription?.status !== 'cancelled' && !!subscription?.cancel_at_period_end;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.pagePaddingH, paddingTop: spacing.sm, paddingBottom: CONTENT_BOTTOM_PADDING }}
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

        {/* Edición inline: nombre + foto. El email va bloqueado — es el vínculo de facturación de Stripe. */}
        {editing && (
          <View style={styles.editCard}>
            <TouchableOpacity onPress={pickPhoto} style={styles.photoRow} activeOpacity={0.8}>
              {pendingPhoto ? (
                <Image source={{ uri: pendingPhoto.uri }} style={styles.photoPreview} />
              ) : user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.photoPreview} />
              ) : (
                <View style={[styles.photoPreview, styles.avatarFallback]}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              )}
              <View style={styles.photoEditBadge}>
                <IconCamera size={13} color={colors.white} />
              </View>
            </TouchableOpacity>

            <Input label="Nombre" value={editName} onChangeText={setEditName} placeholder="Tu nombre" />

            <View style={styles.lockedField}>
              <Text style={styles.lockedLabel}>Correo electrónico</Text>
              <Text style={styles.lockedValue}>{user?.email}</Text>
              <Text style={styles.lockedHint}>Está vinculado a tu facturación y no se puede cambiar aquí.</Text>
            </View>

            {!!editError && <Text style={styles.error}>{editError}</Text>}

            <View style={styles.editActions}>
              <Button variant="secondary" size="md" onPress={() => setEditing(false)} disabled={saving}>
                Cancelar
              </Button>
              <View style={{ flex: 1 }}>
                <Button variant="primary" size="md" fullWidth loading={saving} onPress={saveProfile}>
                  Guardar
                </Button>
              </View>
            </View>
          </View>
        )}

        {/* Segmented control */}
        <View style={styles.segmented}>
          <SegmentButton label="Cuenta" active={tab === 'account'} onPress={() => setTab('account')} />
          <SegmentButton label="Historial" active={tab === 'history'} onPress={() => setTab('history')} />
          <SegmentButton label="Avisos" active={tab === 'notifs'} onPress={() => setTab('notifs')} />
        </View>

        {tab === 'account' && (
          <>
            <View style={styles.subCard}>
              <Text style={styles.subKicker}>Suscripción</Text>
              <Text style={styles.subPlan}>Plan {planLabel || 'sin suscripción'}</Text>
              {subscription?.period_end && (
                <Text style={styles.subMeta}>
                  {pendingCancel ? 'Acceso hasta el ' : 'Se renueva el '}
                  {new Date(subscription.period_end).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              )}
              {!subscription?.period_end && subscription && <Text style={styles.subMeta}>Sin fecha de caducidad</Text>}
            </View>

            <TouchableOpacity style={styles.logoutRow} onPress={handleLogout} activeOpacity={0.7}>
              <IconLogout size={18} color={colors.error} />
              <Text style={styles.logoutText}>Cerrar sesión</Text>
            </TouchableOpacity>
          </>
        )}

        {tab === 'history' && (
          loadingHistory ? (
            <Spinner centered />
          ) : history.length === 0 ? (
            <Text style={styles.emptyText}>Todavía no has visto ningún vídeo.</Text>
          ) : (
            <View style={styles.historyList}>
              {history.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.historyRow}
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
          )
        )}

        {tab === 'notifs' && (
          <View style={styles.notifList}>
            {NOTIF_ROWS.map((n) => {
              const on = notifs[n.key];
              return (
                <View key={n.key} style={styles.notifRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notifLabel}>{n.label}</Text>
                    <Text style={styles.notifDesc}>{n.desc}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setNotifs((s) => ({ ...s, [n.key]: !s[n.key] }))}
                    style={[styles.switchTrack, { backgroundColor: on ? colors.brandBright : 'rgba(255,255,255,0.14)' }]}
                  >
                    <View style={[styles.switchKnob, { left: on ? 20 : 2 }]} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
  editCard: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    padding: 16,
    marginBottom: 20,
    gap: 14,
  },
  photoRow: { alignSelf: 'center', marginBottom: 4 },
  photoPreview: { width: 76, height: 76, borderRadius: radii.full },
  photoEditBadge: {
    position: 'absolute', right: -2, bottom: -2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.brand,
    borderWidth: 2, borderColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  lockedField: { opacity: 0.6, gap: 4 },
  lockedLabel: { ...textStyles.label, color: colors.textSecondary },
  lockedValue: { ...textStyles.body, color: colors.textMuted },
  lockedHint: { ...textStyles.bodyXs, color: colors.textFaint },
  error: { ...textStyles.bodySm, color: colors.error },
  editActions: { flexDirection: 'row', gap: 10 },
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
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    padding: 16,
    marginBottom: 12,
  },
  subKicker: { ...textStyles.kicker, color: colors.brandBright, marginBottom: 6 },
  subPlan: { ...textStyles.sectionTitle, fontSize: 16, color: colors.white, marginBottom: 4 },
  subMeta: { ...textStyles.bodySm, color: colors.textMuted },
  logoutRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 4 },
  logoutText: { ...textStyles.label, color: colors.error },
  emptyText: { ...textStyles.bodySm, color: colors.textFaint, textAlign: 'center', paddingTop: spacing['2xl'] },
  historyList: { gap: 4 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  historyThumb: { width: 64, height: 40, borderRadius: 6, backgroundColor: colors.surface, overflow: 'hidden' },
  historyPlayIcon: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  historyTitle: { ...textStyles.bodySm, color: colors.textPrimary, fontFamily: 'Inter_600SemiBold' },
  historyWhen: { ...textStyles.bodyXs, color: colors.textFaint, marginTop: 2 },
  historyDur: { ...textStyles.bodyXs, color: colors.textMuted },
  notifList: { gap: 2 },
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  notifLabel: { ...textStyles.bodySm, color: colors.textPrimary, fontFamily: 'Inter_600SemiBold' },
  notifDesc: { ...textStyles.bodyXs, color: colors.textFaint, marginTop: 2 },
  switchTrack: { width: 42, height: 25, borderRadius: 13, justifyContent: 'center' },
  switchKnob: { position: 'absolute', width: 21, height: 21, borderRadius: 11, backgroundColor: colors.white },
});
