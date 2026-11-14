// GET ?desde=2026-11-01&hasta=2026-11-30 → números del período (solo el administrador)
//   Ventas del local, costo y ganancia, cómo pagaron, gastos e ingresos de caja,
//   ventas web, por día, por vendedor, por categoría, productos y cierres de caja.
//   Además: CAPITAL TOTAL (lo que vale hoy la mercadería en stock, al costo y a precio de venta).
// Las fechas son días de Argentina (incluye "hasta").
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireOwner, errorResponse, PosError } from "@/lib/pos";
export const dynamic = "force-dynamic";

const TZ = "America/Argentina/Tucuman";
const isDate = (s: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T12:00:00Z"));

export async function GET(req: NextRequest) {
  const unauth = requireOwner(req); if (unauth) return unauth;
  try {
    const sp = req.nextUrl.searchParams;
    const desde = sp.get("desde"), hasta = sp.get("hasta");
    if (!isDate(desde) || !isDate(hasta)) throw new PosError("Elegí las fechas del período");
    if (desde! > hasta!) throw new PosError("La fecha de inicio es posterior a la de fin");
    const days = (Date.parse(hasta! + "T12:00:00Z") - Date.parse(desde! + "T12:00:00Z")) / 86400000;
    if (days > 366) throw new PosError("El período puede ser de hasta un año");

    // Rango [desde 00:00, hasta+1 00:00) en hora argentina
    const P = [desde, hasta, TZ];
    const RANGE = `s.created_at >= ($1::date)::timestamp AT TIME ZONE $3
               AND s.created_at <  ($2::date + 1)::timestamp AT TIME ZONE $3`;
    // Costo de cada línea: el guardado al vender; si es una venta vieja, el costo actual del producto
    const COST = `si.quantity * COALESCE(si.unit_cost, p.cost_price)`;

    const [summary, pay, cost, mov, movList, web, byDay, bySeller, byCat, top, sessions, capital, capitalByCat] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE status = 'completed')::int                  AS count,
                COALESCE(SUM(total) FILTER (WHERE status = 'completed'), 0)::float    AS total,
                COALESCE(SUM(discount) FILTER (WHERE status = 'completed'), 0)::float AS discount,
                COUNT(*) FILTER (WHERE status = 'voided')::int                     AS voided_count,
                COALESCE(SUM(total) FILTER (WHERE status = 'voided'), 0)::float       AS voided_total
         FROM sales s WHERE ${RANGE}`, P),
      pool.query(
        `SELECT COALESCE(SUM(sp.amount) FILTER (WHERE sp.method = 'cash'), 0)::float     AS cash,
                COALESCE(SUM(sp.amount) FILTER (WHERE sp.method = 'transfer'), 0)::float AS transfer
         FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id
         WHERE s.status = 'completed' AND ${RANGE}`, P),
      pool.query(
        `SELECT COALESCE(SUM(${COST}), 0)::float AS cost,
                COALESCE(SUM(si.quantity), 0)::int AS units,
                COALESCE(SUM(si.quantity) FILTER (WHERE COALESCE(si.unit_cost, p.cost_price) IS NULL), 0)::int AS units_without_cost,
                COALESCE(SUM(si.subtotal) FILTER (WHERE COALESCE(si.unit_cost, p.cost_price) IS NULL), 0)::float AS sales_without_cost
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         LEFT JOIN products p ON p.id = si.product_id
         WHERE s.status = 'completed' AND ${RANGE}`, P),
      pool.query(
        `SELECT COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0)::float  AS income,
                COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)::float AS expense
         FROM cash_movements s WHERE ${RANGE}`, P),
      pool.query(
        `SELECT id, type, method, amount::float AS amount, reason, created_at
         FROM cash_movements s WHERE ${RANGE}
         ORDER BY created_at DESC LIMIT 200`, P),
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE status IN ('confirmed', 'completed'))::int              AS count,
                COALESCE(SUM(total) FILTER (WHERE status IN ('confirmed', 'completed')), 0)::float AS total,
                COUNT(*) FILTER (WHERE status = 'pending')::int                                  AS pending
         FROM orders s WHERE ${RANGE}`, P),
      pool.query(
        `SELECT to_char(g.d, 'YYYY-MM-DD') AS day,
                COALESCE(x.total, 0)::float AS total, COALESCE(x.count, 0)::int AS count,
                COALESCE(c.cost, 0)::float AS cost, COALESCE(m.expense, 0)::float AS expense
         FROM generate_series($1::date, $2::date, INTERVAL '1 day') AS g(d)
         LEFT JOIN (
           SELECT (s.created_at AT TIME ZONE $3)::date AS d, SUM(total) AS total, COUNT(*) AS count
           FROM sales s WHERE s.status = 'completed' AND ${RANGE} GROUP BY 1
         ) x ON x.d = g.d::date
         LEFT JOIN (
           SELECT (s.created_at AT TIME ZONE $3)::date AS d, SUM(${COST}) AS cost
           FROM sale_items si JOIN sales s ON s.id = si.sale_id LEFT JOIN products p ON p.id = si.product_id
           WHERE s.status = 'completed' AND ${RANGE} GROUP BY 1
         ) c ON c.d = g.d::date
         LEFT JOIN (
           SELECT (s.created_at AT TIME ZONE $3)::date AS d, SUM(amount) AS expense
           FROM cash_movements s WHERE s.type = 'expense' AND ${RANGE} GROUP BY 1
         ) m ON m.d = g.d::date
         ORDER BY g.d`, P),
      pool.query(
        `SELECT COALESCE(seller_name, 'Sin registrar') AS seller,
                COUNT(*)::int AS count, SUM(total)::float AS total
         FROM sales s WHERE s.status = 'completed' AND ${RANGE}
         GROUP BY 1 ORDER BY total DESC`, P),
      pool.query(
        `SELECT COALESCE(c.name, 'Sin categoría') AS category,
                SUM(si.quantity)::int AS units, SUM(si.subtotal)::float AS total,
                COALESCE(SUM(${COST}), 0)::float AS cost
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         LEFT JOIN products p ON p.id = si.product_id
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE s.status = 'completed' AND ${RANGE}
         GROUP BY 1 ORDER BY total DESC LIMIT 20`, P),
      pool.query(
        `SELECT MAX(si.product_name) AS name, SUM(si.quantity)::int AS units,
                SUM(si.subtotal)::float AS total, SUM(${COST})::float AS cost
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         LEFT JOIN products p ON p.id = si.product_id
         WHERE s.status = 'completed' AND ${RANGE}
         GROUP BY COALESCE(si.product_id::text, si.product_name)
         ORDER BY total DESC LIMIT 15`, P),
      pool.query(
        `SELECT cs.id, cs.opened_at, cs.closed_at, cs.opened_by, cs.closed_by,
                cs.opening_amount::float AS opening_amount, cs.expected_cash::float AS expected_cash,
                cs.expected_transfer::float AS expected_transfer, cs.counted_cash::float AS counted_cash,
                cs.difference::float AS difference, cs.notes,
                COALESCE(x.total, 0)::float AS sales_total, COALESCE(x.count, 0)::int AS sales_count
         FROM cash_sessions cs
         LEFT JOIN (SELECT cash_session_id, SUM(total) AS total, COUNT(*) AS count
                    FROM sales WHERE status = 'completed' GROUP BY 1) x ON x.cash_session_id = cs.id
         WHERE cs.status = 'closed'
           AND cs.closed_at >= ($1::date)::timestamp AT TIME ZONE $3
           AND cs.closed_at <  ($2::date + 1)::timestamp AT TIME ZONE $3
         ORDER BY cs.closed_at DESC LIMIT 100`, P),
      // Capital total: lo que vale la mercadería que hay HOY en stock (no depende del período)
      pool.query(
        `SELECT COALESCE(SUM(stock_quantity * cost_price), 0)::float      AS cost_value,
                COALESCE(SUM(stock_quantity * price_retail), 0)::float    AS retail_value,
                COALESCE(SUM(stock_quantity * COALESCE(NULLIF(price_wholesale, 0), price_retail)), 0)::float AS wholesale_value,
                COUNT(*) FILTER (WHERE price_wholesale IS NULL OR price_wholesale = 0)::int AS no_wholesale_products,
                COALESCE(SUM(stock_quantity), 0)::int                     AS units,
                COUNT(*)::int                                             AS products,
                COUNT(*) FILTER (WHERE cost_price IS NULL OR cost_price = 0)::int AS no_cost_products,
                COALESCE(SUM(stock_quantity) FILTER (WHERE cost_price IS NULL OR cost_price = 0), 0)::int AS no_cost_units,
                COALESCE(SUM(stock_quantity * price_retail) FILTER (WHERE cost_price IS NULL OR cost_price = 0), 0)::float AS no_cost_retail
         FROM products WHERE stock_quantity > 0`),
      pool.query(
        `SELECT COALESCE(c.name, 'Sin categoría') AS category,
                SUM(p.stock_quantity)::int AS units,
                COALESCE(SUM(p.stock_quantity * p.cost_price), 0)::float AS cost_value,
                COALESCE(SUM(p.stock_quantity * p.price_retail), 0)::float AS retail_value,
                COALESCE(SUM(p.stock_quantity * COALESCE(NULLIF(p.price_wholesale, 0), p.price_retail)), 0)::float AS wholesale_value
         FROM products p LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.stock_quantity > 0
         GROUP BY 1 ORDER BY retail_value DESC`),
    ]);

    const s = summary.rows[0], c = cost.rows[0], m = mov.rows[0];
    const gross = s.total - c.cost;
    return NextResponse.json({
      desde, hasta,
      sales: { ...s, units: c.units, avg_ticket: s.count ? s.total / s.count : 0 },
      payments: pay.rows[0],
      cost: c.cost,
      gross_profit: gross,
      margin: s.total > 0 ? gross / s.total : 0,
      missing_cost: { units: c.units_without_cost, sales: c.sales_without_cost },
      movements: { ...m, list: movList.rows },
      net: gross - m.expense,
      web: web.rows[0],
      byDay: byDay.rows,
      bySeller: bySeller.rows,
      byCategory: byCat.rows,
      topProducts: top.rows,
      sessions: sessions.rows,
      capital: { ...capital.rows[0], byCategory: capitalByCat.rows },
    });
  } catch (e) { return errorResponse(e); }
}
