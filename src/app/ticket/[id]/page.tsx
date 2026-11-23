"use client";
// ═══════════════════════════════════════════════════════════════════
// TICKET DE VENTA — 80 mm (comprobante interno, no es factura)
// /ticket/123            → se ve en pantalla con botón Imprimir
// /ticket/123?imprimir=1 → se imprime solo (lo usa Ventas desde un marco oculto)
// /ticket/123?k=CLAVE    → link PÚBLICO que se le manda al cliente por WhatsApp
// Sin la clave, los datos vienen de /api/pos/sales/[id]: sin sesión iniciada no muestra nada.
// ═══════════════════════════════════════════════════════════════════
import { discountLabel } from "@/lib/descuento";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Data = {
  sale: {
    id: number; status: string; created_at: string; price_list: string; seller_name: string | null;
    subtotal: number; discount: number; total: number; customer_name: string | null; customer_doc: string | null; customer_address?: string | null;
    items: { name: string; quantity: number; unit_price: number; subtotal: number }[];
    payments: { method: "cash" | "transfer"; amount: number }[];
  };
  business: { name: string; phone: string; address: string; header: string; footer: string };
};

// Tickets largos: se imprimen en boletas de a 20 productos; la última suma todas
const POR_BOLETA = 20;

const money = (n: number) =>
  "$ " + new Intl.NumberFormat("es-AR", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n || 0);

const CSS = `
  @page { size: 80mm auto; margin: 0; }
  html, body { background: #fff !important; color: #000 !important; overflow: visible !important; }
  .tk { width: 72mm; margin: 0 auto; padding: 4mm 0 6mm; font-family: "Courier New", ui-monospace, monospace; font-size: 12px; line-height: 1.35; color: #000; }
  .tk * { color: #000; }
  .c { text-align: center; }
  .b { font-weight: 700; }
  .name { font-size: 16px; font-weight: 800; letter-spacing: .02em; text-transform: uppercase; }
  .hr { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; gap: 6px; }
  .row > span:last-child { white-space: nowrap; text-align: right; }
  .item { margin: 3px 0; }
  .item-name { word-break: break-word; }
  .small { font-size: 11px; }
  .total { font-size: 17px; font-weight: 800; }
  .void { border: 2px solid #000; text-align: center; font-weight: 800; font-size: 15px; padding: 4px; margin: 6px 0; }
  .screen-bar { position: sticky; top: 0; display: flex; justify-content: center; gap: 8px; padding: 10px; background: #f3f4f6; border-bottom: 1px solid #e5e7eb; font-family: system-ui, sans-serif; }
  .screen-bar button { padding: 8px 16px; border-radius: 8px; border: 1px solid #00B4D8; background: #00B4D8; color: #fff !important; font-weight: 700; cursor: pointer; font-size: 14px; }
  .screen-bar button.ghost { background: #fff; color: #444 !important; border-color: #e5e7eb; }
  @media screen { body { background: #e5e7eb !important; } .tk { background: #fff; padding: 6mm 4mm; margin: 16px auto; box-shadow: 0 4px 16px rgba(0,0,0,.12); width: 80mm; } }
  .part { border: 1px solid #000; text-align: center; font-weight: 800; padding: 2px; margin-top: 4px; }
  .tk + .tk { break-before: page; page-break-before: always; }
  @media print { .screen-bar { display: none !important; } .tk + .tk { margin-top: 0; } }
`;

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [autoPrint, setAutoPrint] = useState(false);
  const [publicView, setPublicView] = useState(false);

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    setAutoPrint(qs.get("imprimir") === "1");
    const k = qs.get("k");
    setPublicView(!!k);
    const url = k ? `/api/ticket/${encodeURIComponent(id)}?k=${encodeURIComponent(k)}` : `/api/pos/sales/${encodeURIComponent(id)}`;
    fetch(url, { credentials: "include" })
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "No se pudo cargar el ticket"); return d; })
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [id]);

  // Imprime apenas está dibujado
  useEffect(() => {
    if (data && autoPrint) {
      const t = setTimeout(() => window.print(), 150);
      return () => clearTimeout(t);
    }
  }, [data, autoPrint]);

  if (err) return <div style={{ padding: 20, fontFamily: "system-ui", color: "#b91c1c" }}>{err}</div>;
  if (!data) return <div style={{ padding: 20, fontFamily: "system-ui", color: "#666" }}>Cargando…</div>;

  const { sale: s, business: b } = data;
  const d = new Date(s.created_at);
  const date = d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
  const units = s.items.reduce((n, i) => n + i.quantity, 0);
  type It = (typeof s.items)[number];
  const partes: It[][] = [];
  for (let i = 0; i < s.items.length; i += POR_BOLETA) partes.push(s.items.slice(i, i + POR_BOLETA));
  if (!partes.length) partes.push([]);
  const sumar = (its: It[]) => Math.round(its.reduce((n, i) => n + Number(i.subtotal), 0) * 100) / 100;
  const unidades = (its: It[]) => its.reduce((n, i) => n + i.quantity, 0);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {!autoPrint && (
        <div className="screen-bar">
          <button onClick={() => window.print()}>{publicView ? "Guardar / Imprimir" : "Imprimir"}</button>
          {!publicView && <button className="ghost" onClick={() => { window.close(); setTimeout(() => history.back(), 200); }}>Cerrar</button>}
        </div>
      )}
      {partes.map((items, pi) => {
        const ultima = pi === partes.length - 1, varias = partes.length > 1;
        return (
          <div className="tk" key={pi}>
            <div className="c">
              <div className="name">{b.name}</div>
              {b.header && <div className="small">{b.header}</div>}
              {b.address && <div className="small">{b.address}</div>}
              {b.phone && <div>Tel: {b.phone}</div>}
            </div>
            <div className="hr" />
            <div className="row"><span className="b">Ticket N° {String(s.id).padStart(6, "0")}</span><span>{date} {time}</span></div>
            {varias && <div className="part">BOLETA {pi + 1} DE {partes.length}</div>}
            <div>Cliente: {s.customer_name ? `${s.customer_name}${s.customer_doc ? ` (${s.customer_doc})` : ""}` : "Consumidor final"}</div>
            {s.customer_name && s.customer_address && <div>Dirección: {s.customer_address}</div>}
            {s.seller_name && <div>Atendió: {s.seller_name}</div>}
            {s.price_list === "wholesale" && <div>Lista: Mayorista</div>}
            {s.status === "voided" && <div className="void">VENTA ANULADA</div>}
            <div className="hr" />

            {items.map((it, i) => (
              <div key={i} className="item">
                <div className="item-name">{it.name}</div>
                <div className="row"><span>{it.quantity} x {money(it.unit_price)}</span><span>{money(it.subtotal)}</span></div>
              </div>
            ))}

            <div className="hr" />
            {!ultima ? (
              <>
                <div className="row small"><span>{unidades(items)} {unidades(items) === 1 ? "artículo" : "artículos"}</span><span /></div>
                <div className="row b"><span>Subtotal boleta {pi + 1}</span><span>{money(sumar(items))}</span></div>
                <div className="hr" />
                <div className="c small">Continúa en la boleta {pi + 2} de {partes.length}</div>
              </>
            ) : (
              <>
                {varias && partes.map((p2, k) => (
                  <div key={k} className="row small"><span>Boleta {k + 1} ({p2.length} prod.)</span><span>{money(sumar(p2))}</span></div>
                ))}
                {varias && <div className="hr" />}
                <div className="row small"><span>{units} {units === 1 ? "artículo" : "artículos"}{varias ? ` en ${partes.length} boletas` : ""}</span><span /></div>
                {s.discount > 0 && (
                  <>
                    <div className="row"><span>Subtotal</span><span>{money(s.subtotal)}</span></div>
                    <div className="row"><span>{discountLabel(s.subtotal, s.discount)}</span><span>- {money(s.discount)}</span></div>
                  </>
                )}
                <div className="row total"><span>{varias ? "TOTAL GENERAL" : "TOTAL"}</span><span>{money(s.total)}</span></div>
                {s.payments.map((p, i) => (
                  <div key={i} className="row"><span>{p.method === "cash" ? "Efectivo" : "Transferencia"}</span><span>{money(p.amount)}</span></div>
                ))}
                <div className="hr" />
                <div className="c">
                  <div className="b">{b.footer}</div>
                  <div className="small" style={{ marginTop: 4 }}>Comprobante no válido como factura</div>
                </div>
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
