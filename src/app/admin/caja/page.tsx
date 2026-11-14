"use client";
// ═══════════════════════════════════════════════════════════════════
// CAJA — /admin/caja  (solo administrador)
// Abrir y cerrar la caja, totales del turno, resumen del día,
// ventas del turno (con anular), ingresos / retiros y el pedido a Saphirus.
// Para vender se usa la sección Ventas.
//   ?vista=ventas | ?vista=movimientos | ?vista=saphirus | ?cerrar=1
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import CajaResumen from "@/components/admin/CajaResumen";
import SaphirusPedido from "@/components/admin/SaphirusPedido";
import {
  SalesList, Movements, CloseCash, OpenCash, Row, api, card, btn, seg, fmt, fmtDateTime, POS_CSS, type Summary,
} from "@/components/admin/pos";

type View = "resumen" | "ventas" | "movimientos" | "saphirus";

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
    if (v === "ventas" || v === "movimientos" || v === "saphirus") setView(v);
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

  // Caja cerrada: se puede abrir o igual armar el pedido a Saphirus
  if (!summary) return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Caja</h1>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <button onClick={() => setView("resumen")} style={{ ...seg(view !== "saphirus"), flex: "0 0 auto", padding: "10px 14px" }}>Abrir caja</button>
        <button onClick={() => setView("saphirus")} style={{ ...seg(view === "saphirus"), flex: "0 0 auto", padding: "10px 14px" }}>Pedido Saphirus</button>
      </div>
      {view === "saphirus" ? <SaphirusPedido /> : <OpenCash onOpened={changed} />}
    </div>
  );

  const kpis: [string, string, string?][] = [
    ["Ventas", String(summary.sales_count)],
    ["Total vendido", fmt(summary.sales_total)],
    ["Efectivo en caja", fmt(summary.expected_cash), "#059669"],
    ["Transferencias", fmt(summary.expected_transfer), "#0891b2"],
  ];
  const views: [View, string][] = [["resumen", "Resumen del día"], ["ventas", `Ventas del turno (${summary.sales_count})`], ["movimientos", "Ingresos / retiros"], ["saphirus", "Pedido Saphirus"]];

  return (
    <div className="caja-layout">
      <aside className="caja-side">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Caja</h1>
          <p style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
            Abierta {fmtDateTime(summary.session.opened_at)} · Inicial {fmt(summary.session.opening_amount)}
          </p>
        </div>

        <div className="kpi-stack" style={card}>
          {kpis.map(([k, v, c]) => (
            <div key={k} className="kpi-row">
              <p style={{ fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>{k}</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: c || "#1a1a1a", marginTop: 2 }}>{v}</p>
            </div>
          ))}
        </div>

        <div className="caja-views">
          {views.map(([v, l]) => (
            <button key={v} onClick={() => setView(v)} className="view-btn"
              style={{ ...seg(view === v), flex: "0 0 auto", padding: "10px 14px", whiteSpace: "nowrap" }}>{l}</button>
          ))}
          <Link href="/admin/ventas" className="view-btn" style={{ ...seg(false), flex: "0 0 auto", padding: "10px 14px", whiteSpace: "nowrap", textDecoration: "none", textAlign: "left" }}>Ir a vender →</Link>
        </div>

        <button onClick={openClose} style={{ ...btn("amber"), padding: "10px 14px" }} className="close-btn">Cerrar caja</button>
      </aside>

      <section className="caja-main">
        {view === "resumen" && <CajaResumen refreshKey={refreshKey} />}
        {view === "ventas" && <SalesList refreshKey={refreshKey} onChange={changed} canVoid />}
        {view === "movimientos" && <Movements refreshKey={refreshKey} onChange={changed} />}
        {view === "saphirus" && <SaphirusPedido />}
      </section>

      {closing && (
        <CloseCash summary={summary} onClose={() => setClosing(false)}
          onClosed={(res) => { setClosing(false); setClosedResult(res); setView("resumen"); }} />
      )}
    </div>
  );
}

export default function CajaPage() {
  return (
    <div className="caja">
      <style dangerouslySetInnerHTML={{ __html: POS_CSS }} />
      <Caja />
    </div>
  );
}
