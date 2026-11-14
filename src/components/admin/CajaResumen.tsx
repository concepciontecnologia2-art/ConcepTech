"use client";
// ═══════════════════════════════════════════════════════════════════
// RESUMEN DEL DÍA (dentro de Caja, solo admin)
// Lo vendido hoy vs. ayer, ventas por hora, cómo pagaron, más vendidos,
// por agotarse, últimas ventas y últimos 7 días.
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const AC = "#6366f1";
const AC_DARK = "#4f46e5";
const AC_SOFT = "rgba(99,102,241,.1)";
const CASH = "#10b981";
const TRANSFER = "#6366f1";

const fmt = (n: number) => {
  const v = n || 0;
  const dec = Number.isInteger(Math.round(v * 100) / 100) ? 0 : 2;
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
};
const fmtShort = (n: number) =>
  n >= 1000 ? "$ " + new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 }).format(n) : fmt(n);
const fmtTime = (s: string) => new Date(s).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
type Dash = {
  caja: null | {
    session: { opened_at: string; opening_amount: number };
    sales_count: number; sales_total: number; expected_cash: number; expected_transfer: number;
  };
  today: {
    today_count: number; today_total: number; today_discount: number;
    yesterday_count: number; yesterday_total: number;
    cash: number; transfer: number; units: number;
  };
  hourly: { hour: number; total: number; count: number }[];
  week: { day: string; total: number; count: number }[];
  top: { product_id: number | null; name: string; image_url: string | null; quantity: number; total: number }[];
  lowStock: { count: number; items: { id: number; name: string; stock_quantity: number; min_stock: number; image_url: string | null }[] };
  outOfStock: number;
  pendingWeb: number;
  recent: { id: number; status: string; created_at: string; total: number; units?: number; lines?: number; first_item?: string | null; methods?: string[]; price_list: string }[];
};

// ─── Íconos ──────────────────────────────────────────────────────────
const I = {
  cart: <path d="M3 3h2l2.4 12.2a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.5L22 7H6" />,
  list: <><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1" /><circle cx="3.5" cy="12" r="1" /><circle cx="3.5" cy="18" r="1" /></>,
  swap: <><path d="M7 4v16M7 20l-4-4M7 20l4-4" /><path d="M17 20V4M17 4l-4 4M17 4l4 4" /></>,
  camera: <><path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.5" /></>,
  truck: <><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 4.5a3 3 0 0 1 0 6M21 20c0-2.6-1.6-4.8-4-5.6" /></>,
  wallet: <><path d="M3 7a2 2 0 0 1 2-2h13v4" /><path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z" /><circle cx="16" cy="14.5" r="1.2" /></>,
  box: <><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>,
  globe: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
};
const Icon = ({ d, size = 18, stroke = 2 }: { d: React.ReactNode; size?: number; stroke?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

// Foto del producto (o su inicial si no tiene)
function Thumb({ src, name }: { src: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken)
    return <img src={src} alt="" className="lc-thumb" onError={() => setBroken(true)} />;
  return <span className="lc-thumb lc-thumb-ph">{(name || "?").trim().charAt(0).toUpperCase()}</span>;
}

// ─── Ventas por hora (dentro del resumen, sobre fondo violeta) ───────
function HourChart({ data }: { data: Dash["hourly"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const byHour = new Map(data.map((d) => [d.hour, d]));
  const nowH = new Date().getHours();
  const first = Math.min(9, ...data.map((d) => d.hour));
  const last = Math.max(Math.min(21, Math.max(nowH, 13)), ...data.map((d) => d.hour));
  const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const max = Math.max(1, ...data.map((d) => d.total));
  const maxH = data.reduce((m, d) => (d.total > (byHour.get(m)?.total ?? -1) ? d.hour : m), -1);
  const H = 92;

  return (
    <div className="lc-hours" onMouseLeave={() => setHover(null)}>
      <div className="lc-hours-head">
        <span>Ventas por hora</span>
        {maxH >= 0 && <span className="lc-hours-peak">Pico: {String(maxH).padStart(2, "0")}:00</span>}
      </div>
      <div style={{ position: "relative", height: H + 22 }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: H, height: 1, background: "rgba(255,255,255,.25)" }} />
        {data.length === 0 && (
          <div style={{ position: "absolute", inset: `0 0 22px 0`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "rgba(255,255,255,.75)" }}>
            Las ventas de hoy van a aparecer acá
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${hours.length}, 1fr)`, height: "100%" }}>
          {hours.map((h, i) => {
            const d = byHour.get(h);
            const bh = d ? Math.max(4, Math.round((d.total / max) * (H - 6))) : 0;
            const isNow = h === nowH;
            return (
              <div key={h} style={{ position: "relative", height: "100%" }} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
                {bh === 0 && <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: H - 2, width: 12, height: 2, borderRadius: 2, background: "rgba(255,255,255,.22)" }} />}
                <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: H - bh, width: "min(14px, 60%)", height: bh,
                              borderRadius: "4px 4px 0 0", background: "#fff", opacity: hover === null ? (isNow ? 1 : .82) : hover === i ? 1 : .45, transition: "opacity .15s" }} />
                {(i % 2 === 0 || isNow) && (
                  <div style={{ position: "absolute", left: 0, right: 0, top: H + 6, textAlign: "center", fontSize: 10, color: isNow ? "#fff" : "rgba(255,255,255,.65)", fontWeight: isNow ? 700 : 500 }}>
                    {isNow ? "Ahora" : `${h}h`}
                  </div>
                )}
                {hover === i && (
                  <div className="lc-tip" style={{ bottom: H - (H - bh) + 30 }}>
                    <div className="lc-tip-k">{String(h).padStart(2, "0")}:00 – {String(h + 1).padStart(2, "0")}:00</div>
                    <div style={{ fontWeight: 700 }}>{fmt(d?.total || 0)}</div>
                    <div className="lc-tip-k">{d?.count || 0} {(d?.count || 0) === 1 ? "venta" : "ventas"}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Últimos 7 días ──────────────────────────────────────────────────
function WeekChart({ data }: { data: Dash["week"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.total));
  const H = 120;
  const total7 = data.reduce((s, d) => s + d.total, 0);
  const label = (s: string) => {
    const d = new Date(s + "T12:00:00");
    return d.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", "");
  };
  return (
    <>
      <div className="lc-card-head">
        <div>
          <h3>Últimos 7 días</h3>
          <p>Total: <b style={{ color: "#1a1a1a" }}>{fmt(total7)}</b></p>
        </div>
      </div>
      <div style={{ position: "relative", height: H + 24 }} onMouseLeave={() => setHover(null)}>
        <div style={{ position: "absolute", left: 0, right: 0, top: H, height: 1, background: "#eaecf0" }} />
        {total7 === 0 && <div className="lc-empty-abs" style={{ bottom: 24 }}>Todavía no hay ventas esta semana</div>}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${data.length}, 1fr)`, height: "100%" }}>
          {data.map((d, i) => {
            const h = d.total > 0 ? Math.max(4, Math.round((d.total / max) * (H - 18))) : 0;
            const isToday = i === data.length - 1;
            return (
              <div key={d.day} style={{ position: "relative", height: "100%" }} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
                <div style={{ position: "absolute", inset: "0 3px 22px", borderRadius: 8, background: hover === i ? AC_SOFT : "transparent" }} />
                <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: H - h, width: "min(24px, 55%)", height: h,
                              background: AC, borderRadius: "4px 4px 0 0", opacity: hover === null || hover === i ? 1 : .5 }} />
                <div style={{ position: "absolute", left: 0, right: 0, top: H + 6, textAlign: "center", fontSize: 11, color: isToday ? "#1a1a1a" : "#98a2b3", fontWeight: isToday ? 700 : 500 }}>
                  {isToday ? "Hoy" : label(d.day)}
                </div>
                {hover === i && (
                  <div className="lc-tip dark" style={{ bottom: 32 + h }}>
                    <div className="lc-tip-k">{new Date(d.day + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short" })}</div>
                    <div style={{ fontWeight: 700 }}>{fmt(d.total)}</div>
                    <div className="lc-tip-k">{d.count} {d.count === 1 ? "venta" : "ventas"}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}


export default function CajaResumen({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<Dash | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/local/dashboard", { credentials: "include" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error al cargar");
      setData(d); setErr("");
    } catch (e: any) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  const now = new Date();
  const dateRaw = now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  const dateStr = dateRaw.charAt(0).toUpperCase() + dateRaw.slice(1);

  if (err) return <><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="lc-card" style={{ color: "#ef4444" }}>{err}</div></>;
  if (!data) return <><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="lc-skeleton" /></>;

  const t = data.today;
  const diff = t.yesterday_total > 0 ? Math.round(((t.today_total - t.yesterday_total) / t.yesterday_total) * 100) : null;
  const avg = t.today_count > 0 ? t.today_total / t.today_count : 0;
  const paid = (t.cash || 0) + (t.transfer || 0);
  const cashPct = paid > 0 ? Math.round((t.cash / paid) * 100) : 0;
  const topMax = Math.max(1, ...data.top.map((x) => x.quantity));

  // ─── Contenido de cada bloque ───
  const render = {
    hero: () => (
      <div className="lc-hero">
        <div className="lc-hero-top">
          <div>
            <p className="lc-hero-greet">Resumen del día</p>
            <p className="lc-hero-date">{dateStr}</p>
          </div>
          {data.pendingWeb > 0 && (
            <Link href="/admin/pedidos" className="lc-hero-chip">
              <Icon d={I.globe} size={14} />
              {data.pendingWeb} {data.pendingWeb === 1 ? "pedido web" : "pedidos web"} por confirmar
              <Icon d={I.arrow} size={14} />
            </Link>
          )}
        </div>
        <div className="lc-hero-body">
          <div className="lc-hero-main">
            <p className="lc-hero-k">Vendido hoy en el local</p>
            <p className="lc-hero-num">{fmt(t.today_total)}</p>
            <p className="lc-hero-cmp">
              {diff === null
                ? (t.yesterday_total === 0 ? "Ayer no hubo ventas para comparar" : "")
                : <><span className={`lc-trend ${diff >= 0 ? "up" : "down"}`}>{diff >= 0 ? "▲" : "▼"} {Math.abs(diff)}%</span> vs. ayer ({fmt(t.yesterday_total)})</>}
            </p>
            <div className="lc-hero-stats">
              <div><b>{t.today_count}</b><span>{t.today_count === 1 ? "venta" : "ventas"}</span></div>
              <div><b>{fmt(Math.round(avg))}</b><span>ticket promedio</span></div>
              <div><b>{t.units || 0}</b><span>unidades</span></div>
            </div>
          </div>
          <HourChart data={data.hourly} />
        </div>
      </div>
    ),

    cobros: () => (
      <div className="lc-card">
        <div className="lc-card-head">
          <div><h3>Cómo te pagaron hoy</h3><p>Ventas del mostrador</p></div>
          <span className="lc-card-ico" style={{ color: CASH, background: "rgba(16,185,129,.1)" }}><Icon d={I.wallet} /></span>
        </div>
        {paid === 0 ? <div className="lc-empty">Todavía no hay cobros hoy.</div> : (
          <>
            <div className="lc-split" role="img" aria-label={`Efectivo ${cashPct}%, transferencia ${100 - cashPct}%`}>
              {t.cash > 0 && <div style={{ flex: t.cash, background: CASH }} />}
              {t.transfer > 0 && <div style={{ flex: t.transfer, background: TRANSFER }} />}
            </div>
            <div className="lc-legend">
              <div>
                <span className="lc-sw" style={{ background: CASH }} />
                <span className="lc-legend-name">Efectivo</span>
                <span className="lc-legend-pct">{cashPct}%</span>
                <b>{fmt(t.cash)}</b>
              </div>
              <div>
                <span className="lc-sw" style={{ background: TRANSFER }} />
                <span className="lc-legend-name">Transferencia</span>
                <span className="lc-legend-pct">{100 - cashPct}%</span>
                <b>{fmt(t.transfer)}</b>
              </div>
            </div>
            {t.today_discount > 0 && <p className="lc-foot-note">Descuentos dados hoy: <b>{fmt(t.today_discount)}</b></p>}
          </>
        )}
      </div>
    ),

    top: () => (
      <div className="lc-card">
        <div className="lc-card-head">
          <div><h3>Más vendidos</h3><p>Últimos 7 días</p></div>
          <span className="lc-card-ico"><Icon d={I.box} /></span>
        </div>
        {data.top.length === 0 ? <div className="lc-empty">Todavía no hay ventas esta semana.</div> : data.top.map((p, i) => (
          <div key={(p.product_id ?? "x") + "-" + i} className="lc-prod">
            <span className="lc-rank">{i + 1}</span>
            <Thumb src={p.image_url} name={p.name} />
            <div className="lc-prod-info">
              <p className="lc-prod-name">{p.name}</p>
              <div className="lc-prod-bar"><div style={{ width: `${(p.quantity / topMax) * 100}%` }} /></div>
            </div>
            <span className="lc-prod-qty">{p.quantity} u.</span>
          </div>
        ))}
      </div>
    ),

    stock: () => (
      <div className="lc-card">
        <div className="lc-card-head">
          <div><h3>Por agotarse</h3><p>Quedan 3 unidades o menos</p></div>
          {data.lowStock.count > 0
            ? <span className="lc-count amber">{data.lowStock.count}</span>
            : <span className="lc-count ok">✓</span>}
        </div>
        {data.lowStock.items.length === 0 ? <div className="lc-empty">Ningún producto está por agotarse.</div> : data.lowStock.items.map((p) => (
          <div key={p.id} className="lc-prod">
            <Thumb src={p.image_url} name={p.name} />
            <div className="lc-prod-info"><p className="lc-prod-name">{p.name}</p></div>
            <span className={`lc-stock ${p.stock_quantity === 1 ? "red" : "amber"}`}>{p.stock_quantity} {p.stock_quantity === 1 ? "unidad" : "unid."}</span>
          </div>
        ))}
        {data.outOfStock > 0 && (
          <Link href="/admin/articulos" className="lc-foot-link">
            {data.outOfStock} {data.outOfStock === 1 ? "producto tiene" : "productos tienen"} stock en 0 <Icon d={I.arrow} size={13} />
          </Link>
        )}
      </div>
    ),

    ventas: () => (
      <div className="lc-card">
        <div className="lc-card-head">
          <div><h3>Últimas ventas</h3><p>Del mostrador, de todas las compus</p></div>
          <Link href="/admin/ventas?vista=ventas" className="lc-link">Ver todas <Icon d={I.arrow} size={13} /></Link>
        </div>
        {data.recent.length === 0 ? <div className="lc-empty">Todavía no hay ventas en el mostrador.</div> : (
          <div className="lc-table">
            {data.recent.map((s) => {
              const methods = s.methods || [];
              const extra = (s.lines || 0) > 1 ? ` y ${(s.lines || 0) - 1} más` : "";
              return (
                <div key={s.id} className={`lc-tr ${s.status === "voided" ? "voided" : ""}`}>
                  <span className="lc-td-time">{fmtTime(s.created_at)}</span>
                  <span className="lc-td-main">
                    <span className="lc-td-item">{s.first_item || `Venta #${s.id}`}{extra}</span>
                    <span className="lc-td-sub">
                      #{s.id} · {s.units ?? 0} u.
                      {s.price_list === "wholesale" && <span className="lc-pill violet">Mayorista</span>}
                      {s.status === "voided" && <span className="lc-pill red">Anulada</span>}
                    </span>
                  </span>
                  <span className="lc-td-pay">
                    {methods.map((m) => (
                      <span key={m} className="lc-method" style={{ color: m === "cash" ? "#047857" : AC_DARK, background: m === "cash" ? "rgba(16,185,129,.1)" : AC_SOFT }}>
                        {m === "cash" ? "Efectivo" : "Transf."}
                      </span>
                    ))}
                  </span>
                  <span className="lc-td-total">{fmt(s.total)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    ),

    semana: () => <div className="lc-card"><WeekChart data={data.week} /></div>,
  };

  return (
    <div className="lc">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lc-board">
        <div className="lc-block s-twothirds"><div className="lc-block-body">{render.hero()}</div></div>
        <div className="lc-block s-third"><div className="lc-block-body">{render.cobros()}</div></div>
        <div className="lc-block s-third"><div className="lc-block-body">{render.top()}</div></div>
        <div className="lc-block s-third"><div className="lc-block-body">{render.stock()}</div></div>
        <div className="lc-block s-third"><div className="lc-block-body">{render.semana()}</div></div>
        <div className="lc-block s-full"><div className="lc-block-body">{render.ventas()}</div></div>
      </div>
    </div>
  );
}

const CSS = `
  .lc{display:flex;flex-direction:column;gap:14px}
  .lc-card{background:#fff;border:1px solid #eaecf0;border-radius:16px;padding:16px 18px;min-width:0;box-shadow:0 1px 2px rgba(16,24,40,.04)}
  .lc-card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:14px}
  .lc-card-head h3{font-size:15px;font-weight:700;color:#101828}
  .lc-card-head p{font-size:12px;color:#98a2b3;margin-top:1px}
  .lc-card-ico{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:${AC_SOFT};color:${AC_DARK};flex-shrink:0}
  .lc-muted{font-size:13px;color:#667085}
  .lc-k{font-size:11px;font-weight:700;color:#98a2b3;text-transform:uppercase;letter-spacing:.05em}
  .lc-empty{font-size:13px;color:#98a2b3;padding:22px 0;text-align:center;background:#fafbfc;border-radius:10px}
  .lc-empty-abs{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;justify-content:center;font-size:13px;color:#98a2b3}
  .lc-skeleton{height:420px;border-radius:18px;background:linear-gradient(90deg,#eceef2 0%,#f5f6f8 50%,#eceef2 100%);background-size:200% 100%;animation:lcsk 1.2s infinite}
  @keyframes lcsk{0%{background-position:200% 0}100%{background-position:-200% 0}}

  /* ── Grilla de bloques (6 columnas en computadora) ── */
  .lc-board{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px;align-items:stretch}
  .lc-block{grid-column:span 6;display:flex;flex-direction:column;min-width:0;container-type:inline-size;position:relative}
  .lc-block-body{flex:1;display:flex;flex-direction:column;min-width:0}
  .lc-block-body > *{flex:1}
  @media(min-width:640px) and (max-width:899px){
    .lc-block.s-third,.lc-block.s-half{grid-column:span 3}
  }
  @media(min-width:900px){
    .lc-block.s-third{grid-column:span 2}
    .lc-block.s-half{grid-column:span 3}
    .lc-block.s-twothirds{grid-column:span 4}
  }

  /* ── Barra "Personalizar" y modo edición ── */
  .lc-toolbar{display:flex;justify-content:flex-end;margin-bottom:-4px}
  .lc-custom-btn{display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border-radius:9px;border:1px solid #eaecf0;background:#fff;color:#475467;font-family:inherit;font-weight:600;font-size:13px;cursor:pointer}
  .lc-custom-btn:hover{border-color:${AC};color:${AC_DARK}}
  .lc-editor{position:sticky;top:calc(var(--adm-top-h, 0px) + 8px);z-index:40;background:#101828;color:#fff;border-radius:14px;padding:14px 16px;box-shadow:0 12px 30px -10px rgba(16,24,40,.45)}
  .lc-editor-row{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}
  .lc-editor-title{font-size:15px;font-weight:800}
  .lc-editor-sub{font-size:12px;color:#c7c9d1;margin-top:2px;max-width:620px}
  .lc-editor-actions{display:flex;gap:8px;flex-wrap:wrap}
  .lc-btn.ghost-gray{background:rgba(255,255,255,.08);color:#fff;border-color:rgba(255,255,255,.2)}
  .lc-btn.ghost-gray:hover{background:rgba(255,255,255,.16)}
  .lc-hidden-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.12);font-size:12px;color:#c7c9d1}
  .lc-chip{padding:5px 11px;border-radius:999px;border:1px dashed rgba(255,255,255,.4);background:transparent;color:#fff;font-family:inherit;font-weight:600;font-size:12px;cursor:pointer}
  .lc-chip:hover{background:rgba(255,255,255,.1);border-style:solid}

  .lc-block.editing{outline:2px dashed #c7d2fe;outline-offset:4px;border-radius:18px}
  .lc-block.editing .lc-block-body{pointer-events:none;user-select:none;opacity:.92}
  .lc-block.dragging{outline-color:${AC};opacity:.9;box-shadow:0 20px 40px -12px rgba(79,70,229,.45);border-radius:18px}
  .lc-edit-bar{display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:6px 8px;background:#fff;border:1px solid #e0e7ff;border-radius:11px;box-shadow:0 1px 2px rgba(16,24,40,.05)}
  .lc-grip{width:30px;height:30px;border-radius:8px;border:1px solid #e0e7ff;background:${AC_SOFT};color:${AC_DARK};display:flex;align-items:center;justify-content:center;cursor:grab;touch-action:none;flex-shrink:0}
  .lc-grip:active{cursor:grabbing}
  .lc-edit-title{font-size:13px;font-weight:700;color:#101828;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .lc-sizes{display:flex;background:#f2f4f7;border-radius:8px;padding:2px;flex-shrink:0}
  .lc-sizes button{border:none;background:transparent;font-family:inherit;font-weight:600;font-size:11px;color:#667085;padding:4px 7px;border-radius:6px;cursor:pointer}
  .lc-sizes button.on{background:#fff;color:${AC_DARK};box-shadow:0 1px 2px rgba(16,24,40,.1)}
  .lc-hide{border:1px solid #fecdca;background:#fff;color:#b42318;font-family:inherit;font-weight:600;font-size:11px;border-radius:7px;padding:4px 8px;cursor:pointer;flex-shrink:0}
  .lc-hide:hover{background:#fef3f2}
  @media(max-width:899px){ .lc-sizes{display:none} }

  /* ── Resumen ── */
  .lc-hero{position:relative;overflow:hidden;border-radius:18px;padding:18px 20px;color:#fff;
    background:radial-gradient(120% 140% at 100% 0%,#8b5cf6 0%,rgba(139,92,246,0) 55%),linear-gradient(135deg,#4338ca 0%,#4f46e5 45%,#6366f1 100%);
    box-shadow:0 10px 30px -12px rgba(79,70,229,.55)}
  .lc-hero::after{content:"";position:absolute;right:-60px;bottom:-80px;width:240px;height:240px;border-radius:50%;background:rgba(255,255,255,.06);pointer-events:none}
  .lc-hero-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
  .lc-hero-greet{font-size:15px;font-weight:700}
  .lc-hero-date{font-size:12px;color:rgba(255,255,255,.72)}
  .lc-hero-chip{display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.25);color:#fff;font-size:12px;font-weight:600;text-decoration:none;backdrop-filter:blur(4px)}
  .lc-hero-chip:hover{background:rgba(255,255,255,.24)}
  .lc-hero-body{display:grid;grid-template-columns:minmax(0,1fr);gap:18px;margin-top:14px;position:relative;z-index:1}
  .lc-hero-k{font-size:12px;font-weight:600;color:rgba(255,255,255,.75);text-transform:uppercase;letter-spacing:.06em}
  .lc-hero-num{font-size:34px;font-weight:800;letter-spacing:-.02em;line-height:1.1;margin-top:4px;white-space:nowrap}
  .lc-hero-cmp{font-size:13px;color:rgba(255,255,255,.8);margin-top:6px;min-height:20px}
  .lc-trend{display:inline-block;font-weight:800;padding:1px 8px;border-radius:999px;margin-right:4px}
  .lc-trend.up{background:rgba(16,185,129,.25);color:#d1fae5}
  .lc-trend.down{background:rgba(239,68,68,.25);color:#fee2e2}
  .lc-hero-stats{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}
  .lc-hero-stats > div{flex:1;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:8px 12px;min-width:0}
  .lc-hero-stats b{display:block;font-size:16px;font-weight:800;white-space:nowrap}
  .lc-hero-stats span{font-size:11px;color:rgba(255,255,255,.72)}
  .lc-hours{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:12px 14px 6px;align-self:end}
  .lc-hours-head{display:flex;justify-content:space-between;font-size:12px;font-weight:600;color:rgba(255,255,255,.85);margin-bottom:8px}
  .lc-hours-peak{font-size:11px;background:rgba(255,255,255,.16);padding:1px 8px;border-radius:999px}
  /* El resumen se acomoda según el ancho que le dé el cliente */
  @container (min-width: 720px){
    .lc-hero-body{grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);align-items:end}
    .lc-hero-num{font-size:40px}
    .lc-hero-stats > div{flex:0 1 auto}
  }

  .lc-tip{position:absolute;left:50%;transform:translateX(-50%);z-index:10;background:#fff;color:#101828;border-radius:9px;padding:7px 10px;font-size:12px;white-space:nowrap;pointer-events:none;box-shadow:0 8px 20px rgba(16,24,40,.18)}
  .lc-tip.dark{background:#101828;color:#fff}
  .lc-tip-k{font-size:11px;color:#98a2b3}
  .lc-tip.dark .lc-tip-k{color:#c7c9d1}

  /* ── Caja ── */
  .lc-caja{display:flex;flex-direction:column;padding:18px}
  .lc-caja-top{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
  .lc-caja-title{font-size:15px;font-weight:700;color:#101828}
  .lc-status{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px}
  .lc-status .dot{width:7px;height:7px;border-radius:50%;background:currentColor}
  .lc-status.on{background:rgba(16,185,129,.12);color:#047857}
  .lc-status.on .dot{box-shadow:0 0 0 3px rgba(16,185,129,.2)}
  .lc-status.off{background:#f2f4f7;color:#667085}
  .lc-caja-cash{font-size:30px;font-weight:800;color:#047857;letter-spacing:-.01em;margin:2px 0 12px}
  .lc-caja-rows{display:flex;flex-direction:column;gap:7px;padding:12px 0;border-top:1px dashed #eaecf0;margin-bottom:14px}
  .lc-caja-rows div{display:flex;justify-content:space-between;font-size:13px}
  .lc-caja-closed{display:flex;gap:12px;align-items:center;margin:18px 0}
  .lc-caja-lock{width:44px;height:44px;border-radius:12px;background:#f2f4f7;color:#98a2b3;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .lc-input{flex:1;min-width:0;padding:10px 12px;border:1px solid #d0d5dd;border-radius:10px;font-size:14px;font-family:inherit;outline:none}
  .lc-input:focus{border-color:${AC};box-shadow:0 0 0 3px ${AC_SOFT}}
  .lc-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 16px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;cursor:pointer;font-family:inherit;border:1px solid transparent;white-space:nowrap;transition:background .15s,box-shadow .15s}
  .lc-btn.primary{background:${AC};color:#fff;box-shadow:0 1px 2px rgba(79,70,229,.3)}
  .lc-btn.primary:hover{background:${AC_DARK}}
  .lc-btn.ghost{background:#fff;color:#b45309;border-color:#fcd9a8}
  .lc-btn.ghost:hover{background:#fffaf2}
  .lc-btn:disabled{opacity:.6;cursor:not-allowed}

  /* ── Atajos (se acomodan según el ancho del bloque) ── */
  .lc-shortcuts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;align-content:start}
  @container (min-width: 560px){ .lc-shortcuts{grid-template-columns:repeat(3,minmax(0,1fr))} }
  @container (min-width: 1050px){
    .lc-shortcuts{grid-template-columns:repeat(3,minmax(0,1.45fr)) repeat(3,minmax(0,1fr))}
    .lc-sc.soon .lc-sc-ico{display:none}
    .lc-sc.soon{padding:12px}
  }
  .lc-sc{display:flex;align-items:center;gap:11px;padding:12px 14px;background:#fff;border:1px solid #eaecf0;border-radius:14px;text-decoration:none;color:#101828;transition:border-color .15s,box-shadow .15s,transform .15s;min-width:0}
  .lc-sc:hover{border-color:${AC};box-shadow:0 6px 16px -6px rgba(99,102,241,.35);transform:translateY(-1px)}
  .lc-sc-ico{width:38px;height:38px;border-radius:11px;background:${AC_SOFT};color:${AC_DARK};display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .lc-sc-txt{flex:1;min-width:0}
  .lc-sc-t{display:block;font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .lc-sc-d{display:block;font-size:11px;color:#98a2b3}
  .lc-sc.soon{background:#fafbfc;border-style:dashed}
  .lc-sc.soon .lc-sc-ico{background:#f2f4f7;color:#b0b5bd}
  .lc-sc.soon .lc-sc-t{color:#98a2b3;font-weight:600}
  .lc-sc.soon:hover{box-shadow:none;transform:none;border-color:#d0d5dd}
  .lc-key{font:700 11px ui-monospace,SFMono-Regular,monospace;color:#98a2b3;background:#fff;border:1px solid #eaecf0;border-bottom-width:2px;border-radius:6px;padding:1px 7px;flex-shrink:0}

  /* ── Cobros / productos ── */
  .lc-split{display:flex;gap:3px;height:14px;border-radius:7px;overflow:hidden;background:#f2f4f7}
  .lc-split > div{min-width:6px}
  .lc-split > div:first-child{border-radius:7px 0 0 7px}
  .lc-split > div:last-child{border-radius:0 7px 7px 0}
  .lc-split > div:only-child{border-radius:7px}
  .lc-legend{display:flex;flex-direction:column;gap:10px;margin-top:16px}
  .lc-legend > div{display:flex;align-items:center;gap:8px;font-size:13px}
  .lc-sw{width:10px;height:10px;border-radius:3px;flex-shrink:0}
  .lc-legend-name{color:#344054;font-weight:600}
  .lc-legend-pct{color:#98a2b3;font-size:12px}
  .lc-legend b{margin-left:auto;font-size:15px;font-weight:800;color:#101828}
  .lc-foot-note{font-size:12px;color:#667085;margin-top:14px;padding-top:12px;border-top:1px dashed #eaecf0}

  .lc-prod{display:flex;align-items:center;gap:10px;padding:7px 0}
  .lc-prod + .lc-prod{border-top:1px solid #f2f4f7}
  .lc-rank{width:16px;font-size:12px;font-weight:700;color:#98a2b3;text-align:center;flex-shrink:0}
  .lc-thumb{width:36px;height:36px;border-radius:9px;object-fit:cover;background:#f2f4f7;flex-shrink:0;border:1px solid #eaecf0}
  .lc-thumb-ph{display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:${AC_DARK};background:${AC_SOFT};border-color:transparent}
  .lc-prod-info{flex:1;min-width:0}
  .lc-prod-name{font-size:13px;font-weight:600;color:#101828;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .lc-prod-bar{height:4px;background:#f2f4f7;border-radius:4px;margin-top:6px}
  .lc-prod-bar > div{height:4px;background:${AC};border-radius:4px}
  .lc-prod-qty{font-size:13px;font-weight:800;color:#101828;white-space:nowrap}
  .lc-stock{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap}
  .lc-stock.amber{background:#fff4e5;color:#b45309}
  .lc-stock.red{background:#fee4e2;color:#b42318}
  .lc-count{min-width:28px;height:28px;padding:0 8px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800}
  .lc-count.amber{background:#fff4e5;color:#b45309}
  .lc-count.ok{background:rgba(16,185,129,.12);color:#047857}
  .lc-foot-link{display:flex;align-items:center;gap:6px;margin-top:10px;padding-top:12px;border-top:1px dashed #eaecf0;font-size:12px;font-weight:600;color:#667085;text-decoration:none}
  .lc-foot-link:hover{color:${AC_DARK}}

  /* ── Últimas ventas ── */
  .lc-link{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:${AC_DARK};text-decoration:none;white-space:nowrap}
  .lc-link:hover{text-decoration:underline}
  .lc-table{display:flex;flex-direction:column}
  .lc-tr{display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:12px;padding:10px 0;border-top:1px solid #f2f4f7}
  .lc-tr:first-child{border-top:none}
  .lc-tr.voided{opacity:.5}
  .lc-tr.voided .lc-td-total{text-decoration:line-through}
  .lc-td-time{font-size:12px;font-weight:600;color:#667085;font-variant-numeric:tabular-nums}
  .lc-td-main{min-width:0}
  .lc-td-item{display:block;font-size:13px;font-weight:600;color:#101828;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .lc-td-sub{display:block;font-size:11px;color:#98a2b3;margin-top:1px}
  .lc-td-pay{display:none;gap:4px}
  .lc-td-total{font-size:14px;font-weight:800;color:#101828;white-space:nowrap;text-align:right}
  @container (min-width: 520px){
    .lc-tr{grid-template-columns:48px minmax(0,1fr) auto auto}
    .lc-td-pay{display:flex}
  }
  .lc-method{font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px}
  .lc-pill{display:inline-block;font-size:10px;font-weight:700;padding:1px 7px;border-radius:6px;margin-left:6px}
  .lc-pill.red{background:#fee4e2;color:#b42318}
  .lc-pill.violet{background:rgba(139,92,246,.12);color:#6d28d9}
`;
