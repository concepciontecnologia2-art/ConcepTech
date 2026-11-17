// PEDIDO SAPHIRUS — sección propia del menú; la usa cualquier usuario con sesión
// GET  ?supplier=ID → proveedores Saphirus, sus productos con stock y los últimos pedidos
//   Productos de Saphirus = los que tienen ese proveedor, o "Saphirus" en el nombre o la categoría.
// POST { supplier_id, items: [{ product_id?, name?, quantity }], note?, message? }
//   → registra el pedido como ENVIADO (la pantalla ya abrió WhatsApp para mandarlo al GRUPO).
//   Los renglones sin product_id son "libres" (aromas o productos que no están cargados).
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireUser, errorResponse, withTransaction, PosError } from "@/lib/pos";
import { buildGroupMessage, REORDER_AT, SAPHIRUS_LIKE, groupUrl } from "@/lib/reposicion";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const unauth = requireUser(req); if (unauth) return unauth;
  try {
    const { rows: suppliers } = await pool.query(
      `SELECT id, name, contact_name, whatsapp FROM suppliers
       WHERE active = TRUE AND name ILIKE $1 ORDER BY name`, [SAPHIRUS_LIKE]);
    const wanted = Number(req.nextUrl.searchParams.get("supplier"));
    const supplier = suppliers.find((s: any) => s.id === wanted) || suppliers[0] || null;

    const [products, orders] = await Promise.all([
      pool.query(
        `SELECT p.id, p.name, p.sku, p.image_url, p.stock_quantity AS stock, p.min_stock,
                c.name AS category,
                po.sent_at AS pending_sent_at, po.quantity AS pending_qty
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN LATERAL (
           SELECT o.sent_at, oi.quantity FROM supplier_order_items oi JOIN supplier_orders o ON o.id = oi.order_id
           WHERE oi.product_id = p.id AND o.status = 'sent' ORDER BY o.sent_at DESC LIMIT 1
         ) po ON TRUE
         WHERE ($1::int IS NOT NULL AND p.supplier_id = $1) OR p.name ILIKE $2 OR c.name ILIKE $2
         ORDER BY (p.stock_quantity <= $3) DESC, p.name
         LIMIT 1000`,
        [supplier?.id ?? null, SAPHIRUS_LIKE, REORDER_AT]),
      supplier
        ? pool.query(
            `SELECT o.id, o.status, o.sent_at, o.received_at, o.notes,
                    COALESCE(json_agg(json_build_object('name', oi.product_name, 'quantity', oi.quantity, 'free', oi.product_id IS NULL) ORDER BY oi.id)
                             FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
             FROM supplier_orders o LEFT JOIN supplier_order_items oi ON oi.order_id = o.id
             WHERE o.supplier_id = $1 AND o.status <> 'draft'
             GROUP BY o.id ORDER BY o.sent_at DESC NULLS LAST LIMIT 30`, [supplier.id])
        : Promise.resolve({ rows: [] as any[] }),
    ]);

    return NextResponse.json({ threshold: REORDER_AT, suppliers, supplier, products: products.rows, orders: orders.rows, group_url: groupUrl() });
  } catch (e) { return errorResponse(e); }
}

export async function POST(req: NextRequest) {
  const unauth = requireUser(req); if (unauth) return unauth;
  try {
    const b = await req.json().catch(() => ({}));
    const supplierId = Number(b.supplier_id);
    if (!Number.isInteger(supplierId) || supplierId <= 0) throw new PosError("Elegí el proveedor de Saphirus");
    if (!Array.isArray(b.items) || !b.items.length) throw new PosError("El pedido está vacío");
    if (b.items.length > 300) throw new PosError("Demasiados renglones en un pedido");
    const note = typeof b.note === "string" ? b.note.trim().slice(0, 500) : "";

    const byProduct = new Map<number, number>();
    const free: { name: string; quantity: number }[] = [];
    for (const it of b.items) {
      const q = Number(it?.quantity);
      if (!Number.isInteger(q) || q <= 0 || q > 9999) throw new PosError("Cantidad inválida");
      if (it?.product_id != null) {
        const id = Number(it.product_id);
        if (!Number.isInteger(id) || id <= 0) throw new PosError("Producto inválido");
        byProduct.set(id, (byProduct.get(id) || 0) + q);
      } else {
        const name = typeof it?.name === "string" ? it.name.trim().slice(0, 200) : "";
        if (!name) throw new PosError("Hay un renglón libre sin descripción");
        free.push({ name, quantity: q });
      }
    }

    const result = await withTransaction(async (db) => {
      const { rows: [s] } = await db.query(
        `SELECT id, name, contact_name, whatsapp, active FROM suppliers WHERE id = $1 AND name ILIKE $2`, [supplierId, SAPHIRUS_LIKE]);
      if (!s) throw new PosError("El proveedor no es de Saphirus o no existe", 404);
      if (!s.active) throw new PosError("El proveedor está desactivado");

      const { rows: prods } = byProduct.size
        ? await db.query(`SELECT id, name, sku FROM products WHERE id = ANY($1::int[]) ORDER BY name`, [[...byProduct.keys()]])
        : { rows: [] as any[] };
      if (prods.length !== byProduct.size) throw new PosError("Algún producto ya no existe");

      const lines = [
        ...prods.map((p: any) => ({ product_id: p.id as number | null, name: p.name, sku: p.sku, quantity: byProduct.get(p.id)! })),
        ...free.map((f) => ({ product_id: null, name: f.name, sku: null, quantity: f.quantity })),
      ];
      const message = typeof b.message === "string" && b.message.trim()
        ? b.message.slice(0, 6000)
        : buildGroupMessage([{ title: s.name, lines }], { title: "Pedido Saphirus", note });
      const { rows: [o] } = await db.query(
        `INSERT INTO supplier_orders (supplier_id, status, message_text, notes, sent_at) VALUES ($1, 'sent', $2, $3, NOW())
         RETURNING id, sent_at`, [supplierId, message, note || null]);
      for (const l of lines)
        await db.query(`INSERT INTO supplier_order_items (order_id, product_id, product_name, quantity) VALUES ($1, $2, $3, $4)`,
          [o.id, l.product_id, l.name, l.quantity]);
      return { order: o, message };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) { return errorResponse(e); }
}