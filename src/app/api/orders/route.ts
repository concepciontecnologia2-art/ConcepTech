// GET  → lista de pedidos web (solo admin)
// POST → nuevo pedido desde la tienda (minorista o mayorista)
//
// Los precios y el total se calculan acá con los precios de la base:
// lo que mande el navegador se ignora. Si no hay stock suficiente,
// el pedido se rechaza y no se descuenta nada.
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin, errorResponse, withTransaction, PosError, toCents, fromCents } from "@/lib/pos";
import { limitByIp } from "@/lib/ratelimit";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const unauth = requireAdmin(req); if (unauth) return unauth;
  const orders = await query(`SELECT * FROM orders ORDER BY created_at DESC`);
  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  // Máximo 6 pedidos cada 10 minutos por IP (evita que vacíen el stock con pedidos falsos)
  const limited = await limitByIp(req, "order", 6, 10 * 60);
  if (limited) return limited;

  try {
    const b = await req.json().catch(() => ({}));

    const customerName = String(b.customer_name || "").trim().slice(0, 100);
    const phone = String(b.phone || "").trim().slice(0, 30);
    const phoneDigits = phone.replace(/\D/g, "");
    if (!customerName || !phone || !Array.isArray(b.items) || b.items.length === 0)
      throw new PosError("Datos incompletos");
    if (customerName.length < 2) throw new PosError("Ingresá tu nombre");
    if (phoneDigits.length < 6 || phoneDigits.length > 15) throw new PosError("Ingresá un teléfono válido");
    if (b.items.length > 50) throw new PosError("El pedido tiene demasiados productos");
    const saleType = b.sale_type === "wholesale" ? "wholesale" : "retail";
    const deliveryType = b.delivery_type === "delivery" ? "delivery" : "pickup";
    const address = deliveryType === "delivery" ? String(b.address || "").trim().slice(0, 300) : null;
    if (deliveryType === "delivery" && !address) throw new PosError("Falta la dirección de envío");

    // Agrupa productos repetidos y valida cantidades
    const qtyById = new Map<number, number>();
    for (const it of b.items) {
      const id = Number(it.id);
      const qty = Number(it.qty);
      if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(qty) || qty <= 0 || qty > 200)
        throw new PosError("Hay un producto con cantidad inválida");
      qtyById.set(id, (qtyById.get(id) || 0) + qty);
    }
    const ids = [...qtyById.keys()];

    const order = await withTransaction(async (c) => {
      const { rows: products } = await c.query(
        `SELECT id, name, available, stock_quantity, price_retail, price_wholesale
         FROM products WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE`,
        [ids]
      );
      if (products.length !== ids.length) throw new PosError("Uno de los productos ya no está disponible", 409);

      let totalCents = 0;
      const items = products.map((p: any) => {
        const qty = qtyById.get(p.id)!;
        if (!p.available) throw new PosError(`${p.name} ya no está disponible`, 409);
        if (p.stock_quantity < qty)
          throw new PosError(
            p.stock_quantity === 0
              ? `${p.name} se quedó sin stock`
              : `Solo quedan ${p.stock_quantity} unidades de ${p.name}`,
            409
          );
        const priceCents = toCents(saleType === "wholesale" ? p.price_wholesale : p.price_retail);
        totalCents += priceCents * qty;
        // Mismo formato que ya usa el panel: { id, name, qty, price }
        return { id: p.id, name: p.name, qty, price: fromCents(priceCents), stock_before: p.stock_quantity };
      });

      const { rows: [o] } = await c.query(
        `INSERT INTO orders (customer_name, phone, email, sale_type, delivery_type, address, items, total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [customerName, phone, typeof b.email === "string" && b.email ? b.email.slice(0, 150) : null, saleType, deliveryType, address,
         JSON.stringify(items.map(({ stock_before, ...i }) => i)), fromCents(totalCents)]
      );

      for (const it of items) {
        await c.query(`UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2`, [it.qty, it.id]);
        await c.query(
          `INSERT INTO stock_movements (product_id, quantity_change, stock_before, stock_after, type, reference_id)
           VALUES ($1, $2, $3, $4, 'sale_web', $5)`,
          [it.id, -it.qty, it.stock_before, it.stock_before - it.qty, o.id]
        );
      }
      return o;
    });

    return NextResponse.json(order, { status: 201 });
  } catch (e) { return errorResponse(e); }
}