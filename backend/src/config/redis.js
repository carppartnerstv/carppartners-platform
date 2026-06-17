// =====================================================================
// Cliente Redis — guarda refresh tokens y caché ligera. (Briefing 4.2)
// La conexión es perezosa: no bloquea el arranque si Redis aún no está.
// =====================================================================
import { createClient } from 'redis';
import { config } from '../config/index.js';

export const redis = createClient({ url: config.redis.url });

redis.on('error', (err) => console.error('[redis] Error:', err.message));

let connected = false;
export const connectRedis = async () => {
  if (!connected) {
    await redis.connect();
    connected = true;
    console.log('[redis] Conectado');
  }
};

// --- Helpers de refresh tokens ---------------------------------------
// Clave: refresh:<userId>:<jti>  ->  "1"  con TTL = vida del refresh token.
// Permite revocar tokens (logout) borrando la clave.

export const storeRefreshToken = (userId, jti) =>
  redis.set(`refresh:${userId}:${jti}`, '1', { EX: config.jwt.refreshTtlSeconds });

export const isRefreshTokenValid = async (userId, jti) =>
  (await redis.exists(`refresh:${userId}:${jti}`)) === 1;

export const revokeRefreshToken = (userId, jti) =>
  redis.del(`refresh:${userId}:${jti}`);

export const closeRedis = async () => {
  if (connected) await redis.quit();
};
