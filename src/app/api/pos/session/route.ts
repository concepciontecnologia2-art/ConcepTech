// GET  → caja abierta actual + resumen (o { session: null })
//        Si no es el dueño, solo dice si está abierta, sin los totales.
// POST → abrir caja { opening_amount }  (solo el dueño)
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireOwner, requireUser, errorResponse, getSessionSummary, getOpenSessionId, PosError, round2 } from "@/lib/pos";
import { getAdmin, getOwner } from "@/lib/auth";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const unauth = requireUser(req); if (unauth) return unauth;
  try {
    const id = await getOpenSessionId(pool);
    if (!id) return NextResponse.json({ session: null });
    if (!getOwner(req)) {
      const { rows: [s] } = await pool.query(`SELECT id, opened_at, status FROM cash_sessions WHERE id = $1`, [id]);
      return NextResponse.json({ session: s, limited: true });
    }
    return NextResponse.json(await getSessionSummary(pool, id));
  } catch (e) { return errorResponse(e); }
}

export async function POST(req: NextRequest) {
  const unauth = requireOwner(req); if (unauth) return unauth;
  try {
    const b = await req.json().catch(() => ({}));
    const opening = Number(b.opening_amount ?? 0);
    if (!Number.isFinite(opening) || opening < 0)
      throw new PosError("El monto inicial debe ser un número mayor o igual a 0");

    const { rows: [s] } = await pool.query(
      `INSERT INTO cash_sessions (opening_amount, opened_by, notes)
       VALUES ($1, $2, $3) RETURNING id`,
      [round2(opening), getAdmin(req)?.name || null, b.notes?.toString().slice(0, 500) || null]
    );
    return NextResponse.json(await getSessionSummary(pool, s.id), { status: 201 });
  } catch (e) { return errorResponse(e); }
}
