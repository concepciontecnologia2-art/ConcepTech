// GET → historial de cajas cerradas (últimas 30)
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireOwner, errorResponse } from "@/lib/pos";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const unauth = requireOwner(req); if (unauth) return unauth;
  try {
    const { rows } = await pool.query(
      `SELECT cs.id, cs.opened_at, cs.closed_at,
              cs.opening_amount::float    AS opening_amount,
              cs.expected_cash::float     AS expected_cash,
              cs.expected_transfer::float AS expected_transfer,
              cs.counted_cash::float      AS counted_cash,
              cs.difference::float        AS difference,
              cs.notes,
              COALESCE(x.sales_total, 0)::float AS sales_total,
              COALESCE(x.sales_count, 0)::int   AS sales_count
       FROM cash_sessions cs
       LEFT JOIN (
         SELECT cash_session_id, SUM(total) AS sales_total, COUNT(*) AS sales_count
         FROM sales WHERE status = 'completed'
         GROUP BY cash_session_id
       ) x ON x.cash_session_id = cs.id
       WHERE cs.status = 'closed'
       ORDER BY cs.closed_at DESC
       LIMIT 30`
    );
    return NextResponse.json(rows);
  } catch (e) { return errorResponse(e); }
}
