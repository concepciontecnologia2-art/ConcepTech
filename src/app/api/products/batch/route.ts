// POST → importación masiva desde Excel (solo admin)
// { updates: [{ id, price_retail, price_wholesale, stock_quantity, stock_level, available }],
//   creates: [{ name, category_id, price_retail, price_wholesale, stock_quantity, stock_level, available }] }
// Los cambios de stock quedan registrados en stock_movements.
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/pos";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const unauth = requireAdmin(req); if (unauth) return unauth;

  const b = await req.json().catch(() => ({}));
  const updates: any[] = Array.isArray(b.updates) ? b.updates : [];
  const creates: any[] = Array.isArray(b.creates) ? b.creates : [];
  const stockOf = (v: unknown) => Math.max(0, Math.trunc(Number(v) || 0));

  let updated = 0; let created = 0; let err = 0;
  const client = await pool.connect();
  try {
    for (const p of updates) {
      try {
        await client.query("BEGIN");
        const { rows: [prev] } = await client.query(
          `SELECT stock_quantity FROM products WHERE id = $1 FOR UPDATE`, [p.id]
        );
        if (!prev) throw new Error("no existe");
        const qty = stockOf(p.stock_quantity);
        await client.query(
          `UPDATE products SET price_retail=$1, price_wholesale=$2, stock_quantity=$3, stock_level=$4, available=$5 WHERE id=$6`,
          [p.price_retail, p.price_wholesale, qty, p.stock_level, p.available, p.id]
        );
        if (qty !== prev.stock_quantity) {
          await client.query(
            `INSERT INTO stock_movements (product_id, quantity_change, stock_before, stock_after, type, notes)
             VALUES ($1, $2, $3, $4, 'adjustment', 'Importación Excel')`,
            [p.id, qty - prev.stock_quantity, prev.stock_quantity, qty]
          );
        }
        await client.query("COMMIT");
        updated++;
      } catch {
        await client.query("ROLLBACK").catch(() => {});
        err++;
      }
    }

    for (const p of creates) {
      try {
        const qty = stockOf(p.stock_quantity);
        const { rows: [np] } = await client.query(
          `INSERT INTO products (name,description,category_id,price_retail,price_wholesale,stock_quantity,stock_level,available,featured,is_offer,is_new,image_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,false,false,null) RETURNING id`,
          [p.name, "", p.category_id, p.price_retail, p.price_wholesale, qty, p.stock_level, p.available]
        );
        if (qty > 0) {
          await client.query(
            `INSERT INTO stock_movements (product_id, quantity_change, stock_before, stock_after, type, notes)
             VALUES ($1, $2, 0, $2, 'adjustment', 'Alta por importación Excel')`,
            [np.id, qty]
          );
        }
        created++;
      } catch { err++; }
    }
  } finally {
    client.release();
  }

  if (updated || created) revalidateTag("products");
  return NextResponse.json({ updated, created, err });
}
