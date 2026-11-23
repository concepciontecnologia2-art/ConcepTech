// PDF del ticket (80 mm de ancho, alto según los renglones) para mandar por WhatsApp.
// Se arma en el navegador con jsPDF (sin servidor). Comprobante NO fiscal.
import { discountLabel } from "@/lib/descuento";

export type TicketPdfData = {
  sale: {
    id: number; status: string; created_at: string; price_list?: string | null;
    subtotal: number; discount: number; total: number;
    customer_name?: string | null; customer_address?: string | null;
    items: { name: string; quantity: number; unit_price: number; subtotal: number }[];
    payments: { method: "cash" | "transfer"; amount: number }[];
  };
  business: { name: string; address?: string; phone?: string; header?: string; footer?: string };
};

const money = (n: number) =>
  "$ " + new Intl.NumberFormat("es-AR", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n);

export async function ticketPdf(d: TicketPdfData): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const W = 80, M = 5, inner = W - M * 2;
  const s = d.sale, b = d.business;

  // Primera pasada para medir el alto
  const measure = new jsPDF({ unit: "mm", format: [W, 200] });
  measure.setFont("courier", "normal"); measure.setFontSize(8.5);
  const nameLines = s.items.map((it) => measure.splitTextToSize(it.name, inner).length);
  const height = 72 + nameLines.reduce((a, n) => a + n * 3.6 + 4.2, 0) + (s.discount > 0 ? 4 : 0) + s.payments.length * 4
    + (s.customer_address ? 4 : 0) + (b.header ? 4 : 0);

  const doc = new jsPDF({ unit: "mm", format: [W, Math.max(110, height)] });
  let y = 9;
  const center = (t: string, size: number, bold = false) => {
    doc.setFont("courier", bold ? "bold" : "normal"); doc.setFontSize(size);
    for (const l of doc.splitTextToSize(t, inner)) { doc.text(l, W / 2, y, { align: "center" }); y += size * 0.42; }
  };
  const row = (l: string, r: string, size = 8.5, bold = false) => {
    doc.setFont("courier", bold ? "bold" : "normal"); doc.setFontSize(size);
    doc.text(l, M, y); doc.text(r, W - M, y, { align: "right" }); y += size * 0.45;
  };
  const hr = () => { y += 0.6; doc.setLineDashPattern([0.8, 0.6], 0); doc.setLineWidth(0.2); doc.line(M, y, W - M, y); y += 3.6; };

  center(b.name.toUpperCase(), 11, true); y += 0.5;
  if (b.header) center(b.header, 7.5);
  if (b.address) center(b.address, 7.5);
  if (b.phone) center(`Tel: ${b.phone}`, 7.5);
  hr();
  const dt = new Date(s.created_at);
  row(`Ticket N° ${String(s.id).padStart(6, "0")}`, `${dt.toLocaleDateString("es-AR")} ${dt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })}`, 8, true);
  doc.setFont("courier", "normal"); doc.setFontSize(8);
  doc.text(`Cliente: ${s.customer_name || "Consumidor final"}`, M, y); y += 3.6;
  if (s.customer_name && s.customer_address) { doc.text(`Dirección: ${s.customer_address}`.slice(0, 44), M, y); y += 3.6; }
  if (s.price_list === "wholesale") { doc.text("Lista: Mayorista", M, y); y += 3.6; }
  if (s.status === "voided") { center("*** VENTA ANULADA ***", 9, true); }
  hr();

  for (const it of s.items) {
    doc.setFont("courier", "normal"); doc.setFontSize(8.5);
    for (const l of doc.splitTextToSize(it.name, inner)) { doc.text(l, M, y); y += 3.6; }
    row(`  ${it.quantity} x ${money(it.unit_price)}`, money(it.subtotal), 8.5);
    y += 0.6;
  }
  hr();
  const units = s.items.reduce((a, i) => a + i.quantity, 0);
  doc.setFontSize(7.5); doc.setFont("courier", "normal"); doc.text(`${units} ${units === 1 ? "artículo" : "artículos"}`, M, y); y += 3.6;
  if (s.discount > 0) { row("Subtotal", money(s.subtotal), 8.5); row(discountLabel(s.subtotal, s.discount), "-" + money(s.discount), 8.5); }
  y += 1; row("TOTAL", money(s.total), 12, true); y += 0.8;
  for (const p of s.payments) row(p.method === "cash" ? "Efectivo" : "Transferencia", money(p.amount), 8.5);
  hr();
  center(b.footer || "¡Gracias por su compra!", 8.5, true); y += 0.5;
  center("Comprobante no válido como factura", 7);

  doc.setProperties({ title: `Ticket ${s.id} - ${b.name}`, creator: b.name });
  return doc.output("blob");
}
