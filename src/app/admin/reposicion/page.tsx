"use client";
// ═══════════════════════════════════════════════════════════════════
// PEDIDOS A PROVEEDORES — /admin/reposicion
// Automático: apenas un producto queda con 2 unidades o menos aparece acá,
// agrupado por su proveedor. Se ELIGEN los artículos (de uno o varios
// proveedores) y se arma UN solo mensaje que se manda al GRUPO de WhatsApp
// del negocio. Al enviarlo queda registrado como "pedido enviado".
//
// Vista: a la izquierda los proveedores; a la derecha sus productos para tildar.
// Abajo, la barra con lo elegido y el botón para ver y mandar el mensaje.
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { buildGroupMessage, type GroupSection } from "@/lib/reposicion";
import { sendToGroup, copyText } from "@/lib/grupoWhatsapp";

type Item = {
  product_id: number; name: string; sku: string | null; image_url: string | null;
  stock: number; min_stock: number; suggested: number;
  pending: { order_id: number; sent_at: string; quantity: number } | null;
  supplier_name?: string | null;
};
type Sup = { id: number; name: string; contact_name: string | null; whatsapp: string | null; items: Item[] };
type Order = { id: number; supplier_id: number | null; supplier_name: string | null;
               sent_at: string; message_text: string | null; items: { product_id: number | null; name: string; quantity: number }[] };
type Data = { threshold: number; suppliers: Sup[]; noSupplier: Item[]; openOrders: Order[]; group_url: string | null };
type Sel = Record<number, { on: boolean; qty: number }>;   // por producto
type View = { kind: "sup"; id: number } | { kind: "sent" };

const NONE = 0; // "Sin proveedor" se maneja como un proveedor más (id 0)
const SEL_KEY = "ct_pedido_grupo";

const api = async (url: string, opts: RequestInit = {}) => {
  const res = await fetch(url, { credentials: "include", ...opts, headers: { "Content-Type": "application/json" } });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || `Error ${res.status}`);
  return d;
};
const when = (s: string) => {
  const d = new Date(s);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  const hm = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
  return days <= 0 ? `hoy ${hm}` : days === 1 ? `ayer ${hm}` : d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
};
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const CSS = `
  .rp{display:flex;flex-direction:column;gap:12px}
  .rp-top{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap}
  .rp-stats{display:flex;gap:8px;flex-wrap:wrap}
  .rp-stat{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:7px 12px;font-size:12px;color:#667085}
  .rp-stat b{font-size:15px;color:#1a1a1a;margin-right:4px}

  .rp-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
  .rp-box{background:#fff;border:1px solid #e5e7eb;border-radius:15px;display:flex;flex-direction:column;min-height:0;overflow:hidden}

  /* Lista de proveedores */
  .rp-list-search{padding:10px;border-bottom:1px solid #f2f4f7}
  .rp-in{width:100%;padding:9px 11px;border:1px solid #e5e7eb;border-radius:9px;font-size:13px;font-family:inherit;outline:none;background:#fff}
  .rp-in:focus{border-color:#00B4D8;box-shadow:0 0 0 3px rgba(0,180,216,.12)}
  .rp-list{overflow-y:auto;min-height:0}
  .rp-li{display:flex;align-items:center;gap:10px;width:100%;padding:11px 14px;border:none;border-bottom:1px solid #f4f5f7;background:#fff;text-align:left;cursor:pointer;font-family:inherit;color:inherit}
  .rp-li:hover{background:#fafbfc}
  .rp-li.on{background:rgba(0,180,216,.08);box-shadow:inset 3px 0 0 #00B4D8}
  .rp-li-main{flex:1;min-width:0}
  .rp-li-name{font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rp-li-sub{font-size:12px;color:#888;margin-top:1px}
  .rp-count{min-width:28px;height:24px;padding:0 8px;border-radius:999px;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .rp-count.go{background:#25D366;color:#fff}
  .rp-count.done{background:#eef2f6;color:#667085}
  .rp-count.warn{background:#fff4e5;color:#b45309}
  .rp-sep{padding:8px 14px 6px;font-size:11px;font-weight:700;color:#98a2b3;text-transform:uppercase;letter-spacing:.05em;background:#fafbfc;border-bottom:1px solid #f2f4f7}

  /* Pedido del proveedor elegido */
  .rp-dh{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid #f2f4f7;flex-wrap:wrap}
  .rp-dname{font-size:17px;font-weight:800}
  .rp-dsub{font-size:12px;color:#888;margin-top:2px}
  .rp-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 18px;border-bottom:1px solid #f2f4f7;background:#fafbfc}
  .rp-items{overflow-y:auto;min-height:0;flex:1}
  .rp-row{display:grid;grid-template-columns:22px 36px minmax(0,1fr) auto 84px;gap:10px;align-items:center;padding:8px 18px;border-bottom:1px solid #f6f7f9;cursor:pointer}
  .rp-row:hover{background:#fcfcfd}
  .rp-row.off{opacity:.5}
  .rp-img{width:36px;height:36px;border-radius:8px;object-fit:cover;background:#f3f4f6}
  .rp-pname{font-size:13px;font-weight:600;line-height:1.35;white-space:normal;overflow-wrap:anywhere}  /* nombre completo, en varias líneas si hace falta */
  .rp-meta{font-size:11px;color:#9ca3af;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rp-stock{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap}
  .rp-qty{display:flex;align-items:center;gap:4px}
  .rp-qty input{width:50px;padding:6px 4px;text-align:center;border:1px solid #e5e7eb;border-radius:7px;font:inherit;font-weight:700;font-size:14px}
  .rp-qty span{font-size:11px;color:#888}
  .rp-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 18px;border-top:1px solid #f2f4f7;font-size:12px;color:#667085;background:#fff;flex-wrap:wrap}
  .rp-pill{font-size:10px;font-weight:700;padding:1px 7px;border-radius:6px;background:rgba(99,102,241,.1);color:#4f46e5}

  .rp-wa{display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:10px;border:none;background:#25D366;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap}
  .rp-wa:disabled{background:#d1d5db;cursor:not-allowed}
  .rp-wa:not(:disabled):hover{background:#1ebe5b}
  .rp-btn{padding:6px 11px;border-radius:8px;border:1px solid #e5e7eb;background:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;color:#444;white-space:nowrap;text-decoration:none;display:inline-flex;align-items:center}
  .rp-btn.green{color:#047857;border-color:rgba(16,185,129,.4);background:rgba(16,185,129,.08)}
  .rp-back{display:none}
  .rp-warn{padding:9px 18px;background:#fffbeb;border-bottom:1px solid #fde68a;font-size:12px;color:#92400e}
  .rp-empty{padding:40px 20px;text-align:center;color:#667085;font-size:14px}
  .rp-err{padding:10px 14px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-size:13px}
  .rp-msg{padding:10px 14px;border-radius:10px;background:#ecfdf5;border:1px solid #a7f3d0;color:#047857;font-size:13px}
  .rp-order{padding:12px 18px;border-bottom:1px solid #f4f5f7;display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}
  /* Pedidos enviados: una tarjeta por pedido, un producto por renglón */
  .rp-ocard{border:1px solid #e9ecf1;border-radius:12px;background:#fff;overflow:hidden;flex-shrink:0}
  .rp-ohead{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:12px 14px;background:#fafbfc;border-bottom:1px solid #eef0f3}
  .rp-oname{font-size:15px;font-weight:800;color:#1a1a1a}
  .rp-ometa{font-size:12px;color:#888;margin-top:2px}
  .rp-ometa b{color:#475467}
  .rp-olist{padding:6px 14px}
  .rp-oline{display:grid;grid-template-columns:44px minmax(0,1fr);gap:10px;align-items:baseline;padding:6px 0;border-bottom:1px dashed #f0f2f5;font-size:13.5px}
  .rp-oline:last-of-type{border-bottom:0}
  .rp-oline b{text-align:right;font-weight:800;color:#0e7490}
  .rp-oline b::after{content:" ×";color:#98a2b3;font-weight:600}
  .rp-oline span{color:#1f2937;word-break:break-word}
  .rp-omore{margin:4px 0 2px 54px;border:0;background:none;color:#0891b2;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;padding:2px 0}
  .rp-oacts{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;padding:10px 14px;border-top:1px solid #eef0f3}

  /* Barra del pedido (abajo) y ventana del mensaje */
  .rp-bar{position:sticky;bottom:10px;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;background:#0f172a;color:#fff;border-radius:14px;padding:12px 16px;box-shadow:0 10px 30px rgba(15,23,42,.25)}
  .rp-bar b{font-size:16px}
  .rp-bar .rp-btn{background:transparent;color:#cbd5e1;border-color:#334155}
  .rp-modal-bg{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:300;display:flex;align-items:center;justify-content:center;padding:16px}
  .rp-modal{background:#fff;border-radius:16px;width:min(640px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;overflow:hidden}
  .rp-modal textarea{width:100%;min-height:260px;flex:1;padding:12px;border:1px solid #e5e7eb;border-radius:10px;font:inherit;font-size:13px;line-height:1.5;resize:vertical;background:#f0fdf4;box-sizing:border-box}
  .rp-steps{font-size:12px;color:#475467;background:#f8fafc;border:1px solid #eef2f6;border-radius:10px;padding:10px 12px;line-height:1.55}

  /* Computadora: todo entra en pantalla, cada columna con su scroll */
  @media(min-width:900px){
    .rp-grid{grid-template-columns:320px minmax(0,1fr);height:calc(100vh - var(--adm-top-h, 120px) - 220px);min-height:420px}
    .rp-box{height:100%}
  }
  /* Celular: o la lista o el pedido */
  @media(max-width:899px){
    .rp-grid.detail .rp-side{display:none}
    .rp-grid:not(.detail) .rp-main{display:none}
    .rp-back{display:inline-flex}
    .rp-box{max-height:none}
    .rp-row{grid-template-columns:22px minmax(0,1fr) 78px;row-gap:3px}
    .rp-row .rp-img{display:none}
    .rp-row .rp-stock{grid-column:2;justify-self:start}
    .rp-dh .rp-wa{width:100%;justify-content:center}
  }
`;

const WaIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3M12 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8M20.5 3.5A12 12 0 0 0 1.6 17.9L0 24l6.3-1.6A12 12 0 0 0 24 12a11.9 11.9 0 0 0-3.5-8.5" />
  </svg>
);
const stockStyle = (stock: number) => (stock <= 0 ? { color: "#b42318", background: "#fee4e2" } : { color: "#b45309", background: "#fff4e5" });

// ─── Productos de un proveedor (para tildar) ────────────────────────
function SupplierItems({ s, sel, setSel, onBack }: { s: Sup; sel: Sel; setSel: (fn: (v: Sel) => Sel) => void; onBack: () => void }) {
  const [q, setQ] = useState("");
  const [hidePending, setHidePending] = useState(true);

  const pendingCount = s.items.filter((i) => i.pending).length;
  const words = norm(q).split(/\s+/).filter(Boolean);
  const shown = s.items.filter((i) => (!hidePending || !i.pending) && words.every((w) => norm(`${i.name} ${i.sku || ""} ${i.product_id}`).includes(w)));
  const chosen = s.items.filter((i) => sel[i.product_id]?.on);

  const setAll = (on: boolean) => setSel((v) => {
    const next = { ...v };
    for (const i of shown) next[i.product_id] = { qty: v[i.product_id]?.qty || i.suggested, on };
    return next;
  });

  return (
    <>
      <div className="rp-dh">
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <button className="rp-btn rp-back" onClick={onBack}>←</button>
          <div style={{ minWidth: 0 }}>
            <div className="rp-dname">{s.name}</div>
            <div className="rp-dsub">
              {s.id === NONE ? "Productos para pedir que todavía no tienen proveedor" : `${s.items.length} productos con poco stock`}
              {chosen.length > 0 && <b style={{ color: "#047857" }}> · {chosen.length} elegidos</b>}
            </div>
          </div>
        </div>
        {s.id !== NONE
          ? <Link href={`/admin/proveedores?id=${s.id}`} className="rp-btn">Ficha del proveedor</Link>
          : <Link href="/admin/proveedores" className="rp-btn">Asignar proveedores</Link>}
      </div>

      <div className="rp-tools">
        <input className="rp-in" style={{ flex: "1 1 200px", width: "auto" }} value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar entre ${s.items.length} productos…`} />
        <button className="rp-btn" onClick={() => setAll(true)}>Marcar todos</button>
        <button className="rp-btn" onClick={() => setAll(false)}>Ninguno</button>
        {pendingCount > 0 && (
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#444", cursor: "pointer", whiteSpace: "nowrap" }}>
            <input type="checkbox" checked={hidePending} onChange={(e) => setHidePending(e.target.checked)} style={{ accentColor: "#00B4D8" }} />
            Ocultar ya pedidos ({pendingCount})
          </label>
        )}
      </div>

      <div className="rp-items">
        {shown.length === 0 && <div className="rp-empty">{q ? "Ningún producto coincide." : "Todos los productos de acá ya se pidieron."}</div>}
        {shown.map((i) => {
          const v = sel[i.product_id] || { on: false, qty: i.suggested };
          return (
            <label key={i.product_id} className={`rp-row ${v.on ? "" : "off"}`}>
              <input type="checkbox" checked={v.on} onChange={(e) => setSel((all) => ({ ...all, [i.product_id]: { qty: v.qty || i.suggested, on: e.target.checked } }))}
                style={{ width: 17, height: 17, accentColor: "#25D366" }} />
              {i.image_url ? <img src={i.image_url} alt="" className="rp-img" /> : <div className="rp-img" />}
              <div style={{ minWidth: 0 }}>
                <div className="rp-pname">{i.name}</div>
                <div className="rp-meta">
                  #{i.product_id}{i.sku ? ` · ${i.sku}` : ""}
                  {i.supplier_name ? ` · proveedor desactivado: ${i.supplier_name}` : ""}
                  {i.pending && <> · <span className="rp-pill">Pedido {when(i.pending.sent_at)}</span></>}
                </div>
              </div>
              <span className="rp-stock" style={stockStyle(i.stock)}>{i.stock <= 0 ? "Sin stock" : `Quedan ${i.stock}`}</span>
              <div className="rp-qty" onClick={(e) => e.preventDefault()}>
                <input value={v.qty} inputMode="numeric" aria-label="Cantidad a pedir"
                  onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, "")) || 0; setSel((all) => ({ ...all, [i.product_id]: { on: n > 0, qty: Math.min(n, 9999) } })); }} />
                <span>u.</span>
              </div>
            </label>
          );
        })}
      </div>
    </>
  );
}

// ─── Ventana: ver, editar y mandar el mensaje al grupo ──────────────
function MessageModal({ initial, count, groupUrl, onClose, onSent }: {
  initial: string; count: number; groupUrl: string | null; onClose: () => void; onSent: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");

  const send = async () => {
    if (!text.trim()) return;
    sendToGroup(text);              // en el mismo clic: abre WhatsApp con el texto (y lo deja copiado)
    setBusy(true); setErr("");
    try { await onSent(text); }
    catch (e: any) { setErr(`Se abrió WhatsApp, pero no se pudo registrar el pedido: ${e.message}`); setBusy(false); }
  };

  return (
    <div className="rp-modal-bg" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="rp-modal">
        <div className="rp-dh">
          <div>
            <div className="rp-dname">Mensaje para el grupo</div>
            <div className="rp-dsub">{count} productos · podés corregir el texto antes de mandarlo</div>
          </div>
          <button className="rp-btn" onClick={onClose} disabled={busy}>✕</button>
        </div>
        <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: 10, overflow: "auto", minHeight: 0 }}>
          {err && <div className="rp-err">{err}</div>}
          <textarea value={text} onChange={(e) => setText(e.target.value)} aria-label="Mensaje" />
          {initial !== text && <button className="rp-btn" style={{ alignSelf: "flex-start" }} onClick={() => setText(initial)}>↺ Volver al texto original</button>}
          <div className="rp-steps">
            Al tocar <b>Enviar al grupo</b> se abre WhatsApp con el mensaje escrito: <b>elegí el grupo</b> y mandalo.
            {" "}El mensaje también queda copiado, por si hace falta pegarlo.
            {groupUrl && <> Si preferís, abrí el grupo y pegalo ahí.</>}
          </div>
        </div>
        <div className="rp-foot" style={{ justifyContent: "flex-end" }}>
          <button className="rp-btn" onClick={async () => { if (await copyText(text)) { setCopied(true); setTimeout(() => setCopied(false), 2000); } }}>
            {copied ? "✓ Copiado" : "Copiar mensaje"}
          </button>
          {groupUrl && <a className="rp-btn" href={groupUrl} target="_blank" rel="noopener noreferrer" onClick={() => { copyText(text); }}>Abrir el grupo</a>}
          <button className="rp-wa" onClick={send} disabled={busy || !text.trim()}>
            <WaIcon /> {busy ? "Registrando…" : "Enviar al grupo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pantalla ───────────────────────────────────────────────────────
export default function ReposicionPage() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [view, setView] = useState<View | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [sel, setSelState] = useState<Sel>({});
  const [filter, setFilter] = useState("");
  const [composing, setComposing] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  // Lo elegido queda guardado en esta compu hasta que se manda
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem(SEL_KEY) || "{}"); if (v && typeof v === "object") setSelState(v); } catch {} }, []);
  const setSel = useCallback((fn: (v: Sel) => Sel) => setSelState((old) => {
    const next = fn(old);
    try { localStorage.setItem(SEL_KEY, JSON.stringify(next)); } catch {}
    return next;
  }), []);

  const load = useCallback(() => {
    api("/api/reposicion").then((x: Data) => { setD(x); setErr(""); }).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const on = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, [load]);

  // Proveedores + "Sin proveedor" como uno más
  const groups: Sup[] = useMemo(() => !d ? [] : [
    ...d.suppliers,
    ...(d.noSupplier.length ? [{ id: NONE, name: "Sin proveedor", contact_name: null, whatsapp: null, items: d.noSupplier }] : []),
  ], [d]);

  // Elegir el primero (o el del link /admin/reposicion#s12)
  useEffect(() => {
    if (!d) return;
    const exists = (v: View | null) => !!v && (v.kind === "sup" ? groups.some((s) => s.id === v.id) : d.openOrders.length > 0);
    if (exists(view)) return;
    const hash = Number(window.location.hash.replace("#s", ""));
    const fromHash = groups.find((s) => s.id === hash && hash > 0);
    const first = fromHash || groups.find((s) => s.items.some((i) => !i.pending)) || groups[0];
    if (fromHash) setMobileDetail(true);
    setView(first ? { kind: "sup", id: first.id } : d.openOrders.length ? { kind: "sent" } : null);
  }, [d, view, groups]);

  // Lo elegido, separado por proveedor (solo productos que siguen en la lista)
  const chosen = useMemo(() => groups
    .map((g) => ({ g, items: g.items.filter((i) => sel[i.product_id]?.on && sel[i.product_id].qty > 0) }))
    .filter((x) => x.items.length), [groups, sel]);
  const chosenCount = chosen.reduce((n, x) => n + x.items.length, 0);
  const chosenUnits = chosen.reduce((n, x) => n + x.items.reduce((m, i) => m + sel[i.product_id].qty, 0), 0);
  const message = useMemo(() => buildGroupMessage(chosen.map(({ g, items }): GroupSection => ({
    title: g.id === NONE ? "Sin proveedor" : g.name,
    lines: [...items].sort((a, b) => a.name.localeCompare(b.name)).map((i) => ({ name: i.name, sku: i.sku, quantity: sel[i.product_id].qty })),
  })), { title: "Pedido de mercadería" }), [chosen, sel]);

  const registerSent = async (text: string) => {
    const items = chosen.flatMap(({ items }) => items.map((i) => ({ product_id: i.product_id, quantity: sel[i.product_id].qty })));
    const r = await api("/api/reposicion/orders", { method: "POST", body: JSON.stringify({ items, message: text }) });
    setComposing(false);
    setSel(() => ({}));
    setMsg(`Pedido registrado (${r.products} productos). Cuando llegue, marcalo en "Pedidos enviados".`);
    load(); window.dispatchEvent(new Event("admin:refresh-badges"));
  };

  const close = async (o: Order, status: "received" | "cancelled") => {
    const name = o.supplier_name || "Sin proveedor";
    const txt = status === "received" ? `¿Marcar como recibido el pedido de ${name}? (Acordate de sumar el stock en Compras o Artículos)` : `¿Cancelar el pedido de ${name}?`;
    if (!confirm(txt)) return;
    try { await api(`/api/reposicion/orders/${o.id}`, { method: "PATCH", body: JSON.stringify({ status }) }); setMsg(status === "received" ? "Pedido marcado como recibido." : "Pedido cancelado."); load(); window.dispatchEvent(new Event("admin:refresh-badges")); }
    catch (e: any) { alert(e.message); }
  };

  const supList = useMemo(() => {
    const w = norm(filter).split(/\s+/).filter(Boolean);
    const todo = (s: Sup) => s.items.filter((i) => !i.pending).length;
    return groups
      .filter((s) => w.every((x) => norm(s.name).includes(x)))
      .sort((a, b) => (a.id === NONE ? 1 : 0) - (b.id === NONE ? 1 : 0) || (todo(b) > 0 ? 1 : 0) - (todo(a) > 0 ? 1 : 0) || todo(b) - todo(a) || a.name.localeCompare(b.name));
  }, [groups, filter]);

  const open = (v: View) => { setView(v); setMobileDetail(true); setMsg(""); };
  const current = view?.kind === "sup" ? groups.find((s) => s.id === view.id) : null;
  const totalItems = groups.reduce((n, s) => n + s.items.filter((i) => !i.pending).length, 0);

  return (
    <div className="rp">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="rp-top">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Pedidos a proveedores</h1>
          <p style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
            Los productos con {d?.threshold ?? 2} unidades o menos aparecen solos. Elegí los que quieras pedir y mandá el pedido al grupo de WhatsApp.
          </p>
        </div>
        {d && (
          <div className="rp-stats">
            <span className="rp-stat"><b>{totalItems}</b>para pedir</span>
            <span className="rp-stat"><b>{d.openOrders.length}</b>pedidos en camino</span>
          </div>
        )}
      </div>

      {err && <div className="rp-err">{err}</div>}
      {msg && <div className="rp-msg">{msg}</div>}
      {!d && !err && <div className="rp-box rp-empty">Cargando…</div>}

      {d && groups.length === 0 && d.openOrders.length === 0 && (
        <div className="rp-box rp-empty">✓ Todo en orden: ningún producto está en {d.threshold} unidades o menos.</div>
      )}

      {d && (groups.length > 0 || d.openOrders.length > 0) && (
        <div className={`rp-grid ${mobileDetail ? "detail" : ""}`}>
          {/* ── Lista ── */}
          <aside className="rp-box rp-side">
            {groups.length > 6 && (
              <div className="rp-list-search">
                <input className="rp-in" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar proveedor…" />
              </div>
            )}
            <div className="rp-list">
              {supList.map((s) => {
                const todo = s.items.filter((i) => !i.pending).length;
                const picked = s.items.filter((i) => sel[i.product_id]?.on).length;
                return (
                  <button key={s.id} className={`rp-li ${view?.kind === "sup" && view.id === s.id ? "on" : ""}`} onClick={() => open({ kind: "sup", id: s.id })}>
                    <div className="rp-li-main">
                      <div className="rp-li-name" style={s.id === NONE ? { color: "#b45309" } : undefined}>{s.name}</div>
                      <div className="rp-li-sub">
                        {todo > 0 ? `${todo} para pedir` : "Todo pedido"}
                        {s.items.length - todo > 0 && ` · ${s.items.length - todo} en camino`}
                        {picked > 0 && <b style={{ color: "#047857" }}> · {picked} elegidos</b>}
                      </div>
                    </div>
                    <span className={`rp-count ${picked ? "go" : todo === 0 ? "done" : "warn"}`}>{picked ? `✓${picked}` : todo || "✓"}</span>
                  </button>
                );
              })}
              {supList.length === 0 && groups.length > 0 && <div className="rp-empty" style={{ padding: 20 }}>Ningún proveedor coincide.</div>}

              {d.openOrders.length > 0 && (
                <>
                  <div className="rp-sep">Otros</div>
                  <button className={`rp-li ${view?.kind === "sent" ? "on" : ""}`} onClick={() => open({ kind: "sent" })}>
                    <div className="rp-li-main">
                      <div className="rp-li-name">Pedidos enviados</div>
                      <div className="rp-li-sub">Esperando que lleguen</div>
                    </div>
                    <span className="rp-count done">{d.openOrders.length}</span>
                  </button>
                </>
              )}
            </div>
          </aside>

          {/* ── Detalle ── */}
          <section className="rp-box rp-main">
            {current && <SupplierItems key={current.id} s={current} sel={sel} setSel={setSel} onBack={() => setMobileDetail(false)} />}

            {view?.kind === "sent" && (
              <>
                <div className="rp-dh">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button className="rp-btn rp-back" onClick={() => setMobileDetail(false)}>←</button>
                    <div>
                      <div className="rp-dname">Pedidos enviados</div>
                      <div className="rp-dsub">Cuando llegue la mercadería, marcalo como &quot;Llegó&quot;</div>
                    </div>
                  </div>
                </div>
                <div className="rp-items" style={{ padding: "12px 14px", display: "grid", gap: 12, alignContent: "start", gridAutoRows: "max-content" }}>
                  {d.openOrders.map((o) => {
                    const units = o.items.reduce((n, it) => n + it.quantity, 0);
                    const long = o.items.length > 6;
                    const isOpen = expanded[o.id] || !long;
                    const list = isOpen ? o.items : o.items.slice(0, 5);
                    return (
                      <div key={o.id} className="rp-ocard">
                        <div className="rp-ohead">
                          <div style={{ minWidth: 0 }}>
                            <div className="rp-oname">{o.supplier_name || "Sin proveedor"}</div>
                            <div className="rp-ometa">
                              Pedido #{o.id} · enviado {when(o.sent_at)} · <b>{o.items.length} {o.items.length === 1 ? "producto" : "productos"}</b> · {units} u.
                            </div>
                          </div>
                          <span className="rp-pill" style={{ background: "#fff4e5", color: "#b45309", flexShrink: 0 }}>Esperando</span>
                        </div>
                        <div className="rp-olist">
                          {list.map((it, k) => (
                            <div key={k} className="rp-oline">
                              <b>{it.quantity}</b>
                              <span>{it.name}</span>
                            </div>
                          ))}
                          {long && (
                            <button className="rp-omore" onClick={() => setExpanded((e) => ({ ...e, [o.id]: !isOpen }))}>
                              {isOpen ? "Ver menos ▴" : `Ver los ${o.items.length - 5} restantes ▾`}
                            </button>
                          )}
                        </div>
                        <div className="rp-oacts">
                          {o.message_text && <button className="rp-btn" onClick={() => sendToGroup(o.message_text!)}>Reenviar al grupo</button>}
                          <button className="rp-btn" onClick={() => close(o, "cancelled")}>Cancelar</button>
                          <button className="rp-btn green" onClick={() => close(o, "received")}>✓ Llegó</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {/* ── Barra con lo elegido ── */}
      {chosenCount > 0 && (
        <div className="rp-bar">
          <div style={{ minWidth: 0 }}>
            <b>{chosenCount}</b> {chosenCount === 1 ? "producto" : "productos"} · {chosenUnits} u.
            <span style={{ color: "#94a3b8", fontSize: 12 }}> · de {chosen.length} {chosen.length === 1 ? "proveedor" : "proveedores"}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="rp-btn" onClick={() => { if (confirm("¿Destildar todo?")) setSel(() => ({})); }}>Vaciar</button>
            <button className="rp-wa" onClick={() => setComposing(true)}><WaIcon /> Ver mensaje y enviar al grupo</button>
          </div>
        </div>
      )}

      {composing && (
        <MessageModal initial={message} count={chosenCount} groupUrl={d?.group_url ?? null}
          onClose={() => setComposing(false)} onSent={registerSent} />
      )}
    </div>
  );
}