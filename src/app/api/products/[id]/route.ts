// GET    → un producto (público)
// PATCH  → cambiar algunos campos (solo admin, campos permitidos)
// PUT    → guardar el formulario completo de edición (solo admin)
// DELETE → borrar (solo admin)
// Todo cambio de stock queda registrado en stock_movements como "adjustment".
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { queryOne } from "@/lib/db";
import { requireAdmin, errorResponse, withTransaction, PosError } from "@/lib/pos";
import { isAdminRequest } from "@/lib/auth";
export const dynamic = "force-dynamic";

type P = { params: Promise<{ id: string }> };

// Columnas que se pueden modificar desde el panel
const EDITABLE = new Set([
  "name", "description", "category_id", "subcategory_id", "price_retail", "price_wholesale",
  "available", "featured", "is_offer", "is_new", "stock_level", "stock_quantity", "image_url",
  "cost_price", "min_stock", "supplier_id", "sku",
]);

async function updateProduct(id: number, data: Record<string, unknown>, note: string) {
  const fields: string[] = [];
  const vals: unknown[] = [];
  for (const [k, raw] of Object.entries(data)) {
    if (!EDITABLE.has(k) || raw === undefined) continue;
    let v = raw;
    if (v === "true") v = true;
    if (v === "false") v = false;
    if (v === "" && k !== "name") v = null;
    if (k === "stock_quantity") {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0) throw new PosError("El stock debe ser un número entero mayor o igual a 0");
      v = n;
    }
    vals.push(v);
    fields.push(`${k} = $${vals.length}`);
  }
  if (fields.length === 0) throw new PosError("No hay cambios para guardar");

  return withTransaction(async (c) => {
    const { rows: [prev] } = await c.query(`SELECT stock_quantity FROM products WHERE id = $1 FOR UPDATE`, [id]);
    if (!prev) throw new PosError("No encontrado", 404);

    vals.push(id);
    const { rows: [p] } = await c.query(
      `UPDATE products SET ${fields.join(", ")} WHERE id = $${vals.length} RETURNING *`,
      vals
    );
    if (p.stock_quantity !== prev.stock_quantity) {
      await c.query(
        `INSERT INTO stock_movements (product_id, quantity_change, stock_before, stock_after, type, notes)
         VALUES ($1, $2, $3, $4, 'adjustment', $5)`,
        [id, p.stock_quantity - prev.stock_quantity, prev.stock_quantity, p.stock_quantity, note]
      );
    }
    return p;
  });
}

export async function GET(req: NextRequest, { params }: P) {
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const product = await queryOne(
    `SELECT p.*, c.name AS category_name, c.icon AS category_icon
     FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.id = $1`,
    [id]
  );
  if (!product) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  // El costo y el proveedor no se muestran en la tienda pública
  if (!isAdminRequest(req)) { delete (product as any).cost_price; delete (product as any).supplier_id; }
  return NextResponse.json(product);
}

export async function PATCH(req: NextRequest, { params }: P) {
  const unauth = requireAdmin(req); if (unauth) return unauth;
  try {
    const { id } = await params;
    const b = await req.json().catch(() => ({}));
    const r = await updateProduct(Number(id), b, "Edición rápida desde el panel");
    revalidateTag("products");
    return NextResponse.json(r);
  } catch (e) { return errorResponse(e); }
}

export async function PUT(req: NextRequest, { params }: P) {
  const unauth = requireAdmin(req); if (unauth) return unauth;
  try {
    const { id } = await params;
    const b = await req.json().catch(() => ({}));
    const data = {
      name: b.name, description: b.description, price_retail: b.price_retail, price_wholesale: b.price_wholesale,
      available: b.available, featured: b.featured, is_offer: b.is_offer, is_new: b.is_new,
      stock_level: b.stock_level, image_url: b.image_url, stock_quantity: b.stock_quantity,
      cost_price: b.cost_price === undefined ? undefined : (b.cost_price === "" || b.cost_price === null || Number(b.cost_price) <= 0 ? null : Number(b.cost_price)),
    };
    const r = await updateProduct(Number(id), data, "Edición desde el panel");
    revalidateTag("products");
    return NextResponse.json(r);
  } catch (e) { return errorResponse(e); }
}

export async function DELETE(req: NextRequest, { params }: P) {
  const unauth = requireAdmin(req); if (unauth) return unauth;
  const { id } = await params;
  await queryOne(`DELETE FROM products WHERE id = $1`, [id]);
  revalidateTag("products");
  return NextResponse.json({ ok: true });
}
