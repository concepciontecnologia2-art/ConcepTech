"use client";
// ═══════════════════════════════════════════════════════════════════
// PEDIDO SAPHIRUS — Caja → Pedido Saphirus (solo el dueño)
// Se arma el pedido con los productos de Saphirus cargados (con su stock)
// y/o renglones libres (aromas que no están cargados), y se manda por
// WhatsApp al GRUPO del negocio. El borrador queda guardado en esta compu.
// El proveedor es el que tenga "Saphirus" en el nombre (se carga en Proveedores).
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { api, fmtDateTime } from "@/components/admin/pos";
import { buildGroupMessage } from "@/lib/reposicion";
import { sendToGroup } from "@/lib/grupoWhatsapp";

type Supplier = { id: number; name: string; contact_name: string | null; whatsapp: string | null };
type Product = { id: number; name: string; sku: string | null; image_url: string | null; stock: number; min_stock: number; category: string | null; pending_sent_at: string | null; pending_qty: number | null };
type Order = { id: number; status: "sent" | "received" | "cancelled"; sent_at: string; received_at: string | null; notes: string | null; items: { name: string; quantity: number; free: boolean }[] };
type Data = { threshold: number; suppliers: Supplier[]; supplier: Supplier | null; products: Product[]; orders: Order[]; group_url: string | null };
type Free = { key: number; name: string; qty: number };
type Draft = { qty: Record<number, number>; free: Free[]; note: string };

const DRAFT_KEY = "ct_saphirus_draft";
const emptyDraft: Draft = { qty: {}, free: [], note: "" };
let seq = Date.now();

const loadDraft = (): Draft => {
  try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); if (d && typeof d === "object") return { ...emptyDraft, ...d }; } catch {}
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

  useEffect(() => { setDraft(loadDraft()); }, []);
  const update = (fn: (d: Draft) => Draft) => setDraft((d) => { const n = fn(d); saveDraft(n); return n; });

  const load = useCallback(async () => {
    try { setData(await api(`/api/saphirus${supplierId ? `?supplier=${supplierId}` : ""}`)); setErr(""); }
    catch (e: any) { setErr(e.message); }
  }, [supplierId]);
  useEffect(() => { load(); }, [load]);

  const supplier = data?.supplier || null;
  const products = data?.products || [];
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const low = products.filter((p) => p.stock <= (data?.threshold ?? 2));

  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = products
    .filter((p) => !onlyLow || p.stock <= (data?.threshold ?? 2))
    .filter((p) => words.every((w) => `${p.name} ${p.sku || ""} ${p.category || ""}`.toLowerCase().includes(w)));

  const setQty = (id: number, q: number) => update((d) => {
    const qty = { ...d.qty };
    if (q > 0) qty[id] = Math.min(9999, q); else delete qty[id];
    return { ...d, qty };
  });

  // Renglones del pedido (los productos que ya no existen se descartan solos)
  const prodLines = Object.entries(draft.qty)
    .map(([id, q]) => ({ p: byId.get(Number(id)), q }))
    .filter((l): l is { p: Product; q: number } => !!l.p && l.q > 0)
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

  const addAllLow = () => update((d) => {
    const qty = { ...d.qty };
    for (const p of low) if (!qty[p.id] && !p.pending_sent_at) qty[p.id] = Math.max(1, (p.min_stock > 2 ? p.min_stock * 2 : 6) - Math.max(0, p.stock));
    return { ...d, qty };
  });

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
      update(() => emptyDraft);
      setMsg("Pedido enviado y guardado ✓");
      setTimeout(() => setMsg(""), 4000);
      load();
    } catch (e: any) { setErr(`Se abrió WhatsApp, pero no se pudo guardar el pedido: ${e.message}`); }
    finally { setSending(false); }
  };

  const closeOrder = async (o: Order, status: "received" | "cancelled") => {
    if (status === "cancelled" && !confirm("¿Cancelar este pedido?")) return;
    try { await api(`/api/reposicion/orders/${o.id}`, { method: "PATCH", body: JSON.stringify({ status }) }); load(); }
    catch (e: any) { setErr(e.message); }
  };

  if (!data && !err) return <p style={{ color: "#666", padding: 10 }}>Cargando…</p>;

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
            <label className="sp-chk"><input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} /> Solo para reponer ({low.length})</label>
          </div>
          {low.some((p) => !draft.qty[p.id] && !p.pending_sent_at) && (
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
                    <button onClick={() => setQty(p.id, q - 1)} disabled={!q} aria-label="Menos">−</button>
                    <input inputMode="numeric" value={q || ""} placeholder="0" onChange={(e) => setQty(p.id, Math.round(Number(e.target.value.replace(/\D/g, "")) || 0))} />
                    <button onClick={() => setQty(p.id, q + 1)} aria-label="Más">+</button>
                  </div>
                </div>
              );
            })}
            {!shown.length && (
              <p className="sp-empty">
                {products.length ? "No hay productos con ese filtro." : "No hay productos de Saphirus cargados. Asignales este proveedor en Artículos, o usá los renglones libres."}
              </p>
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
                <button onClick={() => setQty(l.p.id, 0)} aria-label="Quitar">×</button>
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
            {lineCount > 0 && <button className="sp-btn" onClick={() => { if (confirm("¿Vaciar el pedido?")) update(() => emptyDraft); }}>Vaciar</button>}
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
