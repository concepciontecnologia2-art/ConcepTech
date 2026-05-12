import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  const { name, phone } = await req.json();
  if (!name || !phone) return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  await queryOne(
    `INSERT INTO wholesale_customers (name, phone, email) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id`,
    [name, phone, ""]
  );
  return NextResponse.json({ ok: true }, { status: 201 });
}