// =====================================================================
// Limitadores de peticiones. Cada uno se aplica a nivel de RUTA concreta
// (nunca montado en app.use('/', ...)) — montarlo en la raíz aplicaría el
// límite a toda la API, no solo a la ruta pensada para él.
//
// `trust proxy` está a 1 en app.js (un único salto: Nginx delante del
// backend) y Nginx reenvía X-Forwarded-For con la IP real del cliente
// (deploy/nginx/carppartners.tv.conf), así que req.ip ya identifica al
// cliente real y no a Nginx — cada IP tiene su propio contador.
// =====================================================================
import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';

// Rutas sensibles a fuerza bruta / abuso: login, registro, recuperar
// contraseña y establecer contraseña (comparte endpoint con la
// recuperación — ver CLAUDE.md). Aquí el límite estricto sí aporta.
export const authSensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isProd ? 30 : 200,
  standardHeaders: true,
  legacyHeaders: false,
});

// Formulario de contacto: pública y dispara emails, hay que frenar el spam.
export const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isProd ? 10 : 200,
  standardHeaders: true,
  legacyHeaders: false,
});

// Panel admin: ya exige JWT + rol admin, así que esto no es la primera
// línea de defensa — es un tope generoso para no bloquear el uso normal
// (una pantalla del panel puede disparar varias peticiones a la vez) pero
// seguir protegiendo frente a un bug del front o un token comprometido.
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isProd ? 600 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
});
