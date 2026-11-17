// GET → lo que hay que pedir, agrupado por proveedor (automático: stock ≤ 2)
//   suppliers: proveedores con productos para pedir (y si ya se pidieron)
//   noSupplier: productos para pedir que todavía no tienen proveedor
//   openOrders: pedidos enviados (al grupo) que todavía no llegaron
//   group_url: link del grupo de WhatsApp (variable WHATSAPP_GROUP_URL)
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/pos";
import { REORDER_AT, suggestedQty, isSaphirusSql, groupUrl } from "@/lib/reposicion";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const unauth = requireUser(req); if (unauth) return unauth;
  try {
    const [items, orders] = await Promise.all([
      pool.query(
        `SELECT p.id, p.name, p.sku, p.image_url, p.stock_quantity, p.min_stock, p.supplier_id,
                s.name AS supplier_name, s.contact_name, s.whatsapp, s.active AS supplier_active,
                po.order_id AS pending_order_id, po.sent_at AS pending_sent_at, po.quantity AS pending_qty
         FROM products p
         LEFT JOIN suppliers s ON s.id = p.supplier_id
         -- ¿Ya está en un pedido enviado que todavía no llegó?
         LEFT JOIN LATERAL (
           SELECT o.id AS order_id, o.sent_at, oi.quantity
           FROM supplier_order_items oi JOIN supplier_orders o ON o.id = oi.order_id
           WHERE oi.product_id = p.id AND o.status = 'sent'
           ORDER BY o.sent_at DESC LIMIT 1
         ) po ON TRUE
         WHERE p.stock_quantity <= $1
           AND NOT COALESCE(${isSaphirusSql("s")}, FALSE)   -- Saphirus tiene su propia sección
         ORDER BY s.name NULLS LAST, p.stock_quantity, p.name`,
        [REORDER_AT]
      ),
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

    const bySupplier = new Map<number, any>();
    const noSupplier: any[] = [];
    for (const r of items.rows) {
      const item = {
        product_id: r.id, name: r.name, sku: r.sku, image_url: r.image_url,
        stock: r.stock_quantity, min_stock: r.min_stock,
        suggested: suggestedQty(r.stock_quantity, r.min_stock),
        pending: r.pending_order_id ? { order_id: r.pending_order_id, sent_at: r.pending_sent_at, quantity: r.pending_qty } : null,
      };
      if (!r.supplier_id || !r.supplier_active) { noSupplier.push({ ...item, supplier_name: r.supplier_id ? r.supplier_name : null }); continue; }
      if (!bySupplier.has(r.supplier_id))
        bySupplier.set(r.supplier_id, { id: r.supplier_id, name: r.supplier_name, contact_name: r.contact_name, whatsapp: r.whatsapp, items: [] });
      bySupplier.get(r.supplier_id).items.push(item);
    }

    return NextResponse.json({
      threshold: REORDER_AT,
      suppliers: [...bySupplier.values()],
      noSupplier,
      openOrders: orders.rows,
      group_url: groupUrl(),
    });
  } catch (e) { return errorResponse(e); }
}
