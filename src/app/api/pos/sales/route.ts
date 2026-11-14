// (lo usan el admin y los vendedores)
// GET  ?session_id= → ventas de una sesión (por defecto, la caja abierta)
// POST → registrar venta de mostrador
//   { items: [{ product_id, quantity }], price_list: "retail"|"wholesale",
//     discount: number, payments: [{ method: "cash"|"transfer", amount }], customer_id?, notes? }
//
// Los precios SIEMPRE se toman de la base (nunca del navegador).
// Todo corre en una transacción: si falta stock de un producto, no se graba nada.
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSessionUser, getOwner } from "@/lib/auth";
import {
  requireUser, errorResponse, withTransaction, getOpenSessionId,
  PosError, toCents, fromCents,
} from "@/lib/pos";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const unauth = requireUser(req); if (unauth) return unauth;
  try {
    // Un vendedor solo ve las ventas de la caja abierta; el admin puede pedir una caja vieja
    const param = req.nextUrl.searchParams.get("session_id");
    if (param && !/^\d{1,9}$/.test(param)) throw new PosError("Caja inválida");
    const isAdmin = !!getOwner(req);
    const sessionId = param && isAdmin ? Number(param) : await getOpenSessionId(pool);
    if (!sessionId) return NextResponse.json([]);

    const { rows } = await pool.query(
      `SELECT s.id, s.price_list, s.status, s.created_at, s.voided_at, s.void_reason, s.notes,
              s.customer_id, cu.name AS customer_name, s.seller_name,
              s.subtotal::float AS subtotal, s.discount::float AS discount, s.total::float AS total,
              COALESCE((
                SELECT json_agg(json_build_object(
                  'product_id', si.product_id, 'name', si.product_name, 'quantity', si.quantity,
                  'unit_price', si.unit_price::float, 'subtotal', si.subtotal::float
                ) ORDER BY si.id)
                FROM sale_items si WHERE si.sale_id = s.id
              ), '[]') AS items,
              COALESCE((
                SELECT json_agg(json_build_object('method', sp.method, 'amount', sp.amount::float) ORDER BY sp.id)
                FROM sale_payments sp WHERE sp.sale_id = s.id
              ), '[]') AS payments
       FROM sales s
       LEFT JOIN customers cu ON cu.id = s.customer_id
       WHERE s.cash_session_id = $1
       ORDER BY s.id DESC`,
      [sessionId]
    );
    return NextResponse.json(rows);
  } catch (e) { return errorResponse(e); }
}

type ItemIn = { product_id: number; quantity: number };
type PaymentIn = { method: "cash" | "transfer"; amount: number };

export async function POST(req: NextRequest) {
  const unauth = requireUser(req); if (unauth) return unauth;
  try {
    const b = await req.json().catch(() => ({}));

    // ── Validación de entrada ──
    const priceList = b.price_list === "wholesale" ? "wholesale" : "retail";
    if (!Array.isArray(b.items) || b.items.length === 0)
      throw new PosError("La venta no tiene productos");

    // Agrupa líneas repetidas del mismo producto
    const qtyById = new Map<number, number>();
    for (const it of b.items as ItemIn[]) {
      const id = Number(it.product_id);
      const qty = Number(it.quantity);
      if (!Number.isInteger(id) || id <= 0) throw new PosError("Producto inválido");
      if (!Number.isInteger(qty) || qty <= 0) throw new PosError("Cantidad inválida");
      qtyById.set(id, (qtyById.get(id) || 0) + qty);
    }
    const ids = [...qtyById.keys()];

    const payments: PaymentIn[] = (Array.isArray(b.payments) ? b.payments : [])
      .map((p: any) => ({ method: p.method, amount: Number(p.amount) }))
      .filter((p: PaymentIn) => p.amount > 0);
    for (const p of payments) {
      if (p.method !== "cash" && p.method !== "transfer") throw new PosError("Método de pago inválido");
      if (!Number.isFinite(p.amount)) throw new PosError("Monto de pago inválido");
    }

    const discountCents = toCents(b.discount || 0);
    if (!Number.isFinite(discountCents) || discountCents < 0) throw new PosError("Descuento inválido");

    // Cliente (opcional)
    let customerId: number | null = null;
    if (b.customer_id !== undefined && b.customer_id !== null && b.customer_id !== "") {
      customerId = Number(b.customer_id);
      if (!Number.isInteger(customerId) || customerId <= 0) throw new PosError("Cliente inválido");
      const { rows: [cu] } = await pool.query(`SELECT active FROM customers WHERE id = $1`, [customerId]);
      if (!cu) throw new PosError("El cliente elegido ya no existe", 404);
      if (!cu.active) throw new PosError("El cliente elegido está desactivado");
    }

    const seller = getSessionUser(req)?.name?.slice(0, 80) || null;

    // ── Transacción ──
    const sale = await withTransaction(async (c) => {
      // FOR SHARE: si alguien está cerrando la caja, espera
      const sessionId = await getOpenSessionId(c, "FOR SHARE");
      if (!sessionId) throw new PosError("No hay una caja abierta. Abrí la caja para vender.", 409);

      // Bloquea los productos (ordenados por id para evitar deadlocks)
      const { rows: products } = await c.query(
        `SELECT id, name, stock_quantity, price_retail, price_wholesale, cost_price
         FROM products WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE`,
        [ids]
      );
      if (products.length !== ids.length) throw new PosError("Uno de los productos ya no existe", 404);

      let subtotalCents = 0;
      const lines = products.map((p: any) => {
        const qty = qtyById.get(p.id)!;
        if (p.stock_quantity < qty)
          throw new PosError(`Stock insuficiente: ${p.name} (quedan ${p.stock_quantity})`, 409);
        const unitCents = toCents(priceList === "wholesale" ? p.price_wholesale : p.price_retail);
        const lineCents = unitCents * qty;
        subtotalCents += lineCents;
        return { p, qty, unitCents, lineCents };
      });

      if (discountCents > subtotalCents) throw new PosError("El descuento no puede superar el subtotal");
      const totalCents = subtotalCents - discountCents;

      const paidCents = payments.reduce((s, p) => s + toCents(p.amount), 0);
      if (paidCents !== totalCents)
        throw new PosError(
          `Los pagos ($${fromCents(paidCents).toLocaleString("es-AR")}) no coinciden con el total ($${fromCents(totalCents).toLocaleString("es-AR")})`
        );

      const { rows: [s] } = await c.query(
        `INSERT INTO sales (cash_session_id, customer_id, price_list, subtotal, discount, total, notes, seller_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, created_at`,
        [sessionId, customerId, priceList,
         fromCents(subtotalCents), fromCents(discountCents), fromCents(totalCents),
         b.notes ? String(b.notes).slice(0, 500) : null, seller]
      );

      for (const l of lines) {
        await c.query(
          `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal, unit_cost)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [s.id, l.p.id, l.p.name, l.qty, fromCents(l.unitCents), fromCents(l.lineCents), l.p.cost_price]
        );
        const { rows: [u] } = await c.query(
          `UPDATE products SET stock_quantity = stock_quantity - $1
           WHERE id = $2 RETURNING stock_quantity`,
          [l.qty, l.p.id]
        );
        await c.query(
          `INSERT INTO stock_movements (product_id, quantity_change, stock_before, stock_after, type, reference_id)
           VALUES ($1, $2, $3, $4, 'sale_pos', $5)`,
          [l.p.id, -l.qty, l.p.stock_quantity, u.stock_quantity, s.id]
        );
      }

      for (const p of payments) {
        await c.query(
          `INSERT INTO sale_payments (sale_id, method, amount) VALUES ($1, $2, $3)`,
          [s.id, p.method, fromCents(toCents(p.amount))]
        );
      }

      return { id: s.id as number, created_at: s.created_at, total: fromCents(totalCents) };
    });

    return NextResponse.json(sale, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
