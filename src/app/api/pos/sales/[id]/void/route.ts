// POST → anular una venta de la caja abierta { reason }
// Devuelve el stock y la venta deja de contar en el arqueo.
import { NextRequest, NextResponse } from "next/server";
import { requireOwner, errorResponse, withTransaction, PosError } from "@/lib/pos";
export const dynamic = "force-dynamic";

type P = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: P) {
  const unauth = requireOwner(req); if (unauth) return unauth;
  try {
    const { id } = await params;
    const saleId = Number(id);
    if (!Number.isInteger(saleId)) throw new PosError("Venta inválida");
    const b = await req.json().catch(() => ({}));
    const reason = (b.reason || "").toString().trim();
    if (!reason) throw new PosError("Indicá el motivo de la anulación");

    await withTransaction(async (c) => {
      const { rows: [s] } = await c.query(
        `SELECT s.id, s.status, cs.status AS session_status
         FROM sales s JOIN cash_sessions cs ON cs.id = s.cash_session_id
         WHERE s.id = $1 FOR UPDATE OF s`,
        [saleId]
      );
      if (!s) throw new PosError("Venta no encontrada", 404);
      if (s.status === "voided") throw new PosError("La venta ya está anulada", 409);
      if (s.session_status !== "open")
        throw new PosError("Solo se pueden anular ventas de la caja abierta", 409);

      const { rows: items } = await c.query(
        `SELECT product_id, quantity FROM sale_items
         WHERE sale_id = $1 AND product_id IS NOT NULL ORDER BY product_id`,
        [saleId]
      );
      for (const it of items) {
        const { rows: [u] } = await c.query(
          `UPDATE products SET stock_quantity = stock_quantity + $1
           WHERE id = $2 RETURNING stock_quantity`,
          [it.quantity, it.product_id]
        );
        if (!u) continue; // producto borrado: no hay stock que devolver
        await c.query(
          `INSERT INTO stock_movements (product_id, quantity_change, stock_before, stock_after, type, reference_id, notes)
           VALUES ($1, $2, $3, $4, 'void', $5, $6)`,
          [it.product_id, it.quantity, u.stock_quantity - it.quantity, u.stock_quantity, saleId, reason]
        );
      }

      await c.query(
        `UPDATE sales SET status = 'voided', voided_at = NOW(), void_reason = $1 WHERE id = $2`,
        [reason.slice(0, 500), saleId]
      );
    });

    return NextResponse.json({ ok: true });
  } catch (e) { return errorResponse(e); }
}
