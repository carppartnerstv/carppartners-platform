// =====================================================================
// Resuelve los price_id activos a partir de los IDs de producto de Stripe.
// Útil si en algún momento quieres fijar STRIPE_PRICE_* en el .env, o
// para crear las sesiones de checkout (que sí necesitan price_id).
//
// Uso (necesita STRIPE_SECRET_KEY en el entorno):
//   node scripts/resolve-stripe-prices.js
// =====================================================================
import { stripe } from '../backend/src/services/stripe.js';

const PRODUCTS = {
  // Rellena con tus IDs de producto reales (o pásalos por argumento):
  Anual: process.env.STRIPE_PRODUCT_ANNUAL || 'prod_UiJ29aTCgFXshA',
  Mensual: process.env.STRIPE_PRODUCT_MONTHLY || 'prod_UiJ1iulHEeHC0p',
};

async function main() {
  for (const [label, productId] of Object.entries(PRODUCTS)) {
    const prices = await stripe.prices.list({ product: productId, active: true, limit: 10 });
    console.log(`\n${label}  (${productId}):`);
    if (prices.data.length === 0) {
      console.log('  (sin precios activos)');
      continue;
    }
    for (const p of prices.data) {
      const amount = p.unit_amount != null ? (p.unit_amount / 100).toFixed(2) : '—';
      const interval = p.recurring ? `/${p.recurring.interval}` : ' (pago único)';
      console.log(`  ${p.id}  ->  ${amount} ${p.currency.toUpperCase()}${interval}`);
    }
  }
  console.log('\nCopia el price_id que uses a STRIPE_PRICE_MONTHLY / STRIPE_PRICE_ANNUAL si lo necesitas.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exitCode = 1;
});
