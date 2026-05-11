import { NextResponse } from "next/server";
import { query } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  const categories = await query(`
    SELECT c.*,
      json_agg(json_build_object('id',s.id,'name',s.name,'slug',s.slug) ORDER BY s.sort_order)
        FILTER (WHERE s.id IS NOT NULL) AS subcategories
    FROM categories c
    LEFT JOIN subcategories s ON s.category_id = c.id
    GROUP BY c.id ORDER BY c.sort_order
  `);
  return NextResponse.json(categories);
}