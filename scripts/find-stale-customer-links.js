// scripts/find-stale-customer-links.js
//
// Reconciliación de solo lectura, SIN ventana de fechas — a diferencia de
// reconcile-webhook-gap.js (que solo mira el apagón del 21-24 ago), este
// script revisa a CUALQUIER usuario que hoy no tenga acceso vigente en
// nuestra plataforma, y comprueba si en Stripe existe otro Customer con su
// mismo email que SÍ tiene una suscripción real más reciente.
//
// Motivo: WordPress/ARMember (que sigue activo en paralelo a esta
// plataforma) crea un Customer de Stripe NUEVO cada vez que alguien se
// da de alta — incluida una persona que ya había sido cliente antes y
// cancela y vuelve a suscribirse. ARMember lo trata como el mismo
// suscriptor (mismo historial de membresía), pero en Stripe son dos
// Customer distintos, y nuestro webhook solo sabe resolver por
// stripe_customer_id — así que la persona paga y sigue "cancelada" en
// nuestra plataforma. Caso real que motivó este script:
// zamoracabrillana2000@gmail.com (cus_TGdFmvYjxCEBIi antiguo/cancelado,
// cus_V0oQGXmA5DaqkF nuevo/activo desde 4/08/2026 vía WordPress).
//
// NO escribe nada. Solo imprime un informe — el arreglo de verdad
// (relink-duplicate-customers.js, o un arreglo estructural del webhook)
// se decide después de ver el alcance real.
//
// Uso: node scripts/find-stale-customer-links.js

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Mismo criterio que requireSubscription (auth.js): con esto NO hay acceso.
const ACCESS_GRANTING_DB_STATUSES = ['active', 'trialing', 'past_due'];
const ACCESS_GRANTING_STRIPE_STATUSES = ['active', 'trialing', 'past_due', 'unpaid'];

function fmtDate(unixSeconds) {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString().slice(0, 10) : '?';
}

async function main() {
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

  let checked = 0, found = 0, failed = 0;
  const stale = [];

  for (const user of candidates) {
    checked++;
    try {
      const customer = await stripe.customers.retrieve(user.stripe_customer_id).catch(() => null);
      const email = customer && !customer.deleted ? customer.email : user.email;
      if (!email) continue;

      const others = await stripe.customers.list({ email, limit: 10 });
      const duplicates = others.data.filter((c) => c.id !== user.stripe_customer_id);
      if (duplicates.length === 0) continue;

      for (const dup of duplicates) {
        const subs = await stripe.subscriptions.list({ customer: dup.id, status: 'all', limit: 10 });
        const bestSub = subs.data.find((s) => ACCESS_GRANTING_STRIPE_STATUSES.includes(s.status))
          ?? subs.data.sort((a, b) => b.created - a.created)[0];
        if (!bestSub) continue;

        const grantsAccessNow = ACCESS_GRANTING_STRIPE_STATUSES.includes(bestSub.status);
        console.log(`${grantsAccessNow ? '🔴' : '⚪'} ${email}`);
        console.log(`   BD hoy: ${user.stripe_customer_id} — status=${user.db_status ?? '(sin fila)'}, period_end=${user.db_period_end ?? '-'}`);
        console.log(`   Stripe también tiene: ${dup.id} (cliente desde ${fmtDate(dup.created)}) — ${bestSub.id} (${bestSub.status}, creada ${fmtDate(bestSub.created)})${grantsAccessNow ? '  ← DA ACCESO AHORA MISMO' : ''}`);
        stale.push({ email, dbCustomerId: user.stripe_customer_id, otherCustomerId: dup.id, subId: bestSub.id, subStatus: bestSub.status, grantsAccessNow });
        found++;
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
  console.log(`Fallidos: ${failed}`);

  await pool.end();
}

main().catch(async (err) => {
  console.error('Error inesperado:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
