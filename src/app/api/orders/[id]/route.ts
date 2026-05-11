import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
export const dynamic = "force-dynamic";
type P = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: P) {
  const cookie = req.cookies.get("ct_admin");
  if (cookie?.value !== process.env.SESSION_SECRET)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const b = await req.json();
  const fields = Object.keys(b);
  const vals   = Object.values(b);
  const set    = fields.map((f,i)=>`${f}=$${i+1}`).join(", ");
  const order  = await queryOne(
    `UPDATE orders SET ${set} WHERE id=$${fields.length+1} RETURNING *`,
    [...vals, id]
  );
  if (!order) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(order);
}