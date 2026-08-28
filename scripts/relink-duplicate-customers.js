// scripts/relink-duplicate-customers.js
//
// Arreglo dirigido para los clientes de Stripe duplicados descubiertos con
// reconcile-webhook-gap.js (mismo email, dos o más Customer en Stripe, la
// BD apuntando al que no tiene la suscripción real — casos confirmados a
// mano: zambranodoradojordi61@gmail.com y jesusvaquerovaldivielso@gmail.com,
// este último con 7 Customer duplicados de un mismo intento de alta).
//
// Para cada customer_id que aparece en un evento relevante de la ventana
// 21-24 ago 2026:
//   1. Si ya es el customer_id que tiene la BD, no hace nada (no es un
//      duplicado — esos los cubre reconcile-webhook-gap.js aparte).
//   2. Si la BD tiene un customer_id DISTINTO para ese mismo email, y este
//      customer del evento SÍ tiene una suscripción real, actualiza
//      users.stripe_customer_id a este y la importa (mismo upsert que usa
//      el resto del proyecto).
//   3. Si no tiene ninguna suscripción, lo deja para revisión manual — no
//      toca nada (así se excluye solo dominguezcantin8@icloud.com, sin
//      necesidad de mantenerlo a mano en una lista aparte).
//
// Uso:
//   node scripts/relink-duplicate-customers.js            # dry-run
//   node scripts/relink-duplicate-customers.js --send      # escribe de verdad

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const SEND = process.argv.includes('--send');

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
    for (const ev of page.data) if (RELEVANT_TYPES.includes(ev.type)) events.push(ev);
    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1].id;
  }
  return events;
}

function extractCustomerId(event) {
  const obj = event.data.object;
  return obj.customer || obj.customer_id || null;
}

// Traducción de precio -> plan interno, idéntica a services/stripe.js
// (copiada aquí en vez de importada para no depender de rutas relativas
// frágiles entre scripts/ y backend/ — mismo patrón que ya usa
// bridge-schedule-subscriptions.js en este repo).
function planFromPrice(price) {
  const productId = typeof price?.product === 'string' ? price.product : price?.product?.id;
  if (productId && productId === process.env.STRIPE_PRODUCT_MONTHLY) return 'monthly';
  if (productId && productId === process.env.STRIPE_PRODUCT_ANNUAL) return 'annual';
  const priceId = price?.id;
  if (priceId && priceId === process.env.STRIPE_PRICE_MONTHLY) return 'monthly';
  if (priceId && priceId === process.env.STRIPE_PRICE_ANNUAL) return 'annual';
  return null;
}

function mapStripeStatus(stripeStatus) {
  switch (stripeStatus) {
    case 'active': return 'active';
    case 'trialing': return 'trialing';
    case 'past_due':
    case 'unpaid': return 'past_due';
    case 'canceled': return 'cancelled';
    default: return 'incomplete';
  }
}

async function upsertSubscriptionRow(userId, sub) {
  const price = sub.items?.data?.[0]?.price ?? null;
  const plan = planFromPrice(price);
  const status = mapStripeStatus(sub.status);
  await pool.query(
    `INSERT INTO subscriptions
        (user_id, stripe_sub_id, plan, status, period_start, period_end, cancelled_at, cancel_at_period_end)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (stripe_sub_id) DO UPDATE SET
        plan = EXCLUDED.plan, status = EXCLUDED.status,
        period_start = EXCLUDED.period_start, period_end = EXCLUDED.period_end,
        cancelled_at = EXCLUDED.cancelled_at, cancel_at_period_end = EXCLUDED.cancel_at_period_end`,
    [
      userId, sub.id, plan, status,
      sub.current_period_start ? new Date(sub.current_period_start * 1000) : null,
      sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
      sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      !!sub.cancel_at_period_end,
    ],
  );
}

async function main() {
  console.log(SEND ? '*** MODO ESCRITURA REAL (--send) ***' : 'Modo DRY-RUN (no se escribe nada — usa --send para escribir de verdad)');

  const events = await getAffectedEvents();
  const customerIds = [...new Set(events.map(extractCustomerId).filter(Boolean))];
  console.log(`Revisando ${customerIds.length} clientes de Stripe con eventos en la ventana 21-24 ago...\n`);

  let fixed = 0, alreadyOk = 0, noSubscription = 0, skipped = 0, failed = 0;

  for (const eventCustomerId of customerIds) {
    try {
      const { rows: byCustomerId } = await pool.query(
        'SELECT id FROM users WHERE stripe_customer_id = $1',
        [eventCustomerId],
      );
      if (byCustomerId.length > 0) { alreadyOk++; continue; } // ya apunta bien — no es un duplicado

      const customer = await stripe.customers.retrieve(eventCustomerId).catch(() => null);
      const email = customer && !customer.deleted ? customer.email : null;
      if (!email) { skipped++; continue; }

      const { rows: byEmail } = await pool.query('SELECT id, email, stripe_customer_id FROM users WHERE email = $1', [email.toLowerCase()]);
      if (byEmail.length === 0) { skipped++; continue; } // hueco genuino, no duplicado — lo cubre migrate-stripe.js

      const user = byEmail[0];

      const subs = await stripe.subscriptions.list({ customer: eventCustomerId, limit: 10 });
      const bestSub = subs.data.find((s) => ACCESS_GRANTING_STRIPE_STATUSES.includes(s.status)) ?? subs.data[0];

      if (!bestSub) {
        console.log(`⏭️  ${email} — ${eventCustomerId} no tiene ninguna suscripción real, se deja para revisión manual (BD sigue en ${user.stripe_customer_id}).`);
        noSubscription++;
        continue;
      }

      console.log(`${SEND ? '🔧' : '🔎'} ${email} — BD: ${user.stripe_customer_id} → ${eventCustomerId} (${bestSub.id}, ${bestSub.status})${SEND ? '' : ' [dry-run]'}`);
      if (SEND) {
        await pool.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [eventCustomerId, user.id]);
        await upsertSubscriptionRow(user.id, bestSub);
      }
      fixed++;
    } catch (err) {
      failed++;
      console.log(`✗ Error con ${eventCustomerId}: ${err.message}`);
    }
  }

  console.log('\n--- Resumen ---');
  console.log(`Corregidos: ${fixed}${SEND ? '' : ' (dry-run, nada escrito)'}`);
  console.log(`Ya estaban bien / no eran duplicados: ${alreadyOk}`);
  console.log(`Sin suscripción real en el customer del evento (dejados para revisión manual): ${noSubscription}`);
  console.log(`Omitidos (sin email o hueco genuino): ${skipped}`);
  console.log(`Fallidos: ${failed}`);

  await pool.end();
}

main().catch(async (err) => {
  console.error('Error inesperado:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
