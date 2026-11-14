// GET ?phone= → "Mis pedidos" del mayorista
// Solo devuelve lo que muestra la pantalla (número, fecha, productos,
// total y estado). NO devuelve nombre, teléfono, dirección ni email,
// así nadie puede sacar datos personales probando teléfonos.
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { limitByIp } from "@/lib/ratelimit";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limited = await limitByIp(req, "historial", 30, 10 * 60);
  if (limited) return limited;

  const phone = (req.nextUrl.searchParams.get("phone") || "").trim().slice(0, 30);
  if (phone.replace(/\D/g, "").length < 6) return NextResponse.json([]);

  const orders = await query(
    `SELECT id, created_at, items, total, status
     FROM orders WHERE phone = $1 AND sale_type = 'wholesale'
     ORDER BY created_at DESC LIMIT 20`,
    [phone]
  );
  // items solo con nombre, cantidad y precio
  const safe = orders.map((o: any) => ({
    ...o,
    items: Array.isArray(o.items) ? o.items.map((i: any) => ({ id: i.id, name: i.name, qty: i.qty, price: i.price })) : [],
  }));
  return NextResponse.json(safe, { headers: { "Cache-Control": "no-store" } });
}