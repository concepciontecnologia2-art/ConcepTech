// GET  ?q=&estado=activos|inactivos → proveedores con cuántos productos tienen y cuántos hay que reponer
// POST { name, contact_name, whatsapp, phone, email, cuit, address, notes } → alta de proveedor
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/pos";
import { supplierFields, checkSupplierDuplicates, likeTerm } from "@/lib/crm";
import { REORDER_AT } from "@/lib/reposicion";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const unauth = requireUser(req); if (unauth) return unauth;
  try {
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") || "").trim().slice(0, 100);
    const inactive = sp.get("estado") === "inactivos";

    const params: unknown[] = [!inactive];
    const conds = ["s.active = $1"];
    for (const t of q.split(/\s+/).filter(Boolean).slice(0, 6)) {
      params.push(likeTerm(t));
      const i = params.length;
      conds.push(`(s.name ILIKE $${i} OR COALESCE(s.contact_name,'') ILIKE $${i} OR COALESCE(s.whatsapp,'') ILIKE $${i} OR COALESCE(s.cuit,'') ILIKE $${i})`);
    }

    const { rows } = await pool.query(
      `SELECT s.id, s.name, s.contact_name, s.whatsapp, s.phone, s.email, s.cuit, s.active, s.created_at,
              COUNT(p.id)::int AS products,
              COUNT(p.id) FILTER (WHERE p.stock_quantity <= ${REORDER_AT})::int AS to_restock,
              COUNT(p.id) FILTER (WHERE p.stock_quantity <= 0)::int AS out_of_stock
       FROM suppliers s
       LEFT JOIN products p ON p.supplier_id = s.id
       WHERE ${conds.join(" AND ")}
       GROUP BY s.id
       ORDER BY s.name
       LIMIT 300`,
      params
    );
    return NextResponse.json(rows);
  } catch (e) { return errorResponse(e); }
}

export async function POST(req: NextRequest) {
  const unauth = requireUser(req); if (unauth) return unauth;
  try {
    const b = await req.json().catch(() => ({}));
    const f = supplierFields(b);
    await checkSupplierDuplicates(pool, f.name, null);
    const { rows: [s] } = await pool.query(
      `INSERT INTO suppliers (name, contact_name, whatsapp, phone, email, cuit, address, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, contact_name, whatsapp, phone, email, cuit, address, notes, active, created_at`,
      [f.name, f.contact_name, f.whatsapp, f.phone, f.email, f.cuit, f.address, f.notes]
    );
    return NextResponse.json(s, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
