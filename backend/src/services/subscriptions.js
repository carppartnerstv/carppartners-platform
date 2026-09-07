// =====================================================================
// Lógica de sincronización de suscripciones. Fuente de verdad = Stripe.
// Tanto los webhooks como el script de migración hacen UPSERT aquí, así la
// regla de negocio vive en un solo sitio. (Briefing 4.4, 6.1)
// =====================================================================
import crypto from 'node:crypto';
import { query, queryOne } from '../config/db.js';
import { stripe, mapStripeStatus, planFromPrice } from './stripe.js';

// Con estos tres, requireSubscription (auth.js) da acceso. Solo con uno de
// estos re-enlazamos o creamos la cuenta automáticamente más abajo — nunca
// con un intento fallido o incompleto.
const ACCESS_GRANTING_STATUSES = ['active', 'trialing', 'past_due'];

// Mismo TTL que usa migrate-stripe.js para el enlace de "establece tu
// contraseña" — se reutiliza la lógica exacta de ese script para altas
// nuevas que llegan por webhook (WordPress sigue creando suscriptores que
// nunca han pasado por nuestra plataforma).
const SET_PASSWORD_TTL_DAYS = 14;

/**
 * Inserta o actualiza una suscripción a partir de un objeto subscription de
 * Stripe. Resuelve el user_id por el stripe_customer_id.
 * @param {import('stripe').Stripe.Subscription} sub
 */
export async function upsertSubscriptionFromStripe(sub) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

  let user = await queryOne('SELECT id FROM users WHERE stripe_customer_id = $1', [customerId]);
  const status = mapStripeStatus(sub.status);

  if (!user && ACCESS_GRANTING_STATUSES.includes(status)) {
    // WordPress/ARMember (que sigue activo en paralelo a esta plataforma)
    // crea un Customer de Stripe NUEVO en cada alta o renovación, en vez de
    // reutilizar el que ya teníamos enlazado — así que un customer_id
    // "desconocido" muchas veces no es un cliente sin migrar, es alguien
    // que YA es nuestro pero cuyo customer_id cambió por fuera de nuestra
    // plataforma. Antes de rendirnos, probamos a resolverlo por el email
    // del Customer en Stripe. Solo entramos aquí con un status que da
    // acceso de verdad (nunca en un intento fallido/incompleto), para no
    // re-enlazar/crear a alguien con un pago que en realidad no ha cuajado.
    const customer = await stripe.customers.retrieve(customerId).catch(() => null);
    const email = customer && !customer.deleted ? customer.email : null;
    if (email) {
      const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
      if (existing) {
        user = existing;
        await query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, user.id]);
        console.log(`[subs] Re-enlazado por email: ${email} -> ${customerId} (antes desconocido)`);
      } else {
        // Persona que nunca ha pasado por nuestra plataforma (alta nueva en
        // WordPress) — mismo INSERT ... ON CONFLICT que migrate-stripe.js,
        // así el webhook la da de alta en el momento en vez de esperar a
        // que alguien relance la migración a mano. ON CONFLICT (no un
        // INSERT liso) por si dos eventos de esta misma alta llegan casi a
        // la vez y ambos intentan crearla.
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + SET_PASSWORD_TTL_DAYS * 86_400_000);
        const stripeCreatedAt = customer.created ? new Date(customer.created * 1000) : null;
        user = await queryOne(
          `INSERT INTO users (email, name, stripe_customer_id, stripe_created_at, password_set_token, password_set_expires)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (email) DO UPDATE SET
              stripe_customer_id   = EXCLUDED.stripe_customer_id,
              stripe_created_at    = COALESCE(users.stripe_created_at, EXCLUDED.stripe_created_at),
              name                 = COALESCE(users.name, EXCLUDED.name),
              password_set_token   = CASE WHEN users.password_hash IS NULL
                                          THEN EXCLUDED.password_set_token ELSE users.password_set_token END,
              password_set_expires = CASE WHEN users.password_hash IS NULL
                                          THEN EXCLUDED.password_set_expires ELSE users.password_set_expires END
           RETURNING id`,
          [email.toLowerCase(), customer.name ?? null, customerId, stripeCreatedAt, token, expires],
        );
        console.log(`[subs] Cuenta nueva creada desde el webhook: ${email} (${customerId})`);
      }
    }
  }

  if (!user) {
    // Puede ocurrir si el Customer de Stripe no tiene email, o si la
    // consulta a Stripe para resolverlo falló.
    console.warn(`[subs] Webhook de cliente Stripe desconocido: ${customerId}`);
    return null;
  }

  const price = sub.items?.data?.[0]?.price ?? null;
  const plan = planFromPrice(price);
  const periodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000) : null;
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
  const cancelledAt = sub.canceled_at ? new Date(sub.canceled_at * 1000) : null;
  // Cancelar desde el Customer Portal no cambia `status` de inmediato (Stripe
  // la deja 'active' hasta que termina el periodo ya pagado) — solo pone
  // este flag. Sin guardarlo no había forma de avisar al usuario de que ya
  // ha cancelado hasta que la baja fuera definitiva.
  const cancelAtPeriodEnd = !!sub.cancel_at_period_end;

  await query(
    `INSERT INTO subscriptions
        (user_id, stripe_sub_id, plan, status, period_start, period_end, cancelled_at, cancel_at_period_end)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (stripe_sub_id) DO UPDATE SET
        plan                 = EXCLUDED.plan,
        status               = EXCLUDED.status,
        period_start         = EXCLUDED.period_start,
        period_end           = EXCLUDED.period_end,
        cancelled_at         = EXCLUDED.cancelled_at,
        cancel_at_period_end = EXCLUDED.cancel_at_period_end`,
    [user.id, sub.id, plan, status, periodStart, periodEnd, cancelledAt, cancelAtPeriodEnd],
  );

  return { userId: user.id, status };
}

/**
 * Marca una suscripción como cancelada (customer.subscription.deleted).
 */
export async function markSubscriptionCancelled(stripeSubId) {
  await query(
    `UPDATE subscriptions
        SET status = 'cancelled', cancelled_at = now()
      WHERE stripe_sub_id = $1`,
    [stripeSubId],
  );
}
