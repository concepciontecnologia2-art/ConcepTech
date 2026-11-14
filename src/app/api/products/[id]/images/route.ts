// GET    → fotos extra de un producto (público)
// POST   → agregar foto { image_url } (solo admin, solo URLs https)
// DELETE → quitar foto { image_id } (solo admin)
import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { isAuthenticated, isAdminRequest } from "@/lib/auth";
export const dynamic = "force-dynamic";

type P = { params: Promise<{ id: string }> };

const validId = (v: unknown) => Number.isInteger(Number(v)) && Number(v) > 0;
function validImageUrl(v: unknown) {
  if (typeof v !== "string" || v.length > 1000) return false;
  try { return new URL(v).protocol === "https:"; } catch { return false; }
}

export async function GET(req: NextRequest, { params }: P) {
  const { id } = await params;
  if (!validId(id)) return NextResponse.json([]);
  const images = await query(`SELECT id, product_id, image_url, created_at FROM product_images WHERE product_id=$1 ORDER BY created_at ASC`, [Number(id)]);
  return NextResponse.json(images);
}

export async function POST(req: NextRequest, { params }: P) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const { image_url } = await req.json().catch(() => ({}));
  if (!validId(id) || !validImageUrl(image_url))
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const img = await queryOne(`INSERT INTO product_images (product_id, image_url) VALUES ($1,$2) RETURNING *`, [Number(id), image_url]);
  return NextResponse.json(img, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: P) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const { image_id } = await req.json().catch(() => ({}));
  if (!validId(id) || !validId(image_id)) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  await queryOne(`DELETE FROM product_images WHERE id=$1 AND product_id=$2`, [Number(image_id), Number(id)]);
  return NextResponse.json({ ok: true });
}
