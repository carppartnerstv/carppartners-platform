// =====================================================================
// Middlewares de autenticación y autorización.  (Briefing 4.2, 4.3)
//
//   requireAuth          -> exige JWT válido, carga req.user
//   requireSubscription  -> exige suscripción activa (consulta PostgreSQL)
//   requireAdmin         -> exige role = 'admin'
// =====================================================================
import { verifyAccessToken } from '../utils/tokens.js';
import { forbidden, unauthorized } from '../utils/errors.js';
import { queryOne } from '../config/db.js';

/**
 * Verifica el access token de la cabecera Authorization: Bearer <token>.
 * Carga datos frescos del usuario desde la BD en req.user.
 */
export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw unauthorized('Falta el token de acceso', 'NO_TOKEN');
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw unauthorized('Token inválido o expirado', 'TOKEN_INVALID');
    }

    const user = await queryOne(
      'SELECT id, email, name, role, avatar_url, stripe_customer_id FROM users WHERE id = $1',
      [payload.sub],
    );
    if (!user) throw unauthorized('Usuario no existe', 'USER_NOT_FOUND');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Comprueba en PostgreSQL que el usuario tiene una suscripción que da acceso.
 * 'active' y 'trialing' dan acceso; 'past_due' aún da acceso durante el periodo
 * de reintentos de Stripe; 'cancelled' lo pierde al terminar el periodo pagado.
 *
 * Si NO tiene acceso -> 403 con code SUBSCRIPTION_REQUIRED, que la app usa
 * para mostrar la pantalla de planes. (Briefing 4.3)
 */
export async function requireSubscription(req, _res, next) {
  try {
    const sub = await queryOne(
      `SELECT status, period_end
         FROM subscriptions
        WHERE user_id = $1
          AND status IN ('active', 'trialing', 'past_due')
        ORDER BY period_end DESC NULLS LAST
        LIMIT 1`,
      [req.user.id],
    );

    // period_end NULL = sin fecha de caducidad (p. ej. cortesía indefinida).
    // Para las de pago, los webhooks de Stripe mantienen period_end al día
    // en cada renovación, así que comprobarlo aquí no cambia su comportamiento
    // salvo si un webhook se retrasa (en cuyo caso es lo correcto: cortar el
    // acceso en cuanto el periodo ya pagado/regalado termina de verdad).
    const notExpired = !sub?.period_end || new Date(sub.period_end) > new Date();
    const hasAccess =
      !!sub && notExpired && ['active', 'trialing', 'past_due'].includes(sub.status);

    if (!hasAccess) {
      throw forbidden('Necesitas una suscripción activa', 'SUBSCRIPTION_REQUIRED');
    }

    req.subscription = sub;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') {
    return next(forbidden('Se requiere rol de administrador', 'ADMIN_REQUIRED'));
  }
  next();
}
