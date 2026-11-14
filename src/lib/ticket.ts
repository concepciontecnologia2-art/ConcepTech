// Datos de un ticket de venta (los usan el ticket interno y el link público por WhatsApp)
import { pool } from "@/lib/db";

export async function getTicketData(id: number) {
  const [{ rows: [sale] }, { rows: settings }] = await Promise.all([
    pool.query(
      `SELECT s.id, s.status, s.created_at, s.price_list, s.seller_name,
              s.subtotal::float AS subtotal, s.discount::float AS discount, s.total::float AS total,
              cu.name AS customer_name, cu.dni_cuit AS customer_doc, NULLIF(cu.address, '') AS customer_address,
              NULLIF(cu.phone, '') AS customer_phone,
              COALESCE((SELECT json_agg(json_build_object('name', product_name, 'quantity', quantity,
                          'unit_price', unit_price::float, 'subtotal', subtotal::float) ORDER BY id)
                        FROM sale_items WHERE sale_id = s.id), '[]') AS items,
              COALESCE((SELECT json_agg(json_build_object('method', method, 'amount', amount::float) ORDER BY id)
                        FROM sale_payments WHERE sale_id = s.id), '[]') AS payments
       FROM sales s
       LEFT JOIN customers cu ON cu.id = s.customer_id
       WHERE s.id = $1`,
      [id]
    ),
    pool.query(
      `SELECT key, value FROM business_settings
       WHERE key IN ('business_name', 'ticket_phone', 'ticket_address', 'ticket_header', 'ticket_footer')`
    ),
  ]);
  if (!sale) return null;
  const s = Object.fromEntries(settings.map((r: any) => [r.key, r.value || ""]));
  const business = {
    name: s.business_name || "Concepción Tecnología",
    phone: s.ticket_phone || "3865 630488",
    address: s.ticket_address || "Independencia 450 - Concepción, Tucumán",
    header: s.ticket_header || "",
    footer: s.ticket_footer || "¡Gracias por su compra!",
  };
  return { sale, business };
}
