// Component gallery — verifica que todos los componentes base renderizan correctamente.
// Esta pantalla se reemplaza en Fase 2 por la navegación real.
import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { colors, textStyles, spacing } from '../theme';
import {
  Button,
  Badge,
  Spinner,
  Input,
  Avatar,
  EmptyState,
  VideoCard,
  Row,
  Toast,
  useToast,
  Modal,
} from '../components/ui';
import { MOCK_VIDEOS, TRENDING, CONTINUE_WATCHING } from '../data/mock/videos';

export default function Gallery() {
  const [inputValue, setInputValue] = useState('');
  const [showModal, setShowModal] = useState(false);
  const { toastProps, show: showToast } = useToast();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Carp Partners TV</Text>
        <Text style={styles.pageSubtitle}>Galería de componentes · Fase 1</Text>

        {/* ── Buttons ─────────────────────────────────────────────────────── */}
        <Section title="Button">
          <Button variant="primary" size="lg">Suscribirse</Button>
          <Button variant="primary" size="md">Reproducir</Button>
          <Button variant="secondary" size="md">+ Mi Lista</Button>
          <Button variant="outline" size="md">Gestionar plan</Button>
          <Button variant="ghost" size="md">Cerrar sesión</Button>
          <Button variant="danger" size="sm">Eliminar</Button>
          <Button variant="primary" size="md" loading>Cargando…</Button>
          <Button variant="primary" size="md" disabled>Desactivado</Button>
        </Section>

        {/* ── Badges ──────────────────────────────────────────────────────── */}
        <Section title="Badge">
          <View style={styles.row}>
            <Badge label="Nuevo" variant="new" />
            <Badge label="Gold" variant="gold" />
            <Badge label="Brand" variant="brand" />
            <Badge label="Info" variant="muted" />
            <Badge label="Error" variant="error" />
          </View>
        </Section>

        {/* ── Spinners ─────────────────────────────────────────────────────── */}
        <Section title="Spinner">
          <View style={styles.row}>
            <Spinner size="sm" />
            <Spinner size="md" />
            <Spinner size="lg" />
            <Spinner size="md" color={colors.gold} />
          </View>
        </Section>

        {/* ── Input ────────────────────────────────────────────────────────── */}
        <Section title="Input">
          <Input
            label="Email"
            placeholder="tu@email.com"
            value={inputValue}
            onChangeText={setInputValue}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label="Contraseña"
            placeholder="••••••••"
            secureTextEntry
            hint="Mínimo 8 caracteres"
          />
          <Input
            label="Con error"
            placeholder="Introduce un valor"
            error="Este campo es obligatorio"
          />
        </Section>

        {/* ── Avatars ──────────────────────────────────────────────────────── */}
        <Section title="Avatar">
          <View style={styles.row}>
            <Avatar name="Carlos Angler" size="sm" />
            <Avatar name="Carlos Angler" size="md" />
            <Avatar name="Carlos Angler" size="lg" />
            <Avatar name="María García" size="lg" />
            <Avatar size="md" />
          </View>
        </Section>

        {/* ── VideoCard ────────────────────────────────────────────────────── */}
        <Section title="VideoCard">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hscroll}>
            <View style={styles.cardRow}>
              {MOCK_VIDEOS.slice(0, 4).map((v) => (
                <VideoCard
                  key={v.id}
                  video={v}
                  onPress={(video) => console.log('pressed', video.title)}
                />
              ))}
            </View>
          </ScrollView>
        </Section>

        {/* ── VideoCard continue ────────────────────────────────────────────── */}
        <Section title="VideoCard · continue watching">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hscroll}>
            <View style={styles.cardRow}>
              {CONTINUE_WATCHING.map((v) => (
                <VideoCard key={v.id} video={v} variant="continue" />
              ))}
            </View>
          </ScrollView>
        </Section>

        {/* ── VideoCard rank ────────────────────────────────────────────────── */}
        <Section title="VideoCard · rank">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hscroll}>
            <View style={styles.cardRow}>
              {TRENDING.map((v) => (
                <VideoCard key={v.id} video={v} variant="rank" />
              ))}
            </View>
          </ScrollView>
        </Section>

        {/* ── Row ──────────────────────────────────────────────────────────── */}
        <Section title="Row">
          <Row
            title="Técnicas"
            videos={MOCK_VIDEOS.filter((v) => v.category_id === 'cat-1')}
            onSeeAll={() => console.log('see all')}
            onVideoPress={(v) => console.log('row press', v.title)}
          />
        </Section>

        <Section title="Row · Tendencias">
          <Row
            title="Top 10 esta semana"
            videos={TRENDING}
            variant="rank"
          />
        </Section>

        {/* ── EmptyState ───────────────────────────────────────────────────── */}
        <Section title="EmptyState">
          <View style={{ height: 220 }}>
            <EmptyState
              title="Tu lista está vacía"
              body="Guarda vídeos para verlos cuando quieras sin conexión."
              action={{ label: 'Explorar catálogo', onPress: () => {} }}
            />
          </View>
        </Section>

        {/* ── Toast ────────────────────────────────────────────────────────── */}
        <Section title="Toast">
          <View style={styles.row}>
            <Button variant="secondary" size="sm" onPress={() => showToast('Vídeo guardado en tu lista', 'success')}>
              Success
            </Button>
            <Button variant="secondary" size="sm" onPress={() => showToast('No se pudo conectar', 'error')}>
              Error
            </Button>
            <Button variant="secondary" size="sm" onPress={() => showToast('Actualización disponible', 'info')}>
              Info
            </Button>
          </View>
        </Section>

        {/* ── Modal ────────────────────────────────────────────────────────── */}
        <Section title="Modal">
          <Button variant="outline" size="md" onPress={() => setShowModal(true)}>
            Abrir modal
          </Button>
        </Section>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Overlays */}
      <Toast {...toastProps} />
      <Modal
        visible={showModal}
        onClose={() => setShowModal(false)}
        title="Eliminar de Mi Lista"
        actions={[
          { label: 'Eliminar', variant: 'danger', onPress: () => setShowModal(false) },
          { label: 'Cancelar', variant: 'ghost', onPress: () => setShowModal(false) },
        ]}
      >
        <Text style={{ color: colors.textSecondary, ...textStyles.body }}>
          ¿Seguro que quieres quitar este vídeo de tu lista?
        </Text>
      </Modal>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingTop: spacing.pagePaddingV, gap: spacing['3xl'] },
  pageTitle: {
    ...textStyles.pageTitle,
    color: colors.textPrimary,
    paddingHorizontal: spacing.pagePaddingH,
  },
  pageSubtitle: {
    ...textStyles.bodySm,
    color: colors.textMuted,
    paddingHorizontal: spacing.pagePaddingH,
    marginTop: -spacing['2xl'] + 4,
  },
  section: { gap: 12 },
  sectionTitle: {
    ...textStyles.kicker,
    color: colors.brandBright,
    paddingHorizontal: spacing.pagePaddingH,
  },
  sectionContent: {
    paddingHorizontal: spacing.pagePaddingH,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  hscroll: { marginHorizontal: -spacing.pagePaddingH },
  cardRow: {
    flexDirection: 'row',
    gap: spacing.rowGap,
    paddingHorizontal: spacing.pagePaddingH,
  },
});
