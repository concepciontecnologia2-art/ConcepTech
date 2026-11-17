// GET  ?q=juan&type=retail|wholesale&estado=activos|inactivos → lista de clientes con lo que compraron
//      ?q=juan&limit=8 → modo buscador (rápido, sin estadísticas)
// POST { name, phone, email, dni_cuit, address, city, customer_type, notes } → alta de cliente
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/pos";
import { customerFields, checkCustomerDuplicates, likeTerm } from "@/lib/crm";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const unauth = requireUser(req); if (unauth) return unauth;
  try {
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") || "").trim().slice(0, 100);
    const type = sp.get("type");
    const inactive = sp.get("estado") === "inactivos";

    const params: unknown[] = [!inactive];
    const conds = ["c.active = $1"];
    if (type === "retail" || type === "wholesale") { params.push(type); conds.push(`c.customer_type = $${params.length}`); }
    for (const t of q.split(/\s+/).filter(Boolean).slice(0, 6)) {
      params.push(likeTerm(t));
      const i = params.length;
      conds.push(`(c.name ILIKE $${i} OR COALESCE(c.city,'') ILIKE $${i} OR COALESCE(c.phone,'') ILIKE $${i} OR COALESCE(c.dni_cuit,'') ILIKE $${i} OR COALESCE(c.email,'') ILIKE $${i})`);
    }

    // Modo buscador (?limit=8): para los selectores de cliente. Trae solo esos pocos,
    // sin sumar el historial de ventas de todos los clientes.
    const pick = Number(sp.get("limit"));
    if (pick > 0) {
      const { rows } = await pool.query(
        `SELECT c.id, c.name, c.phone, c.email, c.dni_cuit, c.address, c.city, c.customer_type, c.active
         FROM customers c
         WHERE ${conds.join(" AND ")}
         ORDER BY c.name
         LIMIT ${Math.min(20, Math.trunc(pick))}`,
        params
      );
      return NextResponse.json(rows);
    }

    const { rows } = await pool.query(
      `SELECT c.id, c.name, c.phone, c.email, c.dni_cuit, c.city, c.customer_type, c.active, c.created_at,
              COALESCE(st.purchases, 0)::int  AS purchases,
              COALESCE(st.spent, 0)::float    AS spent,
              st.last_purchase
       FROM customers c
       LEFT JOIN (
         SELECT customer_id, COUNT(*) AS purchases, SUM(total) AS spent, MAX(created_at) AS last_purchase
         FROM sales WHERE status = 'completed' AND customer_id IS NOT NULL
         GROUP BY customer_id
       ) st ON st.customer_id = c.id
       WHERE ${conds.join(" AND ")}
       ORDER BY st.last_purchase DESC NULLS LAST, c.name
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
    const f = customerFields(b);
    await checkCustomerDuplicates(pool, f, null);
    const { rows: [c] } = await pool.query(
      `INSERT INTO customers (name, phone, email, dni_cuit, address, city, customer_type, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, phone, email, dni_cuit, address, city, customer_type, notes, active, created_at`,
      [f.name, f.phone, f.email, f.dni_cuit, f.address, f.city, f.customer_type, f.notes]
    );
    return NextResponse.json(c, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
