// GET  ?q=cargador&category=3&sin=1 → buscar productos para asignarle a este proveedor
//      (sin=1 → solo los que todavía no tienen proveedor)
// POST { add: [ids] }    → estos productos pasan a ser de este proveedor
// POST { remove: [ids] } → estos productos quedan sin proveedor
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireUser, errorResponse, PosError } from "@/lib/pos";
import { parseId, likeTerm } from "@/lib/crm";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const unauth = requireUser(req); if (unauth) return unauth;
  try {
    const id = parseId((await params).id);
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") || "").trim().slice(0, 100);
    const cat = sp.get("category");
    const onlyFree = sp.get("sin") === "1";

    const params2: unknown[] = [id];
    const conds = ["(p.supplier_id IS DISTINCT FROM $1)"];
    for (const t of q.split(/\s+/).filter(Boolean).slice(0, 6)) {
      params2.push(likeTerm(t));
      const i = params2.length;
      conds.push(`(p.name ILIKE $${i} OR COALESCE(p.sku,'') ILIKE $${i})`);
    }
    if (cat && /^\d{1,9}$/.test(cat)) { params2.push(Number(cat)); conds.push(`p.category_id = $${params2.length}`); }
    if (onlyFree) conds.push("p.supplier_id IS NULL");
    if (!q && !cat && !onlyFree) return NextResponse.json({ items: [], total: 0 });

    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.sku, p.image_url, p.stock_quantity, c.name AS category_name,
              s.name AS supplier_name, COUNT(*) OVER()::int AS total
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       WHERE ${conds.join(" AND ")}
       ORDER BY p.name
       LIMIT 200`,
      params2
    );
    return NextResponse.json({ items: rows.map(({ total, ...r }) => r), total: rows[0]?.total ?? 0 });
  } catch (e) { return errorResponse(e); }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const unauth = requireUser(req); if (unauth) return unauth;
  try {
    const id = parseId((await params).id);
    const b = await req.json().catch(() => ({}));
    const ids = (list: unknown) =>
      Array.isArray(list) ? [...new Set(list.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500) : [];
    const add = ids(b.add), remove = ids(b.remove);
    if (!add.length && !remove.length) throw new PosError("No elegiste productos");

    const { rows: [s] } = await pool.query(`SELECT id, active FROM suppliers WHERE id = $1`, [id]);
    if (!s) throw new PosError("El proveedor no existe", 404);

    let added = 0, removed = 0;
    if (add.length) {
      if (!s.active) throw new PosError("El proveedor está desactivado");
      added = (await pool.query(`UPDATE products SET supplier_id = $1 WHERE id = ANY($2::int[])`, [id, add])).rowCount ?? 0;
    }
    if (remove.length) {
      removed = (await pool.query(
        `UPDATE products SET supplier_id = NULL WHERE id = ANY($2::int[]) AND supplier_id = $1`, [id, remove])).rowCount ?? 0;
    }
    return NextResponse.json({ ok: true, added, removed });
  } catch (e) { return errorResponse(e); }
}
