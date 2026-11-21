"use client";
// ═══════════════════════════════════════════════════════════════════
// COMPRAS — /admin/compras  (pide la clave de administrador)
// 1) Foto o PDF de la factura/remito del proveedor
// 2) La IA (Gemini) lee los productos, cantidades y costos
// 3) Se revisa cada renglón: con qué artículo va, o se crea uno nuevo
// 4) Al confirmar: suma stock, actualiza costos (y precios con % si se elige)
// También se puede cargar a mano, sin foto.
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from "react";
import { prepareFile } from "@/lib/prepareFile";
import ListaPrecios from "@/components/admin/ListaPrecios";

// ─── Tipos y ayudas ─────────────────────────────────────────────────
type Match = { id: number; name: string; score: number };
// "CABLE USB-C A USB-C 1 MTS" → "Cable USB-C a USB-C 1 Mts" (respeta modelos y siglas cortas)
const SMALL = new Set(["a", "de", "del", "la", "el", "y", "o", "en", "con", "para", "por", "x"]);
const WORDS = new Set(["pro", "max", "mini", "plus", "lite", "kit", "set"]); // palabras, no siglas
const BRANDS: Record<string, string> = { iphone: "iPhone", ipad: "iPad", airpods: "AirPods", jbl: "JBL", usb: "USB" };
function niceName(raw: string) {
  const t = (raw || "").replace(/\s+/g, " ").trim();
  if (!t || t !== t.toUpperCase()) return t;            // si ya viene con minúsculas, se deja como está
  return t.split(" ").map((w, i) => {
    const lw = w.toLowerCase();
    if (BRANDS[lw]) return BRANDS[lw];
    if (WORDS.has(lw)) return lw.charAt(0).toUpperCase() + lw.slice(1);
    if (/\d/.test(w) || (/^[A-ZÁÉÍÓÚÑ]{2,3}(-[A-Z0-9]{1,3})?$/.test(w) && !SMALL.has(lw))) return w; // A54, 25W, USB-C, LED
    if (i > 0 && SMALL.has(lw)) return lw;
    return lw.charAt(0).toUpperCase() + lw.slice(1);
  }).join(" ");
}

type Line = {
  key: number;
  raw: string;            // como figura en la factura
  es?: string;            // nombre en castellano (traducido por la IA)
  byAi?: boolean;         // la IA decidió que es el mismo artículo aunque esté escrito distinto
  merged?: number;        // cuántos renglones repetidos de la factura se juntaron en este
  code: string | null;
  quantity: string;
  unit_cost: string;
  product: { id: number; name: string } | null;
  matches: Match[];
  create: { name: string; category_id: string; sku?: string; ai?: boolean } | null;
  update_cost: boolean;
};
type Supplier = { id: number; name: string };
type Category = { id: number; name: string };
type History = { id: number; invoice_number: string | null; invoice_date: string | null; total: number | null; confirmed_at: string;
                 supplier_name: string | null; lines: number; units: number; cost_total: number; notes: string | null };

const fmt = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n || 0);
const num = (s: string) => { const n = Number(String(s).replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const round10 = (n: number) => Math.round(n / 10) * 10;
let keySeq = 1;

const api = async (url: string, opts: RequestInit = {}) => {
  const res = await fetch(url, { credentials: "include", ...opts, headers: { "Content-Type": "application/json" } });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || `Error ${res.status}`);
  return d;
};


const CSS = `
  .cp{display:flex;flex-direction:column;gap:14px;max-width:1200px}
  .cp-tabs{display:flex;gap:6px;flex-wrap:wrap}
  .cp-usd{display:grid;gap:10px;padding:14px 18px}
  .cp-usd.on{background:#fffbeb;border-color:#fcd34d}
  .cp-usd-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .cp-usd-in{position:relative;display:inline-block;width:170px}
  .cp-usd-in i{position:absolute;left:11px;top:50%;transform:translateY(-50%);font-style:normal;color:#9ca3af;font-size:14px}
  .cp-usd-in input{padding-left:24px;font-size:16px;font-weight:700}
  .cp-newbar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;background:#f0fdf4;border-color:#bbf7d0;font-size:13px}
  .cp-tab{padding:8px 14px;border-radius:9px;border:1px solid #e5e7eb;background:#fff;font-size:13px;font-weight:700;color:#555;cursor:pointer;font-family:inherit}
  .cp-tab.on{border-color:rgba(0,180,216,.5);background:rgba(0,180,216,.1);color:#0891b2}
  .cp-card{background:#fff;border:1px solid #e5e7eb;border-radius:15px;padding:18px}
  .cp-lbl{font-size:11px;color:#444;display:block;margin-bottom:5px;font-weight:700}
  .cp-in{width:100%;padding:9px 11px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;font-family:inherit;outline:none;background:#fff;color:#1a1a1a}
  .cp-in:focus{border-color:#00B4D8;box-shadow:0 0 0 3px rgba(0,180,216,.12)}
  .cp-btn{padding:9px 14px;border-radius:9px;border:1px solid #e5e7eb;background:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;color:#444;white-space:nowrap}
  .cp-btn.primary{background:#00B4D8;border-color:#00B4D8;color:#fff}
  .cp-btn.green{background:#10b981;border-color:#10b981;color:#fff}
  .cp-btn:disabled{opacity:.55;cursor:not-allowed}
  .cp-drop{border:2px dashed #cbd5e1;border-radius:14px;padding:26px;text-align:center;cursor:pointer;background:#fafbfc;transition:border-color .15s,background .15s}
  .cp-drop:hover,.cp-drop.over{border-color:#00B4D8;background:rgba(0,180,216,.05)}
  .cp-thumbs{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
  .cp-thumb{position:relative;width:96px;height:120px;border-radius:10px;border:1px solid #e5e7eb;overflow:hidden;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:11px;color:#666;text-align:center;padding:4px}
  .cp-thumb img{width:100%;height:100%;object-fit:cover}
  .cp-thumb button{position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;border:none;background:rgba(0,0,0,.6);color:#fff;cursor:pointer;font-size:13px;line-height:1}
  .cp-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .cp-err{padding:10px 14px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-size:13px}
  .cp-ok{padding:10px 14px;border-radius:10px;background:#ecfdf5;border:1px solid #a7f3d0;color:#047857;font-size:13px}
  .cp-note{font-size:12px;color:#667085}
  .cp-reading{display:flex;align-items:center;gap:12px;padding:20px;font-size:14px;color:#0e7490}
  .cp-spin{width:22px;height:22px;border:3px solid rgba(0,180,216,.25);border-top-color:#00B4D8;border-radius:50%;animation:cpspin .8s linear infinite}
  @keyframes cpspin{to{transform:rotate(360deg)}}

  .cp-lines{display:flex;flex-direction:column}
  .cp-line{display:grid;grid-template-columns:minmax(0,2.2fr) 80px 120px minmax(0,2.4fr) 34px;gap:10px;align-items:start;padding:12px 0;border-bottom:1px solid #f2f4f7}
  .cp-line-h{font-size:11px;font-weight:700;color:#98a2b3;text-transform:uppercase;padding-bottom:6px;border-bottom:1px solid #eaecf0}
  .cp-raw{font-size:13px;font-weight:600;word-break:break-word}
  .cp-raw small{display:block;font-weight:500;color:#9ca3af;font-size:11px;margin-top:2px}
  .cp-chip{display:inline-block;font-size:10px;font-weight:800;padding:2px 7px;border-radius:6px;margin-top:4px}
  .cp-x{width:30px;height:34px;border-radius:8px;border:1px solid #e5e7eb;background:#fff;color:#999;cursor:pointer;font-size:16px}
  .cp-x:hover{color:#dc2626;border-color:rgba(239,68,68,.4)}
  .cp-pick{position:relative}
  .cp-pick-btn{width:100%;text-align:left;padding:8px 10px;border-radius:8px;border:1px solid #e5e7eb;background:#fff;cursor:pointer;font-family:inherit;font-size:13px;color:#1a1a1a;min-height:38px}
  .cp-pick-btn.empty{border-color:#fca5a5;background:#fef2f2;color:#b91c1c;font-weight:600}
  .cp-pick-btn.new{border-color:rgba(16,185,129,.45);background:rgba(16,185,129,.06)}
  .cp-dd{position:absolute;left:0;right:0;top:calc(100% + 4px);background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 12px 28px rgba(0,0,0,.12);z-index:30;max-height:300px;overflow-y:auto}
  .cp-dd-sec{padding:6px 10px 4px;font-size:10px;font-weight:800;color:#98a2b3;text-transform:uppercase}
  .cp-dd-opt{display:flex;justify-content:space-between;gap:8px;width:100%;padding:8px 10px;border:none;background:#fff;text-align:left;cursor:pointer;font-family:inherit;font-size:13px;color:#1a1a1a}
  .cp-dd-opt:hover{background:rgba(0,180,216,.07)}
  .cp-sum{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
  .cp-sum b{font-size:18px}
  .cp-hist{width:100%;border-collapse:collapse;font-size:13px}
  .cp-hist th{text-align:left;font-size:11px;color:#98a2b3;text-transform:uppercase;padding:8px;border-bottom:1px solid #eaecf0}
  .cp-hist td{padding:9px 8px;border-bottom:1px solid #f2f4f7}
  .cp-hist .n{text-align:right;white-space:nowrap}
  @media(max-width:820px){
    .cp-line{grid-template-columns:minmax(0,1fr) 80px 110px 34px}
    .cp-line > .cp-pick{grid-column:1 / -1;order:5}
    .cp-line-h{display:none}
    .cp-grid2{grid-template-columns:minmax(0,1fr)}
  }
`;

// ─── Elegir artículo para un renglón ────────────────────────────────
function ProductPicker({ line, categories, onPick, onCreate, onCreateChange }: {
  line: Line; categories: Category[];
  onPick: (p: { id: number; name: string }) => void;
  onCreate: () => void;
  onCreateChange: (c: NonNullable<Line["create"]>) => void;
}) {
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

  if (line.create) {
    return (
      <div className="cp-pick" ref={box} style={{ display: "grid", gap: 6 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <input className="cp-in" value={line.create.name} onChange={(e) => onCreateChange({ ...line.create!, name: e.target.value })} placeholder="Nombre del artículo nuevo" />
          <button className="cp-btn" onClick={() => setOpen(true)} title="Elegir un artículo existente">↺</button>
        </div>
        <select className="cp-in" value={line.create.category_id} onChange={(e) => onCreateChange({ ...line.create!, category_id: e.target.value, ai: false })}
          style={!line.create.category_id ? { borderColor: "#fca5a5" } : undefined}>
          <option value="">Categoría…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span className="cp-chip" style={{ background: "rgba(16,185,129,.12)", color: "#047857", marginTop: 0 }}>ARTÍCULO NUEVO</span>
          {line.create.ai && line.create.category_id && <span className="cp-chip" style={{ background: "#f5f3ff", color: "#6d28d9", marginTop: 0 }}>✨ Categoría elegida por la IA</span>}
        </span>
        {open && <PickerDropdown line={line} q={q} setQ={setQ} res={res} onPick={(p) => { onPick(p); setOpen(false); }} onCreate={() => setOpen(false)} />}
      </div>
    );
  }

  const best = line.product ? line.matches.find((m) => m.id === line.product!.id) : null;
  return (
    <div className="cp-pick" ref={box}>
      <button className={`cp-pick-btn ${line.product ? "" : "empty"}`} onClick={() => setOpen(!open)}>
        {line.product ? line.product.name : "Elegí el artículo ▾"}
      </button>
      {line.product && best && (
        <span className="cp-chip" style={best.score >= 0.75 ? { background: "rgba(16,185,129,.12)", color: "#047857" } : { background: "#fff4e5", color: "#b45309" }}>
          {best.score >= 0.75 ? "Coincide" : "Revisar"} {Math.round(best.score * 100)}%
        </span>
      )}
      {open && <PickerDropdown line={line} q={q} setQ={setQ} res={res} onPick={(p) => { onPick(p); setOpen(false); }} onCreate={() => { onCreate(); setOpen(false); }} />}
    </div>
  );
}

function PickerDropdown({ line, q, setQ, res, onPick, onCreate }: {
  line: Line; q: string; setQ: (s: string) => void; res: { id: number; name: string; stock_quantity: number }[];
  onPick: (p: { id: number; name: string }) => void; onCreate: () => void;
}) {
  return (
    <div className="cp-dd">
      <div style={{ padding: 8, borderBottom: "1px solid #f2f4f7" }}>
        <input className="cp-in" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar artículo…" />
      </div>
      {!q && line.matches.length > 0 && <div className="cp-dd-sec">Sugeridos</div>}
      {!q && line.matches.map((m) => (
        <button key={m.id} className="cp-dd-opt" onClick={() => onPick({ id: m.id, name: m.name })}>
          <span>{m.name}</span><span style={{ color: "#98a2b3", fontSize: 11 }}>{Math.round(m.score * 100)}%</span>
        </button>
      ))}
      {q && res.map((p) => (
        <button key={p.id} className="cp-dd-opt" onClick={() => onPick({ id: p.id, name: p.name })}>
          <span>{p.name}</span><span style={{ color: "#98a2b3", fontSize: 11 }}>stock {p.stock_quantity}</span>
        </button>
      ))}
      {q && res.length === 0 && <div className="cp-dd-sec" style={{ textTransform: "none", fontWeight: 600 }}>Sin resultados</div>}
      <button className="cp-dd-opt" style={{ color: "#047857", fontWeight: 700, borderTop: "1px solid #f2f4f7" }} onClick={onCreate}>＋ Crear artículo nuevo</button>
    </div>
  );
}

// ─── Pantalla ───────────────────────────────────────────────────────
export default function ComprasPage() {
  const [tab, setTab] = useState<"nueva" | "lista" | "historial">("nueva");
  const [step, setStep] = useState<"subir" | "leyendo" | "revisar" | "listo">("subir");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [files, setFiles] = useState<{ mime: string; data: string; preview: string; name: string }[]>([]);
  const [over, setOver] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<History[] | null>(null);
  const [result, setResult] = useState<{ id: number; created: number; updated: number; units: number; closed_orders: number } | null>(null);

  // Datos de la compra
  const [supplierId, setSupplierId] = useState("");
  const [number, setNumber] = useState("");
  const [date, setDate] = useState("");
  const [invoiceTotal, setInvoiceTotal] = useState<number | null>(null);
  const [addIva, setAddIva] = useState(false);
  // Facturas en dólares (ej. proveedores de Paraguay): los costos se pasan a pesos con el valor que se cargue
  const [currency, setCurrency] = useState<"ARS" | "USD">("ARS");
  const [dolar, setDolar] = useState("");
  const [lastDolar, setLastDolar] = useState("");
  const [mergedCount, setMergedCount] = useState(0);
  const [priceMode, setPriceMode] = useState<"keep" | "pct">("keep");
  const [rPct, setRPct] = useState("");
  const [wPct, setWPct] = useState("");
  const [closeOrders, setCloseOrders] = useState(true);
  const [lines, setLines] = useState<Line[]>([]);
  const [raw, setRaw] = useState<unknown>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api("/api/crm/suppliers").then(setSuppliers).catch(() => {});
    fetch("/api/categories").then((r) => r.json()).then((d) => Array.isArray(d) && setCategories(d)).catch(() => {});
    // Ganancia por defecto: 135 % minorista y 30 % mayorista (o lo último que se usó)
    try {
      setRPct(localStorage.getItem("ct_pct_retail") || "135"); setWPct(localStorage.getItem("ct_pct_wholesale") || "30");
      setLastDolar(localStorage.getItem("ct_dolar") || "");
    } catch { setRPct("135"); setWPct("30"); }
  }, []);

  const loadHistory = useCallback(() => { api("/api/compras").then(setHistory).catch((e) => setErr(e.message)); }, []);
  useEffect(() => { if (tab === "historial") loadHistory(); }, [tab, loadHistory]);

  const addFiles = async (list: FileList | File[]) => {
    setErr("");
    const arr = Array.from(list).slice(0, 4 - files.length);
    try {
      const prepared = await Promise.all(arr.map((f) => prepareFile(f)));
      setFiles((f) => [...f, ...prepared].slice(0, 4));
    } catch (e: any) { setErr(e.message); }
  };

  const reset = () => {
    setStep("subir"); setFiles([]); setLines([]); setRaw(null); setErr(""); setResult(null);
    setSupplierId(""); setNumber(""); setDate(""); setInvoiceTotal(null); setAddIva(false);
    setCurrency("ARS"); setDolar(""); setMergedCount(0);
  };

  const read = async () => {
    if (!files.length) return;
    setStep("leyendo"); setErr("");
    try {
      const d = await api("/api/compras/leer", {
        method: "POST",
        body: JSON.stringify({ images: files.map(({ mime, data }) => ({ mime, data })), supplier_id: supplierId || null }),
      });
      if (d.supplier) setSupplierId(String(d.supplier.id));
      setNumber(d.invoice.numero || ""); setDate(d.invoice.fecha || ""); setInvoiceTotal(d.invoice.total);
      setAddIva(!!d.invoice.iva_discriminado);
      setCurrency(d.invoice.moneda === "USD" ? "USD" : "ARS"); setDolar("");
      setMergedCount(d.merged || 0);
      setRaw(d.raw);
      setLines(d.lines.map((l: any) => ({
        key: keySeq++, raw: l.descripcion, es: l.nombre_es || l.descripcion, byAi: !!l.match_by_ai, merged: l.merged || 1, code: l.codigo,
        quantity: String(l.cantidad), unit_cost: l.precio_unitario != null ? String(l.precio_unitario) : "",
        product: l.product_id ? { id: l.product_id, name: l.matches.find((m: Match) => m.id === l.product_id)?.name || "" } : null,
        matches: l.matches, update_cost: true,
        // Lo que no está en el sistema se carga como ARTÍCULO NUEVO con el nombre de la factura
        create: l.product_id ? null : { name: niceName(l.nombre_es || l.descripcion), category_id: l.suggested_category_id ? String(l.suggested_category_id) : "", sku: l.codigo || "", ai: !!l.category_by_ai },
      })));
      if (!d.lines.length) setErr("La IA no encontró productos en la foto. Probá con una foto más clara o cargalos a mano.");
      setStep("revisar");
    } catch (e: any) { setErr(e.message); setStep("subir"); }
  };

  const manual = () => {
    setLines([{ key: keySeq++, raw: "", code: null, quantity: "1", unit_cost: "", product: null, matches: [], create: null, update_cost: true }]);
    setStep("revisar");
  };

  const upd = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  // Totales
  const ivaMul = addIva ? 1.21 : 1;
  const isUsd = currency === "USD";
  const rate = isUsd ? num(dolar) : 1;          // pesos por dólar
  const costTotalOrig = lines.reduce((s, l) => s + num(l.quantity) * num(l.unit_cost), 0);   // en la moneda de la factura
  const costTotal = costTotalOrig * rate;
  const units = lines.reduce((s, l) => s + (parseInt(l.quantity) || 0), 0);
  const pending = lines.filter((l) => !l.product && !l.create).length;
  const newCount = lines.filter((l) => l.create).length;
  const newNoCat = lines.filter((l) => l.create && !l.create.category_id).length;
  const needsPct = priceMode === "pct" || newCount > 0;
  const pctOk = !needsPct || (rPct !== "" && wPct !== "");

  const confirm_ = async () => {
    if (isUsd && !(rate > 0)) { setErr("La factura está en dólares: cargá arriba el valor del dólar en pesos."); return; }
    if (pending) { setErr(`Faltan ${pending} renglones por emparejar (en rojo).`); return; }
    if (lines.some((l) => l.create && l.create.name.trim().length < 2)) { setErr("Hay un artículo nuevo sin nombre."); return; }
    if (newNoCat) { setErr(`Elegí la categoría de ${newNoCat === 1 ? "1 artículo nuevo" : `${newNoCat} artículos nuevos`} (en rojo).`); return; }
    if (!pctOk) { setErr(newCount && priceMode === "keep" ? "Completá los % de ganancia para ponerle precio a los artículos nuevos." : "Completá los % de ganancia."); return; }
    setBusy(true); setErr("");
    try {
      try {
        if (needsPct) { localStorage.setItem("ct_pct_retail", rPct); localStorage.setItem("ct_pct_wholesale", wPct); }
        if (isUsd) localStorage.setItem("ct_dolar", dolar);
      } catch {}
      const r = await api("/api/compras", {
        method: "POST",
        body: JSON.stringify({
          supplier_id: supplierId || null, invoice_number: number || null, invoice_date: date || null,
          total: invoiceTotal != null && isUsd ? Math.round(invoiceTotal * rate * 100) / 100 : invoiceTotal,   // siempre en pesos
          ai_raw: raw, iva_pct: addIva ? 21 : 0,
          notes: isUsd ? `Factura en dólares · US$ 1 = ${fmt(rate)}` : undefined,
          prices: { mode: priceMode, retail_pct: num(rPct), wholesale_pct: num(wPct) },
          close_orders: closeOrders,
          lines: lines.map((l) => ({
            raw_description: l.raw || l.create?.name || l.product?.name || "",
            quantity: parseInt(l.quantity) || 0,
            // en pesos: si la factura es en dólares se multiplica por el valor cargado
            unit_cost: l.unit_cost === "" ? null : Math.round(num(l.unit_cost) * rate * 100) / 100,
            product_id: l.create ? null : l.product?.id,
            create: l.create ? { name: l.create.name, category_id: Number(l.create.category_id), sku: l.create.sku || null } : null,
            update_cost: l.update_cost,
          })),
        }),
      });
      setResult(r); setStep("listo");
      window.dispatchEvent(new Event("admin:refresh-badges"));
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="cp">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Compras</h1>
          <p className="cp-note" style={{ marginTop: 2 }}>
            {tab === "lista"
              ? "Subí la lista de precios del proveedor: la IA la cruza con tus artículos y te muestra los costos nuevos para aprobar."
              : "Sacale una foto a la factura del proveedor: la IA carga los productos, cantidades y costos, y vos revisás antes de grabar."}
          </p>
        </div>
        <div className="cp-tabs">
          <button className={`cp-tab ${tab === "nueva" ? "on" : ""}`} onClick={() => setTab("nueva")}>Nueva compra</button>
          <button className={`cp-tab ${tab === "lista" ? "on" : ""}`} onClick={() => setTab("lista")}>Lista de precios</button>
          <button className={`cp-tab ${tab === "historial" ? "on" : ""}`} onClick={() => setTab("historial")}>Historial</button>
        </div>
      </div>

      {err && tab !== "lista" && <div className="cp-err">{err}</div>}

      {tab === "lista" && <ListaPrecios suppliers={suppliers} />}

      {/* ── HISTORIAL ── */}
      {tab === "historial" && (
        <div className="cp-card" style={{ overflowX: "auto" }}>
          {history === null ? <p className="cp-note">Cargando…</p> : history.length === 0 ? <p className="cp-note">Todavía no se cargó ninguna compra.</p> : (
            <table className="cp-hist">
              <thead><tr><th>Fecha</th><th>Proveedor</th><th>Factura</th><th className="n">Renglones</th><th className="n">Unidades</th><th className="n">Costo</th></tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} title={h.notes || undefined}>
                    <td>{new Date(h.confirmed_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" })}</td>
                    <td>{h.supplier_name || "—"}</td>
                    <td>{h.invoice_number || `#${h.id}`}</td>
                    <td className="n">{h.lines}</td><td className="n">{h.units}</td><td className="n"><b>{fmt(h.cost_total)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── 1. SUBIR ── */}
      {tab === "nueva" && step === "subir" && (
        <div className="cp-card" style={{ display: "grid", gap: 14 }}>
          <div style={{ maxWidth: 360 }}>
            <label className="cp-lbl">PROVEEDOR <span style={{ fontWeight: 500, color: "#9ca3af" }}>(si no lo elegís, la IA lo busca en la factura)</span></label>
            <select className="cp-in" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Detectar automáticamente</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className={`cp-drop ${over ? "over" : ""}`} onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}>
            <div style={{ fontSize: 34, marginBottom: 6 }}>📷</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Sacar foto o subir la factura</div>
            <div className="cp-note" style={{ marginTop: 4 }}>Foto (JPG/PNG) o PDF · hasta 4 páginas · que se lea bien el detalle de productos</div>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" multiple style={{ display: "none" }}
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
          </div>
          {files.length > 0 && (
            <div className="cp-thumbs">
              {files.map((f, i) => (
                <div key={i} className="cp-thumb">
                  {f.preview ? <img src={f.preview} alt="" /> : <span>{f.mime === "application/pdf" ? "📄 PDF" : "🖼"}<br />{f.name}</span>}
                  <button onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))} aria-label="Quitar">×</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button className="cp-btn primary" disabled={!files.length} onClick={read}>✨ Leer con IA</button>
            <button className="cp-btn" onClick={manual}>Cargar a mano, sin foto</button>
          </div>
        </div>
      )}

      {tab === "nueva" && step === "leyendo" && (
        <div className="cp-card cp-reading"><div className="cp-spin" /> Leyendo la factura… puede tardar unos segundos.</div>
      )}

      {/* ── 2. REVISAR ── */}
      {tab === "nueva" && step === "revisar" && (
        <>
          <div className={`cp-card cp-usd${isUsd ? " on" : ""}`}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
              <input type="checkbox" checked={isUsd} onChange={(e) => setCurrency(e.target.checked ? "USD" : "ARS")} style={{ accentColor: "#d97706", width: 16, height: 16 }} />
              Los precios de esta factura están en <b>dólares (US$)</b>
            </label>
            {isUsd && (
              <div className="cp-usd-row">
                <label className="cp-lbl" style={{ margin: 0 }}>VALOR DEL DÓLAR EN PESOS</label>
                <span className="cp-usd-in">
                  <i>$</i>
                  <input className="cp-in" value={dolar} onChange={(e) => { setDolar(e.target.value.replace(/[^\d.,]/g, "")); setErr(""); }} inputMode="decimal"
                    placeholder={lastDolar ? `último: ${lastDolar}` : "Ej: 1500"} autoFocus style={!(rate > 0) ? { borderColor: "#f59e0b" } : undefined} />
                </span>
                <span className="cp-note">
                  {rate > 0 ? <>Total factura: <b>US$ {costTotalOrig.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</b> = <b>{fmt(Math.round(costTotal * 100) / 100)}</b></>
                            : "Cargalo para pasar los costos a pesos. La IA detectó que la factura está en dólares."}
                </span>
              </div>
            )}
          </div>
          <div className="cp-card" style={{ display: "grid", gap: 12 }}>
            <div className="cp-grid2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
              <div>
                <label className="cp-lbl">PROVEEDOR</label>
                <select className="cp-in" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">Sin proveedor</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div><label className="cp-lbl">N° DE FACTURA / REMITO</label><input className="cp-in" value={number} onChange={(e) => setNumber(e.target.value)} /></div>
              <div><label className="cp-lbl">FECHA</label><input className="cp-in" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={addIva} onChange={(e) => setAddIva(e.target.checked)} style={{ accentColor: "#00B4D8", width: 16, height: 16 }} />
              Los precios de la factura <b>no incluyen IVA</b> (factura A): sumar 21 % al costo
            </label>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input type="radio" checked={priceMode === "keep"} onChange={() => setPriceMode("keep")} /> Mantener los precios de venta
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input type="radio" checked={priceMode === "pct"} onChange={() => setPriceMode("pct")} /> Calcular precios con el nuevo costo +
              </label>
              {needsPct && (
                <span style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, flexWrap: "wrap" }}>
                  {priceMode === "keep" && <b style={{ fontSize: 12, color: "#047857" }}>Para los {newCount} artículos nuevos:</b>}
                  <input className="cp-in" style={{ width: 70, ...(rPct === "" ? { borderColor: "#fca5a5" } : {}) }} value={rPct} onChange={(e) => setRPct(e.target.value)} placeholder="60" inputMode="decimal" /> % minorista
                  <input className="cp-in" style={{ width: 70, ...(wPct === "" ? { borderColor: "#fca5a5" } : {}) }} value={wPct} onChange={(e) => setWPct(e.target.value)} placeholder="30" inputMode="decimal" /> % mayorista
                </span>
              )}
            </div>
          </div>

          {(mergedCount > 0 || lines.some((l) => l.byAi)) && (
            <div className="cp-ok">
              {mergedCount > 0 && <>Se juntaron <b>{mergedCount}</b> {mergedCount === 1 ? "renglón repetido" : "renglones repetidos"} de la factura (mismo producto) para no duplicar. </>}
              {lines.some((l) => l.byAi) && <><b>{lines.filter((l) => l.byAi).length}</b> {lines.filter((l) => l.byAi).length === 1 ? "producto se reconoció" : "productos se reconocieron"} como artículos que ya tenés aunque estén escritos distinto (✨). Revisalos.</>}
            </div>
          )}
          {newCount > 0 && (
            <div className="cp-card cp-newbar">
              <div>
                <b>{newCount} {newCount === 1 ? "artículo no está" : "artículos no están"} en el sistema</b>: se van a crear con el nombre de la factura.
                <div className="cp-note">Podés corregir el nombre, o tocar ↺ si en realidad ya existe con otro nombre.</div>
              </div>
              {newNoCat > 0 && (
                <select className="cp-in" style={{ maxWidth: 260, borderColor: "#fca5a5" }} value=""
                  onChange={(e) => { const v = e.target.value; if (v) setLines((ls) => ls.map((l) => (l.create && !l.create.category_id ? { ...l, create: { ...l.create, category_id: v } } : l))); }}>
                  <option value="">Categoría para los {newNoCat} sin categoría…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
          )}

          <div className="cp-card">
            <div className="cp-lines">
              <div className="cp-line cp-line-h">
                <span>Lo que dice la factura</span><span>Cant.</span><span>{isUsd ? "Costo unit. (US$)" : "Costo unit."}</span><span>Artículo del sistema</span><span />
              </div>
              {lines.map((l) => {
                const cost = num(l.unit_cost) * rate * ivaMul;
                return (
                  <div key={l.key} className="cp-line">
                    <div>
                      {l.raw ? (
                        <div className="cp-raw">
                          {l.es || l.raw}
                          {l.es && l.es !== l.raw && <small>En la factura: {l.raw}</small>}
                          {l.code && <small>Código: {l.code}</small>}
                          {l.byAi && l.product && <span className="cp-chip" style={{ background: "#ecfeff", color: "#0e7490" }}>✨ Mismo producto según la IA</span>}
                          {(l.merged || 1) > 1 && <span className="cp-chip" style={{ background: "#f0fdf4", color: "#047857", marginLeft: 4 }}>{l.merged} renglones juntados</span>}
                        </div>
                      ) : (
                        <input className="cp-in" placeholder="Descripción (opcional)" value={l.raw} onChange={(e) => upd(l.key, { raw: e.target.value })} />
                      )}
                      {needsPct && cost > 0 && (
                        <small className="cp-note" style={{ display: "block", marginTop: 4 }}>
                          Venta: {fmt(round10(cost * (1 + num(rPct) / 100)))} · May.: {fmt(round10(cost * (1 + num(wPct) / 100)))}
                        </small>
                      )}
                    </div>
                    <input className="cp-in" value={l.quantity} inputMode="numeric" onChange={(e) => upd(l.key, { quantity: e.target.value.replace(/\D/g, "") })} />
                    <div>
                      <input className="cp-in" value={l.unit_cost} inputMode="decimal" placeholder={isUsd ? "US$" : "$"} onChange={(e) => upd(l.key, { unit_cost: e.target.value })} />
                      {isUsd && num(l.unit_cost) > 0 && <small className="cp-note" style={{ display: "block" }}>{rate > 0 ? `= ${fmt(Math.round(cost * 100) / 100)}` : "falta el dólar"}</small>}
                      {!isUsd && addIva && num(l.unit_cost) > 0 && <small className="cp-note">con IVA {fmt(Math.round(cost * 100) / 100)}</small>}
                    </div>
                    <ProductPicker line={l} categories={categories}
                      onPick={(p) => upd(l.key, { product: p, create: null })}
                      onCreate={() => upd(l.key, { product: null, create: { name: niceName(l.raw), category_id: "", sku: l.code || "" } })}
                      onCreateChange={(c) => upd(l.key, { create: c })} />
                    <button className="cp-x" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} title="Quitar renglón">×</button>
                  </div>
                );
              })}
            </div>
            <button className="cp-btn" style={{ marginTop: 12 }}
              onClick={() => setLines((ls) => [...ls, { key: keySeq++, raw: "", code: null, quantity: "1", unit_cost: "", product: null, matches: [], create: null, update_cost: true }])}>
              ＋ Agregar renglón
            </button>
          </div>

          <div className="cp-card cp-sum">
            <div style={{ display: "grid", gap: 4 }}>
              <span className="cp-note">{lines.length} renglones · {units} unidades{pending > 0 && <b style={{ color: "#b91c1c", fontSize: 13 }}> · faltan {pending} por emparejar</b>}</span>
              <span>Costo total{addIva ? " (con IVA)" : ""}: <b>{isUsd && !(rate > 0) ? "—" : fmt(Math.round(costTotal * ivaMul * 100) / 100)}</b>
                {isUsd && <span className="cp-note"> · US$ {costTotalOrig.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</span>}
                {invoiceTotal != null && <span className="cp-note"> · la factura dice {isUsd ? `US$ ${invoiceTotal.toLocaleString("es-AR")}` : fmt(invoiceTotal)}</span>}</span>
              {supplierId && (
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#444", cursor: "pointer" }}>
                  <input type="checkbox" checked={closeOrders} onChange={(e) => setCloseOrders(e.target.checked)} style={{ accentColor: "#10b981" }} />
                  Marcar como recibidos los pedidos por WhatsApp enviados a este proveedor
                </label>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="cp-btn" onClick={reset}>Descartar</button>
              <button className="cp-btn green" disabled={busy || !lines.length} onClick={confirm_}>
                {busy ? "Guardando…" : "Confirmar compra y sumar stock"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── 3. LISTO ── */}
      {tab === "nueva" && step === "listo" && result && (
        <div className="cp-card" style={{ maxWidth: 520 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>Compra #{result.id} cargada ✓</h2>
          <ul style={{ margin: "10px 0 14px 18px", fontSize: 14, lineHeight: 1.8 }}>
            <li>Se sumaron <b>{result.units}</b> unidades al stock</li>
            <li><b>{result.updated}</b> artículos actualizados{result.created > 0 && <>, <b>{result.created}</b> creados</>}</li>
            {result.closed_orders > 0 && <li><b>{result.closed_orders}</b> pedido(s) a proveedor marcados como recibidos</li>}
          </ul>
          <button className="cp-btn primary" onClick={reset}>Cargar otra compra</button>
        </div>
      )}
    </div>
  );
}
