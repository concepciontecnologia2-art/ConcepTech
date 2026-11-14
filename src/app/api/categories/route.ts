import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { unstable_cache } from "next/cache";
export const dynamic = "force-dynamic";

// Las categorías casi nunca cambian: se guardan 10 minutos para no consultar la base en cada visita
const getCategories = unstable_cache(async () => query(`
    SELECT c.*,
      json_agg(json_build_object('id',s.id,'name',s.name,'slug',s.slug) ORDER BY s.sort_order)
        FILTER (WHERE s.id IS NOT NULL) AS subcategories
    FROM categories c
    LEFT JOIN subcategories s ON s.category_id = c.id
    GROUP BY c.id ORDER BY c.sort_order
  `), ["categories-v1"], { revalidate: 600, tags: ["categories"] });

export async function GET() {
  return NextResponse.json(await getCategories());
}