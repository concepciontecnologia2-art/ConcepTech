// PATCH → actualizar un pedido web (solo admin)
// Solo se pueden modificar los campos de la lista. Si el pedido pasa a
// "cancelado" se devuelve el stock; si se reactiva, se vuelve a descontar.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, errorResponse, withTransaction, PosError } from "@/lib/pos";
export const dynamic = "force-dynamic";

type P = { params: Promise<{ id: string }> };

const EDITABLE = ["status", "paid", "customer_name", "phone", "email", "address", "delivery_type"] as const;
const STATUSES = ["pending", "confirmed", "completed", "cancelled"];

export async function PATCH(req: NextRequest, { params }: P) {
  const unauth = requireAdmin(req); if (unauth) return unauth;
  try {
    const { id } = await params;
    const orderId = Number(id);
    if (!Number.isInteger(orderId)) throw new PosError("Pedido inválido");
    const b = await req.json().catch(() => ({}));

    const fields: string[] = [];
    const vals: unknown[] = [];
    for (const f of EDITABLE) {
      if (!(f in b)) continue;
      let v = b[f];
      if (v === "true") v = true;
      if (v === "false") v = false;
      if (f === "status" && !STATUSES.includes(v)) throw new PosError("Estado inválido");
      if (f === "paid") v = !!v;
      vals.push(v);
      fields.push(`${f} = $${vals.length}`);
    }
    if (fields.length === 0) throw new PosError("No hay cambios para guardar");

    const order = await withTransaction(async (c) => {
      const { rows: [prev] } = await c.query(`SELECT * FROM orders WHERE id = $1 FOR UPDATE`, [orderId]);
      if (!prev) throw new PosError("No encontrado", 404);

      const wasCancelled = prev.status === "cancelled";
      const willCancel = b.status === "cancelled";
      const items: { id: number; qty: number; name: string }[] = Array.isArray(prev.items) ? prev.items : [];

      if ("status" in b && wasCancelled !== willCancel && items.length) {
        // Cancelar → devuelve stock. Reactivar → lo vuelve a descontar (si alcanza).
        const sorted = [...items].filter((i) => Number(i.id) > 0).sort((a, z) => Number(a.id) - Number(z.id));
        for (const it of sorted) {
          const qty = Number(it.qty) || 0;
          if (qty <= 0) continue;
          const delta = willCancel ? qty : -qty;
          const { rows: [u] } = await c.query(
            `UPDATE products SET stock_quantity = stock_quantity + $1
             WHERE id = $2 AND stock_quantity + $1 >= 0
             RETURNING stock_quantity`,
            [delta, Number(it.id)]
          );
          if (!u) {
            const { rows: [exists] } = await c.query(`SELECT stock_quantity FROM products WHERE id = $1`, [Number(it.id)]);
            if (!exists) continue; // producto borrado
            throw new PosError(`No hay stock para reactivar el pedido: ${it.name} (quedan ${exists.stock_quantity})`, 409);
          }
          await c.query(
            `INSERT INTO stock_movements (product_id, quantity_change, stock_before, stock_after, type, reference_id, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [Number(it.id), delta, u.stock_quantity - delta, u.stock_quantity,
             willCancel ? "void" : "sale_web", orderId,
             willCancel ? "Pedido web cancelado" : "Pedido web reactivado"]
          );
        }
      }

      vals.push(orderId);
      const { rows: [o] } = await c.query(
        `UPDATE orders SET ${fields.join(", ")} WHERE id = $${vals.length} RETURNING *`,
        vals
      );
      return o;
    });

    return NextResponse.json(order);
  } catch (e) { return errorResponse(e); }
}