// =====================================================================
// Backfill puntual: rellena users.stripe_created_at (fecha real de alta
// como cliente en Stripe, customer.created) para los usuarios que ya se
// migraron ANTES de que migrate-stripe.js empezara a capturar este campo.
//
// Solo toca usuarios con stripe_customer_id IS NOT NULL y
// stripe_created_at IS NULL — es naturalmente idempotente: si se corta a
// mitad, relanzarlo retoma justo donde se quedó, sin volver a pedir a
// Stripe los que ya se rellenaron.
//
// Uso:
//   node scripts/backfill-stripe-created-at.js            # dry-run, solo lee de Stripe y muestra
//   node scripts/backfill-stripe-created-at.js --send      # escribe de verdad en la base de datos
// =====================================================================
import { pool, query, closePool } from '../backend/src/config/db.js';
import { stripe } from '../backend/src/services/stripe.js';

const SEND = process.argv.includes('--send');

async function main() {
  const { rows } = await query(
    `SELECT id, email, stripe_customer_id FROM users
      WHERE stripe_customer_id IS NOT NULL AND stripe_created_at IS NULL
      ORDER BY email`,
  );

  console.log(`${rows.length} usuario(s) con stripe_customer_id pendientes de stripe_created_at.`);
  console.log(SEND ? '*** MODO ESCRITURA REAL (--send) ***' : 'Modo DRY-RUN (no se escribe nada — usa --send para escribir de verdad)');

  let ok = 0;
  let failed = 0;
  const failures = [];

  for (let i = 0; i < rows.length; i++) {
    const u = rows[i];
    process.stdout.write(`[${i + 1}/${rows.length}] ${u.email} … `);
    try {
      const customer = await stripe.customers.retrieve(u.stripe_customer_id);
      if (customer.deleted) {
        console.log('cliente borrado en Stripe, se omite');
        continue;
      }
      const createdAt = new Date(customer.created * 1000);
      if (SEND) {
        await query('UPDATE users SET stripe_created_at = $1 WHERE id = $2', [createdAt, u.id]);
      }
      console.log(`${createdAt.toISOString().slice(0, 10)}${SEND ? '' : ' (dry-run)'}`);
      ok++;
    } catch (err) {
      failed++;
      failures.push({ email: u.email, reason: err.message });
      console.log(`FALLO — ${err.message}`);
    }
  }

  console.log(`\n--- Resumen ---`);
  console.log(`OK: ${ok}`);
  console.log(`Fallidos: ${failed}`);
  if (failures.length > 0) failures.forEach((f) => console.log(`  · ${f.email} — ${f.reason}`));
  if (!SEND) console.log('\nDry-run: no se ha escrito nada. Relanza con --send para aplicar de verdad.');

  await closePool();
}

main().catch(async (err) => {
  console.error('Error inesperado, abortando:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
