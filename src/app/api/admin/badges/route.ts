// GET → contadores para el menú del panel (una sola consulta liviana)
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/pos";
import { REORDER_AT, isSaphirusSql } from "@/lib/reposicion";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const unauth = requireUser(req); if (unauth) return unauth;
  try {
    const { rows: [r] } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM orders   WHERE status = 'pending')::int                      AS "pendingOrders",
        (SELECT COUNT(*) FROM products WHERE image_url IS NULL OR image_url = '')::int      AS "sinFoto",
        (SELECT COUNT(*) FROM products WHERE min_stock > 0 AND stock_quantity <= min_stock)::int AS "lowStock",
        EXISTS (SELECT 1 FROM cash_sessions WHERE status = 'open')                          AS "cajaAbierta",
        -- Proveedores con productos en ${REORDER_AT} o menos que todavía no se pidieron
        (SELECT COUNT(DISTINCT p.supplier_id) FROM products p JOIN suppliers s ON s.id = p.supplier_id AND s.active AND NOT ${isSaphirusSql("s")}
         WHERE p.stock_quantity <= $1
           AND NOT EXISTS (SELECT 1 FROM supplier_order_items oi JOIN supplier_orders o ON o.id = oi.order_id
                           WHERE oi.product_id = p.id AND o.status = 'sent'))::int        AS "toReorder"
    `, [REORDER_AT]);
    return NextResponse.json(r);
  } catch (e) { return errorResponse(e); }
}
