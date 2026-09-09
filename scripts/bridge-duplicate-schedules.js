// =====================================================================
// Caso combinado que ni find-stale-customer-links.js ni
// bridge-schedule-subscriptions.js detectan solos: un usuario con un
// Customer de Stripe duplicado (mismo email, otro customer_id que el que
// tenemos enlazado — el caso de find-stale-customer-links.js) cuyo
// duplicado NO tiene ninguna Subscription real todavía, sino solo una
// Subscription Schedule pendiente (el caso de
// bridge-schedule-subscriptions.js, pero ese script solo mira schedules
// del customer YA enlazado, nunca de un duplicado que no conocemos).
//
// Caso real que lo motivó: barnygambel_89@hotmail.com — BD enlazada a un
// customer antiguo (mensual, cancelado); el pago real más reciente (89,99€,
// plan anual) fue a OTRO customer que WordPress creó, con un cargo puntual
// ya cobrado y una Subscription Schedule que no arrancará hasta dentro de
// un año (cuando toque renovar) — sin eso, esta persona se queda sin
// acceso todo un año pese a haber pagado.
//
// Misma lógica de puente que bridge-schedule-subscriptions.js (courtesy
// con el plan real, period_end = la fecha en la que arranca la phase) pero
// ADEMÁS re-enlaza users.stripe_customer_id al customer correcto — si no,
// el webhook seguiría sin saber nunca resolver a este usuario cuando la
// Subscription real se cree en Stripe dentro de un año.
//
// Si la fecha de la phase ya pasó (la programación debería haberse
// activado y no lo ha hecho) NO se puentea — es anómalo y se deja para
// revisión manual en vez de dar un acceso con fecha de caducidad ya
// vencida.
//
// Uso:
//   node scripts/bridge-duplicate-schedules.js            # dry-run
//   node scripts/bridge-duplicate-schedules.js --send      # escribe de verdad
// =====================================================================
import { pool, query, closePool } from '../backend/src/config/db.js';
import { stripe, planFromPrice } from '../backend/src/services/stripe.js';

const SEND = process.argv.includes('--send');

// Mismo criterio que requireSubscription (auth.js) / el resto de scripts
// de esta incidencia.
const ACCESS_GRANTING_DB_STATUSES = ['active', 'trialing', 'past_due'];

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
  console.log(SEND
    ? '*** MODO ESCRITURA REAL (--send) ***'
    : 'Modo DRY-RUN (no se escribe nada — usa --send para escribir de verdad)');

  // Mismos candidatos que find-stale-customer-links.js: usuarios con
  // customer_id que HOY no tendrían acceso vigente.
  const { rows: candidates } = await query(`
    SELECT u.id, u.email, u.stripe_customer_id
      FROM users u
      LEFT JOIN LATERAL (
        SELECT status, period_end FROM subscriptions
         WHERE user_id = u.id
         ORDER BY
           (status IN ('active','trialing','past_due') AND (period_end IS NULL OR period_end > now())) DESC,
           period_end DESC NULLS FIRST
         LIMIT 1
      ) s ON true
     WHERE u.stripe_customer_id IS NOT NULL
       AND NOT (
         s.status = ANY($1::text[]) AND (s.period_end IS NULL OR s.period_end > now())
       )
     ORDER BY u.email
  `, [ACCESS_GRANTING_DB_STATUSES]);

  console.log(`Revisando ${candidates.length} usuarios sin acceso vigente que sí tienen stripe_customer_id...\n`);

  let checked = 0, bridged = 0, pastDue = 0, failed = 0;

  for (const user of candidates) {
    checked++;
    try {
      const customer = await stripe.customers.retrieve(user.stripe_customer_id).catch(() => null);
      const email = customer && !customer.deleted ? customer.email : user.email;
      if (!email) continue;

      const escaped = email.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const others = await stripe.customers.search({ query: `email:'${escaped}'`, limit: 10 });
      const duplicates = others.data.filter((c) => c.id !== user.stripe_customer_id);
      if (duplicates.length === 0) continue;

      for (const dup of duplicates) {
        // Si el duplicado YA tiene una Subscription real, no es este caso
        // — lo cubre find-stale-customer-links.js.
        const subs = await stripe.subscriptions.list({ customer: dup.id, status: 'all', limit: 1 });
        if (subs.data.length > 0) continue;

        const schedules = await stripe.subscriptionSchedules.list({ customer: dup.id, limit: 10 });
        const pending = schedules.data.find((sc) => sc.status === 'not_started');
        if (!pending) continue;

        const phase = pending.phases[0];
        const item = phase.items[0];
        const periodEnd = new Date(phase.start_date * 1000);

        if (periodEnd <= new Date()) {
          console.log(`⚠️  ${email} — Schedule ${pending.id} en ${dup.id} con fase ya vencida (${periodEnd.toISOString().slice(0, 10)}) — revisar a mano, no se puentea con una fecha ya pasada.`);
          pastDue++;
          continue;
        }

        const plan = await resolvePlanForScheduleItem(item);
        if (!plan) {
          console.warn(`⚠️  ${email} — plan sin resolver en ${dup.id} (precio ${item.price}) — se omite hasta asignarlo a mano.`);
          failed++;
          continue;
        }

        console.log(`🔧 ${email} — BD: ${user.stripe_customer_id} → ${dup.id} (Schedule ${pending.id}, plan=${plan}, hasta ${periodEnd.toISOString().slice(0, 10)})${SEND ? '' : ' [dry-run]'}`);

        if (SEND) {
          await query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [dup.id, user.id]);
          await query(
            `INSERT INTO subscriptions (user_id, stripe_sub_id, source, plan, status, period_start, period_end)
             VALUES ($1, NULL, 'courtesy', $2, 'active', now(), $3)`,
            [user.id, plan, periodEnd],
          );
        }
        bridged++;
        break; // un puente por usuario es suficiente — no seguimos mirando más duplicados de esta persona
      }
    } catch (err) {
      failed++;
      console.log(`✗ Error con ${user.email}: ${err.message}`);
    }
  }

  console.log(`\n--- Resumen ---`);
  console.log(`Usuarios revisados: ${checked}`);
  console.log(`Puenteados: ${bridged}${SEND ? '' : ' (dry-run, nada escrito)'}`);
  console.log(`Con fase ya vencida (revisión manual, no puenteados): ${pastDue}`);
  console.log(`Fallidos / plan sin resolver: ${failed}`);

  await closePool();
}

main().catch(async (err) => {
  console.error('Error inesperado:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
