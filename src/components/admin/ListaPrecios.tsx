"use client";
// ═══════════════════════════════════════════════════════════════════
// LISTA DE PRECIOS DEL PROVEEDOR — pestaña de /admin/compras
// 1) Subís la lista: foto(s), PDF o Excel/CSV
// 2) La IA lee cada producto con su precio y se cruza con tus artículos
// 3) Ves costo actual → nuevo, cuánto cambió y cómo queda el precio de venta
// 4) Tildás lo que querés actualizar y confirmás
// Usa las clases cp-* que define la página de Compras.
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useMemo } from "react";
import { prepareFile } from "@/lib/prepareFile";
import { newSalePrice, type PriceMode } from "@/lib/precios";

type Prod = { id: number; name: string; cost_price: number | null; price_retail: number; price_wholesale: number | null };
type Match = Prod & { score: number };
type Row = { key: number; desc: string; code: string | null; price: string; matches: Match[]; product: Prod | null; on: boolean; score: number | null };
type Supplier = { id: number; name: string };
type Filter = "cambios" | "todos" | "sin";

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);
const num = (s: string) => { const n = Number(String(s).replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const CHUNK = 150;      // renglones de Excel por pedido a la IA
const MAX_ROWS = 1500;  // tope de renglones de una planilla
let seq = 1;

const api = async (url: string, opts: RequestInit = {}) => {
  const res = await fetch(url, { credentials: "include", ...opts, headers: { "Content-Type": "application/json" } });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || `Error ${res.status}`);
  return d;
};

const isSheet = (f: File) => /\.(xlsx|xls|csv|ods)$/i.test(f.name) || /spreadsheet|excel|csv/.test(f.type);

/** Excel/CSV → partes de texto ("celda;celda;celda" por renglón) */
async function sheetChunks(file: File): Promise<string[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const lines: string[] = [];
  for (const name of wb.SheetNames) {
    const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: false, raw: false });
    for (const r of rows) {
      const cells = r.map((c) => String(c ?? "").replace(/[;\n\r]+/g, " ").trim());
      if (cells.some(Boolean)) lines.push(cells.join(";"));
    }
  }
  if (!lines.length) throw new Error("La planilla está vacía");
  if (lines.length > MAX_ROWS) throw new Error(`La planilla tiene ${lines.length} renglones; el máximo es ${MAX_ROWS}. Dividila en partes.`);
  // Se repiten los primeros renglones (encabezado) en cada parte para que la IA sepa qué es cada columna
  const head = lines.slice(0, 3);
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += CHUNK) {
    const part = lines.slice(i, i + CHUNK);
    out.push((i === 0 ? part : [...head, "...", ...part]).join("\n"));
  }
  return out;
}

// ─── Elegir artículo ────────────────────────────────────────────────
function Picker({ row, onPick }: { row: Row; onPick: (p: Prod | null, score: number | null) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ id: number; name: string; stock_quantity: number }[]>([]);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q.trim()) { setRes([]); return; }
    const t = setTimeout(() => api(`/api/pos/products?q=${encodeURIComponent(q.trim())}`).then(setRes).catch(() => {}), 200);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const pickById = async (id: number) => {
    setOpen(false);
    try { const [p] = await api(`/api/compras/lista?ids=${id}`); if (p) onPick(p, null); } catch {}
  };

  return (
    <div className="cp-pick" ref={box}>
      <button className={`cp-pick-btn ${row.product ? "" : "empty"}`} onClick={() => setOpen(!open)} style={!row.product ? { borderColor: "#e5e7eb", background: "#fafbfc", color: "#667085", fontWeight: 500 } : undefined}>
        {row.product ? row.product.name : "No está en el catálogo · elegir ▾"}
      </button>
      {row.product && row.score != null && (
        <span className="cp-chip" style={row.score >= 0.75 ? { background: "rgba(16,185,129,.12)", color: "#047857" } : { background: "#fff4e5", color: "#b45309" }}>
          {row.score >= 0.75 ? "Coincide" : "Revisar"} {Math.round(row.score * 100)}%
        </span>
      )}
      {open && (
        <div className="cp-dd">
          <div style={{ padding: 8, borderBottom: "1px solid #f2f4f7" }}>
            <input className="cp-in" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar artículo…" />
          </div>
          {!q && row.matches.length > 0 && <div className="cp-dd-sec">Sugeridos</div>}
          {!q && row.matches.map((m) => (
            <button key={m.id} className="cp-dd-opt" onClick={() => { setOpen(false); onPick(m, m.score); }}>
              <span>{m.name}</span><span style={{ color: "#98a2b3", fontSize: 11 }}>{Math.round(m.score * 100)}%</span>
            </button>
          ))}
          {q && res.map((p) => (
            <button key={p.id} className="cp-dd-opt" onClick={() => pickById(p.id)}>
              <span>{p.name}</span><span style={{ color: "#98a2b3", fontSize: 11 }}>stock {p.stock_quantity}</span>
            </button>
          ))}
          {q && res.length === 0 && <div className="cp-dd-sec" style={{ textTransform: "none", fontWeight: 600 }}>Sin resultados</div>}
          {row.product && (
            <button className="cp-dd-opt" style={{ color: "#b91c1c", fontWeight: 700, borderTop: "1px solid #f2f4f7" }} onClick={() => { setOpen(false); onPick(null, null); }}>
              ✕ No es ninguno de mis artículos
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Pantalla ───────────────────────────────────────────────────────
export default function ListaPrecios({ suppliers }: { suppliers: Supplier[] }) {
  const [step, setStep] = useState<"subir" | "leyendo" | "revisar" | "listo">("subir");
  const [supplierId, setSupplierId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState("");
  const [err, setErr] = useState("");
  const [warn, setWarn] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [addIva, setAddIva] = useState(false);
  const [mode, setMode] = useState<PriceMode>("margin");
  const [rPct, setRPct] = useState("");
  const [wPct, setWPct] = useState("");
  const [filter, setFilter] = useState<Filter>("cambios");
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<{ updated: number; prices_changed: number; skipped: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { setRPct(localStorage.getItem("ct_pct_retail") || ""); setWPct(localStorage.getItem("ct_pct_wholesale") || ""); } catch {}
  }, []);

  const addFiles = (list: FileList | File[]) => {
    setErr("");
    const arr = Array.from(list);
    const sheet = arr.find(isSheet);
    if (sheet) { setFiles([sheet]); return; } // una planilla por vez
    setFiles((f) => [...f.filter((x) => !isSheet(x)), ...arr].slice(0, 6));
  };

  const reset = () => { setStep("subir"); setFiles([]); setRows([]); setErr(""); setWarn(""); setResult(null); setFilter("cambios"); setSearch(""); };

  const read = async () => {
    if (!files.length) return;
    setStep("leyendo"); setErr(""); setWarn("");
    const all: any[] = [];
    let supplier: Supplier | null = null, conIva: boolean | null = null, failed = 0;
    try {
      if (isSheet(files[0])) {
        setProgress("Abriendo la planilla…");
        const chunks = await sheetChunks(files[0]);
        for (let i = 0; i < chunks.length; i++) {
          setProgress(chunks.length > 1 ? `La IA está leyendo la lista… parte ${i + 1} de ${chunks.length}` : "La IA está leyendo la lista…");
          try {
            const d = await api("/api/compras/lista/leer", { method: "POST", body: JSON.stringify({ text: chunks[i], supplier_id: supplierId || null }) });
            all.push(...d.items); supplier = supplier || d.supplier; if (conIva == null) conIva = d.precios_con_iva;
          } catch (e: any) {
            if (/límite gratis/.test(e.message) && i < chunks.length - 1) { // se espera y se reintenta una vez
              setProgress("Límite gratis de la IA: esperando un minuto para seguir…");
              await new Promise((r) => setTimeout(r, 62_000)); i--; failed++;
              if (failed > 3) throw e;
              continue;
            }
            throw e;
          }
        }
      } else {
        setProgress("Preparando las fotos…");
        const prepared = await Promise.all(files.map((f) => prepareFile(f, { max: 2000 })));
        setProgress("La IA está leyendo la lista…");
        const d = await api("/api/compras/lista/leer", {
          method: "POST",
          body: JSON.stringify({ images: prepared.map(({ mime, data }) => ({ mime, data })), supplier_id: supplierId || null }),
        });
        all.push(...d.items); supplier = d.supplier; conIva = d.precios_con_iva;
      }
    } catch (e: any) { setErr(e.message); setStep("subir"); return; }

    if (supplier && !supplierId) setSupplierId(String(supplier.id));
    setAddIva(conIva === false);

    // Si dos renglones apuntan al mismo artículo, se queda el de mejor coincidencia
    const best = new Map<number, number>();
    all.forEach((it, i) => {
      if (!it.product_id) return;
      const sc = it.matches[0]?.score ?? 0;
      const prev = best.get(it.product_id);
      if (prev == null || (all[prev].matches[0]?.score ?? 0) < sc) best.set(it.product_id, i);
    });
    const ivaMul = conIva === false ? 1.21 : 1;
    const built: Row[] = all.map((it, i) => {
      const keep = it.product_id && best.get(it.product_id) === i;
      const m: Match | undefined = keep ? it.matches.find((x: Match) => x.id === it.product_id) : undefined;
      const row: Row = { key: seq++, desc: it.descripcion, code: it.codigo, price: String(it.precio), matches: it.matches, product: m || null, score: m ? m.score : null, on: false };
      row.on = defaultOn(row, ivaMul);
      return row;
    });
    const usd = built.filter((r) => /\[USD\]/.test(r.desc)).length;
    if (usd) setWarn(`${usd} renglones están en dólares: no se tildan solos. Pasá el precio a pesos antes de actualizarlos.`);
    if (!built.length) setErr("La IA no encontró productos con precio en la lista.");
    setRows(built);
    setStep("revisar");
  };

  // Tildado por defecto: emparejado seguro, precio distinto y un cambio razonable
  function defaultOn(r: Row, ivaMul: number) {
    if (!r.product || (r.score ?? 0) < 0.55 || /\[USD\]/.test(r.desc)) return false;
    const nc = num(r.price) * ivaMul, oc = r.product.cost_price;
    if (!oc) return true;
    const v = nc / oc - 1;
    return Math.abs(v) >= 0.005 && v < 0.6 && v > -0.4; // cambios enormes quedan sin tildar para revisarlos
  }

  const upd = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const ivaMul = addIva ? 1.21 : 1;

  // Artículos elegidos en más de un renglón
  const dupIds = useMemo(() => {
    const seen = new Map<number, number>(), d = new Set<number>();
    rows.forEach((r) => { if (r.product) { if (seen.has(r.product.id)) d.add(r.product.id); seen.set(r.product.id, 1); } });
    return d;
  }, [rows]);

  const calc = (r: Row) => {
    if (!r.product) return null;
    const nc = Math.round(num(r.price) * ivaMul * 100) / 100;
    const oc = r.product.cost_price;
    const v = oc ? nc / oc - 1 : null;
    const sale = newSalePrice(mode, r.product, nc, num(rPct), num(wPct));
    return { nc, oc, v, sale };
  };

  const matched = rows.filter((r) => r.product);
  const changed = matched.filter((r) => { const c = calc(r)!; return c.v == null || Math.abs(c.v) >= 0.005; });
  const unmatched = rows.filter((r) => !r.product);
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = (filter === "cambios" ? changed : filter === "todos" ? matched : unmatched)
    .filter((r) => words.every((w) => `${r.desc} ${r.product?.name || ""} ${r.code || ""}`.toLowerCase().includes(w)));
  const selected = rows.filter((r) => r.on && r.product && num(r.price) > 0);
  const selDup = selected.filter((r) => dupIds.has(r.product!.id)).length;
  const avgVar = (() => {
    const vs = selected.map((r) => calc(r)!.v).filter((v): v is number => v != null);
    return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
  })();

  const setAll = (on: boolean) => {
    const ids = new Set(shown.map((r) => r.key));
    setRows((rs) => rs.map((r) => (ids.has(r.key) && r.product ? { ...r, on: on && !/\[USD\]/.test(r.desc) } : r)));
  };

  const confirm_ = async () => {
    if (!selected.length) { setErr("No hay artículos tildados para actualizar."); return; }
    if (selDup) { setErr("Hay artículos elegidos en dos renglones (marcados como REPETIDO). Destildá uno."); return; }
    if (mode === "pct" && (rPct === "" || wPct === "")) { setErr("Completá los % de ganancia."); return; }
    setBusy(true); setErr("");
    try {
      if (mode === "pct") { try { localStorage.setItem("ct_pct_retail", rPct); localStorage.setItem("ct_pct_wholesale", wPct); } catch {} }
      const r = await api("/api/compras/lista", {
        method: "POST",
        body: JSON.stringify({
          supplier_id: supplierId || null, iva_pct: addIva ? 21 : 0,
          prices: { mode, retail_pct: num(rPct), wholesale_pct: num(wPct) },
          items: selected.map((s) => ({ product_id: s.product!.id, price: num(s.price) })),
        }),
      });
      setResult(r); setStep("listo");
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const varChip = (v: number | null) => {
    if (v == null) return <span className="lp-var" style={{ background: "#eef2ff", color: "#4338ca" }}>sin costo previo</span>;
    if (Math.abs(v) < 0.005) return <span className="lp-var" style={{ background: "#f2f4f7", color: "#667085" }}>igual</span>;
    const big = v >= 0.6 || v <= -0.4;
    const st = big ? { background: "#fef2f2", color: "#b91c1c" } : v > 0 ? { background: "#fff4e5", color: "#b45309" } : { background: "rgba(16,185,129,.12)", color: "#047857" };
    return <span className="lp-var" style={st} title={big ? "Cambio muy grande: revisá que sea el mismo artículo y la misma unidad" : undefined}>{big ? "⚠ " : ""}{v > 0 ? "+" : ""}{(v * 100).toFixed(1).replace(".", ",")}%</span>;
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {err && <div className="cp-err">{err}</div>}

      {/* ── 1. SUBIR ── */}
      {step === "subir" && (
        <div className="cp-card" style={{ display: "grid", gap: 14 }}>
          <div style={{ maxWidth: 360 }}>
            <label className="cp-lbl">PROVEEDOR <span style={{ fontWeight: 500, color: "#9ca3af" }}>(ayuda a encontrar sus artículos)</span></label>
            <select className="cp-in" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Detectar automáticamente</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className={`cp-drop ${over ? "over" : ""}`} onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}>
            <div style={{ fontSize: 30 }}>📋</div>
            <div style={{ fontWeight: 700, marginTop: 4 }}>Subí la lista de precios</div>
            <div className="cp-note" style={{ marginTop: 4 }}>Excel o CSV (lo mejor), PDF, o fotos de la lista (hasta 6 páginas)</div>
            <input ref={fileRef} type="file" hidden multiple
              accept="image/*,application/pdf,.xlsx,.xls,.csv,.ods"
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
          </div>
          {files.length > 0 && (
            <div className="cp-thumbs" style={{ marginTop: 0 }}>
              {files.map((f, i) => (
                <div key={i} className="cp-thumb" style={{ width: "auto", height: "auto", padding: "8px 34px 8px 12px", fontSize: 12 }}>
                  {isSheet(f) ? "📊" : f.type === "application/pdf" ? "📄" : "🖼"} {f.name}
                  <button onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Quitar">×</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="cp-btn primary" disabled={!files.length} onClick={read}>✨ Leer lista con IA</button>
          </div>
          <p className="cp-note">No se cambia nada hasta que confirmes. Vas a ver cada artículo con su costo actual y el nuevo.</p>
        </div>
      )}

      {/* ── 2. LEYENDO ── */}
      {step === "leyendo" && (
        <div className="cp-card"><div className="cp-reading"><div className="cp-spin" /> {progress}</div>
          <p className="cp-note" style={{ padding: "0 20px 10px" }}>Las listas largas tardan unos segundos por parte.</p></div>
      )}

      {/* ── 3. REVISAR ── */}
      {step === "revisar" && (
        <>
          {warn && <div className="lp-warn">{warn}</div>}
          <div className="cp-card" style={{ display: "grid", gap: 12 }}>
            <div className="lp-opts">
              <div style={{ minWidth: 220 }}>
                <label className="cp-lbl">PROVEEDOR</label>
                <select className="cp-in" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">Sin elegir</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <label className="lp-check"><input type="checkbox" checked={addIva} onChange={(e) => setAddIva(e.target.checked)} />
                <span>Los precios de la lista <b>no incluyen IVA</b>: sumar 21 % al costo</span></label>
            </div>
            <div>
              <div className="cp-lbl">PRECIOS DE VENTA</div>
              <div className="lp-modes">
                <label className={`lp-mode ${mode === "margin" ? "on" : ""}`}><input type="radio" checked={mode === "margin"} onChange={() => setMode("margin")} />
                  <span><b>Mantener mi ganancia</b><small>Si el costo sube 10 %, la venta sube 10 %</small></span></label>
                <label className={`lp-mode ${mode === "pct" ? "on" : ""}`}><input type="radio" checked={mode === "pct"} onChange={() => setMode("pct")} />
                  <span><b>Calcular con %</b><small>Costo nuevo + % de ganancia</small></span></label>
                <label className={`lp-mode ${mode === "cost" ? "on" : ""}`}><input type="radio" checked={mode === "cost"} onChange={() => setMode("cost")} />
                  <span><b>Solo el costo</b><small>No toca los precios de venta</small></span></label>
              </div>
              {mode === "pct" && (
                <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  <div style={{ width: 150 }}><label className="cp-lbl">% MINORISTA</label><input className="cp-in" inputMode="decimal" value={rPct} onChange={(e) => setRPct(e.target.value)} placeholder="60" /></div>
                  <div style={{ width: 150 }}><label className="cp-lbl">% MAYORISTA</label><input className="cp-in" inputMode="decimal" value={wPct} onChange={(e) => setWPct(e.target.value)} placeholder="30" /></div>
                </div>
              )}
              {mode === "margin" && <p className="cp-note" style={{ marginTop: 6 }}>Los artículos que no tenían costo cargado guardan el costo nuevo pero no cambian su precio de venta.</p>}
            </div>
          </div>

          <div className="cp-card" style={{ display: "grid", gap: 10 }}>
            <div className="lp-bar">
              <div className="cp-tabs">
                <button className={`cp-tab ${filter === "cambios" ? "on" : ""}`} onClick={() => setFilter("cambios")}>Con cambios ({changed.length})</button>
                <button className={`cp-tab ${filter === "todos" ? "on" : ""}`} onClick={() => setFilter("todos")}>Emparejados ({matched.length})</button>
                <button className={`cp-tab ${filter === "sin" ? "on" : ""}`} onClick={() => setFilter("sin")}>No están en el catálogo ({unmatched.length})</button>
              </div>
              <input className="cp-in" style={{ maxWidth: 260 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrar…" />
            </div>

            {filter !== "sin" && shown.length > 0 && (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="cp-btn" onClick={() => setAll(true)}>Tildar todos</button>
                <button className="cp-btn" onClick={() => setAll(false)}>Ninguno</button>
              </div>
            )}

            <div className="lp-rows">
              {shown.length > 0 && filter !== "sin" && (
                <div className="lp-row lp-head"><span /><span>En la lista</span><span>Tu artículo</span><span className="n">Costo</span><span className="n">Venta minorista</span></div>
              )}
              {shown.map((r) => {
                const c = calc(r);
                const dup = r.product && dupIds.has(r.product.id);
                return (
                  <div key={r.key} className={`lp-row ${r.on ? "on" : ""} ${!r.product ? "nomatch" : ""}`}>
                    <span>{r.product && <input type="checkbox" checked={r.on} onChange={(e) => upd(r.key, { on: e.target.checked })} aria-label="Actualizar" />}</span>
                    <span className="lp-desc">{r.desc}{r.code && <small>Código: {r.code}</small>}
                      <span className="lp-price">Precio lista $ <input inputMode="decimal" value={r.price} onChange={(e) => upd(r.key, { price: e.target.value })} /></span>
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <Picker row={r} onPick={(p, score) => upd(r.key, { product: p, score, on: !!p && !/\[USD\]/.test(r.desc) })} />
                      {dup && <span className="cp-chip" style={{ background: "#fef2f2", color: "#b91c1c" }}>REPETIDO en otro renglón</span>}
                    </span>
                    {c ? (
                      <>
                        <span className="n lp-num"><s>{fmt(c.oc)}</s><b>{fmt(c.nc)}</b>{varChip(c.v)}</span>
                        <span className="n lp-num">
                          {c.sale.retail !== r.product!.price_retail ? <><s>{fmt(r.product!.price_retail)}</s><b>{fmt(c.sale.retail)}</b></> : <b style={{ color: "#667085" }}>{fmt(r.product!.price_retail)}</b>}
                          {c.sale.skipped && <small>sin costo previo: no cambia</small>}
                          {c.sale.wholesale != null && c.sale.wholesale !== r.product!.price_wholesale && <small>May. {fmt(c.sale.wholesale)}</small>}
                        </span>
                      </>
                    ) : <><span /><span /></>}
                  </div>
                );
              })}
              {shown.length === 0 && (
                <p className="cp-note" style={{ padding: 14, textAlign: "center" }}>
                  {filter === "cambios" ? "Ningún artículo cambió de precio." : filter === "sin" ? "Todos los renglones están emparejados." : "No hay artículos emparejados."}
                </p>
              )}
            </div>
            {filter === "sin" && unmatched.length > 0 && (
              <p className="cp-note">Estos productos de la lista no se encontraron entre tus artículos. Si alguno sí lo tenés, elegilo y se suma a la actualización.</p>
            )}
          </div>

          <div className="cp-card lp-sum">
            <div>
              <div style={{ fontSize: 15 }}><b style={{ fontSize: 18 }}>{selected.length}</b> artículos para actualizar
                {avgVar != null && <span className="cp-note"> · el costo cambia en promedio {avgVar > 0 ? "+" : ""}{(avgVar * 100).toFixed(1).replace(".", ",")}%</span>}
              </div>
              <div className="cp-note">
                {mode === "margin" ? "Se actualiza el costo y la venta mantiene tu ganancia." : mode === "pct" ? "Se actualiza el costo y la venta se calcula con tus %." : "Solo se actualiza el costo."}
                {addIva ? " Costos con IVA (+21 %)." : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="cp-btn" onClick={reset}>Descartar</button>
              <button className="cp-btn green" disabled={busy || !selected.length} onClick={confirm_}>{busy ? "Guardando…" : "Actualizar precios"}</button>
            </div>
          </div>
        </>
      )}

      {/* ── 4. LISTO ── */}
      {step === "listo" && result && (
        <div className="cp-card" style={{ display: "grid", gap: 12, justifyItems: "start" }}>
          <div className="cp-ok" style={{ fontSize: 15 }}>
            ✓ Listo: se actualizó el costo de <b>{result.updated}</b> artículos
            {result.prices_changed > 0 && <> y el precio de venta de <b>{result.prices_changed}</b></>}.
          </div>
          {result.skipped > 0 && <p className="cp-note">{result.skipped} no tenían costo anterior: guardaron el costo nuevo, pero su precio de venta quedó igual.</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="cp-btn primary" onClick={reset}>Cargar otra lista</button>
            <a className="cp-btn" href="/admin/articulos" style={{ textDecoration: "none" }}>Ver artículos</a>
          </div>
        </div>
      )}
    </>
  );
}

const CSS = `
  .lp-warn{padding:10px 14px;border-radius:10px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;font-size:13px}
  .lp-opts{display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap}
  .lp-check{display:flex;gap:8px;align-items:center;font-size:13px;color:#344054;padding-bottom:9px;cursor:pointer}
  .lp-check input{flex-shrink:0;width:16px;height:16px;accent-color:#00B4D8}
  .lp-modes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  .lp-mode{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid #e5e7eb;border-radius:10px;cursor:pointer;background:#fff}
  .lp-mode.on{border-color:rgba(0,180,216,.55);background:rgba(0,180,216,.06)}
  .lp-mode input{margin-top:3px;accent-color:#00B4D8}
  .lp-mode b{display:block;font-size:13px}
  .lp-mode small{display:block;font-size:11px;color:#667085;margin-top:1px}
  .lp-bar{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center}
  .lp-rows{display:flex;flex-direction:column}
  .lp-row{display:grid;grid-template-columns:26px minmax(0,2fr) minmax(0,2fr) 170px 150px;gap:12px;align-items:start;padding:11px 6px;border-bottom:1px solid #f2f4f7;border-radius:8px}
  .lp-row.on{background:rgba(0,180,216,.04)}
  .lp-row.nomatch{grid-template-columns:26px minmax(0,2fr) minmax(0,2fr)}
  .lp-row input[type=checkbox]{width:17px;height:17px;accent-color:#00B4D8;margin-top:2px;cursor:pointer}
  .lp-head{font-size:11px;font-weight:700;color:#98a2b3;text-transform:uppercase;padding-bottom:6px;border-bottom:1px solid #eaecf0;border-radius:0}
  .lp-head .n,.lp-row .n{text-align:right}
  .lp-desc{font-size:13px;font-weight:600;word-break:break-word}
  .lp-desc small{display:block;font-weight:500;color:#9ca3af;font-size:11px;margin-top:2px}
  .lp-price{display:flex;width:fit-content;white-space:nowrap;align-items:center;gap:4px;font-size:11px;font-weight:500;color:#667085;margin-top:5px}
  .lp-price input{width:96px;padding:3px 6px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;font-family:inherit}
  .lp-num{display:flex;flex-direction:column;align-items:flex-end;gap:2px;font-size:13px;white-space:nowrap}
  .lp-num s{color:#98a2b3;font-size:12px}
  .lp-num small{font-size:11px;color:#667085}
  .lp-var{display:inline-block;font-size:11px;font-weight:800;padding:2px 7px;border-radius:6px}
  .lp-sum{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;position:sticky;bottom:10px;box-shadow:0 8px 24px rgba(0,0,0,.08);z-index:5}
  @media(max-width:820px){
    .lp-modes{grid-template-columns:minmax(0,1fr)}
    .lp-row{grid-template-columns:26px minmax(0,1fr) minmax(0,1fr)}
    .lp-row > :nth-child(2),.lp-row > :nth-child(3){grid-column:2 / -1}
    .lp-row > :nth-child(4){grid-column:2}
    .lp-row > :nth-child(5){grid-column:3}
    .lp-row.nomatch > :nth-child(3){grid-column:2 / -1}
    .lp-head{display:none}
    .lp-num{align-items:flex-start}
  }
`;
