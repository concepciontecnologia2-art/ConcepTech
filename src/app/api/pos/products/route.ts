// GET ?q=funda samsung → búsqueda rápida para el mostrador
// Cada palabra tiene que aparecer en el nombre o el SKU (en cualquier orden).
// También acepta el ID exacto del producto.
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/pos";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const unauth = requireUser(req); if (unauth) return unauth;
  try {
    const q = (req.nextUrl.searchParams.get("q") || "").trim();
    if (!q) return NextResponse.json([]);

    const terms = q.split(/\s+/).filter(Boolean).slice(0, 6);
    const params: unknown[] = [];
    const conds = terms.map((t) => {
      params.push(`%${t.replace(/[\\%_]/g, (m) => "\\" + m)}%`);
      const i = params.length;
      return `(p.name ILIKE $${i} OR COALESCE(p.sku, '') ILIKE $${i})`;
    });

    let where = conds.join(" AND ");
    if (/^\d+$/.test(q)) {
      params.push(Number(q));
      where = `(${where}) OR p.id = $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.sku, p.image_url, p.available, p.stock_quantity,
              p.price_retail::float    AS price_retail,
              p.price_wholesale::float AS price_wholesale,
              c.name AS category_name
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE ${where}
       ORDER BY (p.stock_quantity > 0) DESC, p.name
       LIMIT 25`,
      params
    );
    return NextResponse.json(rows);
  } catch (e) { return errorResponse(e); }
}
