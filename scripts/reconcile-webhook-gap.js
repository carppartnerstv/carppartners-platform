// scripts/reconcile-webhook-gap.js
//
// Reconciliación de solo lectura: compara el estado REAL en Stripe
// contra lo que tiene la base de datos, para los clientes que tuvieron
// eventos de suscripción entre el 21 y el 24 de agosto de 2026 —
// ventana en la que el webhook rechazó todas las firmas.
//
// NO escribe nada. Solo imprime un informe de discrepancias.
//
// Uso: node scripts/reconcile-webhook-gap.js

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Ventana afectada, con margen de un par de horas por delante y por detrás
const WINDOW_START = Math.floor(new Date('2026-08-21T12:00:00Z').getTime() / 1000);
const WINDOW_END   = Math.floor(new Date('2026-08-24T10:00:00Z').getTime() / 1000);

const RELEVANT_TYPES = [
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.created',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'checkout.session.completed',
];

// Estados de Stripe que nuestro backend considera "con acceso" —
// exactamente el mismo criterio que requireSubscription (auth.js).
const ACCESS_GRANTING_STRIPE_STATUSES = ['active', 'trialing', 'past_due', 'unpaid'];

async function getAffectedEvents() {
  const events = [];
  let startingAfter;

  while (true) {
    const page = await stripe.events.list({
      created: { gte: WINDOW_START, lte: WINDOW_END },
      limit: 100,
      ...(startingAfter && { starting_after: startingAfter }),
    });

    for (const ev of page.data) {
      if (RELEVANT_TYPES.includes(ev.type)) events.push(ev);
    }

    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1].id;
  }

  return events;
}

function extractCustomerId(event) {
  const obj = event.data.object;
  return obj.customer || obj.customer_id || null;
}

function fmtPeriodEnd(unixSeconds) {
  if (!unixSeconds) return null;
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

async function main() {
  console.log(`Buscando eventos entre ${new Date(WINDOW_START * 1000).toISOString()} y ${new Date(WINDOW_END * 1000).toISOString()}...\n`);

  const events = await getAffectedEvents();
  console.log(`Encontrados ${events.length} eventos relevantes en la ventana.\n`);

  // Deduplicar por customer_id — nos interesa el estado final de cada cliente afectado
  const customerIds = [...new Set(events.map(extractCustomerId).filter(Boolean))];
  console.log(`Clientes distintos afectados: ${customerIds.length}\n`);
  console.log('='.repeat(80));

  let mismatches = 0;
  let checked = 0;
  const notFoundInDb = [];

  for (const customerId of customerIds) {
    checked++;
    // Estado real en Stripe ahora mismo
    const subs = await stripe.subscriptions.list({ customer: customerId, limit: 10 });

    // Usuario en la BD
    const { rows } = await pool.query(
      'SELECT id, name, email, stripe_customer_id FROM users WHERE stripe_customer_id = $1',
      [customerId],
    );

    if (rows.length === 0) {
      console.log(`⚠️  Cliente Stripe ${customerId} no encontrado en la tabla users. Suscripciones Stripe: ${subs.data.map((s) => `${s.id}(${s.status})`).join(', ') || 'ninguna'}`);
      notFoundInDb.push(customerId);
      mismatches++;
      continue;
    }

    const user = rows[0];

    // Sin .catch() silencioso: si esta consulta falla de verdad (nombre de
    // columna mal, conexión caída...), queremos verlo, no que se confunda
    // con "sin discrepancias".
    const { rows: dbSubs } = await pool.query(
      `SELECT stripe_sub_id, status, cancel_at_period_end, period_end
         FROM subscriptions WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 5`,
      [user.id],
    );

    const stripeState = subs.data.map((s) => ({
      id: s.id,
      status: s.status,
      cancel_at_period_end: s.cancel_at_period_end,
      period_end: fmtPeriodEnd(s.current_period_end),
    }));

    const stripeActive = stripeState.find((s) => ACCESS_GRANTING_STRIPE_STATUSES.includes(s.status));
    const dbActive = dbSubs.find((d) =>
      ['active', 'trialing', 'past_due'].includes(d.status)
      && (d.period_end === null || new Date(d.period_end) > new Date()),
    );

    let mismatchReason = null;

    if (stripeActive) {
      // Stripe dice que hay acceso vigente — ¿la BD refleja ESA misma suscripción?
      const dbMatch = dbSubs.find((d) => d.stripe_sub_id === stripeActive.id);
      if (!dbMatch) {
        mismatchReason = `Stripe tiene ${stripeActive.id} (${stripeActive.status}) vigente, pero la BD no tiene esa fila.`;
      } else if (dbMatch.status !== stripeActive.status || dbMatch.cancel_at_period_end !== stripeActive.cancel_at_period_end) {
        mismatchReason = `Suscripción ${stripeActive.id} desincronizada — Stripe: status=${stripeActive.status}/cancel_at_period_end=${stripeActive.cancel_at_period_end}, BD: status=${dbMatch.status}/cancel_at_period_end=${dbMatch.cancel_at_period_end}.`;
      }
    } else if (dbActive) {
      // CASO CLAVE de esta incidencia: Stripe ya NO tiene nada que dé acceso,
      // pero la BD todavía tiene una fila que sí lo concede — exactamente el
      // síntoma "cancelé en Stripe y el usuario sigue con acceso".
      mismatchReason = `La BD sigue dando acceso (fila ${dbActive.stripe_sub_id}, status=${dbActive.status}) pero Stripe ya no tiene ninguna suscripción activa/trialing/past_due/unpaid para este cliente.`;
    }

    if (mismatchReason) {
      mismatches++;
      console.log(`\n❌ DISCREPANCIA — ${user.name ?? '(sin nombre)'} (${user.email})`);
      console.log(`   ${mismatchReason}`);
      console.log(`   Stripe: ${JSON.stringify(stripeState)}`);
      console.log(`   BD:     ${JSON.stringify(dbSubs)}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\nResumen: ${mismatches} discrepancias de ${checked} clientes revisados.`);
  if (notFoundInDb.length > 0) {
    console.log(`  De las cuales, ${notFoundInDb.length} son clientes de Stripe que no existen en absoluto en la tabla users.`);
  }
  console.log(mismatches === 0
    ? '✅ Todo coincide — no se perdió ningún evento real de cliente en esa ventana.'
    : '⚠️  Revisa los casos anteriores uno a uno antes de corregir nada en la BD.');

  await pool.end();
}

main().catch((err) => {
  console.error('Error ejecutando la reconciliación:', err);
  process.exit(1);
});
