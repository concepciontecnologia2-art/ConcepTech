import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get("phone");
  if (!phone) return NextResponse.json([]);
  const orders = await query(
    `SELECT * FROM orders WHERE phone=$1 AND sale_type='wholesale'
     ORDER BY created_at DESC LIMIT 20`,
    [phone]
  );
  return NextResponse.json(orders);
}