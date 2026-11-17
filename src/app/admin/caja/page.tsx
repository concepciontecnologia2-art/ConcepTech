"use client";
// ═══════════════════════════════════════════════════════════════════
// CAJA — /admin/caja  (solo administrador)
// Abrir y cerrar la caja, totales del turno, resumen del día,
// ventas del turno (con anular) e ingresos / retiros.
// Para vender se usa la sección Ventas.
//   ?vista=ventas | ?vista=movimientos | ?cerrar=1
// (El pedido a Saphirus se mudó a su propia sección (Saphirus))
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import CajaResumen from "@/components/admin/CajaResumen";
import {
  SalesList, Movements, CloseCash, OpenCash, Row, api, card, btn, fmt, fmtDateTime, POS_CSS, type Summary,
} from "@/components/admin/pos";

type View = "resumen" | "ventas" | "movimientos";

function Caja() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("resumen");
  const [closing, setClosing] = useState(false);
  const [closedResult, setClosedResult] = useState<Summary | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadSummary = useCallback(async () => {
    try {
      const d = await api("/api/pos/session");
      setSummary(d.session ? d : null);
    } catch { setSummary(null); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  // Varias compus usan la misma caja: al volver a esta pestaña se traen los números actualizados
  useEffect(() => {
    const onVisible = () => { if (!document.hidden) { loadSummary(); setRefreshKey((k) => k + 1); } };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadSummary]);

  // Antes de cerrar se recalcula todo, para incluir las ventas de las otras compus
  const openClose = async () => { await loadSummary(); setClosing(true); };

  const changed = () => {
    loadSummary();
    setRefreshKey((k) => k + 1);
    window.dispatchEvent(new Event("admin:refresh-badges"));
  };

  const deepLinkDone = useRef(false);
  useEffect(() => {
    if (loading || deepLinkDone.current) return;
    deepLinkDone.current = true;
    const q = new URLSearchParams(window.location.search);
    const v = q.get("vista");
    if (v === "saphirus") { window.location.replace("/admin/pedido-saphirus"); return; }
    if (v === "ventas" || v === "movimientos") setView(v);
    if (q.get("cerrar") === "1" && summary) setClosing(true);
    if (q.toString()) window.history.replaceState(null, "", "/admin/caja");
  }, [loading, summary]);

  if (loading) return <p style={{ color: "#666", padding: 20 }}>Cargando…</p>;

  if (closedResult) {
    const d = closedResult.session.difference ?? 0;
    return (
      <div style={{ ...card, maxWidth: 460 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Caja cerrada ✓</h2>
        <Row k="Ventas" v={String(closedResult.sales_count)} />
        <Row k="Total vendido" v={fmt(closedResult.sales_total)} />
        <Row k="Efectivo esperado" v={fmt(closedResult.expected_cash)} />
        <Row k="Efectivo contado" v={fmt(closedResult.session.counted_cash ?? 0)} />
        <Row k="Transferencias" v={fmt(closedResult.expected_transfer)} />
        <Row k="Diferencia" v={`${d > 0 ? "+" : ""}${fmt(d)}`} strong color={d === 0 ? "#059669" : d > 0 ? "#d97706" : "#ef4444"} />
        <button onClick={() => { setClosedResult(null); setSummary(null); window.dispatchEvent(new Event("admin:refresh-badges")); }} style={{ ...btn("primary"), width: "100%", marginTop: 14, padding: 11 }}>Listo</button>
      </div>
    );
  }

  // Caja cerrada: solo se puede abrir
  if (!summary) return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Caja</h1>
      <OpenCash onOpened={changed} />
    </div>
  );

  const kpis: [string, string, string?][] = [
    ["Ventas", String(summary.sales_count)],
    ["Total vendido", fmt(summary.sales_total)],
    ["Efectivo en caja", fmt(summary.expected_cash), "#059669"],
    ["Transferencias", fmt(summary.expected_transfer), "#0891b2"],
  ];
  const views: { v: View; label: string; icon: string; count?: number }[] = [
    { v: "resumen", label: "Resumen del día", icon: "M3 3v18h18 M7 15l4-4 3 3 6-7" },
    { v: "ventas", label: "Ventas del turno", icon: "M4 4h16v16H4z M8 9h8 M8 13h8 M8 17h5", count: summary.sales_count },
    { v: "movimientos", label: "Ingresos / retiros", icon: "M7 7h13l-4-4 M17 17H4l4 4" },
  ];

  return (
    <div className="caja-layout">
      <style dangerouslySetInnerHTML={{ __html: SIDE_CSS }} />
      <aside className="caja-side cj-side">
        {/* Estado de la caja + cerrar */}
        <div className="cj-card cj-head">
          <div className="cj-title">
            <h1>Caja</h1>
            <span className="cj-open"><i />Abierta</span>
          </div>
          <p className="cj-sub">Desde {fmtDateTime(summary.session.opened_at)}</p>
          <p className="cj-sub">Inicial <b>{fmt(summary.session.opening_amount)}</b></p>
          <button onClick={openClose} className="cj-close">Cerrar caja</button>
        </div>

        {/* Menú */}
        <nav className="cj-card cj-nav" aria-label="Secciones de caja">
          {views.map((x) => (
            <button key={x.v} onClick={() => setView(x.v)} className={`cj-item ${view === x.v ? "on" : ""}`}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={x.icon} /></svg>
              <span>{x.label}</span>
              {x.count != null && <em>{x.count}</em>}
            </button>
          ))}
        </nav>

        {/* Números del turno */}
        <div className="cj-card cj-kpis">
          {kpis.map(([k, v, c]) => (
            <div key={k} className="cj-kpi">
              <span>{k}</span>
              <b style={c ? { color: c } : undefined}>{v}</b>
            </div>
          ))}
        </div>

        <Link href="/admin/ventas" className="cj-sell">Ir a vender →</Link>
      </aside>

      <section className="caja-main">
        {view === "resumen" && <CajaResumen refreshKey={refreshKey} />}
        {view === "ventas" && <SalesList refreshKey={refreshKey} onChange={changed} canVoid />}
        {view === "movimientos" && <Movements refreshKey={refreshKey} onChange={changed} />}
      </section>

      {closing && (
        <CloseCash summary={summary} onClose={() => setClosing(false)}
          onClosed={(res) => { setClosing(false); setClosedResult(res); setView("resumen"); }} />
      )}
    </div>
  );
}

// Columna izquierda de Caja (estado, menú y números del turno)
const SIDE_CSS = `
  .cj-side{gap:10px !important}
  .cj-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px}
  .cj-head{padding:12px 14px;display:grid;gap:2px}
  .cj-title{display:flex;align-items:center;justify-content:space-between;gap:8px}
  .cj-title h1{font-size:20px;font-weight:800}
  .cj-open{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#047857;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:999px;padding:2px 8px}
  .cj-open i{width:6px;height:6px;border-radius:50%;background:#10b981}
  .cj-sub{font-size:12px;color:#667085}
  .cj-sub b{color:#344054}
  .cj-close{margin-top:8px;width:100%;padding:8px 10px;border-radius:9px;border:1px solid #fcd34d;background:#fffbeb;color:#b45309;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit}
  .cj-close:hover{background:#fef3c7}
  .cj-nav{padding:5px;display:grid;gap:2px}
  .cj-item{display:flex;align-items:center;gap:9px;width:100%;padding:9px 10px;border:0;border-radius:8px;background:none;color:#475467;font-size:13.5px;font-weight:600;text-align:left;cursor:pointer;font-family:inherit;position:relative}
  .cj-item:hover{background:#f5f7fa;color:#1a1a1a}
  .cj-item.on{background:rgba(0,180,216,.1);color:#0e7490}
  .cj-item.on::before{content:"";position:absolute;left:-5px;top:8px;bottom:8px;width:3px;border-radius:3px;background:#00B4D8}
  .cj-item svg{flex-shrink:0;opacity:.85}
  .cj-item span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .cj-item em{font-style:normal;font-size:11px;font-weight:800;background:#f2f4f7;color:#475467;border-radius:999px;padding:1px 7px}
  .cj-item.on em{background:#00B4D8;color:#fff}
  .cj-kpis{padding:4px 14px}
  .cj-kpi{display:flex;flex-direction:column;gap:1px;padding:8px 0;border-bottom:1px solid #f2f4f7;min-width:0}
  .cj-kpi:last-child{border-bottom:0}
  .cj-kpi span{font-size:11px;font-weight:700;color:#98a2b3;text-transform:uppercase;letter-spacing:.03em;white-space:nowrap}
  .cj-kpi b{font-size:17px;font-weight:800;color:#1a1a1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cj-sell{display:block;text-align:center;padding:10px;border-radius:10px;background:#0891b2;color:#fff;font-weight:700;font-size:13px;text-decoration:none}
  .cj-sell:hover{background:#0e7490}
  /* Celular y tablet: arriba en filas, el menú como pestañas que se deslizan */
  @media(max-width:1023px){
    .cj-side{display:grid !important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
    .cj-head{grid-column:1 / -1;grid-template-columns:minmax(0,1fr) auto;align-items:center;column-gap:10px}
    .cj-head .cj-title,.cj-head .cj-sub{grid-column:1}
    .cj-close{grid-column:2;grid-row:1 / span 3;margin-top:0;width:auto;padding:9px 14px}
    .cj-nav{grid-column:1 / -1;display:flex;overflow-x:auto;scrollbar-width:none}
    .cj-nav::-webkit-scrollbar{display:none}
    .cj-item{flex:0 0 auto;width:auto;padding:8px 12px}
    .cj-item.on::before{left:10px;right:10px;top:auto;bottom:-1px;width:auto;height:3px}
    .cj-kpis{grid-column:1 / -1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:16px}
    .cj-kpi:nth-last-child(2){border-bottom:0}
    .cj-sell{grid-column:1 / -1}
  }
  @media(min-width:640px) and (max-width:1023px){ .cj-kpis{grid-template-columns:repeat(4,minmax(0,1fr))} .cj-kpi{border-bottom:0} }
`;

export default function CajaPage() {
  return (
    <div className="caja">
      <style dangerouslySetInnerHTML={{ __html: POS_CSS }} />
      <Caja />
    </div>
  );
}
