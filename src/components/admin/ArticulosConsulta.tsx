"use client";
// ═══════════════════════════════════════════════════════════════════
// ARTÍCULOS — vista de consulta para vendedores (sin modificar nada)
// Buscar precio y stock rápido. Modificar artículos es solo del admin.
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useRef } from "react";

type P = {
  id: number; name: string; sku: string | null; image_url: string | null; available: boolean;
  stock_quantity: number; price_retail: number | string; price_wholesale: number | string; category_name: string;
};

const fmt = (n: number | string) => {
  const v = Number(n) || 0;
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }).format(v);
};

const CSS = `
  .ac-top{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
  .ac-in{flex:1 1 260px;padding:11px 13px;border:1px solid #e5e7eb;border-radius:9px;font-size:15px;font-family:inherit;outline:none;background:#fff}
  .ac-in:focus{border-color:#00B4D8;box-shadow:0 0 0 3px rgba(0,180,216,.12)}
  .ac-sel{padding:10px 12px;border:1px solid #e5e7eb;border-radius:9px;font-size:14px;font-family:inherit;background:#fff}
  .ac-list{background:#fff;border:1px solid #e5e7eb;border-radius:13px;overflow:hidden}
  .ac-row{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 14px;border-bottom:1px solid #f3f4f6}
  .ac-row:last-child{border-bottom:none}
  .ac-img{width:44px;height:44px;border-radius:9px;object-fit:cover;background:#f3f4f6}
  .ac-name{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ac-sub{font-size:12px;color:#888;margin-top:2px}
  .ac-right{text-align:right}
  .ac-price{font-size:16px;font-weight:800;color:#0891b2;white-space:nowrap}
  .ac-wh{font-size:11px;color:#7c3aed;font-weight:600;white-space:nowrap}
  .ac-stock{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;margin-left:6px}
  .ac-empty{padding:30px;text-align:center;color:#999;font-size:13px}
`;

export default function ArticulosConsulta({ onEdit }: { onEdit?: () => void }) {
  // Se piden de a 10 a la base; la búsqueda espera 350 ms después de la última letra
  const PAGE = 50;   // de a 50 (la base responde igual de rápido; las fotos se cargan a medida que se ven)
  const [list, setList] = useState<P[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [qDeb, setQDeb] = useState("");
  const [cat, setCat] = useState("");
  const [onlyStock, setOnlyStock] = useState(false);
  const [cats, setCats] = useState<string[]>([]);
  const ref = useRef<HTMLInputElement>(null);
  const req = useRef(0);

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json())
      .then((d) => Array.isArray(d) && setCats(d.map((c: { name: string }) => c.name).sort()))
      .catch(() => {});
  }, []);
  useEffect(() => { const t = setTimeout(() => setQDeb(q.trim()), 350); return () => clearTimeout(t); }, [q]);

  const load = useCallback(async (offset: number) => {
    const my = ++req.current;
    const sp = new URLSearchParams({ offset: String(offset), limit: String(PAGE) });
    if (qDeb) sp.set("q", qDeb);
    if (cat) sp.set("cat", cat);
    if (onlyStock) sp.set("f", "constock");
    setLoading(true);
    try {
      const r = await fetch(`/api/products/lista?${sp}`, { credentials: "include", cache: "no-store" });
      const d = await r.json().catch(() => null);
      if (my !== req.current) return;           // llegó tarde: ya se pidió otra búsqueda
      if (!r.ok || !d) { setErr("No se pudieron cargar los artículos"); return; }
      setErr(""); setTotal(d.total); setLoaded(true);
      setList((prev) => (offset ? [...prev, ...d.items] : d.items));
    } catch { if (my === req.current) setErr("No se pudieron cargar los artículos"); }
    finally { if (my === req.current) setLoading(false); }
  }, [qDeb, cat, onlyStock]);
  useEffect(() => { load(0); }, [load]);
  const searching = loading || q.trim() !== qDeb;

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Artículos</h1>
          <p style={{ fontSize: 13, color: "#888", marginTop: 2 }}>Consulta de precios y stock.</p>
        </div>
        {onEdit && (
          <button onClick={onEdit} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: "1px solid rgba(0,180,216,.4)", background: "rgba(0,180,216,.08)", color: "#0891b2", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11h16v10H4z M8 11V7a4 4 0 0 1 8 0v4" /></svg>
            Modificar artículos
          </button>
        )}
      </div>
      <div className="ac-top">
        <input ref={ref} className="ac-in" value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Buscar por nombre, código o número…" />
        <select className="ac-sel" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#444", cursor: "pointer" }}>
          <input type="checkbox" checked={onlyStock} onChange={(e) => setOnlyStock(e.target.checked)} style={{ accentColor: "#00B4D8" }} />
          Solo con stock
        </label>
      </div>
      {err && <div className="ac-empty" style={{ color: "#ef4444" }}>{err}</div>}
      <div className="ac-list">
        {!loaded && !err && <div className="ac-empty">Cargando…</div>}
        {loaded && !searching && list.length === 0 && <div className="ac-empty">No hay artículos con esa búsqueda.</div>}
        {list.map((p) => {
          const st = p.stock_quantity;
          const col = st <= 0 ? ["#b42318", "#fee4e2"] : st <= 3 ? ["#b45309", "#fff4e5"] : ["#047857", "rgba(16,185,129,.12)"];
          return (
            <div key={p.id} className="ac-row">
              {p.image_url ? <img src={p.image_url} alt="" className="ac-img" loading="lazy" decoding="async" /> : <div className="ac-img" />}
              <div style={{ minWidth: 0 }}>
                <div className="ac-name">{p.name}</div>
                <div className="ac-sub">
                  #{p.id}{p.sku ? ` · ${p.sku}` : ""} · {p.category_name}
                  <span className="ac-stock" style={{ color: col[0], background: col[1] }}>{st <= 0 ? "Sin stock" : `Stock ${st}`}</span>
                  {!p.available && <span className="ac-stock" style={{ color: "#666", background: "#f3f4f6" }}>Oculto en la web</span>}
                </div>
              </div>
              <div className="ac-right">
                <div className="ac-price">{fmt(p.price_retail)}</div>
                {Number(p.price_wholesale) > 0 && <div className="ac-wh">Mayorista {fmt(p.price_wholesale)}</div>}
              </div>
            </div>
          );
        })}
      </div>
      {loaded && total > 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginTop: 10 }}>
          <span style={{ fontSize: 12, color: "#888" }}>Mostrando {list.length} de {total}</span>
          {list.length < total && (
            <button onClick={() => load(list.length)} disabled={loading}
              style={{ width: "100%", padding: 11, borderRadius: 10, border: "1px dashed #a5f3fc", background: "#f0fdff", color: "#0e7490", fontSize: 13, fontWeight: 600, cursor: loading ? "default" : "pointer", fontFamily: "inherit", opacity: loading ? 0.6 : 1 }}>
              {loading ? "Cargando…" : `Mostrar ${Math.min(PAGE, total - list.length)} más`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
