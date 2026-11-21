"use client";
// ═══════════════════════════════════════════════════════════════════
// SESIÓN DEL PANEL
// • user  → quién inició sesión en esta compu (admin o vendedor)
// • admin → acceso de administrador desbloqueado (Caja, Contabilidad,
//           modificar artículos, Tienda web, Usuarios). Se pide usuario y
//           contraseña de un administrador y se bloquea solo al salir.
// Lo carga src/app/admin/layout.tsx
// ═══════════════════════════════════════════════════════════════════
import { createContext, useContext, useState } from "react";
import { ICONS, type Role } from "@/lib/sections";
import PasswordInput from "@/components/PasswordInput";

export type AdminUser = { name: string; role: Role; username?: string };
export type AdminAccess = { name: string; username: string; owner: boolean; expiresAt: number };

type Ctx = {
  user: AdminUser;
  admin: AdminAccess | null;
  setAdmin: (a: AdminAccess | null) => void;
  lock: () => void;
};

export const AdminUserContext = createContext<Ctx | null>(null);

export const useAdminUser = () => useContext(AdminUserContext)?.user ?? null;
/** ¿Está desbloqueado el acceso de administrador? */
export const useIsAdmin = () => !!useContext(AdminUserContext)?.admin;
export const useAdminAccess = () => useContext(AdminUserContext);

export function SectionIcon({ name, size = 20, stroke = 1.9 }: { name: keyof typeof ICONS; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

/** Pide usuario y contraseña de administrador para entrar a una sección protegida */
export function AdminUnlock({ section, onCancel, ownerOnly }: { section: string; onCancel?: () => void; ownerOnly?: boolean }) {
  const ctx = useAdminAccess();
  // Para las secciones del dueño no se sugiere ningún usuario
  const prefill = !ownerOnly && ctx?.user.role === "admin" ? ctx.user.username || "" : "";
  const [username, setUsername] = useState(prefill);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (!username || !password) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/auth/admin", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, scope: ownerOnly ? "owner" : undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `Error ${res.status}`);
      // Vuelve a leer el vencimiento real que puso el servidor
      const chk = await fetch("/api/auth/admin", { credentials: "include" }).then((r) => r.json()).catch(() => null);
      ctx?.setAdmin(chk?.admin || d.admin);
    } catch (e: any) {
      setErr(e.message);
      setPassword("");
      setBusy(false);
    }
  };

  const field = { width: "100%", padding: "11px 13px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 9, color: "#1a1a1a", fontSize: 14, fontFamily: "inherit", outline: "none" } as const;

  return (
    <div style={{ maxWidth: 380, margin: "36px auto", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 18, padding: 26, boxShadow: "0 6px 24px -12px rgba(0,0,0,.15)" }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(0,180,216,.1)", color: "#0891b2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
        <SectionIcon name="lock" size={22} />
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 800, textAlign: "center" }}>{ownerOnly ? "Acceso del dueño" : "Acceso de administrador"}</h2>
      <p style={{ fontSize: 13, color: "#666", textAlign: "center", marginTop: 4, marginBottom: 18 }}>
        {ownerOnly
          ? <><b>{section}</b> es solo para el dueño. Ingresá tu usuario y contraseña.</>
          : <>Para entrar a <b>{section}</b> ingresá un usuario administrador.</>}
      </p>
      <div style={{ display: "grid", gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, color: "#444", display: "block", marginBottom: 5, fontWeight: 600 }}>USUARIO</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()}
            autoFocus={!prefill} autoCapitalize="none" autoComplete="off" style={field} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "#444", display: "block", marginBottom: 5, fontWeight: 600 }}>CONTRASEÑA</label>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()}
            autoFocus={!!prefill} autoComplete="off" style={field} />
        </div>
        {err && <p style={{ color: "#ef4444", fontSize: 12 }}>{err}</p>}
        <button onClick={go} disabled={busy || !username || !password}
          style={{ padding: 12, background: "#00B4D8", border: "none", borderRadius: 9, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: busy || !username || !password ? .6 : 1 }}>
          {busy ? "Verificando…" : "Entrar"}
        </button>
        {onCancel && (
          <button onClick={onCancel} style={{ padding: 10, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 9, color: "#444", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Cancelar
          </button>
        )}
        <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center" }}>Se vuelve a bloquear sola al salir de esta sección.</p>
      </div>
    </div>
  );
}
