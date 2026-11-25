// PEDIDOS A PROVEEDORES — lo que hay que pedir (automático: stock ≤ 2), de a poco.
//
// GET                       → RESUMEN: proveedores con cuántos productos tienen para pedir
//                             (sin traer los productos), pedidos enviados y link del grupo.
//                             "Sin proveedor" va como proveedor id 0.
// GET ?supplier=ID          → productos de ESE proveedor, de a 15:
//       &offset=0&limit=15  &q=texto  &hide=1 (ocultar los que ya están pedidos)
//       → { items, total, pendingCount }
// GET ?supplier=ID&all=1    → todos los productos de ese proveedor con esos filtros, livianos
//                             (para "Marcar todos" / "Ninguno")
// GET ?ids=1,2,3            → esos productos, solo si siguen para pedir (para revisar lo elegido)
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/pos";
import { REORDER_AT, suggestedQty, isSaphirusSql, groupUrl } from "@/lib/reposicion";
export const dynamic = "force-dynamic";

// Proveedor "efectivo": si no tiene, o está desactivado, cuenta como "Sin proveedor" (0)
const SID = `CASE WHEN p.supplier_id IS NULL OR NOT COALESCE(s.active, FALSE) THEN 0 ELSE p.supplier_id END`;
// ¿Ya está en un pedido enviado que todavía no llegó?
const PENDING = `EXISTS (SELECT 1 FROM supplier_order_items oi JOIN supplier_orders o ON o.id = oi.order_id
                         WHERE oi.product_id = p.id AND o.status = 'sent')`;
const BASE = `FROM products p
              LEFT JOIN suppliers s ON s.id = p.supplier_id
              WHERE p.stock_quantity <= ${REORDER_AT}
                AND NOT COALESCE(${isSaphirusSql("s")}, FALSE)`;   // Saphirus tiene su propia sección

const toItem = (r: any) => ({
  product_id: r.id, name: r.name, sku: r.sku, image_url: r.image_url ?? null,
  stock: r.stock_quantity, min_stock: r.min_stock,
  suggested: suggestedQty(r.stock_quantity, r.min_stock),
  pending: r.pending_order_id ? { order_id: r.pending_order_id, sent_at: r.pending_sent_at, quantity: r.pending_qty } : null,
  supplier_name: r.inactive_supplier ?? null,
  sup: Number(r.sid), sup_name: r.sup_name ?? null,
});

const DETAIL_COLS = `p.id, p.name, p.sku, p.image_url, p.stock_quantity, p.min_stock, ${SID} AS sid,
       CASE WHEN ${SID} = 0 THEN 'Sin proveedor' ELSE s.name END AS sup_name,
       CASE WHEN p.supplier_id IS NOT NULL AND NOT COALESCE(s.active, FALSE) THEN s.name END AS inactive_supplier,
       po.order_id AS pending_order_id, po.sent_at AS pending_sent_at, po.quantity AS pending_qty`;
const PENDING_JOIN = `LEFT JOIN LATERAL (
         SELECT o.id AS order_id, o.sent_at, oi.quantity
         FROM supplier_order_items oi JOIN supplier_orders o ON o.id = oi.order_id
         WHERE oi.product_id = p.id AND o.status = 'sent'
         ORDER BY o.sent_at DESC LIMIT 1
       ) po ON TRUE`;

export async function GET(req: NextRequest) {
  const unauth = requireUser(req); if (unauth) return unauth;
  try {
    const sp = req.nextUrl.searchParams;

    // ── Revisar lo elegido (ids guardados en la compu) ──
    if (sp.has("ids")) {
      const ids = (sp.get("ids") || "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 2000);
      if (!ids.length) return NextResponse.json({ items: [] });
      const { rows } = await pool.query(
        `SELECT ${DETAIL_COLS} FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id ${PENDING_JOIN}
         WHERE p.id = ANY($1::int[]) AND p.stock_quantity <= ${REORDER_AT} AND NOT COALESCE(${isSaphirusSql("s")}, FALSE)`, [ids]);
      return NextResponse.json({ items: rows.map(toItem) });
    }

    // ── Productos de un proveedor ──
    if (sp.has("supplier")) {
      const sid = Math.max(0, Number(sp.get("supplier")) || 0);
      const all = sp.get("all") === "1";
      const limit = all ? 2000 : Math.min(50, Math.max(1, Number(sp.get("limit")) || 15));
      const offset = all ? 0 : Math.max(0, Number(sp.get("offset")) || 0);
      const hide = sp.get("hide") === "1";
      const words = (sp.get("q") || "").trim().slice(0, 80).split(/\s+/).filter(Boolean).slice(0, 6);

      const params: any[] = [sid];
      const where = [`${SID} = $1`];
      for (const w of words) {
        params.push(`%${w}%`);
        where.push(`(p.name ILIKE $${params.length} OR COALESCE(p.sku,'') ILIKE $${params.length} OR p.id::text = '${w.replace(/\D/g, "") || "-1"}')`);
      }
      const filtered = `${BASE} AND ${where.join(" AND ")}`;
      const shown = `${filtered}${hide ? ` AND NOT ${PENDING}` : ""}`;

      const [items, counts] = await Promise.all([
        pool.query(
          `SELECT ${DETAIL_COLS} FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id ${PENDING_JOIN}
           WHERE p.id IN (SELECT p.id ${shown})
           ORDER BY p.stock_quantity, p.name, p.id
           LIMIT ${limit} OFFSET ${offset}`, params),
        all ? Promise.resolve({ rows: [{}] as any[] }) : pool.query(
          `SELECT COUNT(*) FILTER (WHERE ${hide ? `NOT ${PENDING}` : "TRUE"})::int AS total,
                  COUNT(*) FILTER (WHERE ${PENDING})::int AS pending
           ${filtered}`, params),
      ]);
      return NextResponse.json({
        items: items.rows.map(toItem),
        total: all ? items.rows.length : counts.rows[0].total,
        pendingCount: all ? undefined : counts.rows[0].pending,
      });
    }

    // ── Resumen por proveedor (sin traer los productos) ──
    const [summary, orders] = await Promise.all([
      pool.query(
        `SELECT x.sid AS id,
                CASE WHEN x.sid = 0 THEN 'Sin proveedor' ELSE s.name END AS name,
                s.contact_name, s.whatsapp,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE x.pend)::int AS pending
         FROM (SELECT ${SID} AS sid, ${PENDING} AS pend ${BASE}) x
         LEFT JOIN suppliers s ON s.id = x.sid
         GROUP BY x.sid, s.id`),
      pool.query(
        `SELECT o.id, o.supplier_id, s.name AS supplier_name, s.contact_name, s.whatsapp, o.sent_at, o.message_text,
                COALESCE(json_agg(json_build_object('product_id', oi.product_id, 'name', oi.product_name, 'quantity', oi.quantity) ORDER BY oi.id)
                         FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
         FROM supplier_orders o
         LEFT JOIN suppliers s ON s.id = o.supplier_id
         LEFT JOIN supplier_order_items oi ON oi.order_id = o.id
         WHERE o.status = 'sent' AND NOT COALESCE(${isSaphirusSql("s")}, FALSE)
         GROUP BY o.id, s.id
         ORDER BY o.sent_at DESC
         LIMIT 100`
      ),
    ]);

    return NextResponse.json({
      threshold: REORDER_AT,
      suppliers: summary.rows,      // [{ id, name, contact_name, whatsapp, total, pending }]  (id 0 = Sin proveedor)
      openOrders: orders.rows,
      group_url: groupUrl(),
    });
  } catch (e) { return errorResponse(e); }
}
