// GET    → ficha del proveedor con sus productos (stock, mínimo, costo)
// PATCH  → editar datos  { name, whatsapp, ... }  o  { active: true|false }
// DELETE → borrar (si ya tiene pedidos o facturas cargadas, se desactiva)
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireUser, errorResponse, PosError } from "@/lib/pos";
import { parseId, supplierFields, checkSupplierDuplicates } from "@/lib/crm";
import { isAdminRequest } from "@/lib/auth";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const COLS = `id, name, contact_name, whatsapp, phone, email, cuit, address, notes, active, created_at, updated_at`;

export async function GET(req: NextRequest, { params }: Ctx) {
  const unauth = requireUser(req); if (unauth) return unauth;
  try {
    const id = parseId((await params).id);
    const { rows: [s] } = await pool.query(`SELECT ${COLS} FROM suppliers WHERE id = $1`, [id]);
    if (!s) throw new PosError("El proveedor no existe", 404);

    const { rows: products } = await pool.query(
      `SELECT p.id, p.name, p.sku, p.image_url, p.available, p.stock_quantity, p.min_stock,
              p.cost_price::float AS cost_price, p.price_retail::float AS price_retail,
              c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.supplier_id = $1
       ORDER BY (p.min_stock > 0 AND p.stock_quantity <= p.min_stock) DESC, p.stock_quantity ASC, p.name`,
      [id]
    );
    // El costo de los productos solo lo ve el administrador
    if (!isAdminRequest(req)) for (const p of products) p.cost_price = null;
    return NextResponse.json({ supplier: s, products });
  } catch (e) { return errorResponse(e); }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const unauth = requireUser(req); if (unauth) return unauth;
  try {
    const id = parseId((await params).id);
    const b = await req.json().catch(() => ({}));

    if (typeof b.active === "boolean" && Object.keys(b).length === 1) {
      const { rows: [s] } = await pool.query(
        `UPDATE suppliers SET active = $2 WHERE id = $1 RETURNING ${COLS}`, [id, b.active]);
      if (!s) throw new PosError("El proveedor no existe", 404);
      return NextResponse.json(s);
    }

    const f = supplierFields(b);
    await checkSupplierDuplicates(pool, f.name, id);
    const { rows: [s] } = await pool.query(
      `UPDATE suppliers SET name = $2, contact_name = $3, whatsapp = $4, phone = $5, email = $6, cuit = $7, address = $8, notes = $9
       WHERE id = $1 RETURNING ${COLS}`,
      [id, f.name, f.contact_name, f.whatsapp, f.phone, f.email, f.cuit, f.address, f.notes]
    );
    if (!s) throw new PosError("El proveedor no existe", 404);
    return NextResponse.json(s);
  } catch (e) { return errorResponse(e); }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const unauth = requireUser(req); if (unauth) return unauth;
  try {
    const id = parseId((await params).id);
    const { rows: [u] } = await pool.query(
      `SELECT EXISTS (SELECT 1 FROM supplier_orders WHERE supplier_id = $1)
           OR EXISTS (SELECT 1 FROM purchase_invoices WHERE supplier_id = $1) AS used`, [id]);
    if (u.used) {
      const { rowCount } = await pool.query(`UPDATE suppliers SET active = FALSE WHERE id = $1`, [id]);
      if (!rowCount) throw new PosError("El proveedor no existe", 404);
      return NextResponse.json({ ok: true, deactivated: true });
    }
    // Los productos quedan sin proveedor (ON DELETE SET NULL)
    const { rowCount } = await pool.query(`DELETE FROM suppliers WHERE id = $1`, [id]);
    if (!rowCount) throw new PosError("El proveedor no existe", 404);
    return NextResponse.json({ ok: true, deleted: true });
  } catch (e) { return errorResponse(e); }
}
