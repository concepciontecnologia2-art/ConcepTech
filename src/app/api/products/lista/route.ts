// LISTA PAGINADA DE ARTÍCULOS — GET /api/products/lista (usuarios con sesión)
// Para el panel: en vez de bajar todo el catálogo, trae de a poco y busca en la base.
//   ?q=        palabras a buscar (nombre, código o número; sin importar acentos)
//   ?cat=      nombre de la categoría
//   ?f=        all | sinstock | bajo | sinfoto | ocultos | constock
//   ?sort=     name (por defecto) | stock (menos stock primero) | stockdesc (más stock primero)
//   ?offset=   desde qué artículo (para "Mostrar más")
//   ?limit=    cuántos (por defecto 10, máximo 60)
// Devuelve { items, total, counts } — counts: cuántos hay en cada filtro con la búsqueda actual.
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/pos";
import { isAdminRequest } from "@/lib/auth";
export const dynamic = "force-dynamic";

const FILTROS: Record<string, string> = {
  sinstock: "p.stock_quantity <= 0",
  bajo:     "p.stock_quantity BETWEEN 1 AND 3",
  sinfoto:  "(p.image_url IS NULL OR p.image_url = '')",
  ocultos:  "NOT p.available",
  constock: "p.stock_quantity > 0",
};
const SIN_ACENTO = (col: string) => `translate(lower(${col}), 'áéíóúüñ', 'aeiouun')`;

export async function GET(req: NextRequest) {
  const unauth = requireUser(req); if (unauth) return unauth;
  try {
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") || "").trim().slice(0, 100);
    const cat = (sp.get("cat") || "").trim().slice(0, 100);
    const f = sp.get("f") || "all";
    const sort = sp.get("sort");
    const orden = sort === "stock" ? "p.stock_quantity ASC, p.name" : sort === "stockdesc" ? "p.stock_quantity DESC, p.name" : "p.name";
    const offset = Math.max(0, Math.min(100000, Number(sp.get("offset")) || 0));
    const limit = Math.max(1, Math.min(60, Number(sp.get("limit")) || 10));

    // Búsqueda + categoría (base de los contadores)
    const params: unknown[] = [];
    const conds: string[] = [];
    const words = q.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/\s+/).filter(Boolean).slice(0, 6);
    for (const w of words) {
      params.push(`%${w.replace(/[\\%_]/g, (m) => "\\" + m)}%`);
      const i = params.length;
      const idMatch = /^\d+$/.test(w) ? ` OR p.id = ${Number(w)}` : "";
      conds.push(`(${SIN_ACENTO("p.name")} LIKE $${i} OR lower(COALESCE(p.sku,'')) LIKE $${i}${idMatch})`);
    }
    if (cat) { params.push(cat); conds.push(`c.name = $${params.length}`); }
    const base = conds.length ? conds.join(" AND ") : "TRUE";
    const filtro = FILTROS[f] || "TRUE";

    const from = `FROM products p JOIN categories c ON c.id = p.category_id`;
    const [{ rows: [counts] }, { rows: items }] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS "all",
                COUNT(*) FILTER (WHERE ${FILTROS.sinstock})::int AS sinstock,
                COUNT(*) FILTER (WHERE ${FILTROS.bajo})::int     AS bajo,
                COUNT(*) FILTER (WHERE ${FILTROS.sinfoto})::int  AS sinfoto,
                COUNT(*) FILTER (WHERE ${FILTROS.ocultos})::int  AS ocultos,
                COUNT(*) FILTER (WHERE ${FILTROS.constock})::int AS constock,
                COUNT(*) FILTER (WHERE p.available)::int          AS visibles
         ${from} WHERE ${base}`, params),
      pool.query(
        `SELECT p.*, c.name AS category_name, c.icon AS category_icon, sc.name AS subcategory_name, s.name AS supplier_name
         ${from}
         LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
         LEFT JOIN suppliers s ON s.id = p.supplier_id
         WHERE ${base} AND ${filtro}
         ORDER BY ${orden}
         LIMIT ${limit} OFFSET ${offset}`, params),
    ]);

    if (!isAdminRequest(req)) for (const r of items) { delete r.cost_price; delete r.supplier_id; delete r.supplier_name; }
    const total = f in FILTROS ? counts[f] : counts.all;
    return NextResponse.json({ items, total, counts }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return errorResponse(e); }
}
