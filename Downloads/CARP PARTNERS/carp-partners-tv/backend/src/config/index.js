// =====================================================================
// Configuración centralizada y validada de variables de entorno.
// Falla rápido al arrancar si falta algo crítico (mejor que un 500 a las 3 AM).
// =====================================================================
import dotenv from 'dotenv';

dotenv.config();

const required = (key, fallback = undefined) => {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Falta la variable de entorno obligatoria: ${key}`);
  }
  return value;
};

const optional = (key, fallback) => process.env[key] ?? fallback;

export const config = {
  env: optional('NODE_ENV', 'development'),
  isProd: optional('NODE_ENV', 'development') === 'production',
  port: parseInt(optional('PORT', '3001'), 10),

  // URL pública del frontend (para CORS y enlaces en emails)
  publicUrl: optional('PUBLIC_URL', 'https://carppartners.tv'),
  corsOrigins: optional('CORS_ORIGINS', 'https://carppartners.tv,http://localhost:3000')
    .split(',')
    .map((s) => s.trim()),

  db: {
    // En el VPS: postgresql://carp:password@localhost:5432/carp_partners
    connectionString: required('DATABASE_URL'),
    max: parseInt(optional('DB_POOL_MAX', '10'), 10),
  },

  redis: {
    url: optional('REDIS_URL', 'redis://localhost:6379'),
  },

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessTtl: optional('JWT_ACCESS_TTL', '24h'),   // Briefing 4.2
    refreshTtl: optional('JWT_REFRESH_TTL', '30d'),
    refreshTtlSeconds: 30 * 24 * 60 * 60,
  },

  stripe: {
    secretKey: required('STRIPE_SECRET_KEY'),
    webhookSecret: required('STRIPE_WEBHOOK_SECRET'),
    // Identificación del plan por PRODUCTO (lo que nos han facilitado)…
    productMonthly: optional('STRIPE_PRODUCT_MONTHLY', ''),
    productAnnual: optional('STRIPE_PRODUCT_ANNUAL', ''),
    // …o por PRECIO si se prefiere (respaldo, opcional).
    priceMonthly: optional('STRIPE_PRICE_MONTHLY', ''),
    priceAnnual: optional('STRIPE_PRICE_ANNUAL', ''),
  },

  vimeo: {
    // Credenciales privadas — NUNCA llegan al cliente (Briefing 4.3).
    // Dos formas de autenticar (al menos una obligatoria):
    //  a) accessToken estático generado en el panel de Vimeo (recomendado:
    //     permite scopes para leer archivos de vídeo privados), o
    //  b) clientId + clientSecret -> el backend obtiene el token solo.
    accessToken: optional('VIMEO_ACCESS_TOKEN', ''),
    clientId: optional('VIMEO_CLIENT_ID', ''),
    clientSecret: optional('VIMEO_CLIENT_SECRET', ''),
  },
};

// Vimeo necesita o un access token o el par client_id/secret.
if (!config.vimeo.accessToken && !(config.vimeo.clientId && config.vimeo.clientSecret)) {
  throw new Error(
    'Configura VIMEO_ACCESS_TOKEN, o bien VIMEO_CLIENT_ID + VIMEO_CLIENT_SECRET',
  );
}
