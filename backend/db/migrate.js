// =====================================================================
// Runner de migraciones SQL versionadas.  (Briefing 3.3)
// Lee los .sql de db/migrations en orden y aplica los pendientes,
// registrándolos en la tabla `migrations`. Lo invoca el deploy automático.
//
// Uso:
//   node db/migrate.js up        -> aplica pendientes
//   node db/migrate.js status    -> muestra qué falta
// =====================================================================
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/config/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function appliedMigrations() {
  const { rows } = await pool.query('SELECT name FROM migrations ORDER BY name');
  return new Set(rows.map((r) => r.name));
}

async function migrationFiles() {
  const files = await readdir(MIGRATIONS_DIR);
  return files.filter((f) => f.endsWith('.sql')).sort();
}

async function up() {
  await ensureMigrationsTable();
  const applied = await appliedMigrations();
  const files = await migrationFiles();
  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log('[migrate] Sin migraciones pendientes. BD al día.');
    return;
  }

  for (const file of pending) {
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`[migrate] ✓ Aplicada: ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[migrate] ✗ Falló: ${file}\n`, err.message);
      throw err;
    } finally {
      client.release();
    }
  }
  console.log(`[migrate] Listo. ${pending.length} migración(es) aplicada(s).`);
}

async function status() {
  await ensureMigrationsTable();
  const applied = await appliedMigrations();
  const files = await migrationFiles();
  console.log('Migraciones:');
  for (const f of files) {
    console.log(`  ${applied.has(f) ? '✓ aplicada ' : '· pendiente'}  ${f}`);
  }
}

const cmd = process.argv[2] ?? 'up';
try {
  if (cmd === 'up') await up();
  else if (cmd === 'status') await status();
  else {
    console.error(`Comando desconocido: ${cmd}. Usa "up" o "status".`);
    process.exitCode = 1;
  }
} catch (err) {
  console.error('[migrate] Error fatal:', err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
