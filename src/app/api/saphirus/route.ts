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

// GET ?supplier=ID                       → proveedores, últimos pedidos, contadores y la 1ª página de productos
// GET ?supplier=ID&page=1&offset=15      → solo otra página de productos { items, total }
//        filtros: &q=texto  &low=1 (solo para reponer)   · de a 15
// GET ?supplier=ID&lite=bulto            → Textil/Aerosol/Varilla que no están en camino (para arrancar en 12)
// GET ?supplier=ID&lite=low              → los que hay que reponer y no están en camino ("Agregar todos")
// GET ?supplier=ID&ids=1,2,3             → esos productos (nombre) para el pedido guardado en la compu
const PAGE = 15;
// Textil, Aerosol y Varilla vienen en bulto de 12 (igual que saphirusBulto() en lib/reposicion)
const BULTO_SQL = `translate(lower(p.name), 'áéíóúü', 'aeiouu') ~ '\\m(textil|textiles|aerosol|aerosoles|varilla|varillas)\\M'`;
const PENDING = `EXISTS (SELECT 1 FROM supplier_order_items oi JOIN supplier_orders o ON o.id = oi.order_id
                         WHERE oi.product_id = p.id AND o.status = 'sent')`;

export async function GET(req: NextRequest) {
  const unauth = requireUser(req); if (unauth) return unauth;
  try {
    const sp = req.nextUrl.searchParams;
    const { rows: suppliers } = await pool.query(
      `SELECT id, name, contact_name, whatsapp FROM suppliers
       WHERE active = TRUE AND name ILIKE $1 ORDER BY name`, [SAPHIRUS_LIKE]);
    const wanted = Number(sp.get("supplier"));
    const supplier = suppliers.find((s: any) => s.id === wanted) || suppliers[0] || null;

    // Productos de Saphirus = los de ese proveedor, o con "Saphirus" en el nombre o la categoría
    const params: any[] = [supplier?.id ?? null, SAPHIRUS_LIKE];
    const BASE = `FROM products p LEFT JOIN categories c ON c.id = p.category_id
                  WHERE (($1::int IS NOT NULL AND p.supplier_id = $1) OR p.name ILIKE $2 OR c.name ILIKE $2)`;

    // ── Listas livianas (solo id y nombre) ──
    const lite = sp.get("lite");
    if (lite === "bulto" || lite === "low" || sp.has("ids")) {
      let extra = "";
      const ps = [...params];
      if (lite === "bulto") extra = ` AND ${BULTO_SQL} AND NOT ${PENDING}`;
      else if (lite === "low") extra = ` AND p.stock_quantity <= ${REORDER_AT} AND NOT ${PENDING}`;
      else {
        const ids = (sp.get("ids") || "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 2000);
        if (!ids.length) return NextResponse.json({ items: [] });
        ps.push(ids); extra = ` AND p.id = ANY($3::int[])`;
      }
      const { rows } = await pool.query(`SELECT p.id, p.name, p.sku ${BASE}${extra} ORDER BY p.name LIMIT 2000`, ps);
      return NextResponse.json({ items: rows });
    }

    // ── Una página de productos (con búsqueda y filtro) ──
    const offset = Math.max(0, Number(sp.get("offset")) || 0);
    const limit = Math.min(50, Math.max(1, Number(sp.get("limit")) || PAGE));
    const where: string[] = [];
    const ps = [...params];
    if (sp.get("low") === "1") where.push(`p.stock_quantity <= ${REORDER_AT}`);
    for (const w of (sp.get("q") || "").trim().slice(0, 80).split(/\s+/).filter(Boolean).slice(0, 6)) {
      ps.push(`%${w}%`);
      where.push(`(p.name ILIKE $${ps.length} OR COALESCE(p.sku,'') ILIKE $${ps.length} OR COALESCE(c.name,'') ILIKE $${ps.length})`);
    }
    const filtered = `${BASE}${where.length ? ` AND ${where.join(" AND ")}` : ""}`;
    const pageQ = Promise.all([
      pool.query(
        `SELECT p.id, p.name, p.sku, p.image_url, p.stock_quantity AS stock, p.min_stock,
                c.name AS category,
                po.sent_at AS pending_sent_at, po.quantity AS pending_qty
         ${filtered.replace("WHERE", `LEFT JOIN LATERAL (
           SELECT o.sent_at, oi.quantity FROM supplier_order_items oi JOIN supplier_orders o ON o.id = oi.order_id
           WHERE oi.product_id = p.id AND o.status = 'sent' ORDER BY o.sent_at DESC LIMIT 1
         ) po ON TRUE
         WHERE`)}
         ORDER BY (p.stock_quantity <= ${REORDER_AT}) DESC, p.name, p.id
         LIMIT ${limit} OFFSET ${offset}`, ps),
      pool.query(`SELECT COUNT(*)::int AS n ${filtered}`, ps),
    ]);
    if (sp.get("page") === "1") {
      const [items, total] = await pageQ;
      return NextResponse.json({ items: items.rows, total: total.rows[0].n });
    }

    const [[items, total], counts, orders] = await Promise.all([
      pageQ,
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE p.stock_quantity <= ${REORDER_AT})::int AS low,
                COUNT(*) FILTER (WHERE p.stock_quantity <= ${REORDER_AT} AND NOT ${PENDING})::int AS low_open
         ${BASE}`, params),
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

    return NextResponse.json({
      threshold: REORDER_AT, suppliers, supplier,
      products: items.rows, total: total.rows[0].n, counts: counts.rows[0],
      orders: orders.rows, group_url: groupUrl(),
    });
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
