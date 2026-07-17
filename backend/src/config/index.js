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

  // URL pública del frontend (para CORS y el retorno del Customer Portal de Stripe)
  publicUrl: optional('PUBLIC_URL', 'https://carppartners.tv'),
  corsOrigins: optional('CORS_ORIGINS', 'https://carppartners.tv,http://localhost:3000')
    .split(',')
    .map((s) => s.trim()),

  // URL pública de la web de suscriptores — para construir enlaces en emails
  // (recuperar contraseña, establecer contraseña, etc.). Distinta de
  // publicUrl porque puede vivir en un subdominio propio (app.carppartners.tv).
  publicWebUrl: optional('PUBLIC_WEB_URL', 'https://app.carppartners.tv'),

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

  // SMTP de una cuenta de correo ya existente (no un proveedor tipo Resend).
  // Todo opcional (no `required()`): si falta, el servicio de email se
  // limita a loguear y omitir el envío — nunca debe impedir que el backend
  // arranque o que un flujo (registro, contacto...) complete su respuesta.
  mail: {
    smtpHost: optional('SMTP_HOST', ''),
    smtpPort: parseInt(optional('SMTP_PORT', '587'), 10),
    smtpSecure: optional('SMTP_SECURE', 'false') === 'true',
    smtpUser: optional('SMTP_USER', ''),
    smtpPass: optional('SMTP_PASS', ''),
    from: optional('MAIL_FROM', 'Carp Partners TV <info@carppartners.tv>'),
    admin: optional('MAIL_ADMIN', ''),
  },
};

// Vimeo necesita o un access token o el par client_id/secret.
if (!config.vimeo.accessToken && !(config.vimeo.clientId && config.vimeo.clientSecret)) {
  throw new Error(
    'Configura VIMEO_ACCESS_TOKEN, o bien VIMEO_CLIENT_ID + VIMEO_CLIENT_SECRET',
  );
}
