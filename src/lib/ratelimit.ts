// ═══════════════════════════════════════════════════════════════════
// LÍMITE DE INTENTOS
// Guarda los contadores en Postgres (tabla rate_limits) porque en
// Vercel cada request puede caer en un servidor distinto y la memoria
// no se comparte.
// ═══════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { clientIp } from "@/lib/auth";

type Result = { count: number; resetIn: number };

/** Suma 1 al contador de `key` dentro de una ventana de `windowSec` segundos */
export async function hit(key: string, windowSec: number): Promise<Result> {
  const { rows: [r] } = await pool.query(
    `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, NOW(), 1)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start < NOW() - make_interval(secs => $2) THEN 1 ELSE rate_limits.count + 1 END,
       window_start = CASE WHEN rate_limits.window_start < NOW() - make_interval(secs => $2) THEN NOW() ELSE rate_limits.window_start END
     RETURNING count, GREATEST(0, EXTRACT(EPOCH FROM (window_start + make_interval(secs => $2) - NOW())))::int AS reset_in`,
    [key, windowSec]
  );
  // Limpieza ocasional de contadores viejos
  if (Math.random() < 0.02) pool.query(`DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 day'`).catch(() => {});
  return { count: r.count, resetIn: r.reset_in };
}

/** Consulta el contador sin sumar */
export async function peek(key: string, windowSec: number): Promise<Result> {
  const { rows: [r] } = await pool.query(
    `SELECT count, GREATEST(0, EXTRACT(EPOCH FROM (window_start + make_interval(secs => $2) - NOW())))::int AS reset_in
     FROM rate_limits WHERE key = $1 AND window_start >= NOW() - make_interval(secs => $2)`,
    [key, windowSec]
  );
  return r ? { count: r.count, resetIn: r.reset_in } : { count: 0, resetIn: 0 };
}

export async function reset(key: string) {
  await pool.query(`DELETE FROM rate_limits WHERE key = $1`, [key]);
}

const minutes = (s: number) => Math.max(1, Math.ceil(s / 60));

/**
 * Corta la request si la IP superó `max` llamadas en `windowSec`.
 * Devuelve una respuesta 429 para cortar, o null si puede seguir.
 * Si la tabla no existe todavía, deja pasar (y lo avisa en el log).
 */
export async function limitByIp(req: NextRequest, name: string, max: number, windowSec: number) {
  try {
    const { count, resetIn } = await hit(`${name}:${clientIp(req)}`, windowSec);
    if (count > max) {
      return NextResponse.json(
        { error: `Demasiados intentos. Probá de nuevo en ${minutes(resetIn)} min.` },
        { status: 429, headers: { "Retry-After": String(resetIn) } }
      );
    }
  } catch (e) {
    console.error("[rate-limit] no se pudo verificar (¿corriste sql/03_seguridad.sql?)", e);
  }
  return null;
}

export { minutes };