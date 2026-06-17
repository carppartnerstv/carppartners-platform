// =====================================================================
// Servicio Vimeo — proxy seguro de reproducción.  (Briefing 4.3)
//
// El componente de seguridad más importante: las credenciales de Vimeo
// viven SOLO en el servidor (variables de entorno). El cliente nunca las ve.
//
// Flujo:
//   1. La app pide /videos/:id/stream
//   2. El backend (ya verificó JWT + suscripción) llama a la API de Vimeo
//      con el access token privado
//   3. Vimeo devuelve los archivos HLS; entregamos al cliente solo el enlace
//      .m3u8 (caduca; Domain Privacy restringe el dominio de reproducción)
// =====================================================================
import { config } from '../config/index.js';

const VIMEO_API = 'https://api.vimeo.com';

// --- Resolución del access token -------------------------------------
// Si hay token estático, se usa. Si no, se obtiene vía OAuth
// "client credentials" usando client_id + client_secret y se cachea hasta
// poco antes de expirar.
//
// ⚠️ NOTA DE PERMISOS: el grant client_credentials solo concede scopes
// PÚBLICOS. Para leer el enlace HLS de vídeos con Domain Privacy
// (campo `play.hls.link`) Vimeo exige un token con scope de archivos de
// vídeo (p.ej. "private video_files"). Eso se consigue generando un
// "Personal Access Token" en el panel de la app de Vimeo con esos scopes,
// y poniéndolo en VIMEO_ACCESS_TOKEN. Recomendado para producción.
let cachedToken = null;
let cachedExpiry = 0;

async function getAccessToken() {
  if (config.vimeo.accessToken) return config.vimeo.accessToken;

  const now = Date.now();
  if (cachedToken && now < cachedExpiry) return cachedToken;

  const basic = Buffer.from(
    `${config.vimeo.clientId}:${config.vimeo.clientSecret}`,
  ).toString('base64');

  const res = await fetch(`${VIMEO_API}/oauth/authorize/client`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.vimeo.*+json;version=3.4',
    },
    body: JSON.stringify({ grant_type: 'client_credentials', scope: 'public' }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Vimeo OAuth client_credentials falló ${res.status}: ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  // Vimeo no siempre devuelve expires_in; cacheamos 50 min por seguridad.
  cachedExpiry = now + 50 * 60 * 1000;
  return cachedToken;
}

async function vimeoHeaders() {
  return {
    Authorization: `Bearer ${await getAccessToken()}`,
    Accept: 'application/vnd.vimeo.*+json;version=3.4',
  };
}

/**
 * Obtiene el enlace de reproducción HLS de un vídeo de Vimeo.
 * @param {string} vimeoId  ID numérico del vídeo en Vimeo
 * @returns {Promise<{ hlsUrl: string, expiresInSec: number }>}
 */
export async function getPlaybackUrl(vimeoId) {
  // Pedimos los archivos de reproducción. El campo `play` requiere que la
  // app esté autorizada en la cuenta Vimeo (Pro/Business + Domain Privacy).
  const res = await fetch(`${VIMEO_API}/videos/${encodeURIComponent(vimeoId)}`, {
    headers: await vimeoHeaders(),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Vimeo respondió ${res.status}: ${detail.slice(0, 200)}`);
  }

  const data = await res.json();

  // Enlace HLS adaptativo (240p–1080p los gestiona Vimeo automáticamente).
  const hls = data?.play?.hls?.link;
  if (!hls) {
    throw new Error('Vimeo no devolvió enlace HLS (¿plan sin API de reproducción o vídeo aún procesándose?)');
  }

  return {
    hlsUrl: hls,
    // Los enlaces de reproducción de Vimeo caducan ~1h (Briefing 4.3)
    expiresInSec: 3600,
  };
}

/**
 * Sube/crea un vídeo en Vimeo mediante la API (usado por el panel admin).
 * Devuelve un upload link tus para subida resumible desde el navegador.
 * (Implementación de subida completa en Fase 1 — semana 6.)
 */
export async function createVimeoVideo({ name, sizeBytes }) {
  const res = await fetch(`${VIMEO_API}/me/videos`, {
    method: 'POST',
    headers: {
      ...(await vimeoHeaders()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      upload: { approach: 'tus', size: String(sizeBytes) },
      name,
      privacy: { view: 'disable', embed: 'whitelist' }, // Domain Privacy
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Vimeo upload init falló ${res.status}: ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  return {
    vimeoId: String(data.uri).split('/').pop(),
    uploadUrl: data.upload?.upload_link,
  };
}
