// GET  → últimas compras cargadas
// POST → confirmar una compra: suma stock, actualiza costos (y precios si se pidió),
//        crea los artículos nuevos y deja todo registrado.
// {
//   supplier_id?, invoice_number?, invoice_date?, total?, ai_raw?, notes?,
//   iva_pct?: 21          → se suma al costo (para facturas A, que vienen sin IVA)
//   prices: { mode: "keep" | "pct", retail_pct?, wholesale_pct? },
//   close_orders?: true   → marca como recibidos los pedidos enviados a ese proveedor
//   lines: [{ raw_description, quantity, unit_cost,
//             product_id?                                   → artículo existente
//             create?: { name, category_id }                → artículo nuevo
//             update_cost?: true }]
// }
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { pool } from "@/lib/db";
import { requireAdmin, errorResponse, withTransaction, PosError } from "@/lib/pos";
import { getAdmin } from "@/lib/auth";
export const dynamic = "force-dynamic";

const round10 = (n: number) => Math.round(n / 10) * 10;

export async function GET(req: NextRequest) {
  const unauth = requireAdmin(req); if (unauth) return unauth;
  try {
    const { rows } = await pool.query(
      `SELECT pi.id, pi.invoice_number, pi.invoice_date, pi.total::float AS total, pi.confirmed_at, pi.notes,
              s.name AS supplier_name,
              (SELECT COUNT(*)::int FROM purchase_invoice_items WHERE invoice_id = pi.id) AS lines,
              (SELECT COALESCE(SUM(quantity), 0)::int FROM purchase_invoice_items WHERE invoice_id = pi.id) AS units,
              (SELECT COALESCE(SUM(quantity * unit_cost), 0)::float FROM purchase_invoice_items WHERE invoice_id = pi.id) AS cost_total
       FROM purchase_invoices pi LEFT JOIN suppliers s ON s.id = pi.supplier_id
       WHERE pi.status = 'confirmed'
       ORDER BY pi.confirmed_at DESC LIMIT 50`
    );
    return NextResponse.json(rows);
  } catch (e) { return errorResponse(e); }
}

export async function POST(req: NextRequest) {
  const unauth = requireAdmin(req); if (unauth) return unauth;
  try {
    const b = await req.json().catch(() => ({}));
    if (!Array.isArray(b.lines) || b.lines.length === 0) throw new PosError("La compra no tiene productos");
    if (b.lines.length > 200) throw new PosError("Demasiados renglones");

    const supplierId = b.supplier_id ? Number(b.supplier_id) : null;
    if (supplierId !== null && (!Number.isInteger(supplierId) || supplierId <= 0)) throw new PosError("Proveedor inválido");
    const iva = Number(b.iva_pct) || 0;
    if (iva < 0 || iva > 50) throw new PosError("IVA inválido");
    const mode = b.prices?.mode === "pct" ? "pct" : "keep";
    const rPct = Number(b.prices?.retail_pct), wPct = Number(b.prices?.wholesale_pct);
    // Los % se usan para recalcular (modo pct) y SIEMPRE para ponerle precio a los artículos nuevos
    const anyCreate = b.lines.some((l: any) => l?.create && !l?.product_id);
    if ((mode === "pct" || anyCreate) && (!Number.isFinite(rPct) || !Number.isFinite(wPct) || rPct < -50 || wPct < -50 || rPct > 1000 || wPct > 1000))
      throw new PosError("Revisá los % de ganancia");
    const date = typeof b.invoice_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.invoice_date) ? b.invoice_date : null;
    const rawJson = b.ai_raw ? JSON.stringify(b.ai_raw) : null;
    if (rawJson && rawJson.length > 200_000) throw new PosError("Datos de la IA demasiado grandes");

    const lines = b.lines.map((l: any, i: number) => {
      const n = i + 1;
      const quantity = Number(l?.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 99999) throw new PosError(`Renglón ${n}: cantidad inválida`);
      const unitCost = l?.unit_cost === null || l?.unit_cost === "" || l?.unit_cost === undefined ? null : Number(l.unit_cost);
      if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) throw new PosError(`Renglón ${n}: costo inválido`);
      const productId = l?.product_id ? Number(l.product_id) : null;
      const create = l?.create && !productId ? {
        name: String(l.create.name || "").replace(/\s+/g, " ").trim().slice(0, 255),
        category_id: Number(l.create.category_id),
        sku: typeof l.create.sku === "string" && l.create.sku.trim() ? l.create.sku.trim().slice(0, 60) : null,
      } : null;
      if (!productId && !create) throw new PosError(`Renglón ${n}: elegí un artículo o marcá "crear nuevo"`);
      if (create && (create.name.length < 2 || !Number.isInteger(create.category_id))) throw new PosError(`Renglón ${n}: el artículo nuevo necesita nombre y categoría`);
      if (create && !(unitCost && unitCost > 0)) throw new PosError(`Renglón ${n}: el artículo nuevo necesita costo`);
      return {
        raw: String(l?.raw_description || create?.name || "").slice(0, 500) || "—",
        quantity, unitCost: unitCost === null ? null : Math.round(unitCost * (1 + iva / 100) * 100) / 100,
        productId, create, updateCost: l?.update_cost !== false,
      };
    });

    const who = getAdmin(req)?.name || null;

    const result = await withTransaction(async (db) => {
      if (supplierId) {
        const { rows: [s] } = await db.query(`SELECT id FROM suppliers WHERE id = $1`, [supplierId]);
        if (!s) throw new PosError("El proveedor no existe", 404);
      }
      const { rows: [inv] } = await db.query(
        `INSERT INTO purchase_invoices (supplier_id, invoice_number, invoice_date, total, status, ai_raw, notes, confirmed_at)
         VALUES ($1, $2, $3, $4, 'confirmed', $5, $6, NOW()) RETURNING id`,
        [supplierId, b.invoice_number ? String(b.invoice_number).slice(0, 60) : null, date,
         Number.isFinite(Number(b.total)) && b.total !== null && b.total !== "" ? Number(b.total) : null,
         rawJson, [who ? `Cargó: ${who}` : null, b.notes ? String(b.notes).slice(0, 500) : null].filter(Boolean).join(" · ") || null]
      );

      let created = 0, updated = 0, units = 0;
      // Se bloquean los artículos en orden de id (evita choques con ventas simultáneas)
      const ids = [...new Set(lines.filter((l: any) => l.productId).map((l: any) => l.productId))].sort((a: any, b: any) => a - b);
      const { rows: locked } = ids.length
        ? await db.query(`SELECT id, stock_quantity FROM products WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE`, [ids])
        : { rows: [] as any[] };
      const stock = new Map<number, number>(locked.map((r: any) => [r.id, r.stock_quantity]));
      if (stock.size !== ids.length) throw new PosError("Algún artículo elegido ya no existe");

      for (const l of lines) {
        let pid = l.productId;
        if (l.create) {
          const cost = l.unitCost!;
          // El código de la factura queda como SKU, si ningún otro artículo lo usa
          const sku = l.create.sku && !(await db.query(`SELECT 1 FROM products WHERE sku = $1`, [l.create.sku])).rowCount ? l.create.sku : null;
          const { rows: [np] } = await db.query(
            `INSERT INTO products (name, category_id, price_retail, price_wholesale, cost_price, supplier_id, sku, stock_quantity, available, stock_level)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 0, TRUE, 'bajo') RETURNING id`,
            [l.create.name, l.create.category_id, round10(cost * (1 + rPct / 100)), round10(cost * (1 + wPct / 100)), cost, supplierId, sku]
          );
          pid = np.id; stock.set(pid, 0); created++;
        }
        const before = stock.get(pid)!;
        const after = before + l.quantity;
        stock.set(pid, after);

        const sets = [`stock_quantity = $2`, `available = TRUE`];
        const vals: unknown[] = [pid, after];
        if (l.unitCost !== null && l.unitCost > 0 && (l.updateCost || l.create)) {
          vals.push(l.unitCost); sets.push(`cost_price = $${vals.length}`);
          if (mode === "pct" && !l.create) {
            vals.push(round10(l.unitCost * (1 + rPct / 100))); sets.push(`price_retail = $${vals.length}`);
            vals.push(round10(l.unitCost * (1 + wPct / 100))); sets.push(`price_wholesale = $${vals.length}`);
          }
        }
        if (supplierId) { vals.push(supplierId); sets.push(`supplier_id = COALESCE(supplier_id, $${vals.length})`); }
        await db.query(`UPDATE products SET ${sets.join(", ")} WHERE id = $1`, vals);

        await db.query(
          `INSERT INTO stock_movements (product_id, quantity_change, stock_before, stock_after, type, reference_id, notes)
           VALUES ($1, $2, $3, $4, 'purchase', $5, $6)`,
          [pid, l.quantity, before, after, inv.id, `Compra #${inv.id}`]
        );
        await db.query(
          `INSERT INTO purchase_invoice_items (invoice_id, product_id, raw_description, quantity, unit_cost, subtotal, create_product)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [inv.id, pid, l.raw, l.quantity, l.unitCost, l.unitCost === null ? null : Math.round(l.unitCost * l.quantity * 100) / 100, !!l.create]
        );
        if (!l.create) updated++;
        units += l.quantity;
      }

      // Los pedidos por WhatsApp a ese proveedor quedan como recibidos
      let closed = 0;
      if (supplierId && b.close_orders) {
        closed = (await db.query(
          `UPDATE supplier_orders SET status = 'received', received_at = NOW() WHERE supplier_id = $1 AND status = 'sent'`, [supplierId]
        )).rowCount ?? 0;
      }
      return { id: inv.id, created, updated, units, closed_orders: closed };
    });

    revalidateTag("products");
    return NextResponse.json(result, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
