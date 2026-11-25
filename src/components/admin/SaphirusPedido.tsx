"use client";
// ═══════════════════════════════════════════════════════════════════
// PEDIDO SAPHIRUS — sección propia del menú (/admin/pedido-saphirus), la usa cualquier usuario
// Se arma el pedido con los productos de Saphirus cargados (con su stock)
// y/o renglones libres (aromas que no están cargados), y se manda por
// WhatsApp al GRUPO del negocio. El borrador queda guardado en esta compu.
// El proveedor es el que tenga "Saphirus" en el nombre (se carga en Proveedores).
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { api, fmtDateTime } from "@/components/admin/pos";
import { buildGroupMessage, saphirusBulto, saphirusSuggested } from "@/lib/reposicion";
import { sendToGroup } from "@/lib/grupoWhatsapp";

type Supplier = { id: number; name: string; contact_name: string | null; whatsapp: string | null };
type Product = { id: number; name: string; sku: string | null; image_url: string | null; stock: number; min_stock: number; category: string | null; pending_sent_at: string | null; pending_qty: number | null };
type Order = { id: number; status: "sent" | "received" | "cancelled"; sent_at: string; received_at: string | null; notes: string | null; items: { name: string; quantity: number; free: boolean }[] };
type Data = { threshold: number; suppliers: Supplier[]; supplier: Supplier | null; products: Product[]; total: number;
              counts: { total: number; low: number; low_open: number }; orders: Order[]; group_url: string | null };
type Lite = { id: number; name: string; sku: string | null };
type Free = { key: number; name: string; qty: number };
// qty: cantidad por producto (0 = sacado a mano) · meta: nombre de cada producto elegido, para
// armar el mensaje sin traer todos los productos · filled: ya se cargaron los de bulto en 12
type Draft = { qty: Record<number, number>; meta?: Record<number, { name: string; sku: string | null }>; free: Free[]; note: string; v?: number; filled?: boolean };

const DRAFT_KEY = "ct_saphirus_draft";
const PAGE = 15;
const emptyDraft: Draft = { qty: {}, meta: {}, free: [], note: "", v: 2 };
let seq = Date.now();

const loadDraft = (): Draft => {
  try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); if (d && typeof d === "object") return { ...emptyDraft, v: undefined, ...d }; } catch {}
  return emptyDraft;
};
const saveDraft = (d: Draft) => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch {} };

const WaIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z" />
  </svg>
);

export default function SaphirusPedido() {
  const [data, setData] = useState<Data | null>(null);
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [search, setSearch] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [freeName, setFreeName] = useState("");
  const [freeQty, setFreeQty] = useState("1");
  const [sending, setSending] = useState(false);
  // Lista de productos: de a 15, con la búsqueda y el filtro resueltos en la base
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [qDeb, setQDeb] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const listReq = useRef(0);

  useEffect(() => { setDraft(loadDraft()); }, []);
  const update = (fn: (d: Draft) => Draft) => setDraft((d) => { const n = fn(d); saveDraft(n); return n; });
  useEffect(() => { const t = setTimeout(() => setQDeb(search.trim()), 350); return () => clearTimeout(t); }, [search]);

  const listParams = useCallback((offset: number) => {
    const sp = new URLSearchParams({ offset: String(offset), limit: String(PAGE) });
    if (supplierId) sp.set("supplier", String(supplierId));
    if (qDeb) sp.set("q", qDeb);
    if (onlyLow) sp.set("low", "1");
    return sp;
  }, [supplierId, qDeb, onlyLow]);

  // Proveedor, contadores, pedidos enviados y la 1ª página
  const load = useCallback(async () => {
    const my = ++listReq.current;
    try {
      const d: Data = await api(`/api/saphirus?${listParams(0)}`);
      setData(d); setErr("");
      if (my === listReq.current) { setProducts(d.products); setTotal(d.total); }
    } catch (e: any) { setErr(e.message); }
  }, [supplierId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  // Otra página, o la 1ª cuando cambia la búsqueda / el filtro
  const fetchPage = useCallback(async (offset: number) => {
    const my = ++listReq.current;
    setListLoading(true);
    try {
      const sp = listParams(offset); sp.set("page", "1");
      const d = await api(`/api/saphirus?${sp}`);
      if (my !== listReq.current) return;
      setProducts((prev) => (offset ? [...prev, ...d.items] : d.items)); setTotal(d.total);
    } catch (e: any) { setErr(e.message); } finally { if (my === listReq.current) setListLoading(false); }
  }, [listParams]);
  const firstList = useRef(true);
  useEffect(() => { if (firstList.current) { firstList.current = false; return; } fetchPage(0); }, [qDeb, onlyLow]); // eslint-disable-line react-hooks/exhaustive-deps

  const supplier = data?.supplier || null;
  const supQ = supplier ? `supplier=${supplier.id}&` : "";
  const metaOf = (p: Lite) => ({ name: p.name, sku: p.sku });

  // Textil, Aerosol y Varilla arrancan ya con 12 (un bulto) adentro del pedido.
  // Se pide a la base solo la lista liviana (id y nombre) de esos productos, una vez por pedido.
  // Si uno se pone en 0, queda en 0. Los que ya están en camino no se agregan.
  // Al enviar el pedido el borrador se limpia y en el siguiente vuelven a arrancar en 12.
  useEffect(() => {
    if (!data || draft.filled) return;
    let alive = true;
    api(`/api/saphirus?${supQ}lite=bulto`).then((r: { items: Lite[] }) => {
      if (!alive) return;
      update((d) => {
        const qty = { ...d.qty }, meta = { ...(d.meta || {}) };
        for (const p of r.items) if (!(p.id in qty)) { qty[p.id] = saphirusSuggested(p.name); meta[p.id] = metaOf(p); }
        return { ...d, qty, meta, filled: true };
      });
    }).catch(() => {});
    return () => { alive = false; };
  }, [data, draft.filled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pedidos guardados en la compu desde antes: se completan los nombres que falten
  // (y se sacan los productos que ya no existen). Solo se piden esos ids.
  useEffect(() => {
    if (!data) return;
    const falta = Object.entries(draft.qty).filter(([id, q]) => q > 0 && !draft.meta?.[Number(id)]).map(([id]) => id);
    if (!falta.length) return;
    let alive = true;
    api(`/api/saphirus?${supQ}ids=${falta.join(",")}`).then((r: { items: Lite[] }) => {
      if (!alive) return;
      const ok = new Map(r.items.map((p) => [p.id, p]));
      update((d) => {
        const qty = { ...d.qty }, meta = { ...(d.meta || {}) };
        for (const id of falta.map(Number)) { const p = ok.get(id); if (p) meta[id] = metaOf(p); else delete qty[id]; }
        return { ...d, qty, meta };
      });
    }).catch(() => {});
    return () => { alive = false; };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = products;

  // + / −: los que vienen en bulto (Textil, Aerosol, Varilla) van de a 12; el resto, de a 1.
  // Escribiendo se puede poner cualquier cantidad.
  const stepUp = (q: number, name: string) => {
    const b = saphirusBulto(name);
    if (b) return (Math.floor(q / b) + 1) * b;
    return q + 1;
  };
  const stepDown = (q: number, name: string) => {
    const b = saphirusBulto(name);
    if (b) return (Math.ceil(q / b) - 1) * b;
    return q - 1;
  };

  const setQty = (p: Lite, q: number) => update((d) => {
    const qty = { ...d.qty }, meta = { ...(d.meta || {}) };
    if (q > 0) { qty[p.id] = Math.min(9999, q); meta[p.id] = metaOf(p); }
    else if (saphirusBulto(p.name)) qty[p.id] = 0;   // queda en 0 (no se vuelve a poner 12 solo)
    else { delete qty[p.id]; delete meta[p.id]; }
    return { ...d, qty, meta };
  });

  // Renglones del pedido: salen de lo guardado (nombre incluido), no de la página que se ve
  const prodLines = Object.entries(draft.qty)
    .map(([id, q]) => ({ p: draft.meta?.[Number(id)] ? { id: Number(id), ...draft.meta![Number(id)] } : null, q }))
    .filter((l): l is { p: Lite; q: number } => !!l.p && l.q > 0)
    .sort((a, b) => a.p.name.localeCompare(b.p.name));
  const lineCount = prodLines.length + draft.free.length;
  const units = prodLines.reduce((a, l) => a + l.q, 0) + draft.free.reduce((a, f) => a + f.qty, 0);

  const message = supplier && lineCount
    ? buildGroupMessage([{ title: supplier.name, lines: [
        ...prodLines.map((l) => ({ name: l.p.name, sku: l.p.sku, quantity: l.q })),
        ...draft.free.map((f) => ({ name: f.name, quantity: f.qty })),
      ] }], { title: "Pedido Saphirus", note: draft.note })
    : "";

  const addFree = () => {
    const name = freeName.trim(), q = Math.round(Number(freeQty));
    if (!name || !(q > 0)) return;
    update((d) => ({ ...d, free: [...d.free, { key: seq++, name: name.slice(0, 200), qty: Math.min(9999, q) }] }));
    setFreeName(""); setFreeQty("1");
  };

  // "Agregar todos los que hay que reponer": pide a la base solo id y nombre de esos productos
  const addAllLow = async () => {
    try {
      const r: { items: Lite[] } = await api(`/api/saphirus?${supQ}lite=low`);
      update((d) => {
        const qty = { ...d.qty }, meta = { ...(d.meta || {}) };
        for (const p of r.items) if (!qty[p.id]) { qty[p.id] = saphirusSuggested(p.name); meta[p.id] = metaOf(p); }
        return { ...d, qty, meta };
      });
    } catch (e: any) { setErr(e.message); }
  };

  const send = async () => {
    if (!supplier || !lineCount) return;
    // WhatsApp se abre en el mismo clic con el mensaje (se elige el grupo); después se registra
    sendToGroup(message);
    setSending(true); setErr("");
    try {
      await api("/api/saphirus", {
        method: "POST",
        body: JSON.stringify({
          supplier_id: supplier.id, note: draft.note, message,
          items: [...prodLines.map((l) => ({ product_id: l.p.id, quantity: l.q })), ...draft.free.map((f) => ({ name: f.name, quantity: f.qty }))],
        }),
      });
      setMsg("Pedido enviado y guardado ✓");
      setTimeout(() => setMsg(""), 4000);
      // Primero se recarga (así lo recién pedido figura "en camino") y después se limpia el borrador
      await load();
      update(() => emptyDraft);
    } catch (e: any) { setErr(`Se abrió WhatsApp, pero no se pudo guardar el pedido: ${e.message}`); }
    finally { setSending(false); }
  };

  const closeOrder = async (o: Order, status: "received" | "cancelled") => {
    if (status === "cancelled" && !confirm("¿Cancelar este pedido?")) return;
    try { await api(`/api/reposicion/orders/${o.id}`, { method: "PATCH", body: JSON.stringify({ status }) }); load(); }
    catch (e: any) { setErr(e.message); }
  };

  if (!data) return err
    ? <div style={{ padding: 10 }}><p style={{ color: "#b91c1c", fontSize: 14 }}>No se pudo cargar: {err}</p><button onClick={load} style={{ marginTop: 8 }}>Reintentar</button></div>
    : <p style={{ color: "#666", padding: 10 }}>Cargando…</p>;

  // Sin proveedor Saphirus cargado
  if (data && !data.suppliers.length) return (
    <div className="sp-card" style={{ maxWidth: 560 }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <h2 className="sp-h">Pedido Saphirus</h2>
      <p style={{ fontSize: 14, color: "#475467", marginTop: 6, lineHeight: 1.5 }}>
        Todavía no hay un proveedor de Saphirus. Cargalo en <b>Proveedores → Nuevo proveedor</b> con un nombre que diga
        <b> Saphirus</b> (por ejemplo “Saphirus – Distribuidor”). No hace falta el WhatsApp: los pedidos van al grupo.
      </p>
      <Link href="/admin/proveedores" className="sp-btn primary" style={{ marginTop: 12, display: "inline-flex" }}>Ir a Proveedores</Link>
    </div>
  );

  return (
    <div className="sp">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {err && <div className="sp-err">{err}</div>}
      {msg && <div className="sp-ok">{msg}</div>}

      {/* Proveedor */}
      <div className="sp-card sp-top">
        <div style={{ minWidth: 0 }}>
          <h2 className="sp-h">Pedido Saphirus</h2>
          {supplier && (
            <p className="sp-sub">
              {supplier.contact_name ? `${supplier.contact_name} · ` : ""}
              El pedido se manda al grupo de WhatsApp del negocio
            </p>
          )}
        </div>
        {data!.suppliers.length > 1 && (
          <select className="sp-in" style={{ maxWidth: 260 }} value={supplier?.id ?? ""} onChange={(e) => setSupplierId(Number(e.target.value))}>
            {data!.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      <div className="sp-grid">
        {/* Productos */}
        <div className="sp-card sp-list">
          <div className="sp-bar">
            <input className="sp-in" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar aroma o producto…" />
            <label className="sp-chk"><input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} /> Solo para reponer ({data?.counts.low ?? 0})</label>
          </div>
          {(data?.counts.low_open ?? 0) > 0 && (
            <button className="sp-btn" onClick={addAllLow}>＋ Agregar todos los que hay que reponer</button>
          )}
          <div className="sp-rows">
            {shown.map((p) => {
              const q = draft.qty[p.id] || 0;
              const isLow = p.stock <= (data?.threshold ?? 2);
              return (
                <div key={p.id} className={`sp-row ${q ? "on" : ""}`}>
                  <div style={{ minWidth: 0 }}>
                    <div className="sp-name">{p.name}</div>
                    <div className="sp-meta">
                      <span className="sp-stock" style={isLow ? { background: "#fef2f2", color: "#b91c1c" } : undefined}>Stock {p.stock}</span>
                      {p.pending_sent_at && <span className="sp-stock" style={{ background: "#eef2ff", color: "#4338ca" }}>Pedido {p.pending_qty} · {fmtDateTime(p.pending_sent_at)}</span>}
                    </div>
                  </div>
                  <div className="sp-step">
                    <button onClick={() => setQty(p, stepDown(q, p.name))} disabled={!q} aria-label={saphirusBulto(p.name) ? "Un bulto menos" : "Menos"}>−</button>
                    <input inputMode="numeric" value={q || ""} placeholder="0" onChange={(e) => setQty(p, Math.round(Number(e.target.value.replace(/\D/g, "")) || 0))} />
                    <button onClick={() => setQty(p, stepUp(q, p.name))} aria-label={saphirusBulto(p.name) ? "Un bulto más (12)" : "Más"}>+</button>
                  </div>
                </div>
              );
            })}
            {!shown.length && (
              <p className="sp-empty">
                {listLoading || search.trim() !== qDeb ? "Buscando…" : (data?.counts.total ?? 0) > 0 ? "No hay productos con ese filtro." : "No hay productos de Saphirus cargados. Asignales este proveedor en Artículos, o usá los renglones libres."}
              </p>
            )}
            {products.length < total && (
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <button className="sp-btn" onClick={() => fetchPage(products.length)} disabled={listLoading}>
                  {listLoading ? "Cargando…" : `Mostrar ${Math.min(PAGE, total - products.length)} más`}
                </button>
                <p className="sp-sub" style={{ fontSize: 11, marginTop: 4 }}>Mostrando {products.length} de {total}</p>
              </div>
            )}
          </div>
        </div>

        {/* Pedido */}
        <div className="sp-card sp-cart">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h3 className="sp-h" style={{ fontSize: 16 }}>Pedido</h3>
            <span className="sp-sub">{lineCount} renglones · {units} u.</span>
          </div>

          <div className="sp-lines">
            {prodLines.map((l) => (
              <div key={l.p.id} className="sp-line">
                <b>{l.q}</b><span>{l.p.name}</span>
                <button onClick={() => setQty(l.p, 0)} aria-label="Quitar">×</button>
              </div>
            ))}
            {draft.free.map((f) => (
              <div key={f.key} className="sp-line">
                <b>{f.qty}</b><span>{f.name} <small className="sp-tag">libre</small></span>
                <button onClick={() => update((d) => ({ ...d, free: d.free.filter((x) => x.key !== f.key) }))} aria-label="Quitar">×</button>
              </div>
            ))}
            {!lineCount && <p className="sp-empty" style={{ padding: "6px 0" }}>Sumá productos de la lista o escribí un renglón libre.</p>}
          </div>

          <div>
            <label className="sp-lbl">RENGLÓN LIBRE (aroma o producto que no está cargado)</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input className="sp-in" style={{ width: 64, flex: "0 0 auto" }} inputMode="numeric" value={freeQty} onChange={(e) => setFreeQty(e.target.value.replace(/\D/g, ""))} aria-label="Cantidad" />
              <input className="sp-in" value={freeName} onChange={(e) => setFreeName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addFree(); }} placeholder="Ej: Aerosol Saphirus Lemon Grass" />
              <button className="sp-btn" onClick={addFree} disabled={!freeName.trim()}>Agregar</button>
            </div>
          </div>

          <div>
            <label className="sp-lbl">NOTA PARA EL PROVEEDOR (opcional)</label>
            <textarea className="sp-in" rows={2} value={draft.note} maxLength={500} onChange={(e) => update((d) => ({ ...d, note: e.target.value }))} placeholder="Ej: si no hay Vainilla, mandar Coco" />
          </div>

          {message && (
            <details className="sp-prev">
              <summary>Ver mensaje</summary>
              <pre>{message}</pre>
            </details>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            {lineCount > 0 && <button className="sp-btn" onClick={() => { if (confirm("¿Vaciar el pedido?")) update(() => ({ ...emptyDraft, filled: true })); }}>Vaciar</button>}
            <button className="sp-btn wa" style={{ flex: 1 }} disabled={!lineCount || !supplier || sending} onClick={send}>
              <WaIcon /> {sending ? "Guardando…" : "Enviar al grupo"}
            </button>
          </div>
          <p className="sp-sub" style={{ fontSize: 11 }}>
            Se abre WhatsApp con el mensaje escrito: elegí el grupo y mandalo (también queda copiado).
            {data?.group_url && <> · <a href={data.group_url} target="_blank" rel="noopener noreferrer" style={{ color: "#db2777", fontWeight: 700 }}>Abrir el grupo</a></>}
          </p>
        </div>
      </div>

      {/* Historial */}
      <div className="sp-card">
        <h3 className="sp-h" style={{ fontSize: 16, marginBottom: 8 }}>Pedidos enviados</h3>
        {!data?.orders.length && <p className="sp-empty">Todavía no se mandó ningún pedido a Saphirus.</p>}
        <div style={{ display: "grid", gap: 8 }}>
          {data?.orders.map((o) => (
            <div key={o.id} className="sp-order">
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <b style={{ fontSize: 13 }}>{fmtDateTime(o.sent_at)}</b>
                  <span className="sp-stock" style={o.status === "sent" ? { background: "#fff4e5", color: "#b45309" } : o.status === "received" ? { background: "rgba(16,185,129,.12)", color: "#047857" } : { background: "#f2f4f7", color: "#667085" }}>
                    {o.status === "sent" ? "Esperando" : o.status === "received" ? `Llegó${o.received_at ? ` · ${fmtDateTime(o.received_at)}` : ""}` : "Cancelado"}
                  </span>
                </div>
                <div className="sp-sub" style={{ marginTop: 3 }}>
                  {o.items.map((i) => `${i.quantity} ${i.name}`).join(" · ")}
                </div>
                {o.notes && <div className="sp-sub" style={{ fontStyle: "italic" }}>Nota: {o.notes}</div>}
              </div>
              {o.status === "sent" && (
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button className="sp-btn green" onClick={() => closeOrder(o, "received")}>Llegó</button>
                  <button className="sp-btn" onClick={() => closeOrder(o, "cancelled")}>Cancelar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const CSS = `
  .sp{display:grid;gap:12px}
  .sp-card{background:#fff;border:1px solid #e5e7eb;border-radius:13px;padding:16px 18px;min-width:0}
  .sp-h{font-size:19px;font-weight:800;color:#1a1a1a}
  .sp-sub{font-size:12px;color:#667085;margin-top:2px}
  .sp-top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;border-left:4px solid #db2777}
  .sp-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:12px;align-items:start}
  .sp-list{display:grid;gap:10px}
  .sp-cart{display:grid;gap:12px;position:sticky;top:calc(var(--adm-top-h, 64px) + 12px)}
  .sp-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  .sp-bar .sp-in{flex:1;min-width:180px}
  .sp-in{width:100%;padding:9px 11px;border:1px solid #e5e7eb;border-radius:9px;font-size:14px;font-family:inherit;background:#fff;box-sizing:border-box}
  .sp-in:focus{outline:none;border-color:#db2777;box-shadow:0 0 0 3px rgba(219,39,119,.12)}
  textarea.sp-in{resize:vertical}
  .sp-lbl{display:block;font-size:11px;font-weight:700;color:#667085;margin-bottom:5px;letter-spacing:.02em}
  .sp-chk{display:flex;gap:6px;align-items:center;font-size:13px;color:#344054;white-space:nowrap;cursor:pointer}
  .sp-chk input{accent-color:#db2777;width:16px;height:16px}
  .sp-rows{display:flex;flex-direction:column;max-height:calc(100vh - var(--adm-top-h, 64px) - 290px);min-height:240px;overflow:auto;margin:0 -6px}
  .sp-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:9px 8px;border-bottom:1px solid #f2f4f7;border-radius:8px}
  .sp-row.on{background:rgba(219,39,119,.05)}
  .sp-name{font-size:14px;font-weight:600;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word}
  .sp-meta{display:flex;gap:6px;margin-top:3px;flex-wrap:wrap}
  .sp-stock{font-size:11px;font-weight:700;padding:2px 7px;border-radius:6px;background:#f2f4f7;color:#475467;white-space:nowrap}
  .sp-step{display:flex;align-items:center;border:1px solid #e5e7eb;border-radius:9px;overflow:hidden;flex-shrink:0}
  .sp-step button{width:34px;height:34px;border:0;background:#f9fafb;font-size:17px;cursor:pointer;color:#344054}
  .sp-step button:disabled{color:#d0d5dd;cursor:default}
  .sp-step input{width:46px;height:34px;border:0;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;text-align:center;font-size:14px;font-weight:700;font-family:inherit}
  .sp-lines{display:flex;flex-direction:column;gap:2px;max-height:260px;overflow:auto}
  .sp-line{display:grid;grid-template-columns:36px minmax(0,1fr) 26px;gap:6px;align-items:center;font-size:13px;padding:5px 0;border-bottom:1px dashed #eaecf0}
  .sp-line b{text-align:right;color:#db2777}
  .sp-line span{overflow:hidden;text-overflow:ellipsis}
  .sp-line button{border:0;background:none;color:#98a2b3;font-size:18px;cursor:pointer}
  .sp-tag{font-size:10px;font-weight:700;color:#7c3aed;background:#f5f3ff;padding:1px 5px;border-radius:4px}
  .sp-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px 14px;border-radius:9px;border:1px solid #e5e7eb;background:#fff;font-size:13px;font-weight:700;cursor:pointer;color:#344054;text-decoration:none;font-family:inherit;white-space:nowrap}
  .sp-btn:disabled{opacity:.5;cursor:default}
  .sp-btn.primary{background:#db2777;border-color:#db2777;color:#fff}
  .sp-btn.wa{background:#25D366;border-color:#25D366;color:#fff;padding:12px 14px;font-size:14px}
  .sp-btn.green{background:#059669;border-color:#059669;color:#fff}
  .sp-list > .sp-btn{justify-self:start}
  .sp-prev summary{font-size:12px;font-weight:700;color:#667085;cursor:pointer}
  .sp-prev pre{white-space:pre-wrap;font-family:inherit;font-size:12px;background:#f0fdf4;border:1px solid #dcfce7;border-radius:9px;padding:10px;margin-top:6px;color:#14532d}
  .sp-order{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:10px 12px;border:1px solid #f2f4f7;border-radius:10px;flex-wrap:wrap}
  .sp-empty{font-size:13px;color:#98a2b3;padding:14px;text-align:center}
  .sp-err{padding:10px 14px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-size:13px}
  .sp-ok{padding:10px 14px;border-radius:10px;background:#ecfdf5;border:1px solid #a7f3d0;color:#047857;font-size:13px;font-weight:600}
  @media(max-width:900px){
    .sp-grid{grid-template-columns:minmax(0,1fr)}
    .sp-cart{position:static}
    .sp-rows{max-height:none}
  }
`;
