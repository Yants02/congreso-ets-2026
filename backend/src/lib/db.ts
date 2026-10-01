import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://congreso_app:V-129057-t@localhost:5433/congreso_ets2026';

const isCloudDb = connectionString.includes('sslmode=require') || connectionString.includes('rlwy.net') || connectionString.includes('railway');

const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: isCloudDb ? { rejectUnauthorized: false } : undefined,
});

export { pool };

export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

/**
 * Helper para ejecutar consultas SQL directas en el pool
 */
export async function query<R extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<R>> {
  return pool.query<R>(text, params);
}

/**
 * Helper para obtener un cliente del pool y ejecutar transacciones de forma segura
 */
export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
