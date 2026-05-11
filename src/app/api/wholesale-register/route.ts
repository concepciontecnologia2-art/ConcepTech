import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { name, phone, email } = await req.json();
  if (!name || !phone || !email) return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  const existing = await queryOne(`SELECT id FROM wholesale_customers WHERE email=$1`, [email]);
  if (existing) return NextResponse.json({ ok: true, existing: true });
  await queryOne(`INSERT INTO wholesale_customers (name,phone,email) VALUES ($1,$2,$3) RETURNING id`, [name,phone,email]);
  return NextResponse.json({ ok: true, existing: false }, { status: 201 });
}