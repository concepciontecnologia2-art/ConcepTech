import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const cookie = req.cookies.get("ct_admin");
  if (cookie?.value !== process.env.SESSION_SECRET)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { updates, creates } = await req.json();

  let updated = 0; let created = 0; let err = 0;

  // ACTUALIZAR en batch
  for (const p of updates) {
    try {
      await query(
        `UPDATE products SET price_retail=$1, price_wholesale=$2, stock_quantity=$3, stock_level=$4, available=$5 WHERE id=$6`,
        [p.price_retail, p.price_wholesale, p.stock_quantity, p.stock_level, p.available, p.id]
      );
      updated++;
    } catch(e){ err++; }
  }

  // CREAR en batch
  for (const p of creates) {
    try {
      await query(
        `INSERT INTO products (name,description,category_id,price_retail,price_wholesale,stock_quantity,stock_level,available,featured,is_offer,is_new,image_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,false,false,null)`,
        [p.name, "", p.category_id, p.price_retail, p.price_wholesale, p.stock_quantity, p.stock_level, p.available]
      );
      created++;
    } catch(e){ err++; }
  }

  return NextResponse.json({ updated, created, err });
}