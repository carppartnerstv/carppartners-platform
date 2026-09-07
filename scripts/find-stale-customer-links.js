// scripts/find-stale-customer-links.js
//
// Reconciliación SIN ventana de fechas — a diferencia de
// reconcile-webhook-gap.js (que solo mira el apagón del 21-24 ago), este
// script revisa a CUALQUIER usuario que hoy no tenga acceso vigente en
// nuestra plataforma, y comprueba si en Stripe existe otro Customer con su
// mismo email que SÍ tiene una suscripción real más reciente.
//
// Motivo: WordPress/ARMember (que sigue activo en paralelo a esta
// plataforma) crea un Customer de Stripe NUEVO cada vez que alguien se
// da de alta — incluida una persona que ya había sido cliente antes y
// cancela y vuelve a suscribirse, o incluso en cada renovación mensual.
// ARMember lo trata como el mismo suscriptor (mismo historial de
// membresía), pero en Stripe son Customer distintos, y nuestro webhook
// solo sabe resolver por stripe_customer_id — así que la persona paga y
// pierde acceso en nuestra plataforma en cuanto expira la última fila que
// sí teníamos enlazada. Caso real que motivó este script:
// zamoracabrillana2000@gmail.com (cus_TGdFmvYjxCEBIi antiguo/cancelado,
// cus_V0oQGXmA5DaqkF nuevo/activo desde 4/08/2026 vía WordPress).
//
// Por defecto (dry-run) solo imprime un informe. Con --send, SOLO corrige
// los casos que dan acceso AHORA MISMO en Stripe (los urgentes) —
// re-enlaza users.stripe_customer_id al Customer correcto e importa esa
// suscripción. Los casos sin acceso vigente en ninguno de los duplicados
// se quedan solo listados, para revisión aparte (no son urgentes: nadie
// está pagando sin acceso por esos).
//
// Uso:
//   node scripts/find-stale-customer-links.js            # dry-run
//   node scripts/find-stale-customer-links.js --send      # corrige los urgentes

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

// Mismo criterio que requireSubscription (auth.js): con esto NO hay acceso.
const ACCESS_GRANTING_DB_STATUSES = ['active', 'trialing', 'past_due'];
const ACCESS_GRANTING_STRIPE_STATUSES = ['active', 'trialing', 'past_due', 'unpaid'];

function fmtDate(unixSeconds) {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString().slice(0, 10) : '?';
}

// Mismas funciones que relink-duplicate-customers.js (copiadas, no
// importadas, para no depender de rutas relativas frágiles entre
// scripts/ y backend/ — mismo patrón ya usado en ese script).
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
  console.log(SEND
    ? '*** MODO ESCRITURA REAL (--send) — solo corrige los casos que dan acceso ahora mismo ***'
    : 'Modo DRY-RUN (no se escribe nada — usa --send para corregir los casos urgentes)');

  // Usuarios con customer_id pero que HOY no tendrían acceso vigente según
  // requireSubscription (sin suscripción, o con una que ya no da acceso).
  // Mismo SUB_LATERAL que usa el panel admin (admin.js), para que el
  // criterio de "tiene acceso" sea idéntico en todo el proyecto.
  const { rows: candidates } = await pool.query(`
    SELECT u.id, u.email, u.stripe_customer_id, s.status AS db_status, s.period_end AS db_period_end
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

  let checked = 0, found = 0, fixed = 0, failed = 0;
  const stale = [];

  for (const user of candidates) {
    checked++;
    try {
      const customer = await stripe.customers.retrieve(user.stripe_customer_id).catch(() => null);
      const email = customer && !customer.deleted ? customer.email : user.email;
      if (!email) continue;

      // customers.list({email}) es una comparación EXACTA y sensible a
      // mayúsculas en Stripe — si el Customer duplicado se creó con otra
      // capitalización del mismo email (visto en la práctica: WordPress no
      // siempre normaliza), list() no lo encuentra. search() sí es
      // insensible a mayúsculas.
      const escaped = email.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const others = await stripe.customers.search({ query: `email:'${escaped}'`, limit: 10 });
      const duplicates = others.data.filter((c) => c.id !== user.stripe_customer_id);
      if (duplicates.length === 0) continue;

      // Entre TODOS los Customer duplicados y TODAS sus suscripciones,
      // buscamos la mejor: preferimos una que dé acceso ahora mismo: si
      // hay varias, la más reciente; si ninguna da acceso, la más
      // reciente de todas (aunque esté cancelada), para que el historial
      // importado sea correcto igualmente.
      let best = null; // { dup, sub }
      for (const dup of duplicates) {
        const subs = await stripe.subscriptions.list({ customer: dup.id, status: 'all', limit: 10 });
        for (const sub of subs.data) {
          if (!best) { best = { dup, sub }; continue; }
          const subGrants = ACCESS_GRANTING_STRIPE_STATUSES.includes(sub.status);
          const bestGrants = ACCESS_GRANTING_STRIPE_STATUSES.includes(best.sub.status);
          if (subGrants && !bestGrants) best = { dup, sub };
          else if (subGrants === bestGrants && sub.created > best.sub.created) best = { dup, sub };
        }
      }
      if (!best) continue;

      const grantsAccessNow = ACCESS_GRANTING_STRIPE_STATUSES.includes(best.sub.status);
      console.log(`${grantsAccessNow ? '🔴' : '⚪'} ${email}`);
      console.log(`   BD hoy: ${user.stripe_customer_id} — status=${user.db_status ?? '(sin fila)'}, period_end=${user.db_period_end ?? '-'}`);
      console.log(`   Stripe también tiene: ${best.dup.id} (cliente desde ${fmtDate(best.dup.created)}) — ${best.sub.id} (${best.sub.status}, creada ${fmtDate(best.sub.created)})${grantsAccessNow ? '  ← DA ACCESO AHORA MISMO' : ''}`);
      found++;
      stale.push({ email, grantsAccessNow });

      if (SEND && grantsAccessNow) {
        await pool.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [best.dup.id, user.id]);
        await upsertSubscriptionRow(user.id, best.sub);
        console.log(`   🔧 corregido`);
        fixed++;
      }
    } catch (err) {
      failed++;
      console.log(`✗ Error con ${user.email}: ${err.message}`);
    }
  }

  console.log(`\n--- Resumen ---`);
  console.log(`Usuarios revisados: ${checked}`);
  console.log(`Casos con Customer duplicado y suscripción real: ${found}`);
  console.log(`  De los cuales dan acceso AHORA MISMO en Stripe (usuarios pagando sin acceso en la plataforma): ${stale.filter((s) => s.grantsAccessNow).length}`);
  if (SEND) console.log(`Corregidos: ${fixed}`);
  console.log(`Fallidos: ${failed}`);

  await pool.end();
}

main().catch(async (err) => {
  console.error('Error inesperado:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
