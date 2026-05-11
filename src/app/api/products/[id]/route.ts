import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

type P = { params: Promise<{ id: string }> };

function isAdmin(req: NextRequest) {
  return req.cookies.get("ct_admin")?.value === process.env.SESSION_SECRET;
}

export async function PUT(req: NextRequest, { params }: P) {
  if (!isAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const b = await req.json();
  const p = await queryOne(
    `UPDATE products SET name=$1,description=$2,category_id=$3,subcategory_id=$4,
     price_retail=$5,price_wholesale=$6,available=$7,featured=$8,is_offer=$9,
     is_new=$10,stock_level=$11,image_url=$12 WHERE id=$13 RETURNING *`,
    [b.name,b.description||null,b.category_id,b.subcategory_id||null,b.price_retail,b.price_wholesale,
     b.available,b.featured,b.is_offer,b.is_new,b.stock_level,b.image_url||null,id]
  );
  return NextResponse.json(p);
}

export async function PATCH(req: NextRequest, { params }: P) {
  if (!isAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const b = await req.json();
  const fields = Object.keys(b);
  const vals   = Object.values(b);
  const set    = fields.map((f,i)=>`${f}=$${i+1}`).join(", ");
  const p = await queryOne(
    `UPDATE products SET ${set} WHERE id=$${fields.length+1} RETURNING *`,
    [...vals, id]
  );
  return NextResponse.json(p);
}

export async function DELETE(req: NextRequest, { params }: P) {
  if (!isAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  await query(`DELETE FROM products WHERE id=$1`, [id]);
  return NextResponse.json({ ok: true });
}