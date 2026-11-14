"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { fmtPhone } from "@/lib/phone";
import { REORDER_AT } from "@/lib/reposicion";

// ═══════════════════════════════════════════════════════════════════
// CLIENTES (/admin/clientes) Y PROVEEDORES (/admin/proveedores)
//   ?id=12 → abre directo una ficha
// ═══════════════════════════════════════════════════════════════════

// ─── Formatos ───────────────────────────────────────────────────────
const fmt = (n: number) => {
  const v = n || 0;
  const dec = Number.isInteger(Math.round(v * 100) / 100) ? 0 : 2;
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
};
const fmtDate = (s: string) => new Date(s).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
const ago = (s: string | null) => {
  if (!s) return "Nunca";
  const days = Math.floor((Date.now() - new Date(s).getTime()) / 86400000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 30) return `Hace ${days} días`;
  if (days < 365) { const m = Math.floor(days / 30); return `Hace ${m} ${m === 1 ? "mes" : "meses"}`; }
  return fmtDate(s);
};

const waLink = (p: string | null, text = "") => (p ? `https://wa.me/${p}${text ? `?text=${encodeURIComponent(text)}` : ""}` : "");
const initials = (name: string) =>
  name.replace(/\[[^\]]*\]/g, " ").split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean)
    .slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

// ─── Tipos ──────────────────────────────────────────────────────────
export type Tab = "clientes" | "proveedores";
type CustomerRow = {
  id: number; name: string; phone: string | null; email: string | null; dni_cuit: string | null; city: string | null;
  customer_type: "retail" | "wholesale"; active: boolean; purchases: number; spent: number; last_purchase: string | null;
};
type Customer = CustomerRow & { address: string | null; notes: string | null; created_at: string };
type CustomerDetail = {
  customer: Customer;
  stats: { purchases: number; spent: number; avg_ticket: number; first_purchase: string | null; last_purchase: string | null };
  top: { product_id: number; name: string; image_url: string | null; quantity: number; total: number }[];
  sales: { id: number; status: "completed" | "voided"; created_at: string; total: number; discount: number;
           items: { name: string; quantity: number; subtotal: number }[]; methods: string[] }[];
  webOrders: { id: number; created_at: string; total: number; status: string; sale_type: string; lines: number }[];
};
type SupplierRow = {
  id: number; name: string; contact_name: string | null; whatsapp: string | null; phone: string | null;
  email: string | null; cuit: string | null; active: boolean; products: number; to_restock: number; out_of_stock: number;
};
type Supplier = SupplierRow & { address: string | null; notes: string | null; created_at: string };
type SupplierProduct = {
  id: number; name: string; sku: string | null; image_url: string | null; available: boolean;
  stock_quantity: number; min_stock: number; cost_price: number | null; price_retail: number; category_name: string | null;
};
type SupplierDetail = { supplier: Supplier; products: SupplierProduct[] };
type Selected = { tab: Tab; id: number } | null;

const api = async (url: string, opts: RequestInit = {}) => {
  const res = await fetch(url, {
    credentials: "include",
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
};

// ─── Estilos compartidos (mismo look que Caja) ──────────────────────
const card = { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 13 } as const;
const inp = { width: "100%", padding: "10px 12px", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, color: "#1a1a1a", fontSize: 14, fontFamily: "inherit", outline: "none" } as const;
const label = { fontSize: 11, color: "#444", display: "block", marginBottom: 5, fontWeight: 600 } as const;
const btn = (v: "primary" | "cyan" | "red" | "green" | "gray" | "wa") => {
  const base = { padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600 as const, cursor: "pointer" as const, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center", textDecoration: "none", whiteSpace: "nowrap" as const };
  if (v === "primary") return { ...base, background: "#00B4D8", color: "#fff", border: "1px solid #00B4D8" };
  if (v === "cyan") return { ...base, background: "rgba(0,180,216,.1)", color: "#0891b2", border: "1px solid rgba(0,180,216,.3)" };
  if (v === "red") return { ...base, background: "rgba(239,68,68,.08)", color: "#dc2626", border: "1px solid rgba(239,68,68,.3)" };
  if (v === "green") return { ...base, background: "rgba(16,185,129,.1)", color: "#059669", border: "1px solid rgba(16,185,129,.3)" };
  if (v === "wa") return { ...base, background: "#25D366", color: "#fff", border: "1px solid #25D366" };
  return { ...base, background: "#f3f4f6", color: "#444", border: "1px solid #e5e7eb" };
};

function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  // Se dibuja directo en <body> para quedar por encima del menú fijo
  return createPortal(
    <div className="crm mo" onClick={onClose}>
      <div className={`mb ${wide ? "mb-wide" : ""}`} onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>,
    document.body
  );
}

const WaIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3M12 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8M20.5 3.5A12 12 0 0 0 1.6 17.9L0 24l6.3-1.6A12 12 0 0 0 24 12a11.9 11.9 0 0 0-3.5-8.5"/>
  </svg>
);

function Avatar({ name, tone }: { name: string; tone: "cyan" | "violet" }) {
  const c = tone === "cyan" ? { bg: "rgba(0,180,216,.12)", fg: "#0891b2" } : { bg: "rgba(99,102,241,.12)", fg: "#4f46e5" };
  return (
    <div style={{ width: 38, height: 38, borderRadius: 10, background: c.bg, color: c.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
      {initials(name)}
    </div>
  );
}

function Thumb({ src }: { src: string | null }) {
  return src
    ? <img src={src} alt="" style={{ width: 34, height: 34, borderRadius: 7, objectFit: "cover", background: "#f3f4f6", flexShrink: 0 }} />
    : <div style={{ width: 34, height: 34, borderRadius: 7, background: "#f3f4f6", flexShrink: 0 }} />;
}

function Info({ k, v, href }: { k: string; v: string | null | undefined; href?: string }) {
  if (!v) return null;
  return (
    <div className="info-row">
      <span className="info-k">{k}</span>
      {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="info-v link">{v}</a> : <span className="info-v">{v}</span>}
    </div>
  );
}

function Kpi({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="kpi">
      <div className="kpi-k">{k}</div>
      <div className="kpi-v">{v}</div>
      {sub && <div className="kpi-s">{sub}</div>}
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="sec">
      <div className="sec-h"><span>{title}</span>{right}</div>
      {children}
    </div>
  );
}

const Empty = ({ text }: { text: string }) => <div className="empty">{text}</div>;

// ═══════════════════════════════════════════════════════════════════
// FORMULARIO DE ALTA / EDICIÓN
// ═══════════════════════════════════════════════════════════════════
function CustomerForm({ initial, onSaved, onClose }: { initial: Customer | null; onSaved: (c: Customer) => void; onClose: () => void }) {
  const [f, setF] = useState({
    name: initial?.name || "", phone: initial?.phone ? fmtPhone(initial.phone) : "", email: initial?.email || "",
    dni_cuit: initial?.dni_cuit || "", address: initial?.address || "", notes: initial?.notes || "",
    city: initial?.city || "", customer_type: initial?.customer_type || "retail",
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    setBusy(true); setErr("");
    try {
      const c = initial
        ? await api(`/api/crm/customers/${initial.id}`, { method: "PATCH", body: JSON.stringify(f) })
        : await api("/api/crm/customers", { method: "POST", body: JSON.stringify(f) });
      onSaved(c);
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };

  return (
    <Modal onClose={onClose}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{initial ? "Editar cliente" : "Nuevo cliente"}</h2>
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <label style={label}>NOMBRE Y APELLIDO *</label>
          <input value={f.name} onChange={set("name")} autoFocus style={inp} maxLength={150} />
        </div>
        <div className="form-2">
          <div>
            <label style={label}>TELÉFONO / WHATSAPP</label>
            <input value={f.phone} onChange={set("phone")} inputMode="tel" placeholder="3865 575938" style={inp} />
          </div>
          <div>
            <label style={label}>DNI / CUIT</label>
            <input value={f.dni_cuit} onChange={set("dni_cuit")} inputMode="numeric" style={inp} />
          </div>
        </div>
        <div>
          <label style={label}>TIPO DE CLIENTE</label>
          <div style={{ display: "flex", gap: 6 }}>
            {(["retail", "wholesale"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setF({ ...f, customer_type: t })} className={`seg ${f.customer_type === t ? "on" : ""}`}>
                {t === "retail" ? "Minorista" : "Mayorista"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={label}>EMAIL</label>
          <input value={f.email} onChange={set("email")} inputMode="email" style={inp} />
        </div>
        <div className="form-2">
          <div>
            <label style={label}>DOMICILIO</label>
            <input value={f.address} onChange={set("address")} style={inp} />
          </div>
          <div>
            <label style={label}>CIUDAD</label>
            <input value={f.city} onChange={set("city")} list="ciudades" placeholder="Concepción" style={inp} />
            <datalist id="ciudades">
              {["Concepción", "Aguilares", "Monteros", "Alberdi", "Famaillá", "Simoca", "Banda del Río Salí", "San Miguel de Tucumán"].map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
        </div>
        <div>
          <label style={label}>NOTAS</label>
          <textarea value={f.notes} onChange={set("notes")} rows={3} style={{ ...inp, resize: "vertical" }} placeholder="Ej: prefiere que le avisen por WhatsApp cuando entra mercadería" />
        </div>
        {err && <div className="err">{err}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btn("gray")}>Cancelar</button>
          <button onClick={save} disabled={busy || !f.name.trim()} style={{ ...btn("primary"), opacity: busy || !f.name.trim() ? .6 : 1 }}>
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SupplierForm({ initial, onSaved, onClose }: { initial: Supplier | null; onSaved: (s: Supplier) => void; onClose: () => void }) {
  const [f, setF] = useState({
    name: initial?.name || "", contact_name: initial?.contact_name || "",
    whatsapp: initial?.whatsapp ? fmtPhone(initial.whatsapp) : "", phone: initial?.phone || "",
    email: initial?.email || "", cuit: initial?.cuit || "", address: initial?.address || "", notes: initial?.notes || "",
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    setBusy(true); setErr("");
    try {
      const s = initial
        ? await api(`/api/crm/suppliers/${initial.id}`, { method: "PATCH", body: JSON.stringify(f) })
        : await api("/api/crm/suppliers", { method: "POST", body: JSON.stringify(f) });
      onSaved(s);
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };

  return (
    <Modal onClose={onClose}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{initial ? "Editar proveedor" : "Nuevo proveedor"}</h2>
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <label style={label}>NOMBRE DEL PROVEEDOR *</label>
          <input value={f.name} onChange={set("name")} autoFocus style={inp} maxLength={150} placeholder="Ej: Distribuidora Norte" />
        </div>
        <div className="form-2">
          <div>
            <label style={label}>WHATSAPP PARA PEDIDOS</label>
            <input value={f.whatsapp} onChange={set("whatsapp")} inputMode="tel" placeholder="381 4123456" style={inp} />
          </div>
          <div>
            <label style={label}>PERSONA DE CONTACTO</label>
            <input value={f.contact_name} onChange={set("contact_name")} style={inp} />
          </div>
        </div>
        <div className="form-2">
          <div>
            <label style={label}>OTRO TELÉFONO</label>
            <input value={f.phone} onChange={set("phone")} inputMode="tel" style={inp} />
          </div>
          <div>
            <label style={label}>CUIT</label>
            <input value={f.cuit} onChange={set("cuit")} inputMode="numeric" style={inp} />
          </div>
        </div>
        <div>
          <label style={label}>EMAIL</label>
          <input value={f.email} onChange={set("email")} inputMode="email" style={inp} />
        </div>
        <div>
          <label style={label}>DIRECCIÓN</label>
          <input value={f.address} onChange={set("address")} style={inp} />
        </div>
        <div>
          <label style={label}>NOTAS</label>
          <textarea value={f.notes} onChange={set("notes")} rows={3} style={{ ...inp, resize: "vertical" }} placeholder="Ej: entrega martes y viernes, pedido mínimo $50.000" />
        </div>
        {err && <div className="err">{err}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btn("gray")}>Cancelar</button>
          <button onClick={save} disabled={busy || !f.name.trim()} style={{ ...btn("primary"), opacity: busy || !f.name.trim() ? .6 : 1 }}>
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FICHA DEL CLIENTE
// ═══════════════════════════════════════════════════════════════════
function CustomerPanel({ id, onChanged, onClose }: { id: number; onChanged: () => void; onClose: () => void }) {
  const [d, setD] = useState<CustomerDetail | null>(null);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(false);
  const [openSale, setOpenSale] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(() => {
    api(`/api/crm/customers/${id}`).then((x) => { setD(x); setErr(""); }).catch((e) => setErr(e.message));
  }, [id]);
  useEffect(() => { setD(null); setShowAll(false); setOpenSale(null); load(); }, [load]);

  const toggleActive = async () => {
    if (!d) return;
    const c = d.customer;
    if (c.active && !confirm(`¿Desactivar a ${c.name}? Deja de aparecer en la lista, pero se guarda su historial.`)) return;
    try { await api(`/api/crm/customers/${c.id}`, { method: "PATCH", body: JSON.stringify({ active: !c.active }) }); load(); onChanged(); }
    catch (e: any) { alert(e.message); }
  };
  const remove = async () => {
    if (!d) return;
    if (!confirm(`¿Borrar a ${d.customer.name}? No se puede deshacer.`)) return;
    try {
      const r = await api(`/api/crm/customers/${d.customer.id}`, { method: "DELETE" });
      if (r.deactivated) alert("Tiene compras registradas, así que se desactivó en lugar de borrarse.");
      onChanged(); onClose();
    } catch (e: any) { alert(e.message); }
  };

  if (err) return <div className="panel-pad"><div className="err">{err}</div></div>;
  if (!d) return <div className="panel-pad" style={{ color: "#888", fontSize: 13 }}>Cargando…</div>;

  const c = d.customer, s = d.stats;
  const sales = showAll ? d.sales : d.sales.slice(0, 8);
  const STATUS: Record<string, [string, string]> = {
    pending: ["Pendiente", "#d97706"], confirmed: ["Confirmado", "#0891b2"], completed: ["Entregado", "#059669"], cancelled: ["Cancelado", "#9ca3af"],
  };

  return (
    <div>
      <div className="panel-head">
        <Avatar name={c.name} tone="cyan" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="panel-title">{c.name}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 3 }}>
            <span className={`pill ${c.customer_type === "wholesale" ? "pill-violet" : "pill-gray"}`}>{c.customer_type === "wholesale" ? "Mayorista" : "Minorista"}</span>
            {!c.active && <span className="pill pill-red">Desactivado</span>}
            <span style={{ fontSize: 11, color: "#9ca3af" }}>Cliente desde {fmtDate(c.created_at)}</span>
          </div>
        </div>
        <button className="x-btn" onClick={onClose} aria-label="Cerrar">×</button>
      </div>

      <div className="panel-pad" style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {c.phone && <a href={waLink(c.phone, `Hola ${c.name.split(" ")[0]}! Te escribimos de Concepción Tecnología.`)} target="_blank" rel="noopener noreferrer" style={btn("wa")}><WaIcon /> WhatsApp</a>}
          <button onClick={() => setEditing(true)} style={btn("cyan")}>Editar</button>
          <button onClick={toggleActive} style={btn("gray")}>{c.active ? "Desactivar" : "Reactivar"}</button>
          {s.purchases === 0 && <button onClick={remove} style={btn("red")}>Borrar</button>}
        </div>

        <div className="kpis">
          <Kpi k="Gastó en total" v={fmt(s.spent)} />
          <Kpi k="Compras" v={String(s.purchases)} sub={s.purchases ? `Ticket prom. ${fmt(s.avg_ticket)}` : undefined} />
          <Kpi k="Última compra" v={ago(s.last_purchase)} sub={s.first_purchase ? `Primera: ${fmtDate(s.first_purchase)}` : undefined} />
        </div>

        <Section title="Datos">
          <div className="info">
            <Info k="Teléfono" v={fmtPhone(c.phone)} href={c.phone ? `tel:+${c.phone}` : undefined} />
            <Info k="DNI / CUIT" v={c.dni_cuit} />
            <Info k="Email" v={c.email} href={c.email ? `mailto:${c.email}` : undefined} />
            <Info k="Domicilio" v={c.address} />
            <Info k="Ciudad" v={c.city} />
            {!c.phone && !c.dni_cuit && !c.email && !c.address && !c.city && <Empty text="Sin datos de contacto. Tocá Editar para agregarlos." />}
          </div>
          {c.notes && <div className="notes">{c.notes}</div>}
        </Section>

        {d.top.length > 0 && (
          <Section title="Lo que más compra">
            {d.top.map((p) => (
              <div key={p.product_id ?? p.name} className="line">
                <Thumb src={p.image_url} />
                <span className="line-name">{p.name}</span>
                <span className="line-meta">{p.quantity} u.</span>
                <span className="line-amt">{fmt(p.total)}</span>
              </div>
            ))}
          </Section>
        )}

        <Section title={`Compras en el local${d.sales.length ? ` (${d.sales.length}${d.sales.length === 50 ? "+" : ""})` : ""}`}>
          {d.sales.length === 0 && <Empty text="Todavía no tiene compras en el local. Para registrarlas, elegí el cliente al cobrar en Caja." />}
          {sales.map((v) => {
            const first = v.items[0];
            const more = v.items.length - 1;
            const open = openSale === v.id;
            return (
              <div key={v.id}>
                <button className={`line line-btn ${v.status === "voided" ? "voided" : ""}`} onClick={() => setOpenSale(open ? null : v.id)}>
                  <span className="line-date">{fmtDateTime(v.created_at)}</span>
                  <span className="line-name">
                    {first ? `${first.quantity > 1 ? first.quantity + "× " : ""}${first.name}` : "—"}
                    {more > 0 && <span style={{ color: "#9ca3af" }}> +{more} más</span>}
                  </span>
                  {v.status === "voided" ? <span className="pill pill-red">Anulada</span>
                    : <span className="line-meta">{v.methods.map((m) => (m === "cash" ? "Efectivo" : "Transf.")).join(" + ")}</span>}
                  <span className="line-amt">{fmt(v.total)}</span>
                </button>
                {open && (
                  <div className="sale-detail">
                    <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Ticket #{v.id}</div>
                    {v.items.map((it, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, padding: "2px 0" }}>
                        <span>{it.quantity} × {it.name}</span><span>{fmt(it.subtotal)}</span>
                      </div>
                    ))}
                    {v.discount > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#059669", paddingTop: 2 }}>
                        <span>Descuento</span><span>−{fmt(v.discount)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {d.sales.length > 8 && !showAll && (
            <button onClick={() => setShowAll(true)} className="more-btn">Ver todas ({d.sales.length})</button>
          )}
        </Section>

        {d.webOrders.length > 0 && (
          <Section title={`Pedidos por la web (${d.webOrders.length})`}>
            {d.webOrders.map((o) => {
              const [txt, col] = STATUS[o.status] || [o.status, "#666"];
              return (
                <div key={o.id} className="line">
                  <span className="line-date">{fmtDateTime(o.created_at)}</span>
                  <span className="line-name">Pedido #{o.id} · {o.lines} {o.lines === 1 ? "producto" : "productos"}{o.sale_type === "wholesale" ? " · mayorista" : ""}</span>
                  <span className="line-meta" style={{ color: col, fontWeight: 600 }}>{txt}</span>
                  <span className="line-amt">{fmt(o.total)}</span>
                </div>
              );
            })}
          </Section>
        )}
      </div>

      {editing && <CustomerForm initial={c} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); onChanged(); }} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FICHA DEL PROVEEDOR
// ═══════════════════════════════════════════════════════════════════
function AddProducts({ supplier, onDone, onClose }: { supplier: Supplier; onDone: () => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [onlyFree, setOnlyFree] = useState(true);
  const [cats, setCats] = useState<{ id: number; name: string }[]>([]);
  const [res, setRes] = useState<{ items: any[]; total: number }>({ items: [], total: 0 });
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { fetch("/api/categories").then((r) => r.json()).then((x) => Array.isArray(x) && setCats(x)).catch(() => {}); }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!q.trim() && !cat && !onlyFree) { setRes({ items: [], total: 0 }); return; }
      setLoading(true);
      const p = new URLSearchParams({ q, category: cat, sin: onlyFree ? "1" : "0" });
      api(`/api/crm/suppliers/${supplier.id}/products?${p}`)
        .then((x) => { setRes(x); setErr(""); })
        .catch((e) => setErr(e.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, cat, onlyFree, supplier.id]);

  const toggle = (id: number) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSel = res.items.length > 0 && res.items.every((p) => sel.has(p.id));
  const toggleAll = () => setSel((s) => {
    const n = new Set(s);
    if (allSel) res.items.forEach((p) => n.delete(p.id)); else res.items.forEach((p) => n.add(p.id));
    return n;
  });
  const reassigning = res.items.filter((p) => sel.has(p.id) && p.supplier_name).length;

  const save = async () => {
    setBusy(true); setErr("");
    try {
      await api(`/api/crm/suppliers/${supplier.id}/products`, { method: "POST", body: JSON.stringify({ add: [...sel] }) });
      onDone();
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };

  return (
    <Modal onClose={onClose} wide>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Agregar productos</h2>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 14 }}>Elegí qué productos le comprás a <b>{supplier.name}</b>.</p>
      <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o código…" autoFocus style={inp} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ ...inp, width: "auto", flex: "1 1 180px", padding: "8px 10px" }}>
            <option value="">Todas las categorías</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#444", cursor: "pointer" }}>
            <input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} />
            Solo los que no tienen proveedor
          </label>
        </div>
      </div>

      <div className="pick-list">
        {res.items.length > 0 && (
          <label className="pick-row pick-all">
            <input type="checkbox" checked={allSel} onChange={toggleAll} />
            <span style={{ flex: 1 }}>Seleccionar todos{res.total > res.items.length ? ` (se muestran ${res.items.length} de ${res.total})` : ` (${res.items.length})`}</span>
          </label>
        )}
        {res.items.map((p) => (
          <label key={p.id} className="pick-row">
            <input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} />
            <Thumb src={p.image_url} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
              <span style={{ display: "block", fontSize: 11, color: "#9ca3af" }}>
                {p.category_name}{p.supplier_name && <span style={{ color: "#d97706" }}> · ahora de {p.supplier_name}</span>}
              </span>
            </span>
            <span style={{ fontSize: 12, color: p.stock_quantity > 0 ? "#666" : "#dc2626", flexShrink: 0 }}>Stock {p.stock_quantity}</span>
          </label>
        ))}
        {!loading && res.items.length === 0 && (
          <Empty text={q || cat || onlyFree ? "No hay productos con ese filtro." : "Buscá un producto o elegí una categoría."} />
        )}
        {loading && res.items.length === 0 && <Empty text="Buscando…" />}
      </div>

      {reassigning > 0 && (
        <div style={{ fontSize: 12, color: "#d97706", marginTop: 8 }}>
          {reassigning} {reassigning === 1 ? "producto ya tiene" : "productos ya tienen"} otro proveedor: {reassigning === 1 ? "pasa" : "pasan"} a {supplier.name}.
        </div>
      )}
      {err && <div className="err" style={{ marginTop: 8 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
        <button onClick={onClose} style={btn("gray")}>Cancelar</button>
        <button onClick={save} disabled={busy || sel.size === 0} style={{ ...btn("primary"), opacity: busy || sel.size === 0 ? .6 : 1 }}>
          {busy ? "Guardando…" : `Agregar ${sel.size || ""} ${sel.size === 1 ? "producto" : "productos"}`}
        </button>
      </div>
    </Modal>
  );
}

function SupplierPanel({ id, onChanged, onClose }: { id: number; onChanged: () => void; onClose: () => void }) {
  const [d, setD] = useState<SupplierDetail | null>(null);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState("");

  const load = useCallback(() => {
    api(`/api/crm/suppliers/${id}`).then((x) => { setD(x); setErr(""); }).catch((e) => setErr(e.message));
  }, [id]);
  useEffect(() => { setD(null); setFilter(""); load(); }, [load]);

  const toggleActive = async () => {
    if (!d) return;
    const s = d.supplier;
    if (s.active && !confirm(`¿Desactivar a ${s.name}? Deja de aparecer en la lista y en los pedidos de reposición.`)) return;
    try { await api(`/api/crm/suppliers/${s.id}`, { method: "PATCH", body: JSON.stringify({ active: !s.active }) }); load(); onChanged(); }
    catch (e: any) { alert(e.message); }
  };
  const remove = async () => {
    if (!d) return;
    if (!confirm(`¿Borrar a ${d.supplier.name}?${d.products.length ? ` Sus ${d.products.length} productos quedan sin proveedor.` : ""}`)) return;
    try {
      const r = await api(`/api/crm/suppliers/${d.supplier.id}`, { method: "DELETE" });
      if (r.deactivated) alert("Ya tiene pedidos o facturas cargadas, así que se desactivó en lugar de borrarse.");
      onChanged(); onClose();
    } catch (e: any) { alert(e.message); }
  };
  const unlink = async (p: SupplierProduct) => {
    if (!d || !confirm(`¿Quitar "${p.name}" de ${d.supplier.name}?`)) return;
    try { await api(`/api/crm/suppliers/${d.supplier.id}/products`, { method: "POST", body: JSON.stringify({ remove: [p.id] }) }); load(); onChanged(); }
    catch (e: any) { alert(e.message); }
  };

  if (err) return <div className="panel-pad"><div className="err">{err}</div></div>;
  if (!d) return <div className="panel-pad" style={{ color: "#888", fontSize: 13 }}>Cargando…</div>;

  const s = d.supplier;
  const low = d.products.filter((p) => p.stock_quantity <= REORDER_AT).length;
  const out = d.products.filter((p) => p.stock_quantity <= 0).length;
  const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = d.products.filter((p) => words.every((w) => `${p.name} ${p.sku || ""}`.toLowerCase().includes(w)));

  return (
    <div>
      <div className="panel-head">
        <Avatar name={s.name} tone="violet" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="panel-title">{s.name}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 3 }}>
            {s.contact_name && <span style={{ fontSize: 12, color: "#666" }}>{s.contact_name}</span>}
            {!s.active && <span className="pill pill-red">Desactivado</span>}
          </div>
        </div>
        <button className="x-btn" onClick={onClose} aria-label="Cerrar">×</button>
      </div>

      <div className="panel-pad panel-body">
        <div className="panel-actions">
          {s.whatsapp && <a href={waLink(s.whatsapp, "Hola! Te escribimos de Concepción Tecnología.")} target="_blank" rel="noopener noreferrer" style={btn("wa")}><WaIcon /> WhatsApp</a>}
          <button onClick={() => setEditing(true)} style={btn("cyan")}>Editar</button>
          <button onClick={toggleActive} style={btn("gray")}>{s.active ? "Desactivar" : "Reactivar"}</button>
          <button onClick={remove} style={btn("red")}>Borrar</button>
        </div>
        {!s.whatsapp && (
          <div className="warn">Sin WhatsApp cargado: no se le van a poder mandar los pedidos de reposición automáticos.</div>
        )}

        {low > 0 && s.active && (
          <a href={`/admin/reposicion#s${s.id}`} className="panel-cta" style={{ ...btn("wa"), padding: "11px 14px", whiteSpace: "normal", textAlign: "center" }}>
            <WaIcon /> <span>Armar pedido para el grupo · {low} {low === 1 ? "producto" : "productos"}</span>
          </a>
        )}

        <div className="kpis">
          <Kpi k="Productos" v={String(d.products.length)} />
          <Kpi k="Para pedir" v={String(low)} sub={`Con ${REORDER_AT} unidades o menos`} />
          <Kpi k="Sin stock" v={String(out)} />
        </div>

        <Section title="Datos">
          <div className="info">
            <Info k="WhatsApp" v={fmtPhone(s.whatsapp)} href={s.whatsapp ? waLink(s.whatsapp) : undefined} />
            <Info k="Teléfono" v={s.phone} href={s.phone ? `tel:${s.phone}` : undefined} />
            <Info k="CUIT" v={s.cuit} />
            <Info k="Email" v={s.email} href={s.email ? `mailto:${s.email}` : undefined} />
            <Info k="Dirección" v={s.address} />
          </div>
          {s.notes && <div className="notes">{s.notes}</div>}
        </Section>

        <Section title={`Productos que le compramos (${d.products.length})`}
          right={s.active ? <button onClick={() => setAdding(true)} style={{ ...btn("cyan"), padding: "5px 10px", fontSize: 12 }}>+ Agregar</button> : undefined}>
          {d.products.length > 6 && (
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar productos…" style={{ ...inp, padding: "8px 10px", fontSize: 13, marginBottom: 6 }} />
          )}
          {d.products.length === 0 && <Empty text="Todavía no tiene productos. Asignale los que le comprás para armar los pedidos de reposición." />}
          {shown.map((p) => {
            const isLow = p.stock_quantity <= REORDER_AT;
            const col = p.stock_quantity <= 0 ? "#dc2626" : isLow ? "#d97706" : "#059669";
            return (
              <div key={p.id} className="line">
                <Thumb src={p.image_url} />
                <span className="line-name">
                  {p.name}
                  <span style={{ display: "block", fontSize: 11, color: "#9ca3af" }}>
                    {p.cost_price != null ? `Costo ${fmt(p.cost_price)} · ` : ""}Venta {fmt(p.price_retail)}
                  </span>
                </span>
                <span className="stock-chip" style={{ color: col, background: col + "14" }} title={p.min_stock ? `Mínimo: ${p.min_stock}` : "Sin mínimo cargado"}>
                  {p.stock_quantity}{p.min_stock ? <span style={{ opacity: .65, fontWeight: 500 }}> / mín {p.min_stock}</span> : null}
                </span>
                <button className="x-btn small" onClick={() => unlink(p)} title="Quitar de este proveedor" aria-label="Quitar">×</button>
              </div>
            );
          })}
          {d.products.length > 0 && shown.length === 0 && <Empty text="Ningún producto coincide." />}
        </Section>
      </div>

      {editing && <SupplierForm initial={s} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); onChanged(); }} />}
      {adding && <AddProducts supplier={s} onClose={() => setAdding(false)} onDone={() => { setAdding(false); load(); onChanged(); }} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PANTALLA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
function Crm({ tab }: { tab: Tab }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState<"" | "retail" | "wholesale">("");
  const [inactive, setInactive] = useState(false);
  const [customers, setCustomers] = useState<CustomerRow[] | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierRow[] | null>(null);
  const [sel, setSel] = useState<Selected>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");
  const [isWide, setIsWide] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);
  const reqId = useRef(0);

  // Abrir directo una ficha: /admin/proveedores?id=3
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const id = Number(p.get("id"));
    if (Number.isInteger(id) && id > 0) setSel({ tab, id });
    const mq = window.matchMedia("(min-width: 1024px)");
    const upd = () => setIsWide(mq.matches);
    upd(); mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
  }, [tab]);

  // La URL refleja lo que está abierto (sirve para recargar o compartir el link)
  useEffect(() => {
    const base = tab === "clientes" ? "/admin/clientes" : "/admin/proveedores";
    window.history.replaceState(null, "", base + (sel && sel.tab === tab ? `?id=${sel.id}` : ""));
  }, [tab, sel]);

  const load = useCallback(async () => {
    const my = ++reqId.current;
    try {
      const p = new URLSearchParams({ q });
      if (inactive) p.set("estado", "inactivos");
      if (tab === "clientes") {
        if (type) p.set("type", type);
        const rows = await api(`/api/crm/customers?${p}`);
        if (my === reqId.current) setCustomers(rows);
      } else {
        const rows = await api(`/api/crm/suppliers?${p}`);
        if (my === reqId.current) setSuppliers(rows);
      }
      setErr("");
    } catch (e: any) { if (my === reqId.current) setErr(e.message); }
  }, [tab, q, type, inactive]);

  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);

  // Si otra compu cargó algo, se ve al volver a la pestaña
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  // Atajo: "/" para buscar
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const changed = () => { load(); };
  const rows = tab === "clientes" ? customers : suppliers;
  const filtered = !!q || !!type || inactive;

  const panel = sel && sel.tab === tab
    ? (tab === "clientes"
        ? <CustomerPanel key={`c${sel.id}`} id={sel.id} onChanged={changed} onClose={() => setSel(null)} />
        : <SupplierPanel key={`s${sel.id}`} id={sel.id} onChanged={changed} onClose={() => setSel(null)} />)
    : null;

  return (
    <div>
      <div className="crm-top">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.01em" }}>{tab === "clientes" ? "Clientes" : "Proveedores"}{rows ? <span style={{ fontSize: 14, color: "#9ca3af", fontWeight: 600, marginLeft: 8 }}>{rows.length}{rows.length === 300 ? "+" : ""}</span> : null}</h1>
          <p style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
            {tab === "clientes" ? "Quién te compra, cuánto y qué." : "A quién le comprás y qué productos te trae cada uno."}
          </p>
        </div>
        <button onClick={() => setCreating(true)} style={btn("primary")}>
          + {tab === "clientes" ? "Nuevo cliente" : "Nuevo proveedor"}
        </button>
      </div>

      <div className={`crm-grid ${panel && isWide ? "with-panel" : ""}`}>
        <div style={{ minWidth: 0 }}>
          <div className="filters">
            <div style={{ position: "relative", flex: "1 1 240px" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)}
                placeholder={tab === "clientes" ? "Buscar por nombre, teléfono o DNI…  ( / )" : "Buscar proveedor…  ( / )"}
                style={{ ...inp, paddingLeft: 32 }} />
            </div>
            {tab === "clientes" && (
              <div className="chips">
                {([["", "Todos"], ["retail", "Minoristas"], ["wholesale", "Mayoristas"]] as const).map(([v, t]) => (
                  <button key={v} className={`chip ${type === v ? "on" : ""}`} onClick={() => setType(v)}>{t}</button>
                ))}
              </div>
            )}
            <button className={`chip ${inactive ? "on" : ""}`} onClick={() => setInactive(!inactive)}>
              {inactive ? "Viendo desactivados" : "Desactivados"}
            </button>
          </div>

          {err && <div className="err" style={{ marginBottom: 10 }}>{err}</div>}

          <div style={{ ...card, overflow: "hidden" }}>
            {rows === null && <Empty text="Cargando…" />}
            {rows !== null && rows.length === 0 && (
              <div className="empty" style={{ padding: "36px 20px" }}>
                {filtered ? "No hay resultados con ese filtro." : tab === "clientes"
                  ? <>Todavía no cargaste clientes.<br /><button onClick={() => setCreating(true)} style={{ ...btn("cyan"), marginTop: 12 }}>+ Cargar el primero</button></>
                  : <>Todavía no cargaste proveedores.<br /><button onClick={() => setCreating(true)} style={{ ...btn("cyan"), marginTop: 12 }}>+ Cargar el primero</button></>}
              </div>
            )}

            {tab === "clientes" && customers?.map((c) => (
              <button key={c.id} className={`row ${sel?.tab === "clientes" && sel.id === c.id ? "sel" : ""}`} onClick={() => setSel({ tab: "clientes", id: c.id })}>
                <Avatar name={c.name} tone="cyan" />
                <span className="row-main">
                  <span className="row-name">
                    {c.name}
                    {c.customer_type === "wholesale" && <span className="pill pill-violet" style={{ marginLeft: 6 }}>Mayorista</span>}
                  </span>
                  <span className="row-sub">{[fmtPhone(c.phone), c.city, c.dni_cuit].filter(Boolean).join(" · ") || "Sin datos de contacto"}</span>
                </span>
                <span className="row-right">
                  <span className="row-amt">{c.purchases ? fmt(c.spent) : "—"}</span>
                  <span className="row-sub">{c.purchases ? `${c.purchases} ${c.purchases === 1 ? "compra" : "compras"} · ${ago(c.last_purchase)}` : "Sin compras"}</span>
                </span>
              </button>
            ))}

            {tab === "proveedores" && suppliers?.map((s) => (
              <button key={s.id} className={`row ${sel?.tab === "proveedores" && sel.id === s.id ? "sel" : ""}`} onClick={() => setSel({ tab: "proveedores", id: s.id })}>
                <Avatar name={s.name} tone="violet" />
                <span className="row-main">
                  <span className="row-name">{s.name}</span>
                  <span className="row-sub">
                    {[s.contact_name, fmtPhone(s.whatsapp)].filter(Boolean).join(" · ") || <span style={{ color: "#d97706" }}>Sin WhatsApp</span>}
                  </span>
                </span>
                <span className="row-right">
                  <span className="row-amt" style={{ fontWeight: 600 }}>{s.products} {s.products === 1 ? "producto" : "productos"}</span>
                  {s.to_restock > 0
                    ? <span className="pill pill-amber">{s.to_restock} para pedir</span>
                    : <span className="row-sub">{s.products ? "Stock OK" : "Sin productos"}</span>}
                </span>
              </button>
            ))}
          </div>
          {rows && rows.length === 300 && <div style={{ fontSize: 12, color: "#888", marginTop: 8 }}>Se muestran los primeros 300. Usá el buscador para encontrar el resto.</div>}
        </div>

        {/* Ficha: al costado en computadora, en ventana en celular */}
        {panel && isWide && <aside className="side-panel">{panel}</aside>}
        {!panel && isWide && (
          <aside className="side-panel side-empty">
            <div>
              <div style={{ fontSize: 28, marginBottom: 6, opacity: .5 }}>{tab === "clientes" ? "👤" : "🚚"}</div>
              Elegí {tab === "clientes" ? "un cliente" : "un proveedor"} para ver su ficha
            </div>
          </aside>
        )}
      </div>

      {panel && !isWide && createPortal(
        <div className="crm mo" onClick={() => setSel(null)}>
          <div className="mb mb-panel" onClick={(e) => e.stopPropagation()}>{panel}</div>
        </div>,
        document.body
      )}

      {creating && tab === "clientes" && (
        <CustomerForm initial={null} onClose={() => setCreating(false)}
          onSaved={(c) => { setCreating(false); changed(); setSel({ tab: "clientes", id: c.id }); }} />
      )}
      {creating && tab === "proveedores" && (
        <SupplierForm initial={null} onClose={() => setCreating(false)}
          onSaved={(s) => { setCreating(false); changed(); setSel({ tab: "proveedores", id: s.id }); }} />
      )}
    </div>
  );
}

const CRM_CSS = `
  .crm{color:#1a1a1a}
  .crm button{font-family:inherit}
  .crm-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px;flex-wrap:wrap}
  .tabs{display:flex;gap:4px;border-bottom:1px solid #e5e7eb;margin-bottom:14px}
  .tab{padding:9px 14px;border:none;background:none;font-size:14px;font-weight:600;color:#6b7280;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;display:flex;align-items:center;gap:7px}
  .tab.on{color:#0891b2;border-bottom-color:#00B4D8}
  .tab-n{font-size:11px;font-weight:700;background:#f3f4f6;color:#6b7280;border-radius:10px;padding:1px 7px}
  .tab.on .tab-n{background:rgba(0,180,216,.12);color:#0891b2}
  .filters{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
  .chips{display:flex;gap:4px}
  .chip{padding:7px 11px;border-radius:8px;border:1px solid #e5e7eb;background:#fff;font-size:12px;font-weight:600;color:#666;cursor:pointer;white-space:nowrap}
  .chip.on{border-color:rgba(0,180,216,.5);background:rgba(0,180,216,.1);color:#0891b2}
  .seg{flex:1;padding:9px 8px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid #e5e7eb;background:#fff;color:#666}
  .seg.on{border-color:rgba(0,180,216,.5);background:rgba(0,180,216,.12);color:#0891b2}

  .crm-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;align-items:start}
  .row{display:flex;align-items:center;gap:12px;width:100%;padding:11px 14px;border:none;border-bottom:1px solid #f3f4f6;background:#fff;text-align:left;cursor:pointer;color:inherit}
  .row:last-child{border-bottom:none}
  .row:hover{background:#fafbfc}
  .row.sel{background:rgba(0,180,216,.07);box-shadow:inset 3px 0 0 #00B4D8}
  .row-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
  .row-name{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .row-sub{font-size:12px;color:#888;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .row-right{display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0;max-width:45%}
  .row-amt{font-size:14px;font-weight:700}

  .pill{display:inline-block;padding:2px 7px;border-radius:6px;font-size:11px;font-weight:600;white-space:nowrap;vertical-align:1px}
  .pill-gray{background:#f3f4f6;color:#666}
  .pill-violet{background:rgba(99,102,241,.1);color:#4f46e5}
  .pill-red{background:rgba(239,68,68,.1);color:#dc2626}
  .pill-amber{background:rgba(245,158,11,.12);color:#b45309}

  .side-panel{background:#fff;border:1px solid #e5e7eb;border-radius:13px;overflow:hidden}
  .side-empty{display:flex;align-items:center;justify-content:center;text-align:center;color:#9ca3af;font-size:13px;min-height:260px;padding:20px}
  .panel-head{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid #f3f4f6}
  .panel-title{font-size:17px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .panel-pad{padding:16px 18px}
  .panel-body{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}
  .panel-body > *{min-width:0}
  .panel-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
  .panel-actions > *{min-width:0;padding-left:8px !important;padding-right:8px !important}
  .panel-cta{width:100%;box-sizing:border-box;font-size:14px !important}
  .x-btn{width:30px;height:30px;border-radius:8px;border:1px solid #e5e7eb;background:#fff;color:#888;font-size:18px;line-height:1;cursor:pointer;flex-shrink:0}
  .x-btn:hover{color:#dc2626;border-color:rgba(239,68,68,.4)}
  .x-btn.small{width:26px;height:26px;font-size:15px}

  .kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  .kpi{background:#f8fafc;border:1px solid #eef0f3;border-radius:10px;padding:10px 12px;min-width:0}
  .kpi-k{font-size:11px;color:#888;font-weight:600}
  .kpi-v{font-size:17px;font-weight:700;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .kpi-s{font-size:11px;color:#9ca3af;margin-top:1px;line-height:1.3}

  .sec-h{display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.03em;margin-bottom:6px}
  .info{display:grid;gap:0}
  .info-row{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:13px}
  .info-row:last-child{border-bottom:none}
  .info-k{color:#888;flex-shrink:0}
  .info-v{text-align:right;word-break:break-word}
  .info-v.link{color:#0891b2;text-decoration:none}
  .notes{margin-top:8px;padding:10px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:13px;color:#78350f;white-space:pre-wrap}
  .warn{padding:9px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:12px;color:#92400e}
  .err{padding:9px 12px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);border-radius:8px;font-size:13px;color:#dc2626}
  .empty{padding:18px 12px;text-align:center;font-size:13px;color:#9ca3af}

  .line{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;width:100%;background:none;border-left:none;border-right:none;border-top:none;text-align:left;color:inherit}
  .line-btn{cursor:pointer}
  .line-btn:hover{background:#fafbfc}
  .line.voided .line-name,.line.voided .line-amt{text-decoration:line-through;color:#9ca3af}
  .line-date{font-size:12px;color:#888;flex-shrink:0;width:82px}
  .line-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .line-meta{font-size:12px;color:#888;flex-shrink:0}
  .line-amt{font-weight:700;flex-shrink:0;min-width:70px;text-align:right}
  .sale-detail{background:#f8fafc;border-radius:8px;padding:8px 10px;margin:4px 0 6px}
  .more-btn{width:100%;padding:8px;margin-top:4px;border:1px dashed #d1d5db;border-radius:8px;background:#fff;color:#0891b2;font-size:12px;font-weight:600;cursor:pointer}
  .stock-chip{font-size:12px;font-weight:700;padding:3px 8px;border-radius:6px;flex-shrink:0;white-space:nowrap}

  .pick-list{border:1px solid #e5e7eb;border-radius:10px;max-height:min(46vh,420px);overflow-y:auto}
  .pick-row{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid #f3f4f6;cursor:pointer}
  .pick-row:last-child{border-bottom:none}
  .pick-row:hover{background:#fafbfc}
  .pick-all{position:sticky;top:0;background:#f8fafc;font-size:12px;font-weight:600;color:#444;z-index:1}
  .pick-row input{width:16px;height:16px;accent-color:#00B4D8;flex-shrink:0}

  .form-2{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}
  .mo{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center}
  .mb{background:#fff;border:1px solid #e5e7eb;border-radius:20px 20px 0 0;padding:24px;width:100%;max-width:480px;max-height:92vh;overflow-y:auto}
  .mb-wide{max-width:640px}
  .mb.mb-panel{padding:0;max-width:560px}
  .crm button{transition:background .15s,border-color .15s,opacity .15s}
  .crm button:disabled{cursor:not-allowed}
  .crm input:focus,.crm textarea:focus,.crm select:focus{border-color:#00B4D8 !important;box-shadow:0 0 0 3px rgba(0,180,216,.12)}

  @media(min-width:520px){ .form-2{grid-template-columns:repeat(2,minmax(0,1fr))} }
  @media(min-width:640px){ .mo{align-items:center;padding:16px} .mb{border-radius:18px} }
  @media(max-width:479px){
    .kpis{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
    .panel-actions{grid-template-columns:repeat(2,minmax(0,1fr))}
    .kpis .kpi:first-child{grid-column:1 / -1}
    .line-date{width:auto}
    .line-meta{display:none}
    .row-right{max-width:40%}
  }
  /* Computadora: lista a la izquierda, ficha fija a la derecha */
  @media(min-width:1024px){
    .crm-grid.with-panel,.crm-grid{grid-template-columns:minmax(0,1fr) 440px}
    .side-panel{position:sticky;top:calc(var(--adm-top-h, 0px) + 16px);max-height:calc(100vh - var(--adm-top-h, 0px) - 32px);overflow-y:auto}
  }
  @media(min-width:1440px){ .crm-grid.with-panel,.crm-grid{grid-template-columns:minmax(0,1fr) 500px} }
`;

export default function CrmPanel({ tab }: { tab: Tab }) {
  return (
    <div className="crm">
      <style dangerouslySetInnerHTML={{ __html: CRM_CSS }} />
      <Crm key={tab} tab={tab} />
    </div>
  );
}
