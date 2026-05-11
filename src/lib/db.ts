import { Pool } from "pg";

const g = globalThis as unknown as { pgPool: Pool };

export const pool =
  g.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 0,
    connectionTimeoutMillis: 30000,
    allowExitOnIdle: false,
  });

if (process.env.NODE_ENV !== "production") g.pgPool = pool;

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  let retries = 3;
  while (retries > 0) {
    try {
      const { rows } = await pool.query(sql, params);
      return rows as T[];
    } catch (e: any) {
      retries--;
      if (retries === 0) throw e;
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw new Error("Query failed after retries");
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}