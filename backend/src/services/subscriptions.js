// =====================================================================
// Lógica de sincronización de suscripciones. Fuente de verdad = Stripe.
// Tanto los webhooks como el script de migración hacen UPSERT aquí, así la
// regla de negocio vive en un solo sitio. (Briefing 4.4, 6.1)
// =====================================================================
import { query, queryOne } from '../config/db.js';
import { mapStripeStatus, planFromPrice } from './stripe.js';

/**
 * Inserta o actualiza una suscripción a partir de un objeto subscription de
 * Stripe. Resuelve el user_id por el stripe_customer_id.
 * @param {import('stripe').Stripe.Subscription} sub
 */
export async function upsertSubscriptionFromStripe(sub) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

  const user = await queryOne('SELECT id FROM users WHERE stripe_customer_id = $1', [customerId]);
  if (!user) {
    // Puede ocurrir si llega un webhook de un cliente aún no migrado.
    console.warn(`[subs] Webhook de cliente Stripe desconocido: ${customerId}`);
    return null;
  }

  const price = sub.items?.data?.[0]?.price ?? null;
  const plan = planFromPrice(price);
  const status = mapStripeStatus(sub.status);
  const periodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000) : null;
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
  const cancelledAt = sub.canceled_at ? new Date(sub.canceled_at * 1000) : null;

  await query(
    `INSERT INTO subscriptions
        (user_id, stripe_sub_id, plan, status, period_start, period_end, cancelled_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (stripe_sub_id) DO UPDATE SET
        plan         = EXCLUDED.plan,
        status       = EXCLUDED.status,
        period_start = EXCLUDED.period_start,
        period_end   = EXCLUDED.period_end,
        cancelled_at = EXCLUDED.cancelled_at`,
    [user.id, sub.id, plan, status, periodStart, periodEnd, cancelledAt],
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
