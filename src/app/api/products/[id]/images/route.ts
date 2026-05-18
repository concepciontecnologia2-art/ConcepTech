import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
export const dynamic = "force-dynamic";

type P = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: P) {
  const { id } = await params;
  const images = await query(`SELECT * FROM product_images WHERE product_id=$1 ORDER BY created_at ASC`, [id]);
  return NextResponse.json(images);
}

export async function POST(req: NextRequest, { params }: P) {
  const cookie = req.cookies.get("ct_admin");
  if (cookie?.value !== process.env.SESSION_SECRET)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const { image_url } = await req.json();
  const img = await queryOne(`INSERT INTO product_images (product_id, image_url) VALUES ($1,$2) RETURNING *`, [id, image_url]);
  return NextResponse.json(img, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: P) {
  const cookie = req.cookies.get("ct_admin");
  if (cookie?.value !== process.env.SESSION_SECRET)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const { image_id } = await req.json();
  await queryOne(`DELETE FROM product_images WHERE id=$1 AND product_id=$2`, [image_id, id]);
  return NextResponse.json({ ok: true });
}