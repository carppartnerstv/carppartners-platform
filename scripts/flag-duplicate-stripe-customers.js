// scripts/flag-duplicate-stripe-customers.js
//
// Rellena users.stripe_duplicate_count: cuántos Customer de Stripe existen
// con el email de cada usuario. WordPress/ARMember crea un Customer nuevo
// por alta/ciclo (ver find-stale-customer-links.js para el detalle), así
// que el admin necesitaba entrar a Stripe a mano para darse cuenta — esto
// lo deja visible como aviso en el listado y en el detalle de /admin/suscriptores
// sin salir del panel.
//
// Por qué un script aparte (no en cada request): consultar Stripe por cada
// fila de un listado de cientos de suscriptores sería demasiado lento y
// gastaría la cuota de la API sin necesidad — esto se recalcula una vez a
// la semana, igual que el resto de scripts de reconciliación.
//
// Uso:
//   node scripts/flag-duplicate-stripe-customers.js            # dry-run
//   node scripts/flag-duplicate-stripe-customers.js --send      # escribe

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

async function main() {
  console.log(SEND
    ? '*** MODO ESCRITURA REAL (--send) ***'
    : 'Modo DRY-RUN (no se escribe nada — usa --send para guardar)');

  // Solo usuarios que alguna vez tuvieron relación con Stripe — a alguien
  // sin stripe_customer_id no le puede haber creado WordPress un duplicado.
  const { rows: users } = await pool.query(`
    SELECT id, email FROM users WHERE stripe_customer_id IS NOT NULL ORDER BY email
  `);

  console.log(`Comprobando ${users.length} usuarios con Customer de Stripe...\n`);

  let checked = 0, withDuplicates = 0, failed = 0;

  for (const user of users) {
    checked++;
    try {
      const escaped = user.email.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const found = await stripe.customers.search({ query: `email:'${escaped}'`, limit: 10 });
      const count = found.data.length;

      if (count > 1) {
        withDuplicates++;
        console.log(`🔴 ${user.email}: ${count} Customer`);
      }

      if (SEND) {
        await pool.query('UPDATE users SET stripe_duplicate_count = $1 WHERE id = $2', [count, user.id]);
      }
    } catch (err) {
      failed++;
      console.log(`✗ Error con ${user.email}: ${err.message}`);
    }

    if (checked % 50 === 0) console.log(`  ...${checked}/${users.length}`);
  }

  console.log(`\n--- Resumen ---`);
  console.log(`Usuarios comprobados: ${checked}`);
  console.log(`Con más de un Customer en Stripe: ${withDuplicates}`);
  console.log(`Fallidos: ${failed}`);

  await pool.end();
}

main().catch(async (err) => {
  console.error('Error inesperado:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
