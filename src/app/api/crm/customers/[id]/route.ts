// GET    → ficha del cliente: datos, resumen, más comprados, compras en el local y pedidos web
// PATCH  → editar datos  { name, phone, ... }  o  { active: true|false }
// DELETE → borrar (solo si nunca compró; si tiene compras se desactiva)
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireUser, errorResponse, PosError } from "@/lib/pos";
import { parseId, customerFields, checkCustomerDuplicates, samePhone } from "@/lib/crm";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const COLS = `id, name, phone, email, dni_cuit, address, city, customer_type, notes, active, created_at, updated_at`;

export async function GET(req: NextRequest, { params }: Ctx) {
  const unauth = requireUser(req); if (unauth) return unauth;
  try {
    const id = parseId((await params).id);
    const { rows: [c] } = await pool.query(`SELECT ${COLS} FROM customers WHERE id = $1`, [id]);
    if (!c) throw new PosError("El cliente no existe", 404);

    const [stats, top, sales, web] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS purchases, COALESCE(SUM(total), 0)::float AS spent,
                COALESCE(AVG(total), 0)::float AS avg_ticket,
                MIN(created_at) AS first_purchase, MAX(created_at) AS last_purchase
         FROM sales WHERE customer_id = $1 AND status = 'completed'`, [id]),
      pool.query(
        `SELECT si.product_id, MAX(si.product_name) AS name, MAX(p.image_url) AS image_url,
                SUM(si.quantity)::int AS quantity, SUM(si.subtotal)::float AS total
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         LEFT JOIN products p ON p.id = si.product_id
         WHERE s.customer_id = $1 AND s.status = 'completed'
         GROUP BY si.product_id ORDER BY quantity DESC, total DESC LIMIT 5`, [id]),
      pool.query(
        `SELECT s.id, s.status, s.created_at, s.total::float AS total, s.discount::float AS discount, s.price_list,
                COALESCE((SELECT json_agg(json_build_object('name', product_name, 'quantity', quantity, 'subtotal', subtotal::float) ORDER BY id)
                          FROM sale_items WHERE sale_id = s.id), '[]') AS items,
                COALESCE((SELECT json_agg(DISTINCT method) FROM sale_payments WHERE sale_id = s.id), '[]') AS methods
         FROM sales s WHERE s.customer_id = $1
         ORDER BY s.created_at DESC LIMIT 50`, [id]),
      // Pedidos web: se buscan por teléfono (en la web se escribe de cualquier forma)
      c.phone
        ? pool.query(
            `SELECT id, created_at, total::float AS total, status, sale_type, phone,
                    jsonb_array_length(items) AS lines
             FROM orders
             WHERE RIGHT(regexp_replace(phone, '\\D', '', 'g'), 6) = RIGHT($1, 6)
             ORDER BY created_at DESC LIMIT 50`, [c.phone])
        : Promise.resolve({ rows: [] as any[] }),
    ]);

    const webOrders = web.rows
      .filter((o) => samePhone(o.phone, c.phone))
      .map(({ phone, ...o }) => o);

    return NextResponse.json({ customer: c, stats: stats.rows[0], top: top.rows, sales: sales.rows, webOrders });
  } catch (e) { return errorResponse(e); }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const unauth = requireUser(req); if (unauth) return unauth;
  try {
    const id = parseId((await params).id);
    const b = await req.json().catch(() => ({}));

    // Solo activar / desactivar
    if (typeof b.active === "boolean" && Object.keys(b).length === 1) {
      const { rows: [c] } = await pool.query(
        `UPDATE customers SET active = $2 WHERE id = $1 RETURNING ${COLS}`, [id, b.active]);
      if (!c) throw new PosError("El cliente no existe", 404);
      return NextResponse.json(c);
    }

    const f = customerFields(b);
    await checkCustomerDuplicates(pool, f, id);
    const { rows: [c] } = await pool.query(
      `UPDATE customers SET name = $2, phone = $3, email = $4, dni_cuit = $5, address = $6, customer_type = $7, notes = $8, city = $9
       WHERE id = $1 RETURNING ${COLS}`,
      [id, f.name, f.phone, f.email, f.dni_cuit, f.address, f.customer_type, f.notes, f.city]
    );
    if (!c) throw new PosError("El cliente no existe", 404);
    return NextResponse.json(c);
  } catch (e) { return errorResponse(e); }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const unauth = requireUser(req); if (unauth) return unauth;
  try {
    const id = parseId((await params).id);
    const { rows: [u] } = await pool.query(`SELECT EXISTS (SELECT 1 FROM sales WHERE customer_id = $1) AS used`, [id]);
    if (u.used) {
      const { rowCount } = await pool.query(`UPDATE customers SET active = FALSE WHERE id = $1`, [id]);
      if (!rowCount) throw new PosError("El cliente no existe", 404);
      return NextResponse.json({ ok: true, deactivated: true });
    }
    const { rowCount } = await pool.query(`DELETE FROM customers WHERE id = $1`, [id]);
    if (!rowCount) throw new PosError("El cliente no existe", 404);
    return NextResponse.json({ ok: true, deleted: true });
  } catch (e) { return errorResponse(e); }
}
