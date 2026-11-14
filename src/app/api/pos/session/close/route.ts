// POST → cerrar la caja abierta con arqueo { counted_cash, closed_by?, notes? }
import { NextRequest, NextResponse } from "next/server";
import { requireOwner, errorResponse, withTransaction, getSessionSummary, getOpenSessionId, PosError, round2 } from "@/lib/pos";
import { getAdmin } from "@/lib/auth";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const unauth = requireOwner(req); if (unauth) return unauth;
  try {
    const b = await req.json().catch(() => ({}));
    const counted = Number(b.counted_cash);
    if (b.counted_cash === undefined || b.counted_cash === "" || !Number.isFinite(counted) || counted < 0)
      throw new PosError("Ingresá el efectivo contado en caja");

    const result = await withTransaction(async (c) => {
      // FOR UPDATE: bloquea la sesión para que no entren ventas mientras se cierra
      const id = await getOpenSessionId(c, "FOR UPDATE");
      if (!id) throw new PosError("No hay una caja abierta", 404);

      const summary = await getSessionSummary(c, id);
      const difference = round2(counted - summary!.expected_cash);

      await c.query(
        `UPDATE cash_sessions
         SET status = 'closed', closed_at = NOW(), closed_by = $1,
             expected_cash = $2, expected_transfer = $3,
             counted_cash = $4, difference = $5,
             notes = COALESCE(NULLIF($6, ''), notes)
         WHERE id = $7`,
        [getAdmin(req)?.name || null, summary!.expected_cash, summary!.expected_transfer,
         round2(counted), difference, b.notes ?? "", id]
      );
      return getSessionSummary(c, id);
    });

    return NextResponse.json(result);
  } catch (e) { return errorResponse(e); }
}
