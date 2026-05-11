import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const cookie = req.cookies.get("ct_admin");
  if (cookie?.value !== process.env.SESSION_SECRET)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const orders = await query(`SELECT * FROM orders ORDER BY created_at DESC`);
  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  if (!b.customer_name || !b.phone || !b.items?.length)
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });

  // Descontar stock
  for (const item of b.items) {
    await query(
      `UPDATE products SET stock_quantity = GREATEST(stock_quantity - $1, 0) WHERE id = $2`,
      [item.qty, item.id]
    );
  }

  const [order] = await query(
    `INSERT INTO orders (customer_name,phone,email,sale_type,delivery_type,address,items,total)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [b.customer_name,b.phone,b.email||null,b.sale_type,b.delivery_type,b.address||null,JSON.stringify(b.items),b.total]
  );
  return NextResponse.json(order, { status: 201 });
}