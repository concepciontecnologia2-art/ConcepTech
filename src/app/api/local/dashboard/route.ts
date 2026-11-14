// GET → todo lo que muestra el Inicio del área Local, en una sola llamada:
// caja abierta, resumen de hoy (vs ayer), ventas por hora, cómo pagaron,
// últimos 7 días, más vendidos, por agotarse, últimas ventas y
// pedidos web esperando confirmación.
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireOwner, errorResponse, getOpenSessionId, getSessionSummary } from "@/lib/pos";
export const dynamic = "force-dynamic";

// Los días y las horas se cuentan en hora de Argentina, no en UTC
const TZ = "America/Argentina/Tucuman";

export async function GET(req: NextRequest) {
  const unauth = requireOwner(req); if (unauth) return unauth;
  try {
    const openId = await getOpenSessionId(pool);

    const [caja, today, pay, hourly, week, top, low, recent, web] = await Promise.all([
      openId ? getSessionSummary(pool, openId) : Promise.resolve(null),

      // Hoy y ayer
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE d = hoy)::int                       AS today_count,
           COALESCE(SUM(total) FILTER (WHERE d = hoy), 0)::float      AS today_total,
           COALESCE(SUM(discount) FILTER (WHERE d = hoy), 0)::float   AS today_discount,
           COUNT(*) FILTER (WHERE d = hoy - 1)::int                   AS yesterday_count,
           COALESCE(SUM(total) FILTER (WHERE d = hoy - 1), 0)::float  AS yesterday_total
         FROM (
           SELECT total, discount, (created_at AT TIME ZONE $1)::date AS d, (NOW() AT TIME ZONE $1)::date AS hoy
           FROM sales WHERE status = 'completed' AND created_at >= NOW() - INTERVAL '3 days'
         ) x`,
        [TZ]
      ),

      // Cómo pagaron hoy + unidades vendidas hoy
      pool.query(
        `SELECT
           COALESCE((SELECT SUM(sp.amount) FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id
                     WHERE s.status = 'completed' AND sp.method = 'cash'
                       AND (s.created_at AT TIME ZONE $1)::date = (NOW() AT TIME ZONE $1)::date), 0)::float AS cash,
           COALESCE((SELECT SUM(sp.amount) FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id
                     WHERE s.status = 'completed' AND sp.method = 'transfer'
                       AND (s.created_at AT TIME ZONE $1)::date = (NOW() AT TIME ZONE $1)::date), 0)::float AS transfer,
           COALESCE((SELECT SUM(si.quantity) FROM sale_items si JOIN sales s ON s.id = si.sale_id
                     WHERE s.status = 'completed'
                       AND (s.created_at AT TIME ZONE $1)::date = (NOW() AT TIME ZONE $1)::date), 0)::int AS units`,
        [TZ]
      ),

      // Ventas por hora de hoy
      pool.query(
        `SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE $1)::int AS hour,
                SUM(total)::float AS total, COUNT(*)::int AS count
         FROM sales
         WHERE status = 'completed' AND (created_at AT TIME ZONE $1)::date = (NOW() AT TIME ZONE $1)::date
         GROUP BY 1 ORDER BY 1`,
        [TZ]
      ),

      // Últimos 7 días
      pool.query(
        `SELECT to_char(g.d, 'YYYY-MM-DD') AS day,
                COALESCE(SUM(s.total), 0)::float AS total, COUNT(s.id)::int AS count
         FROM generate_series((NOW() AT TIME ZONE $1)::date - 6, (NOW() AT TIME ZONE $1)::date, INTERVAL '1 day') AS g(d)
         LEFT JOIN sales s ON s.status = 'completed' AND (s.created_at AT TIME ZONE $1)::date = g.d::date
         GROUP BY g.d ORDER BY g.d`,
        [TZ]
      ),

      // Más vendidos (7 días), con foto
      pool.query(
        `SELECT si.product_id, MAX(si.product_name) AS name, MAX(p.image_url) AS image_url,
                SUM(si.quantity)::int AS quantity, SUM(si.subtotal)::float AS total
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         LEFT JOIN products p ON p.id = si.product_id
         WHERE s.status = 'completed' AND s.created_at >= NOW() - INTERVAL '7 days'
         GROUP BY si.product_id
         ORDER BY quantity DESC, total DESC
         LIMIT 5`
      ),

      // Por agotarse (1 a 3 unidades, o menos que el mínimo); los que están en 0 se cuentan aparte
      pool.query(
        `SELECT id, name, stock_quantity, min_stock, image_url,
                COUNT(*) OVER()::int AS total_count
         FROM products
         WHERE available = TRUE AND stock_quantity > 0 AND stock_quantity <= GREATEST(min_stock, 3)
         ORDER BY stock_quantity ASC, name
         LIMIT 6`
      ),

      // Últimas ventas del mostrador
      pool.query(
        `SELECT s.id, s.status, s.created_at, s.total::float AS total, s.price_list,
                (SELECT COALESCE(SUM(quantity), 0)::int FROM sale_items WHERE sale_id = s.id) AS units,
                (SELECT product_name FROM sale_items WHERE sale_id = s.id ORDER BY id LIMIT 1) AS first_item,
                (SELECT COUNT(*)::int FROM sale_items WHERE sale_id = s.id) AS lines,
                (SELECT COALESCE(json_agg(DISTINCT method), '[]') FROM sale_payments WHERE sale_id = s.id) AS methods
         FROM sales s
         ORDER BY s.created_at DESC
         LIMIT 6`
      ),

      // Pedidos web esperando confirmación + productos en 0
      pool.query(
        `SELECT
           (SELECT COUNT(*)::int FROM orders WHERE status = 'pending') AS pending_web,
           (SELECT COUNT(*)::int FROM products WHERE available = TRUE AND stock_quantity = 0) AS out_of_stock`
      ),
    ]);

    return NextResponse.json({
      caja,
      today: { ...today.rows[0], ...pay.rows[0] },
      hourly: hourly.rows,
      week: week.rows,
      top: top.rows,
      lowStock: { count: low.rows[0]?.total_count ?? 0, items: low.rows },
      outOfStock: web.rows[0].out_of_stock,
      pendingWeb: web.rows[0].pending_web,
      recent: recent.rows,
    });
  } catch (e) { return errorResponse(e); }
}
