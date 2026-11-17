// AJUSTAR PRECIOS EN BLOQUE — POST /api/products/ajustar (solo administrador)
// { pct, category_id? | supplier_id? | product_id? }  → sube o baja minorista y mayorista ese %.
// Sin ninguno de los tres: todos los artículos. Se hace en UNA sola consulta (antes era una por artículo).
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { pool } from "@/lib/db";
import { requireAdmin, errorResponse, PosError } from "@/lib/pos";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const unauth = requireAdmin(req); if (unauth) return unauth;
  try {
    const b = await req.json().catch(() => ({}));
    const pct = Number(b.pct);
    if (!Number.isFinite(pct) || pct === 0 || pct <= -100 || pct > 1000) throw new PosError("Porcentaje inválido");

    const params: unknown[] = [1 + pct / 100];
    let where = "TRUE";
    if (b.product_id)       { params.push(Number(b.product_id));  where = `id = $2`; }
    else if (b.supplier_id) { params.push(Number(b.supplier_id)); where = `supplier_id = $2`; }
    else if (b.category_id) { params.push(Number(b.category_id)); where = `category_id = $2`; }

    const { rowCount } = await pool.query(
      `UPDATE products
          SET price_retail    = ROUND(price_retail * $1),
              price_wholesale = ROUND(price_wholesale * $1)
        WHERE ${where}`,
      params
    );
    revalidateTag("products");
    return NextResponse.json({ ok: true, updated: rowCount ?? 0 });
  } catch (e) { return errorResponse(e); }
}
