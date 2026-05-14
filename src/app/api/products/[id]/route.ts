import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
export const dynamic = "force-dynamic";

type P = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: P) {
  const { id } = await params;
  const product = await queryOne(
    `SELECT p.*, c.name AS category_name, c.icon AS category_icon
     FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.id = $1`,
    [id]
  );
  if (!product) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(product);
}

export async function PATCH(req: NextRequest, { params }: P) {
  const cookie = req.cookies.get("ct_admin");
  if (cookie?.value !== process.env.SESSION_SECRET)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const b = await req.json();
  const fields = Object.keys(b);
  const vals = Object.values(b).map(v => {
    if (v === "true") return true;
    if (v === "false") return false;
    return v;
  });
  const set = fields.map((f,i)=>`${f}=$${i+1}`).join(", ");
  const product = await queryOne(
    `UPDATE products SET ${set} WHERE id=$${fields.length+1} RETURNING *`,
    [...vals, id]
  );
  if (!product) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(product);
}

export async function DELETE(req: NextRequest, { params }: P) {
  const cookie = req.cookies.get("ct_admin");
  if (cookie?.value !== process.env.SESSION_SECRET)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  await queryOne(`DELETE FROM products WHERE id=$1`, [id]);
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest, { params }: P) {
  const cookie = req.cookies.get("ct_admin");
  if (cookie?.value !== process.env.SESSION_SECRET)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const b = await req.json();
  const product = await queryOne(
    `UPDATE products SET name=$1,description=$2,price_retail=$3,price_wholesale=$4,
     available=$5,featured=$6,is_offer=$7,is_new=$8,stock_level=$9,image_url=$10,stock_quantity=$11
     WHERE id=$12 RETURNING *`,
    [b.name,b.description,b.price_retail,b.price_wholesale,b.available,b.featured,b.is_offer,b.is_new,b.stock_level,b.image_url,b.stock_quantity,id]
  );
  return NextResponse.json(product);
}