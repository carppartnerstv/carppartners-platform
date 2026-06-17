// =====================================================================
// Script de migración de suscriptores desde Stripe.  (Briefing 6)
//
// Lee TODOS los clientes y suscripciones de Stripe (con paginación) y los
// copia a PostgreSQL. NO modifica nada en Stripe: las suscripciones siguen
// renovándose igual. Genera para cada usuario un token de un solo uso para
// el flujo "establece tu contraseña" (Opción A del briefing 6.2).
//
// Uso:
//   node scripts/migrate-stripe.js            # migra de verdad
//   node scripts/migrate-stripe.js --dry-run  # solo muestra qué haría
//
// Se ejecuta UNA sola vez, idealmente en fin de semana con poco tráfico.
// =====================================================================
import crypto from 'node:crypto';
import { pool } from '../backend/src/config/db.js';
import { stripe, mapStripeStatus, planFromPrice } from '../backend/src/services/stripe.js';

const DRY_RUN = process.argv.includes('--dry-run');
const SET_PASSWORD_TTL_DAYS = 14;

async function* iterateCustomers() {
  let params = { limit: 100 };
  // auto-pagination de Stripe
  for await (const customer of stripe.customers.list(params)) {
    yield customer;
  }
}

async function migrateCustomer(customer) {
  if (!customer.email) {
    console.warn(`· Cliente ${customer.id} sin email, se omite`);
    return { created: 0, subs: 0 };
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SET_PASSWORD_TTL_DAYS * 86_400_000);

  if (DRY_RUN) {
    console.log(`· [dry] Usuario: ${customer.email} (${customer.id})`);
  } else {
    await pool.query(
      `INSERT INTO users (email, name, stripe_customer_id, password_set_token, password_set_expires)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET
          stripe_customer_id   = EXCLUDED.stripe_customer_id,
          name                 = COALESCE(users.name, EXCLUDED.name),
          password_set_token   = CASE WHEN users.password_hash IS NULL
                                      THEN EXCLUDED.password_set_token ELSE users.password_set_token END,
          password_set_expires = CASE WHEN users.password_hash IS NULL
                                      THEN EXCLUDED.password_set_expires ELSE users.password_set_expires END`,
      [customer.email.toLowerCase(), customer.name ?? null, customer.id, token, expires],
    );
  }

  // Suscripciones de este cliente (todas, incluidas canceladas)
  let subCount = 0;
  for await (const sub of stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 100 })) {
    subCount += 1;
    const price = sub.items?.data?.[0]?.price ?? null;
    const plan = planFromPrice(price);
    const status = mapStripeStatus(sub.status);

    if (DRY_RUN) {
      console.log(`    [dry] Sub ${sub.id}: plan=${plan} status=${status}`);
      continue;
    }

    const user = await pool.query('SELECT id FROM users WHERE stripe_customer_id = $1', [customer.id]);
    const userId = user.rows[0]?.id;
    if (!userId) continue;

    await pool.query(
      `INSERT INTO subscriptions
          (user_id, stripe_sub_id, plan, status, period_start, period_end, cancelled_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (stripe_sub_id) DO UPDATE SET
          plan = EXCLUDED.plan, status = EXCLUDED.status,
          period_start = EXCLUDED.period_start, period_end = EXCLUDED.period_end,
          cancelled_at = EXCLUDED.cancelled_at`,
      [
        userId, sub.id, plan, status,
        sub.current_period_start ? new Date(sub.current_period_start * 1000) : null,
        sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
        sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      ],
    );
  }

  // PASO 4 del briefing: aquí se encolaría el email de bienvenida con el
  // enlace https://carppartners.tv/set-password?token=<token>
  // (se implementa con Resend en la semana 8). El token ya está guardado.

  return { created: 1, subs: subCount };
}

async function run() {
  console.log(`=== Migración Stripe -> PostgreSQL ${DRY_RUN ? '(DRY RUN)' : ''} ===`);
  const start = Date.now();
  let users = 0;
  let subs = 0;

  for await (const customer of iterateCustomers()) {
    const r = await migrateCustomer(customer);
    users += r.created;
    subs += r.subs;
  }

  const secs = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n=== Listo en ${secs}s — ${users} usuarios, ${subs} suscripciones ===`);
  if (DRY_RUN) console.log('(dry-run: no se escribió nada en la base de datos)');
}

run()
  .catch((err) => {
    console.error('Error en la migración:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
