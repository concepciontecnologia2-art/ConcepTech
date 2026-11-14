// POST { items: [{ product_id, quantity }], message }
//   → registra lo que se mandó al GRUPO de WhatsApp como pedido ENVIADO
//     (un registro por proveedor, para poder marcar "Llegó" por separado).
//   La pantalla ya abrió WhatsApp en el mismo clic; acá solo se guarda.
import { NextRequest, NextResponse } from "next/server";
import { requireUser, errorResponse, withTransaction, PosError } from "@/lib/pos";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const unauth = requireUser(req); if (unauth) return unauth;
  try {
    const b = await req.json().catch(() => ({}));
    if (!Array.isArray(b.items) || b.items.length === 0) throw new PosError("El pedido está vacío");
    if (b.items.length > 500) throw new PosError("Demasiados productos en un pedido");
    const message = typeof b.message === "string" ? b.message.slice(0, 6000) : null;

    const wanted = new Map<number, number>();
    for (const it of b.items) {
      const id = Number(it?.product_id), q = Number(it?.quantity);
      if (!Number.isInteger(id) || id <= 0) throw new PosError("Producto inválido");
      if (!Number.isInteger(q) || q <= 0 || q > 9999) throw new PosError("Cantidad inválida");
      wanted.set(id, (wanted.get(id) || 0) + q);
    }

    const result = await withTransaction(async (db) => {
      const { rows: prods } = await db.query(
        `SELECT id, name, supplier_id FROM products WHERE id = ANY($1::int[]) ORDER BY name`, [[...wanted.keys()]]);
      if (prods.length !== wanted.size) throw new PosError("Algún producto ya no existe");

      // Un pedido por proveedor (los sin proveedor van juntos)
      const groups = new Map<number | null, any[]>();
      for (const p of prods) {
        const k = p.supplier_id ?? null;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(p);
      }
      const ids: number[] = [];
      for (const [supplierId, list] of groups) {
        let o: any;
        try {
          ({ rows: [o] } = await db.query(
            `INSERT INTO supplier_orders (supplier_id, status, message_text, notes, sent_at) VALUES ($1, 'sent', $2, 'Enviado al grupo', NOW())
             RETURNING id`, [supplierId, message]));
        } catch (e: any) {
          if (e?.code === "23502") throw new PosError("Falta correr sql/06_pedidos_al_grupo.sql para pedir productos sin proveedor", 500);
          throw e;
        }
        ids.push(o.id);
        for (const p of list)
          await db.query(`INSERT INTO supplier_order_items (order_id, product_id, product_name, quantity) VALUES ($1, $2, $3, $4)`,
            [o.id, p.id, p.name, wanted.get(p.id)]);
      }
      return { orders: ids, products: prods.length };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
