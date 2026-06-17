// =====================================================================
// Servicio Stripe — instancia del cliente + helpers.
// La verificación de firma de webhooks se hace en routes/stripe.js
// porque necesita el body crudo (raw). (Briefing 4.4)
// =====================================================================
import Stripe from 'stripe';
import { config } from '../config/index.js';

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
