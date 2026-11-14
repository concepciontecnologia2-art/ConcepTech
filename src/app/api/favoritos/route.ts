// Favoritos del mayorista (identificado por teléfono)
// GET ?phone= · POST { phone, product_id } · DELETE { phone, product_id }
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { limitByIp } from "@/lib/ratelimit";
export const dynamic = "force-dynamic";

const cleanPhone = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 30) : "");
const validPhone = (p: string) => p.replace(/\D/g, "").length >= 6;
const validId = (v: unknown) => Number.isInteger(Number(v)) && Number(v) > 0;

export async function GET(req: NextRequest) {
  const limited = await limitByIp(req, "favs", 60, 10 * 60);
  if (limited) return limited;
  const phone = cleanPhone(req.nextUrl.searchParams.get("phone"));
  if (!validPhone(phone)) return NextResponse.json([]);
  const favs = await query(
    `SELECT p.* FROM mayorista_favoritos f
     JOIN products p ON p.id = f.product_id
     WHERE f.phone = $1 AND p.available = TRUE
     ORDER BY f.created_at DESC LIMIT 200`,
    [phone]
  );
  return NextResponse.json(favs);
}

export async function POST(req: NextRequest) {
  const limited = await limitByIp(req, "favs-w", 60, 10 * 60);
  if (limited) return limited;
  const b = await req.json().catch(() => ({}));
  const phone = cleanPhone(b.phone);
  if (!validPhone(phone) || !validId(b.product_id)) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  await query(
    `INSERT INTO mayorista_favoritos (phone, product_id)
     SELECT $1, id FROM products WHERE id = $2
     ON CONFLICT DO NOTHING`,
    [phone, Number(b.product_id)]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const limited = await limitByIp(req, "favs-w", 60, 10 * 60);
  if (limited) return limited;
  const b = await req.json().catch(() => ({}));
  const phone = cleanPhone(b.phone);
  if (!validPhone(phone) || !validId(b.product_id)) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  await query(`DELETE FROM mayorista_favoritos WHERE phone=$1 AND product_id=$2`, [phone, Number(b.product_id)]);
  return NextResponse.json({ ok: true });
}