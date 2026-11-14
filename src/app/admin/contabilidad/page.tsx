"use client";
// ═══════════════════════════════════════════════════════════════════
// CONTABILIDAD — /admin/contabilidad  (solo administrador)
// Ventas, costo, ganancia, gastos y cierres de caja del período elegido.
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from "react";

const fmt = (n: number) => {
  const v = n || 0;
  const dec = Number.isInteger(Math.round(v * 100) / 100) ? 0 : 2;
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
};
const pct = (n: number) => `${Math.round((n || 0) * 100)}%`;
const fmtDT = (s: string) => new Date(s).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
const dayLabel = (s: string, long = false) =>
  new Date(s + "T12:00:00").toLocaleDateString("es-AR", long ? { weekday: "long", day: "numeric", month: "long" } : { day: "numeric", month: "numeric" });

// Fechas en hora local (Argentina)
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
type Preset = "hoy" | "ayer" | "semana" | "mes" | "mes-ant" | "custom";
function rangeOf(p: Preset): [string, string] {
  const t = new Date(); t.setHours(12, 0, 0, 0);
  const d = (offset: number) => { const x = new Date(t); x.setDate(x.getDate() + offset); return x; };
  if (p === "hoy") return [iso(t), iso(t)];
  if (p === "ayer") return [iso(d(-1)), iso(d(-1))];
  if (p === "semana") { const dow = (t.getDay() + 6) % 7; return [iso(d(-dow)), iso(t)]; }
  if (p === "mes") return [iso(new Date(t.getFullYear(), t.getMonth(), 1, 12)), iso(t)];
  const first = new Date(t.getFullYear(), t.getMonth() - 1, 1, 12), last = new Date(t.getFullYear(), t.getMonth(), 0, 12);
  return [iso(first), iso(last)];
}

type Data = {
  sales: { count: number; total: number; discount: number; voided_count: number; voided_total: number; units: number; avg_ticket: number };
  payments: { cash: number; transfer: number };
  cost: number; gross_profit: number; margin: number; net: number;
  missing_cost: { units: number; sales: number };
  movements: { income: number; expense: number; list: { id: number; type: string; method: string; amount: number; reason: string; created_at: string }[] };
  web: { count: number; total: number; pending: number };
  byDay: { day: string; total: number; count: number; cost: number; expense: number }[];
  bySeller: { seller: string; count: number; total: number }[];
  byCategory: { category: string; units: number; total: number; cost: number }[];
  topProducts: { name: string; units: number; total: number; cost: number | null }[];
  capital: { cost_value: number; retail_value: number; wholesale_value: number; units: number; products: number;
             no_cost_products: number; no_cost_units: number; no_cost_retail: number; no_wholesale_products: number;
             byCategory: { category: string; units: number; cost_value: number; retail_value: number; wholesale_value: number }[] };
  sessions: { id: number; opened_at: string; closed_at: string; opened_by: string | null; closed_by: string | null; sales_total: number; sales_count: number;
              expected_cash: number; counted_cash: number; difference: number; notes: string | null }[];
};

const CSS = `
  .ct{display:flex;flex-direction:column;gap:14px}
  .ct-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap}
  .ct-chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
  .ct-chip{padding:7px 12px;border-radius:9px;border:1px solid #e5e7eb;background:#fff;font-size:13px;font-weight:600;font-family:inherit;color:#555;cursor:pointer}
  .ct-chip.on{border-color:rgba(0,180,216,.5);background:rgba(0,180,216,.1);color:#0891b2}
  .ct-date{padding:6px 9px;border:1px solid #e5e7eb;border-radius:9px;font-family:inherit;font-size:13px;background:#fff}
  .ct-card{background:#fff;border:1px solid #eaecf0;border-radius:15px;padding:16px 18px;min-width:0}
  .ct-card h3{font-size:15px;font-weight:700}
  .ct-card .sub{font-size:12px;color:#98a2b3;margin-top:1px}
  .ct-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .ct-kpi{background:#fff;border:1px solid #eaecf0;border-radius:14px;padding:13px 15px;min-width:0}
  .ct-kpi .k{font-size:11px;font-weight:700;color:#98a2b3;text-transform:uppercase;letter-spacing:.05em}
  .ct-kpi .v{font-size:22px;font-weight:800;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ct-kpi .s{font-size:12px;color:#667085;margin-top:2px}
  .ct-kpi.hl{background:linear-gradient(135deg,#0e7490,#0891b2);border-color:transparent;color:#fff}
  .ct-kpi.hl .k,.ct-kpi.hl .s{color:rgba(255,255,255,.8)}
  .ct-warn{padding:10px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;font-size:13px;color:#92400e}
  .ct-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
  .ct-tbl{width:100%;border-collapse:collapse;font-size:13px}
  .ct-tbl th{text-align:left;font-size:11px;color:#98a2b3;font-weight:700;text-transform:uppercase;padding:8px 8px;border-bottom:1px solid #eaecf0;white-space:nowrap}
  .ct-tbl td{padding:8px;border-bottom:1px solid #f2f4f7;white-space:nowrap}
  .ct-tbl td.n,.ct-tbl th.n{text-align:right}
  .ct-tbl td.name{white-space:normal;min-width:140px}
  .ct-scroll{overflow-x:auto;margin-top:10px}
  .ct-split{display:flex;gap:3px;height:12px;border-radius:6px;overflow:hidden;background:#f2f4f7;margin-top:12px}
  .ct-legend{display:flex;justify-content:space-between;gap:10px;margin-top:10px;font-size:13px;flex-wrap:wrap}
  .ct-sw{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:6px}
  .ct-empty{font-size:13px;color:#98a2b3;padding:18px 0;text-align:center}
  .ct-tip{position:absolute;transform:translateX(-50%);background:#101828;color:#fff;border-radius:9px;padding:7px 10px;font-size:12px;white-space:nowrap;pointer-events:none;z-index:5}
  .ct-tip span{color:#c7c9d1}
  .ct-cap{background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;border-radius:16px;padding:18px 20px;display:grid;gap:14px}
  .ct-cap .k{font-size:11px;font-weight:700;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.06em}
  .ct-cap-big{display:grid;gap:10px;grid-template-columns:repeat(2,minmax(0,1fr))}
  .ct-cap-tot{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:14px 16px;min-width:0}
  .ct-cap-tot.main{background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.3)}
  .ct-cap-tot .v{font-size:clamp(20px,2.4vw,28px);font-weight:800;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}
  .ct-cap-tot .s{font-size:11px;color:rgba(255,255,255,.65);margin-top:2px}
  .ct-cap-warn{font-size:12px;color:#fde68a}
  .ct-cap-btn{justify-self:start;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:#fff;border-radius:9px;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
  .ct-cap-tbl{width:100%;border-collapse:collapse;font-size:13px}
  .ct-cap-tbl th{text-align:left;font-size:11px;color:rgba(255,255,255,.6);font-weight:700;text-transform:uppercase;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.15)}
  .ct-cap-tbl td{padding:7px 8px;border-bottom:1px solid rgba(255,255,255,.08)}
  .ct-cap-tbl .n{text-align:right;white-space:nowrap}
  @media(min-width:900px){ .ct-cap{grid-template-columns:minmax(0,1fr)} .ct-cap-big{grid-template-columns:repeat(4,minmax(0,1fr))} .ct-cap-full{grid-column:1 / -1} }
  @media(min-width:700px){ .ct-kpis{grid-template-columns:repeat(3,minmax(0,1fr))} }
  @media(min-width:1100px){
    .ct-kpis{grid-template-columns:repeat(6,minmax(0,1fr))}
    .ct-grid.two{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
    .ct-grid.wide{grid-template-columns:minmax(0,2fr) minmax(0,1fr)}
  }
`;

function DayChart({ data }: { data: Data["byDay"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.total));
  const H = 150;
  const few = data.length <= 14;
  return (
    <div style={{ position: "relative", height: H + 26, marginTop: 14 }} onMouseLeave={() => setHover(null)}>
      <div style={{ position: "absolute", left: 0, right: 0, top: H, height: 1, background: "#eaecf0" }} />
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${data.length}, 1fr)`, height: "100%" }}>
        {data.map((d, i) => {
          const h = d.total > 0 ? Math.max(3, (d.total / max) * (H - 10)) : 0;
          const profit = Math.max(0, d.total - d.cost);
          const ph = d.total > 0 ? (profit / d.total) * h : 0;
          return (
            <div key={d.day} style={{ position: "relative" }} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
              <div style={{ position: "absolute", inset: "0 1px 24px", borderRadius: 6, background: hover === i ? "rgba(0,180,216,.08)" : "transparent" }} />
              <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: H - h, width: few ? "min(28px,60%)" : "70%", height: h, borderRadius: "4px 4px 0 0", background: "#a5e3f0", overflow: "hidden" }}>
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: ph, background: "#0891b2" }} />
              </div>
              {(few || i % Math.ceil(data.length / 10) === 0 || i === data.length - 1) && (
                <div style={{ position: "absolute", left: 0, right: 0, top: H + 6, textAlign: "center", fontSize: 10, color: "#98a2b3" }}>{dayLabel(d.day)}</div>
              )}
              {hover === i && (
                <div className="ct-tip" style={{ left: "50%", bottom: 30 + h }}>
                  <div><span>{dayLabel(d.day, true)}</span></div>
                  <div>Vendido <b>{fmt(d.total)}</b> · {d.count} {d.count === 1 ? "venta" : "ventas"}</div>
                  <div>Ganancia <b>{fmt(profit)}</b></div>
                  {d.expense > 0 && <div>Gastos <b>{fmt(d.expense)}</b></div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ContabilidadPage() {
  const [preset, setPreset] = useState<Preset>("mes");
  const [[desde, hasta], setRange] = useState<[string, string]>(() => rangeOf("mes"));
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [capOpen, setCapOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/contabilidad?desde=${desde}&hasta=${hasta}`, { credentials: "include" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error al cargar");
      setData(d); setErr("");
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }, [desde, hasta]);
  useEffect(() => { load(); }, [load]);

  const pick = (p: Preset) => { setPreset(p); if (p !== "custom") setRange(rangeOf(p)); };
  const presets: [Preset, string][] = [["hoy", "Hoy"], ["ayer", "Ayer"], ["semana", "Esta semana"], ["mes", "Este mes"], ["mes-ant", "Mes anterior"], ["custom", "Elegir fechas"]];

  const d = data;
  const paid = d ? d.payments.cash + d.payments.transfer : 0;
  const cashPct = paid > 0 ? d!.payments.cash / paid : 0;

  return (
    <div className="ct">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ct-head">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Contabilidad</h1>
          <p style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
            {desde === hasta ? dayLabel(desde, true) : `Del ${dayLabel(desde, true)} al ${dayLabel(hasta, true)}`}
            {loading && " · actualizando…"}
          </p>
        </div>
        <div className="ct-chips">
          {presets.map(([p, l]) => <button key={p} className={`ct-chip ${preset === p ? "on" : ""}`} onClick={() => pick(p)}>{l}</button>)}
          {preset === "custom" && (
            <>
              <input type="date" className="ct-date" value={desde} max={hasta} onChange={(e) => e.target.value && setRange([e.target.value, hasta])} />
              <span style={{ color: "#999" }}>a</span>
              <input type="date" className="ct-date" value={hasta} min={desde} onChange={(e) => e.target.value && setRange([desde, e.target.value])} />
            </>
          )}
        </div>
      </div>

      {err && <div className="ct-warn" style={{ background: "#fef2f2", borderColor: "#fecaca", color: "#b91c1c" }}>{err}</div>}
      {!d && !err && <div className="ct-card ct-empty">Cargando…</div>}

      {d && (
        <>
          {/* ── Capital total: lo que vale hoy la mercadería en stock ── */}
          <div className="ct-cap">
            <div className="ct-cap-full">
              <div className="k">Capital total en mercadería · hoy</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)", marginTop: 3 }}>
                Todo el stock: {d.capital.units.toLocaleString("es-AR")} unidades en {d.capital.products} productos
              </div>
            </div>
            <div className="ct-cap-big ct-cap-full">
              <div className="ct-cap-tot main"><div className="k">A precio minorista</div><div className="v">{fmt(d.capital.retail_value)}</div><div className="s">Si se vende todo al público</div></div>
              <div className="ct-cap-tot"><div className="k">A precio mayorista</div><div className="v">{fmt(d.capital.wholesale_value)}</div><div className="s">Si se vende todo por mayor</div></div>
              <div className="ct-cap-tot"><div className="k">Al costo</div><div className="v">{fmt(d.capital.cost_value)}</div><div className="s">Lo que pagaste por el stock</div></div>
              <div className="ct-cap-tot"><div className="k">Ganancia posible</div><div className="v" style={{ color: "#6ee7b7" }}>{fmt(d.capital.retail_value - d.capital.cost_value - d.capital.no_cost_retail)}</div><div className="s">Minorista − costo</div></div>
            </div>
            {d.capital.no_wholesale_products > 0 && (
              <div className="ct-cap-warn ct-cap-full" style={{ color: "rgba(255,255,255,.7)" }}>
                {d.capital.no_wholesale_products} {d.capital.no_wholesale_products === 1 ? "producto no tiene" : "productos no tienen"} precio mayorista: en ese total se cuentan a precio minorista.
              </div>
            )}
            {d.capital.no_cost_products > 0 && (
              <div className="ct-cap-warn ct-cap-full">
                ⚠ {d.capital.no_cost_products} {d.capital.no_cost_products === 1 ? "producto con stock no tiene" : "productos con stock no tienen"} precio de costo ({d.capital.no_cost_units} unidades, {fmt(d.capital.no_cost_retail)} a precio de venta): están en los totales minorista y mayorista, pero no en «Al costo». Cargales el costo en Artículos.
              </div>
            )}
            <button className="ct-cap-btn ct-cap-full" onClick={() => setCapOpen(!capOpen)}>{capOpen ? "Ocultar detalle" : "Ver por categoría"}</button>
            {capOpen && (
              <div className="ct-cap-full" style={{ overflowX: "auto" }}>
                <table className="ct-cap-tbl">
                  <thead><tr><th>Categoría</th><th className="n">Unidades</th><th className="n">A minorista</th><th className="n">A mayorista</th><th className="n">Al costo</th></tr></thead>
                  <tbody>
                    {d.capital.byCategory.map((c) => (
                      <tr key={c.category}><td>{c.category}</td><td className="n">{c.units}</td><td className="n"><b>{fmt(c.retail_value)}</b></td><td className="n">{fmt(c.wholesale_value)}</td><td className="n">{fmt(c.cost_value)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="ct-kpis">
            <div className="ct-kpi">
              <div className="k">Vendido en el local</div>
              <div className="v">{fmt(d.sales.total)}</div>
              <div className="s">{d.sales.count} ventas · ticket {fmt(Math.round(d.sales.avg_ticket))}</div>
            </div>
            <div className="ct-kpi">
              <div className="k">Costo de lo vendido</div>
              <div className="v">{fmt(d.cost)}</div>
              <div className="s">{d.sales.units} unidades</div>
            </div>
            <div className="ct-kpi hl">
              <div className="k">Ganancia bruta</div>
              <div className="v">{fmt(d.gross_profit)}</div>
              <div className="s">Margen {pct(d.margin)}</div>
            </div>
            <div className="ct-kpi">
              <div className="k">Gastos y retiros</div>
              <div className="v" style={{ color: d.movements.expense > 0 ? "#b45309" : undefined }}>{fmt(d.movements.expense)}</div>
              <div className="s">{d.movements.income > 0 ? `Ingresos extra ${fmt(d.movements.income)}` : "Salidas de caja"}</div>
            </div>
            <div className="ct-kpi">
              <div className="k">Resultado</div>
              <div className="v" style={{ color: d.net >= 0 ? "#047857" : "#b42318" }}>{fmt(d.net)}</div>
              <div className="s">Ganancia − gastos</div>
            </div>
            <div className="ct-kpi">
              <div className="k">Ventas web</div>
              <div className="v">{fmt(d.web.total)}</div>
              <div className="s">{d.web.count} confirmadas{d.web.pending ? ` · ${d.web.pending} pendientes` : ""}</div>
            </div>
          </div>

          {d.missing_cost.units > 0 && (
            <div className="ct-warn">
              ⚠ {d.missing_cost.units} {d.missing_cost.units === 1 ? "unidad vendida no tiene" : "unidades vendidas no tienen"} precio de costo cargado ({fmt(d.missing_cost.sales)} en ventas).
              Esas ventas se cuentan como ganancia completa, así que la ganancia real es menor. Cargá el costo en Artículos.
            </div>
          )}

          <div className="ct-grid wide">
            <div className="ct-card">
              <h3>Ventas por día</h3>
              <p className="sub"><span className="ct-sw" style={{ background: "#0891b2" }} />Ganancia <span className="ct-sw" style={{ background: "#a5e3f0", marginLeft: 10 }} />Costo</p>
              {d.sales.total === 0 ? <div className="ct-empty">No hay ventas en este período.</div> : <DayChart data={d.byDay} />}
            </div>
            <div className="ct-card">
              <h3>Cómo te pagaron</h3>
              <p className="sub">Ventas del local</p>
              {paid === 0 ? <div className="ct-empty">Sin cobros.</div> : (
                <>
                  <div className="ct-split">
                    {d.payments.cash > 0 && <div style={{ flex: d.payments.cash, background: "#10b981" }} />}
                    {d.payments.transfer > 0 && <div style={{ flex: d.payments.transfer, background: "#6366f1" }} />}
                  </div>
                  <div className="ct-legend">
                    <span><span className="ct-sw" style={{ background: "#10b981" }} />Efectivo {pct(cashPct)} · <b>{fmt(d.payments.cash)}</b></span>
                    <span><span className="ct-sw" style={{ background: "#6366f1" }} />Transferencia {pct(1 - cashPct)} · <b>{fmt(d.payments.transfer)}</b></span>
                  </div>
                </>
              )}
              <div style={{ borderTop: "1px dashed #eaecf0", marginTop: 16, paddingTop: 12, fontSize: 13, display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#667085" }}>Descuentos dados</span><b>{fmt(d.sales.discount)}</b></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#667085" }}>Ventas anuladas</span><b>{d.sales.voided_count} · {fmt(d.sales.voided_total)}</b></div>
              </div>
              <h3 style={{ marginTop: 18 }}>Por vendedor</h3>
              {d.bySeller.length === 0 ? <div className="ct-empty">Sin ventas.</div> : (
                <table className="ct-tbl" style={{ marginTop: 6 }}>
                  <tbody>
                    {d.bySeller.map((s) => (
                      <tr key={s.seller}><td className="name">{s.seller}</td><td className="n">{s.count}</td><td className="n"><b>{fmt(s.total)}</b></td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="ct-grid two">
            <div className="ct-card">
              <h3>Productos más vendidos</h3>
              {d.topProducts.length === 0 ? <div className="ct-empty">Sin ventas.</div> : (
                <div className="ct-scroll">
                  <table className="ct-tbl">
                    <thead><tr><th>Producto</th><th className="n">Unid.</th><th className="n">Vendido</th><th className="n">Ganancia</th></tr></thead>
                    <tbody>
                      {d.topProducts.map((p, i) => (
                        <tr key={i}>
                          <td className="name">{p.name}</td><td className="n">{p.units}</td><td className="n">{fmt(p.total)}</td>
                          <td className="n" style={{ color: "#047857", fontWeight: 700 }}>{p.cost === null ? "—" : fmt(p.total - p.cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="ct-card">
              <h3>Por categoría</h3>
              {d.byCategory.length === 0 ? <div className="ct-empty">Sin ventas.</div> : (
                <div className="ct-scroll">
                  <table className="ct-tbl">
                    <thead><tr><th>Categoría</th><th className="n">Unid.</th><th className="n">Vendido</th><th className="n">Margen</th></tr></thead>
                    <tbody>
                      {d.byCategory.map((c) => (
                        <tr key={c.category}>
                          <td className="name">{c.category}</td><td className="n">{c.units}</td><td className="n">{fmt(c.total)}</td>
                          <td className="n">{c.total > 0 ? pct((c.total - c.cost) / c.total) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="ct-grid two">
            <div className="ct-card">
              <h3>Gastos, retiros e ingresos de caja</h3>
              {d.movements.list.length === 0 ? <div className="ct-empty">No hubo movimientos de caja.</div> : (
                <div className="ct-scroll">
                  <table className="ct-tbl">
                    <thead><tr><th>Fecha</th><th>Motivo</th><th>Medio</th><th className="n">Monto</th></tr></thead>
                    <tbody>
                      {d.movements.list.map((m) => (
                        <tr key={m.id}>
                          <td>{fmtDT(m.created_at)}</td><td className="name">{m.reason}</td><td>{m.method === "cash" ? "Efectivo" : "Transf."}</td>
                          <td className="n" style={{ fontWeight: 700, color: m.type === "income" ? "#047857" : "#b45309" }}>{m.type === "income" ? "+" : "−"} {fmt(m.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="ct-card">
              <h3>Cierres de caja</h3>
              {d.sessions.length === 0 ? <div className="ct-empty">No se cerró ninguna caja en este período.</div> : (
                <div className="ct-scroll">
                  <table className="ct-tbl">
                    <thead><tr><th>Cierre</th><th>Cerró</th><th className="n">Vendido</th><th className="n">Esperado</th><th className="n">Contado</th><th className="n">Diferencia</th></tr></thead>
                    <tbody>
                      {d.sessions.map((s) => (
                        <tr key={s.id} title={s.notes || undefined}>
                          <td>{fmtDT(s.closed_at)}</td><td>{s.closed_by || "—"}</td>
                          <td className="n">{fmt(s.sales_total)}</td><td className="n">{fmt(s.expected_cash)}</td><td className="n">{fmt(s.counted_cash)}</td>
                          <td className="n" style={{ fontWeight: 700, color: s.difference === 0 ? "#047857" : s.difference > 0 ? "#b45309" : "#b42318" }}>
                            {s.difference > 0 ? "+" : ""}{fmt(s.difference)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
