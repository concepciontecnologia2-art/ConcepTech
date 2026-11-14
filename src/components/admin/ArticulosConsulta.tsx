"use client";
// ═══════════════════════════════════════════════════════════════════
// ARTÍCULOS — vista de consulta para vendedores (sin modificar nada)
// Buscar precio y stock rápido. Modificar artículos es solo del admin.
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo, useRef } from "react";

type P = {
  id: number; name: string; sku: string | null; image_url: string | null; available: boolean;
  stock_quantity: number; price_retail: number | string; price_wholesale: number | string; category_name: string;
};

const fmt = (n: number | string) => {
  const v = Number(n) || 0;
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }).format(v);
};
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

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
  const [all, setAll] = useState<P[] | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [onlyStock, setOnlyStock] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/products", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => (Array.isArray(d) ? setAll(d) : setErr("No se pudieron cargar los artículos")))
      .catch(() => setErr("No se pudieron cargar los artículos"));
  }, []);

  const cats = useMemo(() => [...new Set((all || []).map((p) => p.category_name).filter(Boolean))].sort(), [all]);
  const list = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    return (all || [])
      .filter((p) => (!cat || p.category_name === cat) && (!onlyStock || p.stock_quantity > 0))
      .filter((p) => words.every((w) => norm(`${p.name} ${p.sku || ""} ${p.id}`).includes(w)))
      .slice(0, 200);
  }, [all, q, cat, onlyStock]);

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
        {all === null && !err && <div className="ac-empty">Cargando…</div>}
        {all && list.length === 0 && <div className="ac-empty">No hay artículos con esa búsqueda.</div>}
        {list.map((p) => {
          const st = p.stock_quantity;
          const col = st <= 0 ? ["#b42318", "#fee4e2"] : st <= 3 ? ["#b45309", "#fff4e5"] : ["#047857", "rgba(16,185,129,.12)"];
          return (
            <div key={p.id} className="ac-row">
              {p.image_url ? <img src={p.image_url} alt="" className="ac-img" /> : <div className="ac-img" />}
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
      {all && list.length === 200 && <p style={{ fontSize: 12, color: "#888", marginTop: 8 }}>Se muestran los primeros 200. Buscá para encontrar el resto.</p>}
    </div>
  );
}
