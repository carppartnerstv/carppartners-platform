// =====================================================================
// Punto de entrada del backend. Conecta Redis, arranca el servidor y
// gestiona apagado limpio (pm2 envía SIGINT/SIGTERM en cada reload).
// =====================================================================
import { createApp } from './app.js';
import { config } from './config/index.js';
import { connectRedis, closeRedis } from './config/redis.js';
import { closePool } from './config/db.js';
import { verifyMailConnection } from './services/mail.js';

async function main() {
  await connectRedis();
  await verifyMailConnection(); // nunca lanza — un SMTP caído no debe impedir arrancar

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[server] Carp Partners TV API escuchando en :${config.port} (${config.env})`);
  });

  const shutdown = async (signal) => {
    console.log(`[server] ${signal} recibido, cerrando...`);
    server.close(async () => {
      await closeRedis();
      await closePool();
      process.exit(0);
    });
    // Failsafe: si no cierra en 10s, salir igualmente.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[server] Fallo al arrancar:', err);
  process.exit(1);
});
