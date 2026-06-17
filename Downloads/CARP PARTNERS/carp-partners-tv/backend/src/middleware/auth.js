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

    const hasAccess =
      sub &&
      (sub.status === 'active' ||
        sub.status === 'trialing' ||
        // past_due sigue dando acceso hasta que termina el periodo ya pagado
        (sub.status === 'past_due' && sub.period_end && new Date(sub.period_end) > new Date()));

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
