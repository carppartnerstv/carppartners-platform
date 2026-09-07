// =====================================================================
// Lógica de sincronización de suscripciones. Fuente de verdad = Stripe.
// Tanto los webhooks como el script de migración hacen UPSERT aquí, así la
// regla de negocio vive en un solo sitio. (Briefing 4.4, 6.1)
// =====================================================================
import { query, queryOne } from '../config/db.js';
import { stripe, mapStripeStatus, planFromPrice } from './stripe.js';

// Con estos tres, requireSubscription (auth.js) da acceso. Solo con uno de
// estos re-enlazamos automáticamente por email más abajo — nunca con un
// intento fallido o incompleto.
const ACCESS_GRANTING_STATUSES = ['active', 'trialing', 'past_due'];

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
    // re-enlazar a alguien con un pago que en realidad no ha cuajado.
    const customer = await stripe.customers.retrieve(customerId).catch(() => null);
    const email = customer && !customer.deleted ? customer.email : null;
    if (email) {
      user = await queryOne('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
      if (user) {
        await query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, user.id]);
        console.log(`[subs] Re-enlazado por email: ${email} -> ${customerId} (antes desconocido)`);
      }
    }
  }

  if (!user) {
    // Puede ocurrir si llega un webhook de un cliente aún no migrado.
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
