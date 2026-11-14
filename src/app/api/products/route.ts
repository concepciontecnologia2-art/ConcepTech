import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isAuthenticated, isAdminRequest } from "@/lib/auth";
import { unstable_cache, revalidateTag } from "next/cache";
export const dynamic = "force-dynamic";

// Lista pública (tienda y mayorista): se guarda 2 minutos para que cada visita
// no despierte la base de datos (Neon gratis cobra por horas encendida y por datos transferidos).
// Sin costo ni proveedor: nunca se cachea nada privado.
const PUBLIC_SQL = `
  SELECT p.*, c.name AS category_name, c.icon AS category_icon, s.name AS subcategory_name
    FROM products p
    JOIN categories c ON c.id = p.category_id
    LEFT JOIN subcategories s ON s.id = p.subcategory_id
    WHERE p.available = TRUE
    ORDER BY p.featured DESC, p.is_new DESC, p.name`;
const publicProducts = unstable_cache(
  async () => {
    const rows: any[] = await query(PUBLIC_SQL);
    for (const r of rows) { delete r.cost_price; delete r.supplier_id; }
    return rows;
  },
  ["public-products-v1"],
  { revalidate: 120, tags: ["products"] }
);

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const search  = searchParams.get("q")?.slice(0, 100);
  const catSlug = searchParams.get("category")?.slice(0, 100);
  const sort    = searchParams.get("sort");
  const isAdmin = isAuthenticated(req);   // con sesión (admin o vendedor) ve también los ocultos
  const canSeeCost = isAdminRequest(req);  // el costo y el proveedor solo los ve el administrador

  // Visitante de la tienda pidiendo la lista completa → desde la caché
  if (!isAdmin && !search && !catSlug && !sort) {
    const res = NextResponse.json(await publicProducts());
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

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

  const rows: any[] = await query(sql, params);
  if (!canSeeCost) for (const r of rows) { delete r.cost_price; delete r.supplier_id; }
  const res = NextResponse.json(rows);
  res.headers.set("Cache-Control", "no-store");  
  return res;
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  // Costo y proveedor (opcionales)
  const cost = b.cost_price === null || b.cost_price === undefined || b.cost_price === "" ? null : Number(b.cost_price);
  if (cost !== null && (!Number.isFinite(cost) || cost < 0)) return NextResponse.json({ error: "Precio de costo inválido" }, { status: 400 });
  const supplierId = b.supplier_id ? Number(b.supplier_id) : null;
  if (supplierId !== null && (!Number.isInteger(supplierId) || supplierId <= 0)) return NextResponse.json({ error: "Proveedor inválido" }, { status: 400 });
  try {
    const [p] = await query(
      `INSERT INTO products (name,description,category_id,subcategory_id,price_retail,price_wholesale,available,featured,is_offer,is_new,stock_level,stock_quantity,image_url,cost_price,supplier_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [b.name,b.description||null,b.category_id,b.subcategory_id||null,b.price_retail,b.price_wholesale,
       b.available??true,b.featured??false,b.is_offer??false,b.is_new??false,b.stock_level||"alto",b.stock_quantity??0,b.image_url||null,
       cost,supplierId]
    );
    revalidateTag("products");
    return NextResponse.json(p, { status: 201 });
  } catch (e) {
    console.error("[products POST]", e);
    return NextResponse.json({ error: "No se pudo guardar el producto. Revisá los datos." }, { status: 400 });
  }
}