// =====================================================================
// Puente de acceso para clientes reales de Stripe cuya Subscription
// todavía no existe como tal — solo un Subscription Schedule en estado
// "not_started" (ver incidencia: migración Stripe, ~20 casos). Crea una
// fila en `subscriptions` con source='courtesy' (es el único valor del
// esquema que no exige un stripe_sub_id real — la Subscription de verdad
// aún no existe en Stripe) PERO con el plan real resuelto desde el precio
// de su phase, no "courtesy" — para que quede claro que es un cliente de
// pago real en tránsito, no un regalo. period_end = la fecha en la que
// arranca su phase: en ese momento Stripe crea la Subscription real, nuestro
// webhook (customer.subscription.created) la recoge sola, y esta fila
// puente simplemente deja de estar vigente sin que haya que borrar nada.
//
// Uso:
//   node scripts/bridge-schedule-subscriptions.js            # dry-run
//   node scripts/bridge-schedule-subscriptions.js --send      # escribe de verdad
// =====================================================================
import { pool, query, closePool } from '../backend/src/config/db.js';
import { stripe, planFromPrice } from '../backend/src/services/stripe.js';

const SEND = process.argv.includes('--send');

async function resolvePlanForScheduleItem(item) {
  const priceId = typeof item.price === 'string' ? item.price : item.price?.id;
  if (!priceId) return null;
  try {
    const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
    return planFromPrice(price);
  } catch (err) {
    console.warn(`    (no se pudo resolver el precio ${priceId}: ${err.message})`);
    return null;
  }
}

async function main() {
  const { rows } = await query(
    `SELECT u.id, u.email, u.stripe_customer_id FROM users u
      WHERE u.role <> 'admin'
        AND u.stripe_customer_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = u.id)
      ORDER BY u.email`,
  );

  console.log(`Revisando ${rows.length} usuario(s) sin ninguna suscripción…`);
  console.log(SEND ? '*** MODO ESCRITURA REAL (--send) ***' : 'Modo DRY-RUN (no se escribe nada — usa --send para escribir de verdad)');

  let bridged = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const u = rows[i];
    try {
      const schedules = await stripe.subscriptionSchedules.list({ customer: u.stripe_customer_id, limit: 10 });
      const pending = schedules.data.find((sc) => sc.status === 'not_started');
      if (!pending) { skipped++; continue; }

      const phase = pending.phases[0];
      const item = phase.items[0];
      const plan = await resolvePlanForScheduleItem(item);
      const periodEnd = new Date(phase.start_date * 1000);

      console.log(`[${i + 1}/${rows.length}] ${u.email} → plan=${plan ?? '(sin resolver)'} hasta ${periodEnd.toISOString().slice(0, 10)}${SEND ? '' : ' (dry-run)'}`);

      if (!plan) {
        console.warn(`    plan sin resolver — se omite hasta asignarlo a mano (revisa el precio ${item.price} en Stripe)`);
        failed++;
        continue;
      }

      if (SEND) {
        await query(
          `INSERT INTO subscriptions (user_id, stripe_sub_id, source, plan, status, period_start, period_end)
           VALUES ($1, NULL, 'courtesy', $2, 'active', now(), $3)`,
          [u.id, plan, periodEnd],
        );
      }
      bridged++;
    } catch (err) {
      failed++;
      console.log(`[${i + 1}/${rows.length}] ${u.email} — FALLO: ${err.message}`);
    }
  }

  console.log(`\n--- Resumen ---`);
  console.log(`Puenteados: ${bridged}${SEND ? '' : ' (dry-run, nada escrito)'}`);
  console.log(`Sin schedule pendiente (omitidos, no son de este caso): ${skipped}`);
  console.log(`Fallidos / plan sin resolver: ${failed}`);

  await closePool();
}

main().catch(async (err) => {
  console.error('Error inesperado:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
