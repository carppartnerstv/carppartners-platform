// =====================================================================
// Pool de conexiones PostgreSQL usando node-postgres (pg).
// Sin ORM de pago — solo SQL parametrizado. (Briefing 3.3)
// =====================================================================
import pg from 'pg';
import { config } from '../config/index.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.db.connectionString,
  max: config.db.max,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('[db] Error inesperado en cliente inactivo del pool:', err);
});

/**
 * Ejecuta una consulta parametrizada. Usar SIEMPRE placeholders ($1, $2…)
 * para evitar inyección SQL.
 * @param {string} text
 * @param {Array} params
 */
export const query = (text, params) => pool.query(text, params);

/**
 * Helper para una sola fila (o null).
 */
export const queryOne = async (text, params) => {
  const { rows } = await pool.query(text, params);
  return rows[0] ?? null;
};

/**
 * Ejecuta una función dentro de una transacción.
 * @param {(client: pg.PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const closePool = () => pool.end();
