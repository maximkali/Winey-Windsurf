import { neon, Pool } from '@neondatabase/serverless';

function getConnectionString() {
  return process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || '';
}

let sqlSingleton: ReturnType<typeof neon> | null = null;

/** Neon HTTP driver — use for single-statement queries (typical API route path). */
export function getSql() {
  if (!sqlSingleton) {
    const url = getConnectionString();
    if (!url) throw new Error('NEON_NOT_CONFIGURED');
    sqlSingleton = neon(url);
  }
  return sqlSingleton;
}

let poolSingleton: Pool | null = null;

function getPool() {
  if (!poolSingleton) {
    const url = getConnectionString();
    if (!url) throw new Error('NEON_NOT_CONFIGURED');
    poolSingleton = new Pool({ connectionString: url });
  }
  return poolSingleton;
}

export type TransactionQuery = (
  text: string,
  params?: unknown[]
) => Promise<{ rows: Record<string, unknown>[] }>;

/** Same connection string as {@link getSql}; use for BEGIN/COMMIT multi-statement flows. */
export async function withTransaction<T>(fn: (query: TransactionQuery) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const query: TransactionQuery = async (text, params = []) => {
      const res = await client.query(text, params);
      return { rows: res.rows as Record<string, unknown>[] };
    };
    const out = await fn(query);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
