// PATCH { status: "received" | "cancelled" } → el pedido llegó / se canceló
//   (el stock se suma cargando la compra o editando el artículo; esto solo cierra el pedido)
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireUser, errorResponse, PosError } from "@/lib/pos";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const unauth = requireUser(req); if (unauth) return unauth;
  try {
    const raw = (await params).id;
    if (!/^\d{1,9}$/.test(raw)) throw new PosError("Pedido inválido", 404);
    const b = await req.json().catch(() => ({}));
    if (b.status !== "received" && b.status !== "cancelled") throw new PosError("Estado inválido");
    const { rows: [o] } = await pool.query(
      `UPDATE supplier_orders
       SET status = $2::varchar, received_at = CASE WHEN $2::varchar = 'received' THEN NOW() ELSE received_at END
       WHERE id = $1 AND status = 'sent'
       RETURNING id, status`,
      [Number(raw), b.status]
    );
    if (!o) throw new PosError("El pedido no existe o ya estaba cerrado", 404);
    return NextResponse.json(o);
  } catch (e) { return errorResponse(e); }
}
