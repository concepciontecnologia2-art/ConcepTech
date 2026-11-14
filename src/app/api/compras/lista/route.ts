// ACTUALIZAR PRECIOS DESDE LA LISTA DEL PROVEEDOR (solo administrador)
// GET  ?ids=1,2,3 → costo y precios actuales (para los artículos elegidos a mano)
// POST { supplier_id?, iva_pct, prices: { mode: "cost" | "margin" | "pct", retail_pct?, wholesale_pct? },
//        items: [{ product_id, price }] }
//   cost   → solo cambia el precio de costo
//   margin → los precios de venta suben/bajan en la misma proporción que el costo (mantiene la ganancia)
//   pct    → precios de venta = costo nuevo + % de ganancia
//   Los cálculos se hacen acá con los valores de la base (no se confía en el navegador).
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { pool } from "@/lib/db";
import { requireAdmin, errorResponse, PosError } from "@/lib/pos";
import { getAdmin } from "@/lib/auth";
import { newSalePrice } from "@/lib/precios";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const unauth = requireAdmin(req); if (unauth) return unauth;
  try {
    const ids = (req.nextUrl.searchParams.get("ids") || "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 200);
    if (!ids.length) return NextResponse.json([]);
    const { rows } = await pool.query(
      `SELECT id, name, cost_price::float AS cost_price, price_retail::float AS price_retail, price_wholesale::float AS price_wholesale
       FROM products WHERE id = ANY($1::int[])`, [ids]);
    return NextResponse.json(rows);
  } catch (e) { return errorResponse(e); }
}

export async function POST(req: NextRequest) {
  const unauth = requireAdmin(req); if (unauth) return unauth;
  const client = await pool.connect();
  try {
    const b = await req.json().catch(() => ({}));
    const mode = b?.prices?.mode;
    if (!["cost", "margin", "pct"].includes(mode)) throw new PosError("Elegí qué hacer con los precios de venta");
    const rPct = Number(b.prices.retail_pct), wPct = Number(b.prices.wholesale_pct);
    if (mode === "pct" && (!Number.isFinite(rPct) || !Number.isFinite(wPct) || rPct < 0 || wPct < 0 || rPct > 1000 || wPct > 1000))
      throw new PosError("Revisá los % de ganancia");
    const iva = Number(b.iva_pct) || 0;
    if (iva < 0 || iva > 50) throw new PosError("IVA inválido");
    const supplierId = Number(b.supplier_id) || null;

    if (!Array.isArray(b.items) || !b.items.length) throw new PosError("No hay artículos para actualizar");
    if (b.items.length > 2000) throw new PosError("Demasiados artículos de una vez");
    const items = new Map<number, number>();
    for (const [i, it] of b.items.entries()) {
      const id = Number(it?.product_id), price = Number(it?.price);
      if (!Number.isInteger(id) || id <= 0) throw new PosError(`Renglón ${i + 1}: artículo inválido`);
      if (!Number.isFinite(price) || price <= 0 || price > 100_000_000) throw new PosError(`Renglón ${i + 1}: precio inválido`);
      if (items.has(id)) throw new PosError("Hay un artículo elegido dos veces");
      items.set(id, Math.round(price * (1 + iva / 100) * 100) / 100);
    }

    await client.query("BEGIN");
    if (supplierId) {
      const { rowCount } = await client.query(`SELECT 1 FROM suppliers WHERE id = $1`, [supplierId]);
      if (!rowCount) throw new PosError("El proveedor no existe");
    }
    const ids = [...items.keys()];
    const { rows } = await client.query(
      `SELECT id, cost_price::float AS cost_price, price_retail::float AS price_retail, price_wholesale::float AS price_wholesale
       FROM products WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE`, [ids]);
    if (rows.length !== ids.length) throw new PosError("Algún artículo elegido ya no existe");

    const upd = { id: [] as number[], cost: [] as number[], retail: [] as number[], wholesale: [] as (number | null)[] };
    let pricesChanged = 0, skipped = 0;
    for (const p of rows) {
      const cost = items.get(p.id)!;
      const np = newSalePrice(mode, p, cost, rPct, wPct);
      if (np.retail !== p.price_retail || np.wholesale !== p.price_wholesale) pricesChanged++;
      if (np.skipped) skipped++;
      upd.id.push(p.id); upd.cost.push(cost); upd.retail.push(np.retail); upd.wholesale.push(np.wholesale);
    }
    await client.query(
      `UPDATE products p SET cost_price = u.cost, price_retail = u.retail, price_wholesale = u.wholesale,
              supplier_id = COALESCE(p.supplier_id, $5::int), updated_at = NOW()
       FROM unnest($1::int[], $2::numeric[], $3::numeric[], $4::numeric[]) AS u(id, cost, retail, wholesale)
       WHERE p.id = u.id`,
      [upd.id, upd.cost, upd.retail, upd.wholesale, supplierId]);
    await client.query("COMMIT");

    const who = getAdmin(req)?.name || "admin";
    console.log(`[lista-precios] ${who}: ${rows.length} costos, ${pricesChanged} precios de venta (modo ${mode}, proveedor ${supplierId ?? "-"})`);
    revalidateTag("products");
    return NextResponse.json({ updated: rows.length, prices_changed: pricesChanged, skipped });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    return errorResponse(e);
  } finally { client.release(); }
}
