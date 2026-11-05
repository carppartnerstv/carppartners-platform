// =====================================================================
// Notificaciones push de "nuevo vídeo publicado", vía el servicio de push
// de Expo (gratuito, sin credenciales propias de FCM/APNs que gestionar —
// Expo las releva). Igual que mail.js: un fallo aquí nunca debe tumbar el
// backend ni el resto del flujo que lo dispara.
// =====================================================================
import { Expo } from 'expo-server-sdk';
import { query } from '../config/db.js';

const expo = new Expo();

/**
 * Envía la notificación de "nuevo vídeo" a los suscriptores con acceso
 * vigente (mismo criterio que requireSubscription) que tengan el toggle
 * Push activado. Nunca lanza.
 */
export async function sendNewVideoPush(video) {
  try {
    const { rows } = await query(
      `SELECT DISTINCT pt.token
         FROM push_tokens pt
         JOIN users u ON u.id = pt.user_id
        WHERE (u.notification_preferences->>'push')::boolean = true
          AND EXISTS (
            SELECT 1 FROM subscriptions s
             WHERE s.user_id = u.id
               AND s.status IN ('active', 'trialing', 'past_due')
               AND (s.period_end IS NULL OR s.period_end > now())
          )`,
    );

    const validTokens = rows.map((r) => r.token).filter((t) => Expo.isExpoPushToken(t));
    if (validTokens.length === 0) return;

    const messages = validTokens.map((to) => ({
      to,
      sound: 'default',
      title: 'Nuevo en Carp Partners TV',
      body: video.title,
      data: { videoId: video.id, type: 'new_video' },
    }));

    const invalidTokens = [];
    for (const chunk of expo.chunkPushNotifications(messages)) {
      try {
        const receipts = await expo.sendPushNotificationsAsync(chunk);
        receipts.forEach((receipt, i) => {
          if (receipt.status === 'error' && receipt.details?.error === 'DeviceNotRegistered') {
            invalidTokens.push(chunk[i].to);
          }
        });
      } catch (err) {
        console.error('[push] Error enviando lote de notificaciones:', err.message);
      }
    }

    if (invalidTokens.length > 0) {
      await query('DELETE FROM push_tokens WHERE token = ANY($1)', [invalidTokens]);
    }
  } catch (err) {
    console.error('[push] Error enviando notificación de nuevo vídeo:', err.message);
  }
}

/**
 * Barrido periódico (ver server.js): busca vídeos que ya son visibles para
 * el catálogo (mismo criterio que el resto de endpoints públicos) y que
 * todavía no han disparado su notificación — cubre tanto la publicación
 * inmediata como la programada, sin necesidad de enganchar nada en
 * admin.js. Nunca lanza.
 */
export async function checkAndNotifyNewVideos() {
  try {
    const { rows } = await query(
      `SELECT id, title
         FROM videos
        WHERE published = true
          AND (published_at IS NULL OR published_at <= now())
          AND push_notified_at IS NULL`,
    );

    for (const video of rows) {
      await sendNewVideoPush(video);
      await query('UPDATE videos SET push_notified_at = now() WHERE id = $1', [video.id]);
    }
  } catch (err) {
    console.error('[push] Error en el barrido de nuevos vídeos:', err.message);
  }
}
