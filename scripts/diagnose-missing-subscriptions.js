// =====================================================================
// SOLO LECTURA. No escribe nada en la base de datos ni en Stripe.
//
// Diagnóstico de los usuarios con stripe_customer_id pero SIN ninguna fila
// en subscriptions (el bug de abort de migrate-stripe.js + el caso de los
// Subscription Schedules "not_started" pueden dar el mismo síntoma en
// nuestra BD, pero necesitan remedios distintos). Para cada uno, consulta
// Stripe y lo clasifica en:
//
//   HAS_SUBSCRIPTION   → Stripe SÍ tiene una Subscription real (cualquier
//                         estado). El bug de abort del script se la comió —
//                         re-ejecutar migrate-stripe.js (ya corregido) la
//                         importaría sin más.
//   SCHEDULE_PENDING   → Stripe tiene un Subscription Schedule sin empezar
//                         todavía (status=not_started). No hay Subscription
//                         que importar — necesita cortesía puente hasta la
//                         fecha de inicio de su phase.
//   NOTHING_IN_STRIPE  → Stripe no tiene ni Subscription ni Schedule para
//                         este cliente. Caso raro, revisar a mano.
//
// Uso:
//   node scripts/diagnose-missing-subscriptions.js
// =====================================================================
import { pool, query, closePool } from '../backend/src/config/db.js';
import { stripe } from '../backend/src/services/stripe.js';

async function main() {
  const { rows } = await query(
    `SELECT u.id, u.email, u.stripe_customer_id FROM users u
      WHERE u.role <> 'admin'
        AND u.stripe_customer_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = u.id)
      ORDER BY u.email`,
  );

  console.log(`${rows.length} usuario(s) con stripe_customer_id y sin ninguna fila en subscriptions.\n`);

  const buckets = { HAS_SUBSCRIPTION: [], SCHEDULE_PENDING: [], NOTHING_IN_STRIPE: [], ERROR: [] };

  for (let i = 0; i < rows.length; i++) {
    const u = rows[i];
    process.stdout.write(`[${i + 1}/${rows.length}] ${u.email} (${u.stripe_customer_id}) … `);
    try {
      const subs = await stripe.subscriptions.list({ customer: u.stripe_customer_id, status: 'all', limit: 10 });
      if (subs.data.length > 0) {
        const s = subs.data[0];
        console.log(`HAS_SUBSCRIPTION (${s.id}, status=${s.status})`);
        buckets.HAS_SUBSCRIPTION.push({ email: u.email, customerId: u.stripe_customer_id, subId: s.id, status: s.status });
        continue;
      }

      const schedules = await stripe.subscriptionSchedules.list({ customer: u.stripe_customer_id, limit: 10 });
      const pending = schedules.data.find((sc) => sc.status === 'not_started');
      if (pending) {
        const startDate = new Date(pending.phases[0].start_date * 1000).toISOString().slice(0, 10);
        console.log(`SCHEDULE_PENDING (${pending.id}, empieza ${startDate})`);
        buckets.SCHEDULE_PENDING.push({ email: u.email, customerId: u.stripe_customer_id, scheduleId: pending.id, startDate });
        continue;
      }

      console.log('NOTHING_IN_STRIPE');
      buckets.NOTHING_IN_STRIPE.push({ email: u.email, customerId: u.stripe_customer_id });
    } catch (err) {
      console.log(`ERROR — ${err.message}`);
      buckets.ERROR.push({ email: u.email, customerId: u.stripe_customer_id, reason: err.message });
    }
  }

  console.log('\n=== Resumen ===');
  console.log(`HAS_SUBSCRIPTION (re-ejecutar migrate-stripe.js los arregla):  ${buckets.HAS_SUBSCRIPTION.length}`);
  console.log(`SCHEDULE_PENDING (necesitan cortesía puente):                  ${buckets.SCHEDULE_PENDING.length}`);
  console.log(`NOTHING_IN_STRIPE (revisar a mano):                            ${buckets.NOTHING_IN_STRIPE.length}`);
  console.log(`ERROR (fallo consultando Stripe):                              ${buckets.ERROR.length}`);

  for (const [bucket, items] of Object.entries(buckets)) {
    if (items.length === 0) continue;
    console.log(`\n--- ${bucket} ---`);
    items.forEach((it) => console.log(JSON.stringify(it)));
  }

  await closePool();
}

main().catch(async (err) => {
  console.error('Error inesperado:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
