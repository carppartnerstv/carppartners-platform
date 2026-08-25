// =====================================================================
// Servicio Stripe — instancia del cliente + helpers.
// La verificación de firma de webhooks se hace en routes/stripe.js
// porque necesita el body crudo (raw). (Briefing 4.4)
// =====================================================================
import Stripe from 'stripe';
import { config } from '../config/index.js';
import { query } from '../config/db.js';

export const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2024-12-18.acacia',
});

/**
 * Traduce un precio de Stripe a nuestro nombre de plan interno.
 *
 * Acepta el objeto `price` completo de una suscripción. Identifica el plan
 * por el ID de PRODUCTO (lo que nos han facilitado), con respaldo por price_id
 * si se configuran. Así funciona tanto si conoces el producto como el precio.
 *
 * @param {import('stripe').Stripe.Price | string} price  objeto price o price_id
 */
export function planFromPrice(price) {
  const priceId = typeof price === 'string' ? price : price?.id;
  const productId = typeof price === 'string' ? null
    : (typeof price?.product === 'string' ? price.product : price?.product?.id);

  // 1) Por producto (preferente — es lo que tenemos configurado)
  if (productId && productId === config.stripe.productMonthly) return 'monthly';
  if (productId && productId === config.stripe.productAnnual) return 'annual';

  // 2) Respaldo por price_id (si algún día se configuran)
  if (priceId && priceId === config.stripe.priceMonthly) return 'monthly';
  if (priceId && priceId === config.stripe.priceAnnual) return 'annual';

  return null;
}

/**
 * Mapea el estado de suscripción de Stripe a nuestro enum interno.
 * Stripe: active, trialing, past_due, canceled, unpaid, incomplete, incomplete_expired
 */
export function mapStripeStatus(stripeStatus) {
  switch (stripeStatus) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
      return 'cancelled';
    default:
      return 'incomplete';
  }
}

/**
 * Crea una sesión del Customer Portal de Stripe para que el usuario gestione
 * su suscripción (cambiar plan, actualizar tarjeta, cancelar). (Briefing 5.1 /perfil)
 */
export async function createPortalSession(stripeCustomerId, returnUrl) {
  return stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });
}

/**
 * Devuelve el stripe_customer_id del usuario, creándolo en Stripe (y
 * guardándolo en nuestra BD) si todavía no tiene uno. Tiene que existir
 * ANTES de crear la Checkout Session: es lo que permite al webhook
 * (upsertSubscriptionFromStripe) resolver qué usuario nuestro corresponde
 * a la suscripción que llega de Stripe.
 */
export async function getOrCreateStripeCustomer(user) {
  if (user.stripe_customer_id) return user.stripe_customer_id;

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { userId: user.id },
  });

  await query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customer.id, user.id]);
  return customer.id;
}

/**
 * Resuelve el price_id activo para un plan. Preferimos STRIPE_PRICE_MONTHLY/
 * ANNUAL si están configurados (evita una llamada a Stripe); si no, buscamos
 * el precio activo del producto configurado (STRIPE_PRODUCT_MONTHLY/ANNUAL).
 */
export async function resolvePriceIdForPlan(plan) {
  const configuredPrice = plan === 'monthly' ? config.stripe.priceMonthly : config.stripe.priceAnnual;
  if (configuredPrice) return configuredPrice;

  const productId = plan === 'monthly' ? config.stripe.productMonthly : config.stripe.productAnnual;
  if (!productId) throw new Error(`Falta configurar el producto/precio de Stripe para el plan "${plan}"`);

  const prices = await stripe.prices.list({ product: productId, active: true, limit: 1 });
  const price = prices.data[0];
  if (!price) throw new Error(`El producto de Stripe "${productId}" no tiene ningún precio activo`);
  return price.id;
}

/**
 * Resumen de la tarjeta asociada a una suscripción (para mostrarla en
 * /perfil). Primero mira el método de pago propio de ESA suscripción
 * (default_payment_method); si no tiene uno asignado, cae en el método de
 * pago por defecto del customer. Solo cubre tarjetas (type 'card') — para
 * cualquier otro método (SEPA, etc.) devuelve null, ya que no hay UI para
 * representarlo.
 * @param {string|null} stripeSubId
 * @param {string|null} stripeCustomerId
 */
export async function getSubscriptionCardSummary(stripeSubId, stripeCustomerId) {
  let pm = null;

  if (stripeSubId) {
    const sub = await stripe.subscriptions.retrieve(stripeSubId, { expand: ['default_payment_method'] });
    pm = sub.default_payment_method;
  }

  if (!pm && stripeCustomerId) {
    const customer = await stripe.customers.retrieve(stripeCustomerId, {
      expand: ['invoice_settings.default_payment_method'],
    });
    if (!customer.deleted) pm = customer.invoice_settings?.default_payment_method ?? null;
  }

  if (!pm) return null;
  if (typeof pm === 'string') pm = await stripe.paymentMethods.retrieve(pm);
  if (pm.type !== 'card' || !pm.card) return null;

  return {
    brand: pm.card.brand,
    last4: pm.card.last4,
    expMonth: pm.card.exp_month,
    expYear: pm.card.exp_year,
  };
}

/**
 * Crea la Checkout Session en modo suscripción para dar de alta un plan.
 */
export async function createCheckoutSession({ customerId, priceId, successUrl, cancelUrl }) {
  return stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}
