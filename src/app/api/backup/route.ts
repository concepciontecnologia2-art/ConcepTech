// DESCARGAR COPIA — GET /api/backup (solo el dueño).
// Devuelve los datos del negocio en hojas para armar un Excel desde Contabilidad.
// Es una copia "para tener en la compu"; la copia completa para restaurar el sistema
// la hace todas las noches GitHub (.github/workflows/backup-diario.yml).
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireOwner, errorResponse } from "@/lib/pos";

export const dynamic = "force-dynamic";

const HOJAS: [string, string][] = [
  ["Artículos", `SELECT p.id, p.sku AS codigo, p.name AS nombre, c.name AS categoria, sc.name AS subcategoria, s.name AS proveedor,
       p.cost_price AS costo, p.price_retail AS minorista, p.price_wholesale AS mayorista,
       p.stock_quantity AS stock, p.min_stock AS stock_minimo, p.available AS visible_web, p.image_url AS foto
     FROM products p LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
     LEFT JOIN suppliers s ON s.id = p.supplier_id ORDER BY p.name`],
  ["Clientes", `SELECT id, name AS nombre, phone AS telefono, email, dni_cuit, address AS direccion, city AS ciudad,
       customer_type AS tipo, notes AS notas, active AS activo, created_at AS alta FROM customers ORDER BY name`],
  ["Proveedores", `SELECT id, name AS nombre, contact_name AS contacto, whatsapp, phone AS telefono, email, cuit,
       address AS direccion, notes AS notas, active AS activo FROM suppliers ORDER BY name`],
  ["Ventas", `SELECT s.id, s.created_at AS fecha, s.status AS estado, cu.name AS cliente, s.seller_name AS vendedor,
       s.price_list AS lista, s.subtotal, s.discount AS descuento, s.total,
       (SELECT string_agg(sp.method || ' ' || sp.amount, ' + ') FROM sale_payments sp WHERE sp.sale_id = s.id) AS pagos,
       s.void_reason AS motivo_anulacion
     FROM sales s LEFT JOIN customers cu ON cu.id = s.customer_id ORDER BY s.id DESC`],
  ["Detalle de ventas", `SELECT si.sale_id AS venta, s.created_at AS fecha, si.product_name AS articulo, si.quantity AS cantidad,
       si.unit_price AS precio_unitario, si.subtotal, si.unit_cost AS costo_unitario
     FROM sale_items si JOIN sales s ON s.id = si.sale_id ORDER BY si.sale_id DESC, si.id`],
  ["Pedidos web", `SELECT id, created_at AS fecha, customer_name AS cliente, phone AS telefono, sale_type AS tipo,
       delivery_type AS entrega, address AS direccion, total, status AS estado, paid AS pagado, items::text AS productos
     FROM orders ORDER BY id DESC`],
  ["Cierres de caja", `SELECT id, opened_at AS apertura, closed_at AS cierre, opening_amount AS inicial, expected_cash AS efectivo_esperado,
       counted_cash AS efectivo_contado, difference AS diferencia, expected_transfer AS transferencias, notes AS notas
     FROM cash_sessions ORDER BY id DESC`],
  ["Ingresos y retiros", `SELECT id, created_at AS fecha, type AS tipo, method AS medio, amount AS monto, reason AS motivo
     FROM cash_movements ORDER BY id DESC`],
  ["Compras", `SELECT pi.id, pi.invoice_date AS fecha_factura, s.name AS proveedor, pi.invoice_number AS numero,
       pi.total, pi.status AS estado, pi.confirmed_at AS confirmada
     FROM purchase_invoices pi LEFT JOIN suppliers s ON s.id = pi.supplier_id ORDER BY pi.id DESC`],
];

export async function GET(req: NextRequest) {
  const unauth = requireOwner(req); if (unauth) return unauth;
  try {
    const out: Record<string, unknown[]> = {};
    for (const [name, sql] of HOJAS) out[name] = (await pool.query(sql)).rows;
    return NextResponse.json({ generated_at: new Date().toISOString(), sheets: out });
  } catch (e) { return errorResponse(e); }
}
