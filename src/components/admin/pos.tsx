"use client";
// ═══════════════════════════════════════════════════════════════════
// PIEZAS DE CAJA Y VENTAS
// Las usan /admin/ventas (cualquier usuario) y /admin/caja (solo admin).
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import CustomerPicker, { type PickedCustomer } from "@/components/admin/CustomerPicker";
import { toWhatsApp, fmtPhone } from "@/lib/phone";
import { ticketPdf } from "@/lib/ticketPdf";

export const fmt = (n: number) => {
  const v = n || 0;
  const dec = Number.isInteger(Math.round(v * 100) / 100) ? 0 : 2;
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
};
export const fmtTime = (s: string) => new Date(s).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
export const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
export const r2 = (n: number) => Math.round(n * 100) / 100;
// Acepta "1500", "1.500", "1.500,50", "1500,5" y "10.5"
export const parseNum = (s: string) => {
  let t = String(s).trim().replace(/[\s$]/g, "");
  if (!t) return 0;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
};

export type Product = {
  id: number; name: string; sku: string | null; image_url: string | null; available: boolean;
  stock_quantity: number; price_retail: number; price_wholesale: number; category_name: string;
};
export type CartLine = { product: Product; quantity: number };
export type Summary = {
  session: { id: number; opened_at: string; opening_amount: number; status: string; closed_at?: string;
             counted_cash: number | null; difference: number | null; notes: string | null };
  sales_count: number; voided_count: number; sales_total: number; discount_total: number;
  cash_sales: number; transfer_sales: number; cash_in: number; cash_out: number;
  transfer_in: number; transfer_out: number; expected_cash: number; expected_transfer: number;
};
export type Sale = {
  id: number; status: "completed" | "voided"; created_at: string; total: number; subtotal: number; discount: number;
  price_list: string; void_reason: string | null; customer_name: string | null; seller_name?: string | null;
  items: { name: string; quantity: number; unit_price: number; subtotal: number }[];
  payments: { method: "cash" | "transfer"; amount: number }[];
};
export type Movement = { id: number; type: "income" | "expense"; method: "cash" | "transfer"; amount: number; reason: string; created_at: string };
type PayMode = "cash" | "transfer" | "mixed";

export const api = async (url: string, opts: RequestInit = {}) => {
  const res = await fetch(url, {
    credentials: "include",
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
};

// ─── Estilos compartidos (mismo look que el panel admin) ────────────
export const card = { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 13, padding: "16px 18px" };
export const inp = { width: "100%", padding: "10px 12px", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, color: "#1a1a1a", fontSize: 14, fontFamily: "inherit", outline: "none" } as const;
export const label = { fontSize: 11, color: "#444", display: "block", marginBottom: 5, fontWeight: 600 } as const;
export const btn = (v: "cyan" | "red" | "green" | "amber" | "gray" | "primary") => {
  const base = { padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600 as const, cursor: "pointer" as const, fontFamily: "inherit" };
  if (v === "primary") return { ...base, background: "#00B4D8", color: "#fff", border: "1px solid #00B4D8" };
  if (v === "cyan") return { ...base, background: "rgba(0,180,216,.1)", color: "#0891b2", border: "1px solid rgba(0,180,216,.3)" };
  if (v === "red") return { ...base, background: "rgba(239,68,68,.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,.3)" };
  if (v === "green") return { ...base, background: "rgba(16,185,129,.1)", color: "#059669", border: "1px solid rgba(16,185,129,.3)" };
  if (v === "amber") return { ...base, background: "rgba(245,158,11,.1)", color: "#d97706", border: "1px solid rgba(245,158,11,.3)" };
  return { ...base, background: "#f3f4f6", color: "#444", border: "1px solid #e5e7eb" };
};
export const seg = (active: boolean) => ({
  flex: 1, padding: "9px 8px", borderRadius: 8, fontSize: 13, fontWeight: 600 as const, cursor: "pointer" as const, fontFamily: "inherit",
  border: `1px solid ${active ? "rgba(0,180,216,.5)" : "#e5e7eb"}`, background: active ? "rgba(0,180,216,.12)" : "#fff", color: active ? "#0891b2" : "#666",
});

export function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  // Se dibuja directo en <body> para quedar por encima del menú fijo
  return createPortal(
    <div className="caja mo" onClick={onClose}>
      <div className="mb" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>,
    document.body
  );
}

// ─── Ticket (80 mm) ─────────────────────────────────────────────────
// Se imprime desde un marco oculto: no abre ventanas nuevas ni lo frena el bloqueador de pop-ups.
export function printTicket(saleId: number) {
  document.getElementById("ticket-frame")?.remove();
  const f = document.createElement("iframe");
  f.id = "ticket-frame";
  f.title = "Ticket";
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  f.src = `/ticket/${saleId}?imprimir=1`;
  document.body.appendChild(f);
}

// ─── Ticket por WhatsApp (por si falla la impresora) ───────────────
type TicketData = {
  sale: { id: number; status: string; created_at: string; total: number; subtotal: number; discount: number; customer_phone: string | null;
          price_list?: string | null; customer_name?: string | null; customer_address?: string | null;
          items: { name: string; quantity: number; unit_price: number; subtotal: number }[];
          payments: { method: "cash" | "transfer"; amount: number }[] };
  business: { name: string; footer: string; address?: string; phone?: string; header?: string };
  share_key: string | null;
};
function ticketMessage(d: TicketData) {
  const s = d.sale, dt = new Date(s.created_at);
  const when = `${dt.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })} ${dt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  const items = s.items.map((i) => i.quantity > 1
    ? `• ${i.quantity} x ${i.name}\n   ${fmt(i.unit_price)} c/u — *${fmt(i.subtotal)}*`
    : `• ${i.name} — *${fmt(i.subtotal)}*`).join("\n");
  const pays = s.payments.map((p) => `${p.method === "cash" ? "Efectivo" : "Transferencia"} ${fmt(p.amount)}`).join(" + ");
  const link = d.share_key ? `\n\nVer el comprobante: ${window.location.origin}/ticket/${s.id}?k=${d.share_key}` : "";
  return [
    `*${d.business.name}*`,
    `Comprobante de compra N° ${String(s.id).padStart(6, "0")} · ${when}`,
    s.status === "voided" ? "*VENTA ANULADA*" : "",
    "",
    items,
    "",
    s.discount > 0 ? `Descuento: -${fmt(s.discount)}` : "",
    `*TOTAL: ${fmt(s.total)}*`,
    pays ? `Pago: ${pays}` : "",
  ].filter((l, i, a) => l !== "" || (a[i - 1] !== "" && i > 0)).join("\n") + link + `\n\n${d.business.footer || "¡Gracias por su compra!"}\n_Comprobante no válido como factura_`;
}

// Números a los que se mandaron tickets (en esta compu), para elegirlos rápido
type Contact = { phone: string; name: string | null; customer_id?: number | null };
const RECENT_KEY = "ct_wa_recientes";
const readRecent = (): Contact[] => { try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
const saveRecent = (c: Contact) => {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([c, ...readRecent().filter((x) => x.phone !== c.phone)].slice(0, 40))); } catch {}
};
const digits = (s: string) => s.replace(/\D/g, "");

/** Ventana para mandar el ticket al WhatsApp del cliente.
 *  Recuerda los números: los de esta compu y los clientes guardados (con nombre). */
export function ShareTicket({ saleId, onClose, afterSale = false }: { saleId: number; onClose: () => void; afterSale?: boolean }) {
  const [data, setData] = useState<TicketData | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [pdfNote, setPdfNote] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Contact | null>(null);
  const [found, setFound] = useState<Contact[]>([]);
  const [recent] = useState<Contact[]>(() => readRecent());
  const [err, setErr] = useState("");
  useEffect(() => {
    api(`/api/pos/sales/${saleId}`).then((d: TicketData) => {
      setData(d);
      // El PDF se arma apenas llegan los datos, así al tocar "PDF" se comparte en el mismo clic
      ticketPdf(d).then((blob) => setPdf(new File([blob], `ticket-${String(saleId).padStart(6, "0")}.pdf`, { type: "application/pdf" }))).catch(() => {});
      if (d.sale.customer_phone) {
        setPhone(fmtPhone(d.sale.customer_phone));
        setPicked({ phone: d.sale.customer_phone, name: d.sale.customer_name || null });
      }
    }).catch((e) => setErr(e.message));
  }, [saleId]);

  // Buscar entre los clientes guardados por nombre o por número
  const q = phone.trim();
  useEffect(() => {
    if (picked || q.length < 3) { setFound([]); return; }
    // Con un número completo se busca por los últimos 8 dígitos (así encuentra "03865 15 …" guardado como 549…)
    const full = toWhatsApp(q);
    const term = full ? full.slice(-8) : /\d/.test(q) ? digits(q).replace(/^0/, "").slice(-8) : q;
    const t = setTimeout(() => {
      api(`/api/crm/customers?limit=12&q=${encodeURIComponent(term)}`)
        .then((rows: any[]) => setFound(rows.filter((r) => r.phone).slice(0, 6).map((r) => ({ phone: r.phone, name: r.name, customer_id: r.id }))))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q, picked]);

  const num = toWhatsApp(phone);
  const valid = !!num;
  const qd = digits(q);
  const recentShown = picked ? [] : recent.filter((c) => !q || (qd ? c.phone.includes(qd.replace(/^0/, "")) : (c.name || "").toLowerCase().includes(q.toLowerCase()))).slice(0, 6);
  const suggestions = [...found, ...recentShown.filter((r) => !found.some((f) => f.phone === r.phone))].slice(0, 8);
  const known = !!picked || found.some((f) => f.phone === num) || recent.some((r) => r.phone === num && r.name);

  const choose = (c: Contact) => { setPicked(c); setPhone(fmtPhone(c.phone)); setName(c.name || ""); };

  const remember = () => {
    if (!num) return;
    const who = picked?.name || name.trim() || null;
    saveRecent({ phone: num, name: who, customer_id: picked?.customer_id ?? null });
    api(`/api/pos/sales/${saleId}/share`, {
      method: "POST",
      body: JSON.stringify({ phone: num, name: picked ? null : name.trim() || null, customer_id: picked?.customer_id ?? null }),
    }).catch(() => {});
  };

  // Mandar el PDF: en el celular (y en la compu con Windows) se abre "Compartir" y se elige WhatsApp.
  // Si el navegador no puede compartir archivos: se descarga el PDF y se abre el chat para adjuntarlo.
  const sendPdf = async () => {
    if (!pdf || !data) return;
    const text = `Comprobante de compra N° ${String(saleId).padStart(6, "0")} – ${data.business.name}`;
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [pdf] })) {
      try { await navigator.share({ files: [pdf], title: text, text }); remember(); onClose(); return; }
      catch (e: any) { if (e?.name === "AbortError") return; }
    }
    const url = URL.createObjectURL(pdf);
    const a = document.createElement("a"); a.href = url; a.download = pdf.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    if (num) {
      window.open(`https://wa.me/${num}?text=${encodeURIComponent(`¡Hola! Te envío el comprobante de tu compra (N° ${String(saleId).padStart(6, "0")}). Te lo adjunto en PDF.`)}`, "_blank", "noopener");
      remember();
      setPdfNote(`Se descargó ${pdf.name}. En el chat que se abrió, tocá el clip 📎 y adjuntalo.`);
    } else {
      setPdfNote(`Se descargó ${pdf.name}. Para mandarlo por WhatsApp, escribí el número arriba y tocá "PDF" de nuevo.`);
    }
  };

  const send = () => {
    if (!data || !num) return;
    // Se abre en el mismo clic (si no, el navegador lo bloquea)
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(ticketMessage(data))}`, "_blank", "noopener");
    remember();   // queda guardado (y el cliente se crea si se escribió el nombre) — no frena el envío si falla
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      {afterSale && <div style={{ fontSize: 13, fontWeight: 700, color: "#059669", background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.3)", borderRadius: 8, padding: "7px 10px", marginBottom: 10 }}>✓ Venta #{saleId} cobrada{data ? ` · ${fmt(data.sale.total)}` : ""}</div>}
      <h3 style={{ fontSize: 17, fontWeight: 700 }}>Enviar ticket por WhatsApp</h3>
      <p style={{ fontSize: 13, color: "#666", marginTop: 4 }}>{afterSale ? "" : `Venta #${saleId}${data ? ` · ${fmt(data.sale.total)}` : ""}. `}Buscá el cliente o escribí su número.</p>
      {err && <p style={{ color: "#ef4444", fontSize: 13, marginTop: 8 }}>{err}</p>}

      <label style={{ ...label, marginTop: 14 }}>WHATSAPP O NOMBRE DEL CLIENTE</label>
      <div style={{ position: "relative" }}>
        <input style={{ ...inp, fontSize: 18, fontWeight: 700, letterSpacing: ".02em", paddingRight: picked ? 40 : 12 }} autoFocus inputMode="text" value={phone}
          onChange={(e) => { setPhone(e.target.value); setPicked(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") { if (valid) send(); else if (suggestions[0]) choose(suggestions[0]); } }}
          placeholder="Ej: 3865 575938 o Juan" />
        {picked && <button onClick={() => { setPicked(null); setPhone(""); setName(""); }} aria-label="Borrar"
          style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: 0, background: "none", fontSize: 18, color: "#999", cursor: "pointer" }}>×</button>}
      </div>
      {picked?.name && <p style={{ fontSize: 13, marginTop: 6, color: "#059669", fontWeight: 600 }}>✓ {picked.name}</p>}

      {suggestions.length > 0 && (
        <div style={{ marginTop: 8, border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#98a2b3", padding: "6px 12px", background: "#fafbfc" }}>{q ? "COINCIDEN" : "ÚLTIMOS ENVIADOS"}</div>
          {suggestions.map((c) => (
            <button key={c.phone} onClick={() => choose(c)}
              style={{ display: "flex", justifyContent: "space-between", gap: 10, width: "100%", padding: "9px 12px", border: 0, borderTop: "1px solid #f2f4f7", background: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 14, textAlign: "left" }}>
              <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name || "Sin nombre"}</span>
              <span style={{ color: "#667085", whiteSpace: "nowrap" }}>{fmtPhone(c.phone)}</span>
            </button>
          ))}
        </div>
      )}

      {!picked && (
        <p style={{ fontSize: 12, marginTop: 6, color: phone && !valid && /\d{3}/.test(phone) ? "#ef4444" : "#888" }}>
          {phone && !valid && /\d{3}/.test(phone) ? "Número incompleto: va con característica (ej. 3865 575938)" : num ? `Se envía a +${num}` : "Con característica; acepta 0 y 15"}
        </p>
      )}

      {valid && !known && (
        <>
          <label style={{ ...label, marginTop: 12 }}>NOMBRE <span style={{ fontWeight: 500, color: "#999" }}>(opcional · lo guarda como cliente)</span></label>
          <input style={inp} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder="Ej: Juan Pérez" />
        </>
      )}

      {pdfNote && <p style={{ fontSize: 12, marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "#eff6ff", color: "#1d4ed8" }}>{pdfNote}</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button onClick={onClose} style={btn("gray")}>{afterSale ? "No enviar" : "Cancelar"}</button>
        <button onClick={sendPdf} disabled={!pdf} title="Manda el ticket como archivo PDF"
          style={{ ...btn("gray"), fontWeight: 700, opacity: pdf ? 1 : 0.5 }}>
          📄 PDF
        </button>
        <button onClick={send} disabled={!data || !valid}
          style={{ ...btn("primary"), background: "#25D366", borderColor: "#25D366", opacity: !data || !valid ? 0.5 : 1 }}>
          Enviar por WhatsApp
        </button>
      </div>
    </Modal>
  );
}

// Imprimir el ticket al cobrar: apagado por defecto (ahora el ticket se manda por WhatsApp)
const AUTO_TICKET_KEY = "ct_auto_ticket_v2";
const readAutoTicket = () => { try { return localStorage.getItem(AUTO_TICKET_KEY) === "1"; } catch { return false; } };
const saveAutoTicket = (v: boolean) => { try { localStorage.setItem(AUTO_TICKET_KEY, v ? "1" : "0"); } catch {} };

export function Row({ k, v, strong, color }: { k: string; v: string; strong?: boolean; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: strong ? 15 : 13, fontWeight: strong ? 700 : 500, color: color || "#1a1a1a" }}>
      <span style={{ color: strong ? "#1a1a1a" : "#666" }}>{k}</span><span>{v}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// APERTURA DE CAJA (cuando no hay una abierta) + historial
// ═══════════════════════════════════════════════════════════════════
export function OpenCash({ onOpened }: { onOpened: () => void }) {
  const [amount, setAmount] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => { api("/api/pos/sessions").then(setHistory).catch(() => {}); }, []);

  const open = async () => {
    setBusy(true); setErr("");
    try {
      await api("/api/pos/session", { method: "POST", body: JSON.stringify({ opening_amount: parseNum(amount) }) });
      onOpened();
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ ...card, maxWidth: 440 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>La caja está cerrada</h2>
        <p style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>Ingresá el efectivo con el que arranca el turno.</p>
        <label style={label}>EFECTIVO INICIAL</label>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === "Enter" && open()}
          inputMode="decimal" placeholder="0" autoFocus style={{ ...inp, fontSize: 18, fontWeight: 700 }} />
        {err && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 8 }}>{err}</p>}
        <button onClick={open} disabled={busy} style={{ ...btn("primary"), width: "100%", marginTop: 14, padding: 12, fontSize: 14, opacity: busy ? .6 : 1 }}>
          {busy ? "Abriendo..." : "Abrir caja"}
        </button>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Últimos cierres de caja</h3>
        {history.length === 0 ? <p style={{ fontSize: 13, color: "#999" }}>Todavía no hay cierres.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Apertura</th><th>Cierre</th><th>Ventas</th><th>Total vendido</th><th>Efectivo esperado</th><th>Contado</th><th>Diferencia</th></tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>{fmtDateTime(h.opened_at)}</td>
                    <td>{fmtDateTime(h.closed_at)}</td>
                    <td>{h.sales_count}</td>
                    <td>{fmt(h.sales_total)}</td>
                    <td>{fmt(h.expected_cash)}</td>
                    <td>{fmt(h.counted_cash)}</td>
                    <td style={{ fontWeight: 700, color: h.difference === 0 ? "#059669" : h.difference > 0 ? "#d97706" : "#ef4444" }}>
                      {h.difference > 0 ? "+" : ""}{fmt(h.difference)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PANTALLA DE VENTA
// ═══════════════════════════════════════════════════════════════════
export function SaleScreen({ onSold }: { onSold: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [hi, setHi] = useState(0);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [priceList, setPriceList] = useState<"retail" | "wholesale">("wholesale"); // pedido del cliente: mayorista por defecto
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [discMode, setDiscMode] = useState<"$" | "%">("$");
  const [discInput, setDiscInput] = useState("");
  const [payMode, setPayMode] = useState<PayMode>("cash");
  const [received, setReceived] = useState("");
  const [transferPart, setTransferPart] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; saleId?: number } | null>(null);
  const [shareId, setShareId] = useState<number | null>(null);
  const [autoTicket, setAutoTicket] = useState(false);
  const [lastAdded, setLastAdded] = useState<number | null>(null);
  const cartRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setAutoTicket(readAutoTicket()); }, []);
  const searchRef = useRef<HTMLInputElement>(null);
  const reqId = useRef(0);

  // Búsqueda con debounce
  useEffect(() => {
    const term = q.trim();
    if (!term) { setResults([]); return; }
    const my = ++reqId.current;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const data = await api(`/api/pos/products?q=${encodeURIComponent(term)}`);
        if (my === reqId.current) { setResults(data); setHi(0); }
      } catch { if (my === reqId.current) setResults([]); }
      finally { if (my === reqId.current) setSearching(false); }
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const unitPrice = (p: Product) => (priceList === "wholesale" ? p.price_wholesale : p.price_retail);
  const inCart = (id: number) => cart.find((l) => l.product.id === id)?.quantity || 0;

  const add = (p: Product) => {
    if (p.stock_quantity - inCart(p.id) <= 0) { setMsg({ ok: false, text: `Sin stock disponible de ${p.name}` }); return; }
    setMsg(null);
    setCart((c) => {
      const ex = c.find((l) => l.product.id === p.id);
      if (ex) return c.map((l) => (l.product.id === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [...c, { product: p, quantity: 1 }];
    });
    setQ(""); setResults([]);
    setLastAdded(p.id);
    searchRef.current?.focus();
  };

  // Al agregar un producto, la lista baja hasta ese renglón y lo resalta un momento
  useEffect(() => {
    if (lastAdded == null) return;
    const el = cartRef.current?.querySelector(`[data-pid="${lastAdded}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const t = setTimeout(() => setLastAdded(null), 1200);
    return () => clearTimeout(t);
  }, [lastAdded, cart]);

  const setQty = (id: number, qty: number) =>
    setCart((c) => c.map((l) => (l.product.id === id ? { ...l, quantity: Math.max(1, Math.min(qty || 1, l.product.stock_quantity)) } : l)));
  const remove = (id: number) => setCart((c) => c.filter((l) => l.product.id !== id));

  // Totales
  const subtotal = r2(cart.reduce((s, l) => s + unitPrice(l.product) * l.quantity, 0));
  const discRaw = parseNum(discInput);
  const discount = r2(Math.min(subtotal, Math.max(0, discMode === "%" ? (subtotal * discRaw) / 100 : discRaw)));
  const total = r2(subtotal - discount);
  const transferAmt = payMode === "transfer" ? total : payMode === "mixed" ? r2(Math.min(total, parseNum(transferPart))) : 0;
  const cashAmt = r2(total - transferAmt);
  const receivedNum = parseNum(received);
  const change = received && cashAmt > 0 ? r2(receivedNum - cashAmt) : null;
  const canCharge = cart.length > 0 && !busy && (change === null || change >= 0);

  const reset = () => {
    setCart([]); setDiscInput(""); setDiscMode("$"); setReceived(""); setTransferPart(""); setPayMode("cash"); setPriceList("wholesale"); setCustomer(null);
  };
  // Cliente mayorista → pasa solo a lista mayorista
  const pickCustomer = (c: PickedCustomer | null) => {
    setCustomer(c);
    if (c?.customer_type === "wholesale") setPriceList("wholesale");
  };

  const charge = async (sendWa = true) => {
    if (!canCharge) return;
    setBusy(true); setMsg(null);
    const payments = [
      ...(cashAmt > 0 ? [{ method: "cash", amount: cashAmt }] : []),
      ...(transferAmt > 0 ? [{ method: "transfer", amount: transferAmt }] : []),
    ];
    try {
      const sale = await api("/api/pos/sales", {
        method: "POST",
        body: JSON.stringify({
          items: cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
          price_list: priceList, discount, payments, customer_id: customer?.id ?? null,
        }),
      });
      const vuelto = change && change > 0 ? ` · Vuelto: ${fmt(change)}` : "";
      const quien = customer ? ` a ${customer.name}` : "";
      setMsg({ ok: true, text: `Venta #${sale.id}${quien} registrada por ${fmt(sale.total)}${vuelto}`, saleId: sale.id });
      if (autoTicket) printTicket(sale.id);
      if (sendWa) setShareId(sale.id);   // se abre la ventana para mandar el ticket por WhatsApp
      reset();
      onSold();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
      searchRef.current?.focus();
    }
  };

  // Atajos para cobrar: F2 o Ctrl+Enter
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (document.querySelector(".mo")) return; // hay una ventana abierta
      if (e.key === "F2" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) { e.preventDefault(); charge(true); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  // Busca ya mismo (sin esperar) y agrega si hay una coincidencia exacta o un solo resultado
  const quickAdd = async (term: string) => {
    reqId.current++;
    try {
      const data: Product[] = await api(`/api/pos/products?q=${encodeURIComponent(term)}`);
      const exact = data.find((p) => p.sku?.toLowerCase() === term.toLowerCase() || String(p.id) === term);
      const pick = exact || (data.length === 1 ? data[0] : null);
      if (pick) add(pick);
      else { setResults(data); setHi(0); setSearching(false); if (!data.length) setMsg({ ok: false, text: `No se encontró "${term}"` }); }
    } catch (e: any) { setMsg({ ok: false, text: e.message }); }
  };

  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const term = q.trim();
      if (!term) return;
      // Lector de código de barras: escribe el código y Enter al instante, antes de que lleguen los resultados
      const exact = results.find((p) => p.sku?.toLowerCase() === term.toLowerCase() || String(p.id) === term);
      if (exact) { add(exact); return; }
      if (results[hi] && !searching) { add(results[hi]); return; }
      quickAdd(term);
    }
    else if (e.key === "Escape") { setQ(""); setResults([]); }
  };

  return (
    <div className="pos-grid">
      {/* ── IZQUIERDA: buscador + carrito ── */}
      <div className="pos-left">
        <div style={card}>
          <div style={{ position: "relative" }}>
          <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onSearchKey} autoFocus
            placeholder="Buscar o escanear producto…  (↑↓ elegir · Enter agregar · F2 cobrar)"
            style={{ ...inp, fontSize: 15, padding: "13px 14px" }} />
          {q.trim() && (
            <div className="results">
              {searching && results.length === 0 && <div style={{ padding: 12, fontSize: 13, color: "#999" }}>Buscando…</div>}
              {!searching && results.length === 0 && <div style={{ padding: 12, fontSize: 13, color: "#999" }}>Sin resultados</div>}
              {results.map((p, i) => {
                const left = p.stock_quantity - inCart(p.id);
                return (
                  <div key={p.id} onMouseDown={(e) => { e.preventDefault(); add(p); }} onMouseEnter={() => setHi(i)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", cursor: left > 0 ? "pointer" : "not-allowed",
                             background: i === hi ? "rgba(0,180,216,.08)" : "#fff", borderBottom: "1px solid #f3f4f6", opacity: left > 0 ? 1 : .5 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 7, background: "#f3f4f6", flexShrink: 0, overflow: "hidden" }}>
                      {p.image_url && <img src={p.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</p>
                      <p style={{ fontSize: 11, color: "#888" }}>
                        #{p.id}{p.sku ? ` · ${p.sku}` : ""} · {p.category_name} ·{" "}
                        <span style={{ color: left <= 0 ? "#ef4444" : left <= 3 ? "#d97706" : "#059669", fontWeight: 600 }}>
                          {left <= 0 ? "Sin stock" : `${left} en stock`}
                        </span>
                      </p>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#0891b2" }}>{fmt(unitPrice(p))}</span>
                  </div>
                );
              })}
            </div>
          )}
          </div>

          {/* Total de la venta, en horizontal debajo del buscador */}
          <div className="sale-total">
            <div className="st-info">
              <span><b>{cart.reduce((s, l) => s + l.quantity, 0)}</b> {cart.reduce((s, l) => s + l.quantity, 0) === 1 ? "artículo" : "artículos"}</span>
              <span>Subtotal <b>{fmt(subtotal)}</b></span>
              {discount > 0 && <span style={{ color: "#d97706" }}>Descuento <b>− {fmt(discount)}</b></span>}
              <span style={{ color: priceList === "wholesale" ? "#7c3aed" : "#0369a1", fontWeight: 700 }}>Precios {priceList === "wholesale" ? "mayoristas" : "minoristas"}</span>
            </div>
            <div className="st-total">
              <span>TOTAL</span>
              <strong>{fmt(total)}</strong>
            </div>
          </div>
        </div>

        <div style={{ ...card, padding: 0 }} className="pos-cart">
          <div className="cart-head">
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>
              Venta actual {cart.length > 0 && <span style={{ color: "#999", fontWeight: 500 }}>· {cart.length} {cart.length === 1 ? "producto" : "productos"} · {cart.reduce((s, l) => s + l.quantity, 0)} u.</span>}
            </h3>
            {cart.length > 0 && <button onClick={reset} style={{ ...btn("gray"), padding: "6px 12px" }}>Vaciar</button>}
          </div>
          {cart.length === 0 ? (
            <p style={{ fontSize: 13, color: "#999", padding: "28px 0", textAlign: "center" }}>Buscá un producto para empezar la venta.</p>
          ) : (
            <div className="cart-table" ref={cartRef}>
              <div className="cart-row cart-th">
                <span>Producto</span><span className="c">Cant.</span><span className="r">P. unit.</span><span className="r">Total</span><span />
              </div>
              {cart.map((l, i) => (
                <div key={l.product.id} data-pid={l.product.id} className={`cart-row ${lastAdded === l.product.id ? "flash" : ""}`}>
                  <span className="cart-name" title={l.product.name}>
                    <b>{i + 1}.</b> {l.product.name}
                    <small>stock {l.product.stock_quantity}</small>
                  </span>
                  <span className="cart-qty">
                    <button onClick={() => setQty(l.product.id, l.quantity - 1)} disabled={l.quantity <= 1} aria-label="Menos">−</button>
                    <input value={l.quantity} onChange={(e) => setQty(l.product.id, parseInt(e.target.value))} inputMode="numeric" aria-label="Cantidad" />
                    <button onClick={() => setQty(l.product.id, l.quantity + 1)} disabled={l.quantity >= l.product.stock_quantity} aria-label="Más">+</button>
                  </span>
                  <span className="r cart-unit">{fmt(unitPrice(l.product))}</span>
                  <span className="r cart-sub">{fmt(unitPrice(l.product) * l.quantity)}</span>
                  <button className="cart-x" onClick={() => remove(l.product.id)} title="Quitar" aria-label="Quitar">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── DERECHA: cobro ── */}
      <div style={card} className="pos-pay">
        <label style={label}>CLIENTE <span style={{ fontWeight: 500, color: "#9ca3af" }}>(opcional)</span></label>
        <div style={{ marginBottom: 14 }}>
          <CustomerPicker value={customer} onChange={pickCustomer} />
        </div>

        <label style={label}>LISTA DE PRECIOS</label>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <button onClick={() => setPriceList("wholesale")} style={seg(priceList === "wholesale")}>Mayorista</button>
          <button onClick={() => setPriceList("retail")} style={seg(priceList === "retail")}>Minorista</button>
        </div>

        <label style={label}>DESCUENTO</label>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <input value={discInput} onChange={(e) => setDiscInput(e.target.value)} inputMode="decimal" placeholder="0" style={{ ...inp, flex: 1 }} />
          <button onClick={() => setDiscMode("$")} style={{ ...seg(discMode === "$"), flex: "0 0 44px" }}>$</button>
          <button onClick={() => setDiscMode("%")} style={{ ...seg(discMode === "%"), flex: "0 0 44px" }}>%</button>
        </div>

        <label style={label}>FORMA DE PAGO</label>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <button onClick={() => setPayMode("cash")} style={seg(payMode === "cash")}>Efectivo</button>
          <button onClick={() => setPayMode("transfer")} style={seg(payMode === "transfer")}>Transferencia</button>
          <button onClick={() => setPayMode("mixed")} style={seg(payMode === "mixed")}>Mixto</button>
        </div>

        {payMode === "mixed" && (
          <div style={{ marginBottom: 10 }}>
            <label style={label}>MONTO POR TRANSFERENCIA</label>
            <input value={transferPart} onChange={(e) => setTransferPart(e.target.value)} inputMode="decimal" placeholder="0" style={inp} />
            <p style={{ fontSize: 12, color: "#666", marginTop: 5 }}>Resto en efectivo: <b>{fmt(cashAmt)}</b></p>
          </div>
        )}

        {cashAmt > 0 && (
          <div style={{ marginBottom: 12 }}>
            <label style={label}>EFECTIVO RECIBIDO <span style={{ fontWeight: 400, color: "#999" }}>(opcional, para el vuelto)</span></label>
            <input value={received} onChange={(e) => setReceived(e.target.value)} inputMode="decimal" placeholder={String(cashAmt)} style={inp} />
            {change !== null && (
              <p style={{ fontSize: 14, fontWeight: 700, marginTop: 6, color: change < 0 ? "#ef4444" : "#059669" }}>
                {change < 0 ? `Faltan ${fmt(-change)}` : `Vuelto: ${fmt(change)}`}
              </p>
            )}
          </div>
        )}

        <button onClick={() => charge(true)} disabled={!canCharge}
          style={{ ...btn("primary"), width: "100%", padding: "12px 14px", fontSize: 16, fontWeight: 800, opacity: canCharge ? 1 : .5,
                   background: "#16a34a", borderColor: "#16a34a", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <span>{busy ? "Registrando…" : `Cobrar ${fmt(total)}`}</span>
          {!busy && <span style={{ fontSize: 12, fontWeight: 600, opacity: .9 }}>y enviar ticket por WhatsApp</span>}
        </button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => charge(false)} disabled={!canCharge}
            style={{ border: 0, background: "none", padding: 0, fontSize: 12, color: canCharge ? "#475467" : "#c0c4cc", textDecoration: "underline", cursor: canCharge ? "pointer" : "default", fontFamily: "inherit" }}>
            Cobrar sin enviar
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#667085", cursor: "pointer" }}>
            <input type="checkbox" checked={autoTicket} onChange={(e) => { setAutoTicket(e.target.checked); saveAutoTicket(e.target.checked); }} style={{ accentColor: "#00B4D8" }} />
            Imprimir
          </label>
          <span style={{ fontSize: 11, color: "#999" }}>F2</span>
        </div>

        {msg && (
          <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                        background: msg.ok ? "rgba(16,185,129,.1)" : "rgba(239,68,68,.1)", color: msg.ok ? "#059669" : "#ef4444",
                        border: `1px solid ${msg.ok ? "rgba(16,185,129,.3)" : "rgba(239,68,68,.3)"}` }}>
            {msg.text}
            {msg.saleId && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                <button onClick={() => printTicket(msg.saleId!)} style={{ ...btn("gray"), padding: "5px 10px", fontSize: 12 }}>
                  🖨 Imprimir de nuevo
                </button>
                <button onClick={() => setShareId(msg.saleId!)} style={{ ...btn("green"), padding: "5px 10px", fontSize: 12 }}>
                  📱 Enviar por WhatsApp
                </button>
              </div>
            )}
        {shareId && <ShareTicket saleId={shareId} afterSale onClose={() => { setShareId(null); setTimeout(() => searchRef.current?.focus(), 50); }} />}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VENTAS DEL TURNO
// ═══════════════════════════════════════════════════════════════════
export function SalesList({ refreshKey, onChange, canVoid }: { refreshKey: number; onChange: () => void; canVoid: boolean }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [voiding, setVoiding] = useState<Sale | null>(null);
  const [shareId, setShareId] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "cash" | "transfer" | "voided">("all");
  const [open, setOpen] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api("/api/pos/sales").then(setSales).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load, refreshKey]);

  const doVoid = async () => {
    if (!voiding) return;
    setBusy(true); setErr("");
    try {
      await api(`/api/pos/sales/${voiding.id}/void`, { method: "POST", body: JSON.stringify({ reason }) });
      setVoiding(null); setReason(""); load(); onChange();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const payLabel = (s: Sale) => s.payments.map((p) => `${p.method === "cash" ? "Efectivo" : "Transf."} ${fmt(p.amount)}`).join(" + ") || "—";

  // Resumen del turno (solo ventas vigentes)
  const ok = sales.filter((x) => x.status === "completed");
  const sum = {
    count: ok.length,
    total: ok.reduce((a, x) => a + x.total, 0),
    cash: ok.reduce((a, x) => a + x.payments.filter((p) => p.method === "cash").reduce((b, p) => b + p.amount, 0), 0),
    transfer: ok.reduce((a, x) => a + x.payments.filter((p) => p.method === "transfer").reduce((b, p) => b + p.amount, 0), 0),
    units: ok.reduce((a, x) => a + x.items.reduce((b, i) => b + i.quantity, 0), 0),
    voided: sales.length - ok.length,
  };
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = sales.filter((x) =>
    (filter === "all" || (filter === "voided" ? x.status === "voided"
      : x.status === "completed" && x.payments.some((p) => p.method === filter))) &&
    words.every((w) => `#${x.id} ${x.id} ${x.customer_name || "consumidor final"} ${x.seller_name || ""} ${x.items.map((i) => i.name).join(" ")}`.toLowerCase().includes(w)));

  return (
    <div style={card}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Ventas de esta caja</h3>

      {!loading && sales.length > 0 && (
        <>
          <div className="sl-sum">
            <div><span>Ventas</span><b>{sum.count}</b><small>{sum.units} unidades</small></div>
            <div className="main"><span>Total vendido</span><b>{fmt(sum.total)}</b><small>{sum.count ? `promedio ${fmt(sum.total / sum.count)}` : "—"}</small></div>
            <div><span>Efectivo</span><b>{fmt(sum.cash)}</b></div>
            <div><span>Transferencia</span><b>{fmt(sum.transfer)}</b></div>
            {sum.voided > 0 && <div className="void"><span>Anuladas</span><b>{sum.voided}</b></div>}
          </div>
          <div className="sl-tools">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por N°, cliente o producto…" style={{ ...inp, flex: "1 1 220px" }} />
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {([["all", "Todas"], ["cash", "Efectivo"], ["transfer", "Transferencia"], ...(sum.voided ? [["voided", "Anuladas"]] : [])] as [typeof filter, string][]).map(([k, l]) => (
                <button key={k} onClick={() => setFilter(k)} style={{ ...seg(filter === k), flex: "0 0 auto", padding: "7px 12px", fontSize: 12 }}>{l}</button>
              ))}
            </div>
          </div>
        </>
      )}

      {loading ? <p style={{ fontSize: 13, color: "#999" }}>Cargando…</p> : sales.length === 0 ? (
        <p style={{ fontSize: 13, color: "#999" }}>Todavía no hay ventas en este turno.</p>
      ) : (
        <div className="sl-table">
          <div className="sl-row sl-th"><span>N°</span><span>Hora</span><span>Cliente</span><span>Productos</span><span>Pago</span><span className="r">Total</span><span /></div>
          {shown.length === 0 && <p style={{ fontSize: 13, color: "#999", padding: 16, textAlign: "center" }}>Ninguna venta coincide.</p>}
          {shown.map((x) => {
            const units = x.items.reduce((a, i) => a + i.quantity, 0);
            const isOpen = open === x.id;
            return (
              <div key={x.id} className={`sl-item ${x.status === "voided" ? "voided" : ""} ${isOpen ? "open" : ""}`}>
                <div className="sl-row" onClick={() => setOpen(isOpen ? null : x.id)} role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") setOpen(isOpen ? null : x.id); }}>
                  <span className="sl-id">#{x.id}</span>
                  <span className="sl-muted">{fmtTime(x.created_at)}</span>
                  <span className="sl-cli">
                    {x.customer_name || <i>Consumidor final</i>}
                    {x.price_list === "wholesale" && <em>May.</em>}
                    {x.status === "voided" && <em className="v">Anulada</em>}
                  </span>
                  <span className="sl-prods">{x.items.length === 1 ? `${x.items[0].quantity > 1 ? `${x.items[0].quantity}× ` : ""}${x.items[0].name}` : `${x.items.length} productos · ${units} u.`}</span>
                  <span className="sl-muted">{x.payments.length > 1 ? "Mixto" : x.payments[0]?.method === "transfer" ? "Transferencia" : "Efectivo"}</span>
                  <span className="r sl-total">{fmt(x.total)}</span>
                  <span className="sl-acts" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setShareId(x.id)} title="Enviar ticket por WhatsApp" className="sl-wa">WhatsApp</button>
                    <button onClick={() => printTicket(x.id)} title="Imprimir ticket" className="sl-btn">🖨</button>
                    {canVoid && x.status === "completed" && <button onClick={() => { setVoiding(x); setReason(""); setErr(""); }} title="Anular" className="sl-btn red">Anular</button>}
                    <span className="sl-chev">{isOpen ? "▴" : "▾"}</span>
                  </span>
                </div>
                {isOpen && (
                  <div className="sl-detail">
                    {x.items.map((i, k) => (
                      <div key={k} className="sl-line">
                        <span>{i.name}</span>
                        <span className="sl-muted">{i.quantity} × {fmt(i.unit_price)}</span>
                        <b>{fmt(i.subtotal)}</b>
                      </div>
                    ))}
                    {x.discount > 0 && <div className="sl-line"><span>Descuento</span><span /><b style={{ color: "#d97706" }}>− {fmt(x.discount)}</b></div>}
                    <div className="sl-line" style={{ borderTop: "1px dashed #e5e7eb", paddingTop: 6 }}>
                      <span className="sl-muted">{payLabel(x)}{x.seller_name ? ` · vendió ${x.seller_name}` : ""}{x.void_reason ? ` · Motivo: ${x.void_reason}` : ""}</span>
                      <span /><b>{fmt(x.total)}</b>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {shareId && <ShareTicket saleId={shareId} onClose={() => setShareId(null)} />}
      {voiding && (
        <Modal onClose={() => setVoiding(null)}>
          <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Anular venta #{voiding.id}</h3>
          <p style={{ fontSize: 13, color: "#666", marginBottom: 14 }}>
            Se devuelve el stock de {voiding.items.reduce((s, i) => s + i.quantity, 0)} unidades y {fmt(voiding.total)} deja de contar en la caja.
          </p>
          <label style={label}>MOTIVO</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus placeholder="Ej: el cliente lo devolvió / error de carga" style={inp} />
          {err && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 8 }}>{err}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={() => setVoiding(null)} style={{ ...btn("gray"), flex: 1 }}>Cancelar</button>
            <button onClick={doVoid} disabled={busy || !reason.trim()} style={{ ...btn("red"), flex: 1, opacity: busy || !reason.trim() ? .5 : 1 }}>
              {busy ? "Anulando…" : "Anular venta"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// INGRESOS / RETIROS MANUALES
// ═══════════════════════════════════════════════════════════════════
export function Movements({ refreshKey, onChange }: { refreshKey: number; onChange: () => void }) {
  const [list, setList] = useState<Movement[]>([]);
  const [type, setType] = useState<"income" | "expense">("expense");
  const [method, setMethod] = useState<"cash" | "transfer">("cash");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => { api("/api/pos/movements").then(setList).catch(() => {}); }, []);
  useEffect(load, [load, refreshKey]);

  const save = async () => {
    setBusy(true); setErr("");
    try {
      await api("/api/pos/movements", { method: "POST", body: JSON.stringify({ type, method, amount: parseNum(amount), reason }) });
      setAmount(""); setReason(""); load(); onChange();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="mov-grid">
      <div style={card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Nuevo movimiento</h3>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <button onClick={() => setType("expense")} style={seg(type === "expense")}>Retiro / gasto</button>
          <button onClick={() => setType("income")} style={seg(type === "income")}>Ingreso</button>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <button onClick={() => setMethod("cash")} style={seg(method === "cash")}>Efectivo</button>
          <button onClick={() => setMethod("transfer")} style={seg(method === "transfer")}>Transferencia</button>
        </div>
        <label style={label}>MONTO</label>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" style={{ ...inp, marginBottom: 10 }} />
        <label style={label}>MOTIVO</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder={type === "expense" ? "Ej: pago de flete, retiro del dueño" : "Ej: cambio agregado a la caja"} style={inp} />
        {err && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 8 }}>{err}</p>}
        <button onClick={save} disabled={busy || !amount || !reason.trim()}
          style={{ ...btn(type === "expense" ? "amber" : "green"), width: "100%", marginTop: 12, padding: 11, opacity: busy || !amount || !reason.trim() ? .5 : 1 }}>
          {busy ? "Guardando…" : type === "expense" ? "Registrar retiro" : "Registrar ingreso"}
        </button>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Movimientos del turno</h3>
        {list.length === 0 ? <p style={{ fontSize: 13, color: "#999" }}>Sin movimientos.</p> : list.map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "9px 0", borderBottom: "1px solid #f3f4f6" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600 }}>{m.reason}</p>
              <p style={{ fontSize: 11, color: "#888" }}>{fmtTime(m.created_at)} · {m.method === "cash" ? "Efectivo" : "Transferencia"}</p>
            </div>
            <span style={{ fontWeight: 700, color: m.type === "income" ? "#059669" : "#d97706" }}>
              {m.type === "income" ? "+" : "−"} {fmt(m.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CIERRE DE CAJA CON ARQUEO
// ═══════════════════════════════════════════════════════════════════
export function CloseCash({ summary, onClose, onClosed }: { summary: Summary; onClose: () => void; onClosed: (s: Summary) => void }) {
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const diff = counted === "" ? null : r2(parseNum(counted) - summary.expected_cash);

  const close = async () => {
    setBusy(true); setErr("");
    try {
      const res = await api("/api/pos/session/close", { method: "POST", body: JSON.stringify({ counted_cash: parseNum(counted), notes }) });
      onClosed(res);
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };

  return (
    <Modal onClose={onClose}>
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Cerrar caja</h3>
      <div style={{ background: "#f9fafb", borderRadius: 10, padding: "8px 14px", marginBottom: 14 }}>
        <Row k="Efectivo inicial" v={fmt(summary.session.opening_amount)} />
        <Row k="Ventas en efectivo" v={`+ ${fmt(summary.cash_sales)}`} />
        {summary.cash_in > 0 && <Row k="Ingresos en efectivo" v={`+ ${fmt(summary.cash_in)}`} />}
        {summary.cash_out > 0 && <Row k="Retiros en efectivo" v={`− ${fmt(summary.cash_out)}`} />}
        <div style={{ borderTop: "1px solid #e5e7eb", marginTop: 4 }}><Row k="Efectivo esperado" v={fmt(summary.expected_cash)} strong /></div>
        <Row k="Transferencias (no se cuentan)" v={fmt(summary.expected_transfer)} />
        <Row k={`Total vendido (${summary.sales_count} ventas)`} v={fmt(summary.sales_total)} />
      </div>

      <label style={label}>EFECTIVO CONTADO EN CAJA</label>
      <input value={counted} onChange={(e) => setCounted(e.target.value)} inputMode="decimal" autoFocus placeholder="0" style={{ ...inp, fontSize: 18, fontWeight: 700 }} />
      {diff !== null && (
        <p style={{ fontSize: 14, fontWeight: 700, marginTop: 6, color: diff === 0 ? "#059669" : diff > 0 ? "#d97706" : "#ef4444" }}>
          {diff === 0 ? "✓ La caja cierra justa" : diff > 0 ? `Sobran ${fmt(diff)}` : `Faltan ${fmt(-diff)}`}
        </p>
      )}
      <label style={{ ...label, marginTop: 12 }}>OBSERVACIONES <span style={{ fontWeight: 400, color: "#999" }}>(opcional)</span></label>
      <input value={notes} onChange={(e) => setNotes(e.target.value)} style={inp} />
      {err && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 8 }}>{err}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={onClose} style={{ ...btn("gray"), flex: 1 }}>Cancelar</button>
        <button onClick={close} disabled={busy || counted === ""} style={{ ...btn("primary"), flex: 1, opacity: busy || counted === "" ? .5 : 1 }}>
          {busy ? "Cerrando…" : "Confirmar cierre"}
        </button>
      </div>
    </Modal>
  );
}


// ─── Estilos de Ventas y Caja ───────────────────────────────────────
export const POS_CSS = `
  .caja{max-width:1280px;margin:0 auto}
  .page-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px}

  /* Estructura: columna izquierda (números) + área principal */
  .caja-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
  .caja-side{display:flex;flex-direction:column;gap:12px;min-width:0}
  .caja-main{min-width:0}
  .kpi-stack{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 16px;padding:14px 16px !important}
  .caja-views{display:flex;gap:6px;overflow-x:auto}

  /* Venta: buscador + carrito | cobro */
  .pos-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
  .pos-left{display:grid;gap:12px;align-content:start;min-width:0}
  .mov-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:14px;align-items:start}
  .sale-total{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:12px;padding:12px 16px;border-radius:11px;background:linear-gradient(135deg,rgba(0,180,216,.08),rgba(0,180,216,.14));border:1px solid rgba(0,180,216,.25)}
  .st-info{display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:#555}
  .st-info b{color:#1a1a1a}
  .st-total{display:flex;align-items:baseline;gap:10px;margin-left:auto}
  .st-total span{font-size:13px;font-weight:800;color:#0e7490;letter-spacing:.06em}
  .st-total strong{font-size:32px;font-weight:800;color:#0891b2;line-height:1;white-space:nowrap}
  @media(max-width:520px){ .st-total strong{font-size:26px} }
  .results{position:absolute;left:0;right:0;top:calc(100% + 4px);background:#fff;border:1px solid #e5e7eb;border-radius:10px;z-index:40;max-height:380px;overflow-y:auto;box-shadow:0 10px 24px rgba(0,0,0,.1)}
  .cart-line{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f3f4f6;flex-wrap:wrap}
  .pill{display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600}
  .tbl{width:100%;border-collapse:collapse;font-size:13px}
  .tbl th{text-align:left;font-size:11px;color:#888;font-weight:600;text-transform:uppercase;padding:8px 10px;border-bottom:1px solid #e5e7eb;white-space:nowrap}
  .tbl td{padding:9px 10px;border-bottom:1px solid #f3f4f6;white-space:nowrap}
  .mo{position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center}
  .mb{color:#1a1a1a;background:#fff;border:1px solid #e5e7eb;border-radius:20px 20px 0 0;padding:24px;width:100%;max-width:480px;max-height:92vh;overflow-y:auto}
  .caja button{transition:background .15s,border-color .15s,opacity .15s}
  .caja button:hover:not(:disabled){filter:brightness(.97)}
  .caja button:disabled{cursor:not-allowed}
  .caja input:focus{border-color:#00B4D8 !important;box-shadow:0 0 0 3px rgba(0,180,216,.12)}
  @media(min-width:640px){.mo{align-items:center;padding:16px}.mb{border-radius:18px}}
  @media(min-width:640px) and (max-width:1023px){ .kpi-stack{grid-template-columns:repeat(4,minmax(0,1fr))} }
  @media(min-width:768px){ .mov-grid{grid-template-columns:minmax(0,360px) minmax(0,1fr)} }

  /* Computadora: todo entra en una pantalla
     izquierda = números en vertical · centro = buscador + carrito · derecha = cobro */
  @media(min-width:1024px){
    .caja-layout{grid-template-columns:210px minmax(0,1fr);align-items:start}
    .caja-side{position:sticky;top:calc(var(--adm-top-h, 0px) + 16px)}
    .caja-main .lc{margin:0}
    .kpi-stack{grid-template-columns:minmax(0,1fr);gap:0;padding:4px 16px !important}
    .kpi-row{padding:9px 0;border-bottom:1px solid #f3f4f6}
    .caja-side{gap:10px}
    .view-btn{padding:9px 14px !important}
    .kpi-row:last-child{border-bottom:none}
    .caja-views{flex-direction:column;overflow:visible}
    .view-btn{text-align:left}
    .pos-grid{grid-template-columns:minmax(0,1fr) 330px;height:calc(100vh - var(--adm-top-h, 0px) - 86px);min-height:480px}
    .pos-left{display:flex;flex-direction:column;min-height:0}
    .pos-left > :first-child{flex-shrink:0}
    .pos-cart{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
    .cart-line{flex-wrap:nowrap}
    .pos-pay{overflow-y:auto;min-height:0}
  }
  /* Notebooks chicas: columnas laterales un poco más angostas */
  @media(min-width:1024px) and (max-width:1279px){
    .caja-layout{grid-template-columns:180px minmax(0,1fr)}
    .pos-grid{grid-template-columns:minmax(0,1fr) 300px}
  }
  .side-note{font-size:12px;color:#666;line-height:1.4}
  /* Ventas del turno */
  .sl-sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:12px}
  .sl-sum > div{background:#f8fafc;border:1px solid #eef2f6;border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:2px;min-width:0}
  .sl-sum > div.main{background:rgba(0,180,216,.08);border-color:rgba(0,180,216,.25)}
  .sl-sum > div.void{background:#fef2f2;border-color:#fecaca}
  .sl-sum span{font-size:11px;font-weight:700;color:#667085;text-transform:uppercase;letter-spacing:.03em}
  .sl-sum b{font-size:19px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sl-sum small{font-size:11px;color:#98a2b3}
  .sl-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px}
  .sl-table{border:1px solid #eef0f3;border-radius:10px;overflow:hidden}
  .sl-row{display:grid;grid-template-columns:56px 82px minmax(0,1.4fr) minmax(0,1.4fr) 100px 104px 170px;gap:10px;align-items:center;padding:9px 12px;font-size:13px;cursor:pointer}
  .sl-th{background:#fafbfc;font-size:11px;font-weight:700;color:#98a2b3;text-transform:uppercase;letter-spacing:.03em;cursor:default;border-bottom:1px solid #eef0f3}
  .sl-item{border-bottom:1px solid #f3f4f6}
  .sl-item:last-child{border-bottom:0}
  .sl-item:hover .sl-row:not(.sl-th){background:#fafcff}
  .sl-item.open{background:#f8fbff}
  .sl-item.voided .sl-row{opacity:.55}
  .sl-item.voided .sl-total{text-decoration:line-through}
  .sl-row .r{text-align:right}
  .sl-id{font-weight:800}
  .sl-muted{color:#888;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sl-cli{font-weight:600;color:#0e7490;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sl-cli i{color:#98a2b3;font-weight:500}
  .sl-cli em{font-style:normal;font-size:10px;font-weight:800;margin-left:6px;padding:1px 6px;border-radius:5px;background:rgba(139,92,246,.12);color:#7c3aed}
  .sl-cli em.v{background:rgba(239,68,68,.12);color:#ef4444}
  .sl-prods{color:#444;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sl-total{font-weight:800;font-size:14px;white-space:nowrap}
  .sl-acts{display:flex;gap:5px;justify-content:flex-end;align-items:center}
  .sl-acts button{border-radius:7px;padding:5px 9px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid #e5e7eb;background:#fff;color:#344054}
  .sl-acts .sl-wa{background:#dcfce7;border-color:#86efac;color:#15803d}
  .sl-acts .red{background:#fef2f2;border-color:#fecaca;color:#dc2626}
  .sl-chev{color:#98a2b3;font-size:12px;width:12px;text-align:center}
  .sl-detail{padding:4px 12px 12px 170px;display:grid;gap:4px}
  .sl-line{display:grid;grid-template-columns:minmax(0,1fr) 140px 104px;gap:10px;font-size:13px}
  .sl-line b{text-align:right;white-space:nowrap}
  @media(max-width:900px){
    .sl-th{display:none}
    .sl-row{grid-template-columns:auto auto minmax(0,1fr) auto;row-gap:4px}
    .sl-prods{grid-column:1 / -1;order:5}
    .sl-row > :nth-child(5){display:none}
    .sl-acts{grid-column:1 / -1;order:6;justify-content:flex-start}
    .sl-detail{padding-left:12px}
    .sl-line{grid-template-columns:minmax(0,1fr) auto auto}
  }
  /* Tabla de la venta actual: compacta, para ver muchos productos */
  .cart-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #eef0f3}
  .cart-table{overflow-y:auto;min-height:0;flex:1}
  .cart-row{display:grid;grid-template-columns:minmax(0,1fr) 112px 92px 104px 30px;gap:8px;align-items:center;padding:6px 16px;border-bottom:1px solid #f3f4f6;font-size:13px}
  .cart-row.flash{background:#ecfeff}
  .cart-th{position:sticky;top:0;z-index:1;background:#fafbfc;font-size:11px;font-weight:700;color:#98a2b3;text-transform:uppercase;letter-spacing:.03em;padding-top:7px;padding-bottom:7px}
  .cart-row .r{text-align:right}
  .cart-row .c{text-align:center}
  .cart-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;color:#1a1a1a}
  .cart-name b{color:#98a2b3;font-weight:600;margin-right:2px}
  .cart-name small{margin-left:8px;font-size:11px;font-weight:500;color:#aaa}
  .cart-qty{display:flex;align-items:center;justify-content:center;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;height:30px}
  .cart-qty button{width:30px;height:100%;border:0;background:#f8f9fb;font-size:15px;cursor:pointer;color:#344054}
  .cart-qty button:disabled{color:#d0d5dd;cursor:default}
  .cart-qty input{width:42px;height:100%;border:0;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;text-align:center;font-weight:700;font-size:14px;font-family:inherit}
  .cart-unit{color:#667085;white-space:nowrap}
  .cart-sub{font-weight:800;white-space:nowrap}
  .cart-x{width:28px;height:28px;border:0;border-radius:7px;background:#fef2f2;color:#ef4444;cursor:pointer;font-size:12px}
  @media(max-width:640px){
    .cart-row{grid-template-columns:auto minmax(0,1fr) auto 30px;row-gap:5px;padding:8px 12px}
    .cart-th{display:none}
    .cart-name{grid-column:1 / -1;white-space:normal}
    .cart-unit::after{content:" c/u"}
  }
  .state{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px}
  .state.on{background:rgba(16,185,129,.12);color:#047857}
  .state.off{background:#f2f4f7;color:#667085}
  .state .dot{width:7px;height:7px;border-radius:50%;background:currentColor}
  .keys{font-size:11px;color:#9ca3af;line-height:1.7}
  .keys kbd{font:700 10px ui-monospace,monospace;border:1px solid #e5e7eb;border-bottom-width:2px;border-radius:5px;padding:0 5px;color:#666;background:#fff}
`;
