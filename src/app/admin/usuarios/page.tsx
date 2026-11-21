"use client";
// ═══════════════════════════════════════════════════════════════════
// USUARIOS — /admin/usuarios  (solo administrador)
// Crear vendedores (o más administradores), cambiar contraseña,
// desactivar o borrar.
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAdminAccess } from "@/components/admin/session";
import PasswordInput from "@/components/PasswordInput";

type U = { id: number; username: string; display_name: string; role: "admin" | "vendedor"; active: boolean; last_login_at: string | null; created_at: string };

const api = async (url: string, opts: RequestInit = {}) => {
  const res = await fetch(url, { credentials: "include", ...opts, headers: { "Content-Type": "application/json" } });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || `Error ${res.status}`);
  return d;
};
const ago = (s: string | null) => {
  if (!s) return "Nunca entró";
  const d = new Date(s);
  return "Último ingreso: " + d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
};

const CSS = `
  .us{max-width:860px}
  .us-card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden}
  .us-row{display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid #f3f4f6;flex-wrap:wrap}
  .us-row:last-child{border-bottom:none}
  .us-av{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;flex-shrink:0}
  .us-main{flex:1;min-width:160px}
  .us-name{font-size:14px;font-weight:700}
  .us-sub{font-size:12px;color:#888;margin-top:1px}
  .us-pill{font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px}
  .us-btn{padding:6px 11px;border-radius:8px;border:1px solid #e5e7eb;background:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;color:#444}
  .us-btn:hover{background:#f9fafb}
  .us-btn.red{color:#dc2626;border-color:rgba(239,68,68,.3)}
  .us-btn.primary{background:#00B4D8;border-color:#00B4D8;color:#fff;padding:9px 16px;font-size:13px}
  .us-in{width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;font-family:inherit;outline:none}
  .us-in:focus{border-color:#00B4D8;box-shadow:0 0 0 3px rgba(0,180,216,.12)}
  .us-lbl{font-size:11px;color:#444;display:block;margin-bottom:5px;font-weight:600}
  .us-seg{flex:1;padding:10px 8px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid #e5e7eb;background:#fff;color:#666;font-family:inherit;text-align:left}
  .us-seg.on{border-color:rgba(0,180,216,.5);background:rgba(0,180,216,.1);color:#0891b2}
  .us-seg small{display:block;font-weight:500;color:#888;font-size:11px;margin-top:2px}
  .us-mo{position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;font-family:'DM Sans',system-ui,sans-serif}
  .us-mb{background:#fff;border-radius:18px;padding:24px;width:100%;max-width:440px;max-height:92vh;overflow-y:auto;color:#1a1a1a}
  .us-err{padding:9px 12px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);border-radius:8px;font-size:13px;color:#dc2626}
`;

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return createPortal(
    <div className="us-mo" onClick={onClose}><div className="us-mb" onClick={(e) => e.stopPropagation()}>{children}</div></div>,
    document.body
  );
}

function UserForm({ initial, onClose, onSaved }: { initial: U | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ username: initial?.username || "", display_name: initial?.display_name || "", password: "", role: initial?.role || "vendedor" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true); setErr("");
    try {
      if (initial) {
        const body: any = { display_name: f.display_name, role: f.role };
        if (f.password) body.password = f.password;
        await api(`/api/users/${initial.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await api("/api/users", { method: "POST", body: JSON.stringify(f) });
      }
      onSaved();
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };

  return (
    <Modal onClose={onClose}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{initial ? `Editar a ${initial.display_name}` : "Nuevo usuario"}</h2>
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <label className="us-lbl">NOMBRE (sale en el ticket como "Atendió")</label>
          <input className="us-in" value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} autoFocus placeholder="Ej: Juan" />
        </div>
        <div>
          <label className="us-lbl">USUARIO PARA ENTRAR</label>
          <input className="us-in" value={f.username} disabled={!!initial} autoCapitalize="none"
            onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, "") })} placeholder="Ej: juan" />
        </div>
        <div>
          <label className="us-lbl">{initial ? "NUEVA CONTRASEÑA (dejala vacía para no cambiarla)" : "CONTRASEÑA (mínimo 6 caracteres)"}</label>
          <PasswordInput className="us-in" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </div>
        <div>
          <label className="us-lbl">PERMISOS</label>
          <div style={{ display: "flex", gap: 6 }}>
            <button className={`us-seg ${f.role === "vendedor" ? "on" : ""}`} onClick={() => setF({ ...f, role: "vendedor" })}>
              Vendedor<small>Vende y consulta artículos, clientes y proveedores</small>
            </button>
            <button className={`us-seg ${f.role === "admin" ? "on" : ""}`} onClick={() => setF({ ...f, role: "admin" })}>
              Administrador<small>Además modifica artículos y maneja la tienda web (no entra a Caja ni Contabilidad)</small>
            </button>
          </div>
        </div>
        {err && <div className="us-err">{err}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="us-btn" onClick={onClose}>Cancelar</button>
          <button className="us-btn primary" onClick={save} disabled={busy} style={{ opacity: busy ? .6 : 1 }}>{busy ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>
    </Modal>
  );
}

export default function UsuariosPage() {
  const me = useAdminAccess()?.admin; // el administrador que desbloqueó
  const [users, setUsers] = useState<U[] | null>(null);
  const [mainAdmin, setMainAdmin] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<U | null | "new">(null);

  const load = useCallback(() => {
    api("/api/users").then((d) => { setUsers(d.users); setMainAdmin(d.mainAdmin); setErr(""); }).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (u: U) => {
    if (u.active && !confirm(`¿Desactivar a ${u.display_name}? No va a poder entrar más al sistema.`)) return;
    try { await api(`/api/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ active: !u.active }) }); load(); }
    catch (e: any) { alert(e.message); }
  };
  const remove = async (u: U) => {
    if (!confirm(`¿Borrar el usuario ${u.username}? Sus ventas quedan registradas con su nombre.`)) return;
    try { await api(`/api/users/${u.id}`, { method: "DELETE" }); load(); }
    catch (e: any) { alert(e.message); }
  };

  return (
    <div className="us">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Usuarios</h1>
          <p style={{ fontSize: 13, color: "#888", marginTop: 2 }}>Cada persona entra con su usuario. Caja, Contabilidad y Usuarios son solo del dueño, con su usuario y contraseña propios. Modificar artículos y la Tienda web piden la clave de un administrador.</p>
        </div>
        <button className="us-btn primary" onClick={() => setEditing("new")}>+ Nuevo usuario</button>
      </div>

      {err && <div className="us-err" style={{ marginBottom: 12 }}>{err}</div>}

      <div className="us-card">
        {mainAdmin && (
          <div className="us-row">
            <div className="us-av" style={{ background: "rgba(0,180,216,.12)", color: "#0891b2" }}>★</div>
            <div className="us-main">
              <div className="us-name">Administrador principal <span style={{ fontWeight: 500, color: "#888" }}>· {mainAdmin}</span></div>
              <div className="us-sub">Ingreso al sistema. Se configura en Vercel (ADMIN_USERNAME / ADMIN_PASSWORD_HASH). La clave del dueño para Caja, Contabilidad y Usuarios es aparte (OWNER_USERNAME / OWNER_PASSWORD_HASH).</div>
            </div>
            <span className="us-pill" style={{ background: "rgba(0,180,216,.12)", color: "#0891b2" }}>Administrador</span>
          </div>
        )}
        {users === null && !err && <div className="us-row" style={{ color: "#999", fontSize: 13 }}>Cargando…</div>}
        {users?.length === 0 && <div className="us-row" style={{ color: "#999", fontSize: 13 }}>Todavía no hay otros usuarios. Creá uno para cada vendedor.</div>}
        {users?.map((u) => (
          <div key={u.id} className="us-row" style={{ opacity: u.active ? 1 : .55 }}>
            <div className="us-av" style={u.role === "admin" ? { background: "rgba(0,180,216,.12)", color: "#0891b2" } : { background: "rgba(124,58,237,.1)", color: "#7c3aed" }}>
              {u.display_name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
            </div>
            <div className="us-main">
              <div className="us-name">{u.display_name} <span style={{ fontWeight: 500, color: "#888" }}>· {u.username}</span></div>
              <div className="us-sub">{u.active ? ago(u.last_login_at) : "Desactivado"}</div>
            </div>
            <span className="us-pill" style={u.role === "admin" ? { background: "rgba(0,180,216,.12)", color: "#0891b2" } : { background: "rgba(124,58,237,.1)", color: "#7c3aed" }}>
              {u.role === "admin" ? "Administrador" : "Vendedor"}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="us-btn" onClick={() => setEditing(u)}>Editar</button>
              {me?.username !== u.username && <button className="us-btn" onClick={() => toggle(u)}>{u.active ? "Desactivar" : "Activar"}</button>}
              {me?.username !== u.username && <button className="us-btn red" onClick={() => remove(u)}>Borrar</button>}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <UserForm initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}
