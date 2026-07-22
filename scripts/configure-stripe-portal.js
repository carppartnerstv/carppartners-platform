// =====================================================================
// Activa el cambio de plan (mensual <-> anual) en la configuración del
// Customer Portal de Stripe. Es un ajuste de CUENTA (no de nuestro código):
// hay que ejecutarlo una vez por modo (test/live) — no lo dispara la app en
// cada sesión de portal, sería una llamada de más en cada uso. Idempotente:
// si ya está activado con los dos precios correctos, no hace nada.
//
// Uso (necesita STRIPE_SECRET_KEY y STRIPE_PRODUCT_MONTHLY/ANNUAL en el entorno):
//   node scripts/configure-stripe-portal.js
// =====================================================================
import { stripe, resolvePriceIdForPlan } from '../backend/src/services/stripe.js';
import { config } from '../backend/src/config/index.js';

async function main() {
  const monthlyPriceId = await resolvePriceIdForPlan('monthly');
  const annualPriceId = await resolvePriceIdForPlan('annual');

  const subscriptionUpdate = {
    enabled: true,
    default_allowed_updates: ['price'],
    // Prorratea al momento del cambio (cobra/abona la diferencia ya) — es el
    // comportamiento estándar de Stripe para upgrade/downgrade inmediato.
    proration_behavior: 'create_prorations',
    products: [
      { product: config.stripe.productMonthly, prices: [monthlyPriceId] },
      { product: config.stripe.productAnnual, prices: [annualPriceId] },
    ],
  };

  // Stripe crea sola una configuración por defecto la primera vez que se
  // abre una sesión de portal si no existe ninguna — puede que ya exista.
  // `products` es un campo "expandible": sin `expand` no viene en la
  // respuesta aunque esté guardado, así que lo pedimos explícitamente para
  // que la comprobación de idempotencia de abajo funcione de verdad.
  const configs = await stripe.billingPortal.configurations.list({
    limit: 100,
    expand: ['data.features.subscription_update.products'],
  });
  const defaultConfig = configs.data.find((c) => c.is_default) ?? configs.data[0];

  if (!defaultConfig) {
    const created = await stripe.billingPortal.configurations.create({
      business_profile: { headline: 'Carp Partners TV' },
      features: {
        subscription_update: subscriptionUpdate,
        subscription_cancel: { enabled: true, mode: 'at_period_end' },
        payment_method_update: { enabled: true },
        invoice_history: { enabled: true },
      },
    });
    console.log('Configuración de portal creada:', created.id);
    return;
  }

  const already =
    defaultConfig.features.subscription_update?.enabled &&
    defaultConfig.features.subscription_update.products?.some((p) => p.product === config.stripe.productMonthly) &&
    defaultConfig.features.subscription_update.products?.some((p) => p.product === config.stripe.productAnnual);

  if (already) {
    console.log(`El cambio de plan ya estaba activado en ${defaultConfig.id} — nada que hacer.`);
    return;
  }

  const updated = await stripe.billingPortal.configurations.update(
    defaultConfig.id,
    { features: { subscription_update: subscriptionUpdate } },
    { expand: ['features.subscription_update.products'] },
  );
  console.log(`Cambio de plan activado en la configuración ${updated.id}.`);
  console.log('  subscription_update.enabled:', updated.features.subscription_update.enabled);
  console.log('  productos permitidos:', updated.features.subscription_update.products.map((p) => p.product).join(', '));
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exitCode = 1;
});
