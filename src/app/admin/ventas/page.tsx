"use client";
// ═══════════════════════════════════════════════════════════════════
// VENTAS — /admin/ventas  (admin y vendedores)
// Solo vender: buscar/escanear, cobrar e imprimir el ticket.
// Los totales de la caja NO se muestran acá (están en Caja, solo admin).
//   ?vista=ventas → abre "Ventas de hoy"
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { SaleScreen, SalesList, api, card, seg, fmtTime, POS_CSS } from "@/components/admin/pos";

type View = "venta" | "ventas";
type SessionInfo = { id: number; opened_at: string } | null;

function Ventas() {
  const [session, setSession] = useState<SessionInfo | undefined>(undefined);
  const [view, setView] = useState<View>("venta");
  const [refreshKey, setRefreshKey] = useState(0);
  const [count, setCount] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api("/api/pos/session");
      setSession(d.session ? { id: d.session.id, opened_at: d.session.opened_at } : null);
    } catch { setSession(null); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Cantidad de ventas del turno (sin montos)
  useEffect(() => {
    if (!session) return;
    api("/api/pos/sales").then((rows: any[]) => setCount(rows.filter((r) => r.status === "completed").length)).catch(() => {});
  }, [session, refreshKey]);

  // Varias compus venden en la misma caja: al volver a la pestaña se actualiza
  useEffect(() => {
    const onVisible = () => { if (!document.hidden) { load(); setRefreshKey((k) => k + 1); } };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("vista") === "ventas") setView("ventas");
    if (q.toString()) window.history.replaceState(null, "", "/admin/ventas");
  }, []);

  const changed = () => { setRefreshKey((k) => k + 1); window.dispatchEvent(new Event("admin:refresh-badges")); };

  if (session === undefined) return <p style={{ color: "#666", padding: 20 }}>Cargando…</p>;

  if (!session) {
    return (
      <div style={{ ...card, maxWidth: 440, margin: "30px auto", textAlign: "center", padding: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>La caja está cerrada</h2>
        <p style={{ fontSize: 13, color: "#666", marginTop: 6 }}>Para vender, primero el dueño tiene que abrir la caja.</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
          <Link href="/admin/caja" style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #00B4D8", background: "#00B4D8", color: "#fff", fontWeight: 700, textDecoration: "none", fontSize: 14 }}>
            Abrir caja
          </Link>
          <button onClick={load} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Volver a revisar
          </button>
        </div>
      </div>
    );
  }

  const views: [View, string][] = [["venta", "Nueva venta"], ["ventas", `Ventas de hoy${count !== null ? ` (${count})` : ""}`]];

  return (
    <div className="caja-layout">
      <aside className="caja-side">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Ventas</h1>
          <span className="state on" style={{ marginTop: 6 }}><span className="dot" />Caja abierta · {fmtTime(session.opened_at)}</span>
        </div>

        <div className="caja-views">
          {views.map(([v, l]) => (
            <button key={v} onClick={() => setView(v)} className="view-btn"
              style={{ ...seg(view === v), flex: "0 0 auto", padding: "10px 14px", whiteSpace: "nowrap" }}>{l}</button>
          ))}
        </div>

        <div className="keys" style={{ ...card, padding: "10px 14px" }}>
          <div><kbd>Enter</kbd> agrega el producto</div>
          <div><kbd>↑</kbd> <kbd>↓</kbd> elegir de la lista</div>
          <div><kbd>F2</kbd> cobrar</div>
          <div><kbd>Esc</kbd> limpiar búsqueda</div>
        </div>

        <Link href="/admin/caja" className="side-note" style={{ color: "#0891b2", fontWeight: 600, textDecoration: "none" }}>Totales y cierre en Caja →</Link>
      </aside>

      <section className="caja-main">
        {/* La venta se mantiene montada para no perder el carrito al cambiar de vista */}
        <div style={{ display: view === "venta" ? "block" : "none" }}><SaleScreen onSold={changed} /></div>
        {view === "ventas" && <SalesList refreshKey={refreshKey} onChange={changed} canVoid={false} />}
      </section>
    </div>
  );
}

export default function VentasPage() {
  return (
    <div className="caja">
      <style dangerouslySetInnerHTML={{ __html: POS_CSS }} />
      <Ventas />
    </div>
  );
}
