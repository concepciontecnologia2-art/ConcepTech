"use client";
import { useState, useEffect, useRef } from "react";
import { fmtPhone } from "@/lib/phone";

// ═══════════════════════════════════════════════════════════════════
// Elegir cliente al cobrar (Caja). Opcional: si no se elige, la venta
// queda como "consumidor final". También deja dar de alta uno rápido.
// ═══════════════════════════════════════════════════════════════════

export type PickedCustomer = { id: number; name: string; phone: string | null; customer_type: "retail" | "wholesale" };

const inp = { width: "100%", padding: "9px 11px", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, color: "#1a1a1a", fontSize: 13, fontFamily: "inherit", outline: "none" } as const;

async function api(url: string, opts: RequestInit = {}) {
  const res = await fetch(url, { credentials: "include", ...opts, headers: { "Content-Type": "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

export default function CustomerPicker({ value, onChange }: { value: PickedCustomer | null; onChange: (c: PickedCustomer | null) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState<PickedCustomer[]>([]);
  const [hi, setHi] = useState(0);
  const [creating, setCreating] = useState(false);
  const [nf, setNf] = useState({ name: "", phone: "", address: "", wholesale: false });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q.trim()) { setRes([]); return; }
    const t = setTimeout(() => {
      api(`/api/crm/customers?limit=8&q=${encodeURIComponent(q.trim())}`)
        .then((rows) => { setRes(rows.slice(0, 6)); setHi(0); })
        .catch(() => setRes([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  // Cerrar el desplegable al tocar afuera
  useEffect(() => {
    const h = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const pick = (c: PickedCustomer) => { onChange(c); setQ(""); setOpen(false); setCreating(false); };
  const startCreate = () => {
    const digits = q.replace(/[\s\-+()]/g, "");
    const isPhone = /^\d{6,}$/.test(digits);
    setNf({ name: isPhone ? "" : q.trim(), phone: isPhone ? q.trim() : "", address: "", wholesale: false });
    setErr(""); setCreating(true); setOpen(false);
  };
  const create = async () => {
    setBusy(true); setErr("");
    try {
      const c = await api("/api/crm/customers", {
        method: "POST",
        body: JSON.stringify({ name: nf.name, phone: nf.phone, address: nf.address, customer_type: nf.wholesale ? "wholesale" : "retail" }),
      });
      pick(c);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const onKey = (e: React.KeyboardEvent) => {
    const n = res.length + (q.trim() ? 1 : 0);
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, n - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" && q.trim()) { e.preventDefault(); if (hi < res.length) pick(res[hi]); else startCreate(); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  // ── Cliente elegido ──
  if (value) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,180,216,.35)", background: "rgba(0,180,216,.06)" }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(0,180,216,.15)", color: "#0891b2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
          {value.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {value.name}
            {value.customer_type === "wholesale" && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#4f46e5", background: "rgba(99,102,241,.1)", padding: "1px 6px", borderRadius: 5 }}>MAYORISTA</span>}
          </div>
          {value.phone && <div style={{ fontSize: 11, color: "#888" }}>{fmtPhone(value.phone)}</div>}
        </div>
        <button onClick={() => onChange(null)} title="Quitar cliente" aria-label="Quitar cliente"
          style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid #e5e7eb", background: "#fff", color: "#888", fontSize: 15, cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}>×</button>
      </div>
    );
  }

  // ── Alta rápida ──
  if (creating) {
    return (
      <div style={{ padding: 10, borderRadius: 8, border: "1px solid #e5e7eb", background: "#f8fafc", display: "grid", gap: 7 }}>
        <input value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} placeholder="Nombre y apellido" autoFocus={!nf.name} style={inp} />
        <input value={nf.phone} onChange={(e) => setNf({ ...nf, phone: e.target.value })} placeholder="Teléfono (opcional)" inputMode="tel" autoFocus={!!nf.name}
          style={inp} />
        <input value={nf.address} onChange={(e) => setNf({ ...nf, address: e.target.value })} placeholder="Dirección (opcional)"
          onKeyDown={(e) => e.key === "Enter" && nf.name.trim() && create()} style={inp} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#444", cursor: "pointer" }}>
          <input type="checkbox" checked={nf.wholesale} onChange={(e) => setNf({ ...nf, wholesale: e.target.checked })} style={{ accentColor: "#00B4D8" }} />
          Es mayorista
        </label>
        {err && <div style={{ fontSize: 12, color: "#dc2626" }}>{err}</div>}
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setCreating(false)} style={{ flex: 1, padding: "7px", borderRadius: 7, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "#444" }}>Cancelar</button>
          <button onClick={create} disabled={busy || !nf.name.trim()}
            style={{ flex: 1, padding: "7px", borderRadius: 7, border: "1px solid #00B4D8", background: "#00B4D8", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: busy || !nf.name.trim() ? .6 : 1 }}>
            {busy ? "Guardando…" : "Guardar cliente"}
          </button>
        </div>
      </div>
    );
  }

  // ── Buscador ──
  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
        placeholder="Consumidor final · buscar cliente…" style={inp} />
      {open && q.trim() && (
        <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 9, boxShadow: "0 10px 24px rgba(0,0,0,.1)", zIndex: 50, overflow: "hidden" }}>
          {res.map((c, i) => (
            <button key={c.id} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(c)} onMouseEnter={() => setHi(i)}
              style={{ display: "flex", justifyContent: "space-between", gap: 8, width: "100%", padding: "8px 11px", border: "none", borderBottom: "1px solid #f3f4f6", background: hi === i ? "rgba(0,180,216,.08)" : "#fff", textAlign: "left", cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: "#1a1a1a" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>
                {c.name}{c.customer_type === "wholesale" && <span style={{ color: "#4f46e5", fontWeight: 600, fontSize: 11 }}> · mayorista</span>}
              </span>
              <span style={{ color: "#888", fontSize: 12, flexShrink: 0 }}>{fmtPhone(c.phone)}</span>
            </button>
          ))}
          <button onMouseDown={(e) => e.preventDefault()} onClick={startCreate} onMouseEnter={() => setHi(res.length)}
            style={{ display: "block", width: "100%", padding: "9px 11px", border: "none", background: hi === res.length ? "rgba(0,180,216,.08)" : "#fff", textAlign: "left", cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: "#0891b2", fontWeight: 600 }}>
            + Nuevo cliente “{q.trim()}”
          </button>
        </div>
      )}
    </div>
  );
}
