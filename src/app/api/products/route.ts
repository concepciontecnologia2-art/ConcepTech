import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const search  = searchParams.get("q");
  const catSlug = searchParams.get("category");
  const sort    = searchParams.get("sort");
  const isAdmin = req.cookies.get("ct_admin")?.value === process.env.SESSION_SECRET;

  let sql = `
  SELECT p.*, c.name AS category_name, c.icon AS category_icon, s.name AS subcategory_name
    FROM products p
    JOIN categories c ON c.id = p.category_id
    LEFT JOIN subcategories s ON s.id = p.subcategory_id
    WHERE ${isAdmin ? "1=1" : "p.available = TRUE"}
  `;
  const params: unknown[] = [];

  if (search)  { params.push(`%${search}%`); sql += ` AND (p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`; }
  if (catSlug) { params.push(catSlug);        sql += ` AND c.slug = $${params.length}`; }
  if (sort === "price_asc")  sql += ` ORDER BY p.price_retail ASC`;
  else if (sort === "price_desc") sql += ` ORDER BY p.price_retail DESC`;
  else sql += ` ORDER BY p.featured DESC, p.is_new DESC, p.name`;

  const res = NextResponse.json(await query(sql, params));
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function POST(req: NextRequest) {
  const cookie = req.cookies.get("ct_admin");
  if (cookie?.value !== process.env.SESSION_SECRET)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json();
  const [p] = await query(
    `INSERT INTO products (name,description,category_id,subcategory_id,price_retail,price_wholesale,available,featured,is_offer,is_new,stock_level,image_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [b.name,b.description||null,b.category_id,b.subcategory_id||null,b.price_retail,b.price_wholesale,
     b.available??true,b.featured??false,b.is_offer??false,b.is_new??false,b.stock_level||"alto",b.image_url||null]
  );
  return NextResponse.json(p, { status: 201 });
}