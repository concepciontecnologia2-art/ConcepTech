import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get("phone");
  if (!phone) return NextResponse.json([]);
  const favs = await query(
    `SELECT p.* FROM mayorista_favoritos f
     JOIN products p ON p.id = f.product_id
     WHERE f.phone = $1 ORDER BY f.created_at DESC`,
    [phone]
  );
  return NextResponse.json(favs);
}

export async function POST(req: NextRequest) {
  const { phone, product_id } = await req.json();
  await query(
    `INSERT INTO mayorista_favoritos (phone, product_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [phone, product_id]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { phone, product_id } = await req.json();
  await query(
    `DELETE FROM mayorista_favoritos WHERE phone=$1 AND product_id=$2`,
    [phone, product_id]
  );
  return NextResponse.json({ ok: true });
}