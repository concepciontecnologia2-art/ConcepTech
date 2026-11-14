// POST { phone, name?, customer_id? } → guarda el número al que se mandó el ticket por WhatsApp,
//   para no tener que escribirlo la próxima vez:
//   • si la venta ya tiene cliente sin teléfono → se le guarda el teléfono
//   • si no tiene cliente: se usa el cliente elegido, o el que ya tenga ese número,
//     o se crea uno nuevo si se escribió un nombre; y la venta queda a nombre de ese cliente.
import { NextRequest, NextResponse } from "next/server";
import { requireUser, errorResponse, withTransaction, PosError } from "@/lib/pos";
import { normalizePhone, optText } from "@/lib/crm";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const unauth = requireUser(req); if (unauth) return unauth;
  try {
    const raw = (await params).id;
    if (!/^\d{1,9}$/.test(raw)) throw new PosError("Venta inválida", 404);
    const saleId = Number(raw);
    const b = await req.json().catch(() => ({}));
    const phone = normalizePhone(b.phone, "El WhatsApp");
    if (!phone) throw new PosError("Falta el número");
    const name = optText(b.name, 150);
    const wanted = Number(b.customer_id) || null;

    const result = await withTransaction(async (db) => {
      const { rows: [sale] } = await db.query(`SELECT id, customer_id FROM sales WHERE id = $1 FOR UPDATE`, [saleId]);
      if (!sale) throw new PosError("La venta no existe", 404);

      let cid: number | null = sale.customer_id;
      let created = false;
      if (!cid && wanted) {
        const { rows: [c] } = await db.query(`SELECT id FROM customers WHERE id = $1`, [wanted]);
        cid = c?.id ?? null;
      }
      if (!cid) {
        const { rows: [c] } = await db.query(`SELECT id FROM customers WHERE phone = $1 ORDER BY active DESC, id LIMIT 1`, [phone]);
        cid = c?.id ?? null;
      }
      if (!cid && name && name.length >= 2) {
        const { rows: [c] } = await db.query(
          `INSERT INTO customers (name, phone, customer_type, notes) VALUES ($1, $2, 'retail', 'Guardado al enviar un ticket por WhatsApp') RETURNING id`,
          [name, phone]);
        cid = c.id; created = true;
      }
      if (cid) {
        if (!sale.customer_id) await db.query(`UPDATE sales SET customer_id = $1 WHERE id = $2 AND customer_id IS NULL`, [cid, saleId]);
        await db.query(`UPDATE customers SET phone = $1, updated_at = NOW() WHERE id = $2 AND (phone IS NULL OR phone = '')`, [phone, cid]);
      }
      return { customer_id: cid, created };
    });
    return NextResponse.json(result);
  } catch (e) { return errorResponse(e); }
}
