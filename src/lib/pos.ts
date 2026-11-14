// Utilidades compartidas del módulo de Caja / Ventas en mostrador
import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import { getSessionUser, getAdmin, getOwner } from "@/lib/auth";

// ─── Auth (token firmado de src/lib/auth.ts) ─────────────────────────
/** Solo con el acceso de administrador desbloqueado (usuario y contraseña de un admin). */
export function requireAdmin(req: NextRequest) {
  if (!getSessionUser(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!getAdmin(req))
    return NextResponse.json({ error: "Hace falta el acceso de administrador", code: "ADMIN_REQUIRED" }, { status: 403 });
  return null;
}

/** Solo el dueño (Caja, Contabilidad y Usuarios), con su clave propia desbloqueada. */
export function requireOwner(req: NextRequest) {
  if (!getSessionUser(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!getOwner(req))
    return NextResponse.json({ error: "Solo el dueño puede entrar acá", code: "OWNER_REQUIRED" }, { status: 403 });
  return null;
}

/** Cualquier usuario con sesión (admin o vendedor) */
export function requireUser(req: NextRequest) {
  if (!getSessionUser(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return null;
}

// ─── Errores controlados ─────────────────────────────────────────────
export class PosError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function errorResponse(e: unknown) {
  if (e instanceof PosError)
    return NextResponse.json({ error: e.message }, { status: e.status });
  // 23505 = unique violation → índice "una sola caja abierta"
  if ((e as { code?: string })?.code === "23505")
    return NextResponse.json({ error: "Ya hay una caja abierta" }, { status: 409 });
  console.error("[POS]", e);
  return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
}

// ─── Transacciones ───────────────────────────────────────────────────
export async function withTransaction<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    throw e;
  } finally {
    client.release();
  }
}

// ─── Números (trabajamos en centavos para no perder precisión) ───────
export const toCents = (n: unknown) => Math.round(Number(n) * 100);
export const fromCents = (c: number) => c / 100;
export const round2 = (n: number) => Math.round(n * 100) / 100;

type Queryable = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> };

function normalizeSession(s: any) {
  if (!s) return null;
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    ...s,
    opening_amount: Number(s.opening_amount),
    expected_cash: num(s.expected_cash),
    expected_transfer: num(s.expected_transfer),
    counted_cash: num(s.counted_cash),
    difference: num(s.difference),
  };
}

// ─── Resumen de una sesión de caja (para el panel y el cierre) ───────
export async function getSessionSummary(db: Queryable, sessionId: number) {
  const { rows: [s] } = await db.query(`SELECT * FROM cash_sessions WHERE id = $1`, [sessionId]);
  if (!s) return null;

  const { rows: [sales] } = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'completed')::int                 AS sales_count,
       COUNT(*) FILTER (WHERE status = 'voided')::int                    AS voided_count,
       COALESCE(SUM(total)    FILTER (WHERE status = 'completed'), 0)::float AS sales_total,
       COALESCE(SUM(discount) FILTER (WHERE status = 'completed'), 0)::float AS discount_total
     FROM sales WHERE cash_session_id = $1`,
    [sessionId]
  );

  const { rows: [pay] } = await db.query(
    `SELECT
       COALESCE(SUM(sp.amount) FILTER (WHERE sp.method = 'cash'), 0)::float     AS cash_sales,
       COALESCE(SUM(sp.amount) FILTER (WHERE sp.method = 'transfer'), 0)::float AS transfer_sales
     FROM sale_payments sp
     JOIN sales s ON s.id = sp.sale_id
     WHERE s.cash_session_id = $1 AND s.status = 'completed'`,
    [sessionId]
  );

  const { rows: [mov] } = await db.query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE type = 'income'  AND method = 'cash'), 0)::float     AS cash_in,
       COALESCE(SUM(amount) FILTER (WHERE type = 'expense' AND method = 'cash'), 0)::float     AS cash_out,
       COALESCE(SUM(amount) FILTER (WHERE type = 'income'  AND method = 'transfer'), 0)::float AS transfer_in,
       COALESCE(SUM(amount) FILTER (WHERE type = 'expense' AND method = 'transfer'), 0)::float AS transfer_out
     FROM cash_movements WHERE cash_session_id = $1`,
    [sessionId]
  );

  const opening = Number(s.opening_amount);
  return {
    session: normalizeSession(s),
    ...sales,
    ...pay,
    ...mov,
    expected_cash: round2(opening + pay.cash_sales + mov.cash_in - mov.cash_out),
    expected_transfer: round2(pay.transfer_sales + mov.transfer_in - mov.transfer_out),
  };
}

export async function getOpenSessionId(db: Queryable, lock: "" | "FOR SHARE" | "FOR UPDATE" = "") {
  const { rows: [s] } = await db.query(
    `SELECT id FROM cash_sessions WHERE status = 'open' LIMIT 1 ${lock}`
  );
  return s ? (s.id as number) : null;
}
