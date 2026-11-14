// GET  → ingresos/retiros manuales de la caja abierta
// POST → { type: "income"|"expense", method: "cash"|"transfer", amount, reason }
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireOwner, errorResponse, getOpenSessionId, PosError, round2 } from "@/lib/pos";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const unauth = requireOwner(req); if (unauth) return unauth;
  try {
    const id = await getOpenSessionId(pool);
    if (!id) return NextResponse.json([]);
    const { rows } = await pool.query(
      `SELECT id, type, method, amount::float AS amount, reason, created_at
       FROM cash_movements WHERE cash_session_id = $1 ORDER BY id DESC`,
      [id]
    );
    return NextResponse.json(rows);
  } catch (e) { return errorResponse(e); }
}

export async function POST(req: NextRequest) {
  const unauth = requireOwner(req); if (unauth) return unauth;
  try {
    const b = await req.json().catch(() => ({}));
    if (b.type !== "income" && b.type !== "expense") throw new PosError("Tipo inválido");
    const method = b.method === "transfer" ? "transfer" : "cash";
    const amount = Number(b.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new PosError("El monto debe ser mayor a 0");
    const reason = (b.reason || "").toString().trim();
    if (!reason) throw new PosError("Indicá el motivo");

    const id = await getOpenSessionId(pool);
    if (!id) throw new PosError("No hay una caja abierta", 409);

    const { rows: [m] } = await pool.query(
      `INSERT INTO cash_movements (cash_session_id, type, method, amount, reason)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, type, method, amount::float AS amount, reason, created_at`,
      [id, b.type, method, round2(amount), reason.slice(0, 255)]
    );
    return NextResponse.json(m, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
