// =====================================================================
// Envío masivo de las campañas de lanzamiento de la nueva plataforma.
//
//   ACTIVOS  (suscripción vigente)      → platformLaunchEmail (con token
//                                          de "establece tu contraseña")
//   WINBACK  (no suscritos/cancelados)  → winbackNonSubscriberEmail
//                                          (botón directo a la landing)
//
// Los dos grupos se calculan con EXACTAMENTE la misma condición que usa
// requireSubscription (backend/src/middleware/auth.js) para dar acceso, así
// que "quién recibe el email de activación" coincide siempre con "quién
// puede entrar". Se excluye role='admin' de ambos grupos.
//
// Script puntual pensado para producción, con cientos de destinatarios
// reales — ver instrucciones de uso completas al final de este archivo.
//
// SEGURO POR DEFECTO: sin --send, SOLO cuenta y lista destinatarios, no
// envía nada ni toca la base de datos (no genera tokens, no escribe en
// email_campaign_log).
//
// Uso resumido (ver más abajo el detalle):
//   node scripts/send-launch-campaign.js                                   # dry-run, ambos grupos
//   node scripts/send-launch-campaign.js --group=active                    # dry-run, solo activos
//   node scripts/send-launch-campaign.js --group=active --only=yo@x.com --send
//   node scripts/send-launch-campaign.js --group=active --send --rate=200
// =====================================================================
import crypto from 'node:crypto';
import readline from 'node:readline/promises';
import { pool, query, closePool } from '../backend/src/config/db.js';
import { transporter, sendMail } from '../backend/src/services/mail.js';
import { platformLaunchEmail, winbackNonSubscriberEmail } from '../backend/src/services/mailTemplates.js';
import { config } from '../backend/src/config/index.js';

const SET_PASSWORD_TTL_DAYS = 14; // mismo TTL que la migración WP / alta manual (admin.js)
const DEFAULT_DELAY_SECONDS = 5;  // ≈720/hora — combinado con DEFAULT_MAX_PER_RUN, una tanda no supera el límite de 800/día de EMAS. Para el envío real conviene un --rate más bajo (p. ej. 60-120) por entregabilidad, no por este límite.
const DEFAULT_MAX_PER_RUN = 700;  // margen bajo el límite confirmado de 800/día de EMAS
const CONFIRM_PHRASE = 'ENVIAR';

// La misma condición que requireSubscription (auth.js): status con acceso +
// no caducada. EXISTS/NOT EXISTS son estrictamente complementarias, así que
// entre los dos grupos cubren a todos los usuarios sin solapar a nadie.
const HAS_ACCESS_SQL = `
  EXISTS (
    SELECT 1 FROM subscriptions s
     WHERE s.user_id = u.id
       AND s.status IN ('active', 'trialing', 'past_due')
       AND (s.period_end IS NULL OR s.period_end > now())
  )
`;

const CAMPAIGNS = {
  active: {
    key: 'platform_launch',
    label: 'Lanzamiento — activos',
    query: `SELECT id, email, name FROM users u
             WHERE u.role <> 'admin' AND ${HAS_ACCESS_SQL}
             ORDER BY u.email`,
  },
  winback: {
    key: 'winback_non_subscriber',
    label: 'Reenganche — no suscritos/cancelados',
    query: `SELECT id, email, name FROM users u
             WHERE u.role <> 'admin' AND NOT ${HAS_ACCESS_SQL}
             ORDER BY u.email`,
  },
};

// ── CLI ────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { send: false, only: null, group: null, rate: null, delay: null, max: null };
  for (const raw of argv) {
    if (raw === '--send') args.send = true;
    else if (raw.startsWith('--only=')) args.only = raw.slice('--only='.length).trim().toLowerCase();
    else if (raw.startsWith('--group=')) args.group = raw.slice('--group='.length).trim();
    else if (raw.startsWith('--rate=')) args.rate = Number(raw.slice('--rate='.length));
    else if (raw.startsWith('--delay=')) args.delay = Number(raw.slice('--delay='.length));
    else if (raw.startsWith('--max=')) args.max = Number(raw.slice('--max='.length));
    else {
      console.error(`Argumento no reconocido: ${raw}`);
      process.exit(1);
    }
  }
  if (args.group && !CAMPAIGNS[args.group]) {
    console.error(`--group debe ser "active" o "winback" (recibido: "${args.group}")`);
    process.exit(1);
  }
  if (args.only && !args.group) {
    console.error('--only requiere --group=active o --group=winback (para saber qué plantilla probar).');
    process.exit(1);
  }
  if (args.rate != null && args.delay != null) {
    console.error('Usa --rate o --delay, no ambos.');
    process.exit(1);
  }
  if (args.rate != null && (!Number.isFinite(args.rate) || args.rate <= 0)) {
    console.error('--rate debe ser un número positivo (correos por hora).');
    process.exit(1);
  }
  if (args.delay != null && (!Number.isFinite(args.delay) || args.delay < 0)) {
    console.error('--delay debe ser un número >= 0 (segundos entre correos).');
    process.exit(1);
  }
  return args;
}

function resolveDelaySeconds(args) {
  if (args.delay != null) return args.delay;
  if (args.rate != null) return 3600 / args.rate;
  return DEFAULT_DELAY_SECONDS;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Envío de un destinatario ─────────────────────────────────────────────

async function buildEmail(campaignGroup, user) {
  if (campaignGroup === 'active') {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + SET_PASSWORD_TTL_DAYS * 86_400_000);
    await query(
      `UPDATE users SET password_set_token = $1, password_set_expires = $2 WHERE id = $3`,
      [token, expires, user.id],
    );
    const setUrl = `${config.publicWebUrl}/set-password?token=${token}`;
    return platformLaunchEmail({ name: user.name, setUrl });
  }
  return winbackNonSubscriberEmail({ name: user.name });
}

// skipDedupe=true para --only: permite reenviar a la misma dirección sin
// que el registro de la campaña anterior lo bloquee (uso de prueba).
async function sendToUser(campaignGroup, user, { skipDedupe }) {
  const campaign = CAMPAIGNS[campaignGroup];

  if (!skipDedupe) {
    const { rows } = await query(
      `SELECT 1 FROM email_campaign_log WHERE user_id = $1 AND campaign = $2`,
      [user.id, campaign.key],
    );
    if (rows.length > 0) return { status: 'skipped' };
  }

  const { subject, html, text } = await buildEmail(campaignGroup, user);
  const result = await sendMail({ to: user.email, subject, html, text });
  if (!result.sent) return { status: 'failed', reason: 'sendMail devolvió sent:false — ver el log de [mail] justo arriba' };

  await query(
    `INSERT INTO email_campaign_log (user_id, campaign) VALUES ($1, $2)
     ON CONFLICT (user_id, campaign) DO UPDATE SET sent_at = now()`,
    [user.id, campaign.key],
  );
  return { status: 'sent' };
}

// ── Un grupo completo ─────────────────────────────────────────────────

async function fetchRecipients(campaignGroup, only) {
  if (only) {
    const { rows } = await query(`SELECT id, email, name FROM users WHERE lower(email) = $1`, [only]);
    if (rows.length === 0) {
      console.error(`No existe ningún usuario con el email "${only}" — --only necesita una cuenta real (para poder generar el token si aplica).`);
      process.exit(1);
    }
    return rows;
  }
  const { rows } = await query(CAMPAIGNS[campaignGroup].query);
  return rows;
}

async function pendingCount(campaignGroup, recipients) {
  if (recipients.length === 0) return 0;
  const { rows } = await query(
    `SELECT COUNT(*)::int AS n FROM email_campaign_log WHERE campaign = $1 AND user_id = ANY($2::uuid[])`,
    [CAMPAIGNS[campaignGroup].key, recipients.map((r) => r.id)],
  );
  return recipients.length - rows[0].n;
}

async function runCampaign(campaignGroup, args) {
  const campaign = CAMPAIGNS[campaignGroup];
  const skipDedupe = !!args.only;
  const all = await fetchRecipients(campaignGroup, args.only);
  const already = skipDedupe ? 0 : all.length - (await pendingCount(campaignGroup, all));
  const pendingTotal = all.length - (skipDedupe ? 0 : already);

  console.log(`\n=== ${campaign.label} (${campaign.key}) ===`);
  console.log(`Destinatarios en el grupo: ${all.length}`);
  if (!skipDedupe) console.log(`Ya enviados en esta campaña (se omiten): ${already}`);
  console.log(`Pendientes de envío: ${pendingTotal}`);

  if (!args.send) {
    all.forEach((u) => console.log(`  [dry-run] ${u.email}`));
    return { attempted: 0, sent: 0, failed: 0, skipped: 0, remaining: pendingTotal };
  }

  if (pendingTotal === 0) {
    console.log('Nada que enviar en este grupo.');
    return { attempted: 0, sent: 0, failed: 0, skipped: already, remaining: 0 };
  }

  const max = args.max ?? DEFAULT_MAX_PER_RUN;
  let batch = all;
  if (!skipDedupe && max > 0 && pendingTotal > max) {
    // Recorremos toda la lista pero solo CONTAMOS pendientes reales hasta
    // llegar al tope — los ya enviados no cuentan para el límite.
    let counted = 0;
    const cut = [];
    for (const u of all) {
      cut.push(u);
      const { rows } = await query(`SELECT 1 FROM email_campaign_log WHERE user_id = $1 AND campaign = $2`, [u.id, campaign.key]);
      if (rows.length === 0) counted += 1;
      if (counted >= max) break;
    }
    batch = cut;
    console.log(`⚠ El grupo tiene más pendientes (${pendingTotal}) que el máximo por ejecución (${max}). Se procesarán ${counted} y el resto quedará para una siguiente ejecución (relanza el script más tarde, es idempotente).`);
  }

  if (!skipDedupe) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(
      `\n¿Confirmas el envío REAL de la campaña "${campaign.label}" a ${Math.min(pendingTotal, max > 0 ? max : pendingTotal)} destinatarios?\nEscribe "${CONFIRM_PHRASE}" para continuar (cualquier otra cosa cancela): `,
    );
    rl.close();
    if (answer.trim() !== CONFIRM_PHRASE) {
      console.log('Cancelado. No se ha enviado nada.');
      return { attempted: 0, sent: 0, failed: 0, skipped: 0, remaining: pendingTotal };
    }
  }

  const delaySeconds = resolveDelaySeconds(args);
  let sent = 0, failed = 0, skipped = 0, attempted = 0;
  const failures = [];

  for (let i = 0; i < batch.length; i++) {
    const user = batch[i];
    process.stdout.write(`[${i + 1}/${batch.length}] ${user.email} … `);
    try {
      const result = await sendToUser(campaignGroup, user, { skipDedupe });
      if (result.status === 'sent') { sent += 1; attempted += 1; console.log('OK'); }
      else if (result.status === 'skipped') { skipped += 1; console.log('omitido (ya enviado antes)'); }
      else { failed += 1; attempted += 1; failures.push({ email: user.email, reason: result.reason }); console.log(`FALLO — ${result.reason}`); }
    } catch (err) {
      failed += 1; attempted += 1;
      failures.push({ email: user.email, reason: err.message });
      console.log(`FALLO — ${err.message}`);
    }
    if (i < batch.length - 1 && delaySeconds > 0) await sleep(delaySeconds * 1000);
  }

  console.log(`\n--- Resumen "${campaign.label}" ---`);
  console.log(`Enviados OK: ${sent}`);
  console.log(`Fallidos: ${failed}`);
  if (failures.length > 0) failures.forEach((f) => console.log(`  · ${f.email} — ${f.reason}`));
  console.log(`Omitidos (ya enviados antes): ${skipped}`);
  const remaining = pendingTotal - sent - failed; // failed no se marcan como enviados: se reintentan en la próxima ejecución
  console.log(`Pendientes para una próxima ejecución: ${Math.max(remaining, 0)}`);

  return { attempted, sent, failed, skipped, remaining: Math.max(remaining, 0) };
}

// ── main ─────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log(args.send ? '*** MODO ENVÍO REAL (--send) ***' : 'Modo DRY-RUN (no se envía nada — usa --send para enviar de verdad)');
  if (args.only) console.log(`Filtro --only: ${args.only} (ignora la pertenencia al grupo, y no requiere confirmación por consola)`);

  if (args.send && !transporter) {
    console.error('\nSMTP no configurado (faltan SMTP_HOST/SMTP_USER/SMTP_PASS en el .env que está usando este proceso). Abortando antes de tocar nada.');
    process.exit(1);
  }

  const groups = args.group ? [args.group] : ['active', 'winback'];
  const totals = { sent: 0, failed: 0, skipped: 0, remaining: 0 };

  for (const g of groups) {
    const r = await runCampaign(g, args);
    totals.sent += r.sent;
    totals.failed += r.failed;
    totals.skipped += r.skipped;
    totals.remaining += r.remaining;
  }

  if (args.send) {
    console.log('\n=== RESUMEN TOTAL ===');
    console.log(`Enviados OK: ${totals.sent}`);
    console.log(`Fallidos: ${totals.failed}`);
    console.log(`Omitidos (ya enviados antes): ${totals.skipped}`);
    console.log(`Pendientes para una próxima ejecución: ${totals.remaining}`);
  }

  await closePool();
}

main().catch(async (err) => {
  console.error('Error inesperado, abortando:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
