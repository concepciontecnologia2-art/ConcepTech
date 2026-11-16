"use client";
// ═══════════════════════════════════════════════════════════════════
// LAYOUT DEL PANEL
// • Inicio (/admin): solo los botones de las secciones, nada más.
// • Arriba, fijo: marca · secciones con ícono · usuario y Salir.
// • Caja, Contabilidad, Tienda web, Compras y Usuarios piden usuario y contraseña
//   de un ADMINISTRADOR para entrar (aunque la compu ya tenga sesión). Al salir de
//   esas secciones se vuelve a bloquear solo. Lo controla también el servidor.
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { visibleSections, sectionOf, keepsAdmin } from "@/lib/sections";
import { AdminUserContext, SectionIcon, AdminUnlock, type AdminUser, type AdminAccess } from "@/components/admin/session";

type Badges = { pendingOrders: number; sinFoto: number; lowStock: number; cajaAbierta: boolean; toReorder?: number };

// Pestañas internas de algunas secciones
const SUBNAV: Record<string, { href: string; label: string; badge?: (b: Badges) => number | null }[]> = {
  "/admin/pedidos": [
    { href: "/admin/pedidos", label: "Pedidos web", badge: (b) => b.pendingOrders || null },
    { href: "/admin/resumen", label: "Resumen de la tienda" },
  ],
  "/admin/proveedores": [
    { href: "/admin/proveedores", label: "Proveedores" },
    { href: "/admin/reposicion", label: "Pedidos a proveedores", badge: (b) => b.toReorder || null },
    { href: "/admin/pedido-saphirus", label: "Pedido Saphirus 🔒" },
  ],
  "/admin/articulos": [
    { href: "/admin/articulos", label: "Artículos" },
    { href: "/admin/sin-foto", label: "Sin foto", badge: (b) => b.sinFoto || null },
  ],
};

const BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  /* globals.css pone overflow-x:hidden en html/body y eso rompe la barra fija; clip corta igual sin romperla */
  html,body{overflow-x:clip !important}
  ::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:#f3f4f6}::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:4px}
  .adm{min-height:100vh;background:#f2f4f7;color:#1a1a1a;font-family:'DM Sans',system-ui,sans-serif;font-variant-numeric:tabular-nums}
  .adm-wrap{max-width:1340px;margin:0 auto;padding:0 16px}

  .adm-top{position:sticky;top:0;z-index:60;box-shadow:0 2px 8px rgba(0,0,0,.05)}
  .adm-head{background:#fff;border-bottom:1px solid #eef0f3}
  .adm-head .adm-wrap{display:flex;align-items:center;justify-content:space-between;gap:10px;height:58px}
  .adm-brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:inherit;min-width:0}
  .adm-logo{width:32px;height:32px;border-radius:9px;background:rgba(0,180,216,.1);border:1px solid rgba(0,180,216,.3);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#00B4D8;flex-shrink:0}
  .adm-sub{font-size:12px;color:#9ca3af;font-weight:500}
  .adm-user{display:flex;align-items:center;gap:10px;flex-shrink:0}
  .adm-who{display:flex;flex-direction:column;align-items:flex-end;line-height:1.15}
  .adm-who b{font-size:13px;font-weight:700}
  .adm-role{font-size:11px;font-weight:700;color:#6b7280}
  .adm-role.admin{color:#0891b2}
  .adm-out{padding:7px 14px;border-radius:8px;background:#f3f4f6;border:1px solid #e5e7eb;color:#444;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
  .adm-out:hover{background:#e9ebee}

  /* ── Barra de secciones ── */
  .adm-nav{background:#fff;border-bottom:1px solid #e5e7eb}
  .adm-tabs{display:flex;align-items:stretch;overflow-x:auto;scrollbar-width:none;gap:2px}
  .adm-tabs::-webkit-scrollbar{display:none}
  .adm-tab{padding:11px 12px 9px;border-bottom:2px solid transparent;color:#555;font-size:14px;font-weight:500;white-space:nowrap;display:flex;align-items:center;gap:7px;text-decoration:none;transition:color .15s,border-color .15s}
  .adm-tab:hover{color:#1a1a1a}
  .adm-tab .ico{color:#9ca3af;display:flex}
  .adm-tab.active{color:#0e7490;border-bottom-color:#00B4D8;font-weight:700}
  .adm-tab.active .ico{color:#00B4D8}
  .adm-tab.soon{color:#a3a9b3}
  .adm-home{padding:11px 10px 9px}

  .adm-subnav{background:#fafbfc;border-bottom:1px solid #eef0f3}
  .adm-subnav .adm-wrap{display:flex;gap:6px;padding-top:7px;padding-bottom:7px;overflow-x:auto}
  .adm-sub-tab{padding:6px 12px;border-radius:8px;font-size:13px;font-weight:600;color:#666;text-decoration:none;white-space:nowrap;display:flex;align-items:center;gap:6px}
  .adm-sub-tab:hover{background:#f0f2f5}
  .adm-sub-tab.active{background:rgba(0,180,216,.1);color:#0891b2}

  .adm-lock{display:flex;color:#b0b6c0;margin-left:-2px}
  .adm-mode{display:flex;align-items:center;gap:8px;padding:5px 6px 5px 11px;border-radius:999px;background:rgba(0,180,216,.1);border:1px solid rgba(0,180,216,.35);color:#0e7490;font-size:12px;font-weight:700;white-space:nowrap}
  .adm-mode button{border:none;background:#fff;color:#0e7490;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
  .adm-mode button:hover{background:#ecfeff}
  @media(max-width:640px){ .adm-mode .txt{display:none} }
  .adm-badge{border-radius:20px;padding:1px 7px;font-size:10px;font-weight:700;line-height:16px;background:#f59e0b;color:#fff}
  .adm-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,.18)}

  .adm-main{padding-top:16px;padding-bottom:48px}
  .adm-main .admin-inner,.adm-main .caja{max-width:none}

  @media(min-width:768px){
    .adm-wrap{padding:0 28px}
    .adm-head .adm-wrap{height:62px}
    .adm-main{padding-top:24px;padding-bottom:60px}
  }
  @media(max-width:767px){
    .adm-brand-txt{display:none}
    .adm-tab{padding:10px 10px 8px;font-size:13px}
  }
  @media(max-width:479px){ .adm-who{display:none} }
`;

function Login({ onLogin }: { onLogin: (u: AdminUser) => void }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (!user || !pass) return;
    setLoading(true); setErr("");
    const res = await fetch("/api/auth/login", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password: pass }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.user) onLogin(d.user);
    else {
      // 401 = datos mal · 429 = demasiados intentos · otro = problema del servidor (se muestra tal cual)
      setErr(res.status === 401 ? "Usuario o contraseña incorrectos" : d.error || `No se pudo ingresar (error ${res.status})`);
      setLoading(false);
    }
  };

  const field = { width: "100%", padding: "12px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 9, color: "#1a1a1a", fontSize: 14, fontFamily: "inherit", outline: "none" };

  return (
    <div style={{ minHeight: "100vh", background: "#f2f4f7", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',system-ui,sans-serif", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 54, height: 54, background: "rgba(0,180,216,.1)", border: "1px solid rgba(0,180,216,.3)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 18, fontWeight: 800, color: "#00B4D8" }}>CT</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a" }}><span style={{ color: "#00B4D8" }}>Concepción</span> Tecnología</h1>
          <p style={{ color: "#666", fontSize: 13, marginTop: 4 }}>Sistema de gestión. Ingresá con tu usuario.</p>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 26, boxShadow: "0 2px 10px rgba(0,0,0,.04)" }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: "#444", display: "block", marginBottom: 5, fontWeight: 600 }}>USUARIO</label>
            <input type="text" value={user} onChange={(e) => setUser(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} autoFocus autoCapitalize="none" autoComplete="username" style={field} />
          </div>
          <div style={{ marginBottom: err ? 10 : 16 }}>
            <label style={{ fontSize: 11, color: "#444", display: "block", marginBottom: 5, fontWeight: 600 }}>CONTRASEÑA</label>
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} autoComplete="current-password" style={field} />
          </div>
          {err && <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 12 }}>{err}</p>}
          <button onClick={login} disabled={loading || !user || !pass}
            style={{ width: "100%", padding: 12, background: "#00B4D8", border: "none", borderRadius: 9, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: loading || !user || !pass ? 0.6 : 1 }}>
            {loading ? "Verificando..." : "Ingresar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<AdminUser | null | undefined>(undefined); // undefined = cargando
  const [admin, setAdmin] = useState<AdminAccess | null>(null);
  const [badges, setBadges] = useState<Badges>({ pendingOrders: 0, sinFoto: 0, lowStock: 0, cajaAbierta: false });

  useEffect(() => {
    fetch("/api/auth/check", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setUser(d.ok && d.user ? d.user : null); setAdmin(d.admin || null); })
      .catch(() => setUser(null));
  }, []);

  // Manifest propio del admin (para instalarlo como app en el celular)
  useEffect(() => {
    const link = document.querySelector("link[rel='manifest']");
    if (link) link.setAttribute("href", "/manifest-admin.json");
    return () => { if (link) link.setAttribute("href", "/manifest.json"); };
  }, []);

  // Contadores: se actualizan al cambiar de sección
  const loadBadges = useCallback(() => {
    fetch("/api/admin/badges", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setBadges(d))
      .catch(() => {});
  }, []);
  useEffect(() => { if (user) loadBadges(); }, [user, pathname, loadBadges]);
  useEffect(() => {
    window.addEventListener("admin:refresh-badges", loadBadges);
    return () => window.removeEventListener("admin:refresh-badges", loadBadges);
  }, [loadBadges]);

  // Pantallas angostas: deja visible la pestaña de la sección actual
  useEffect(() => {
    document.querySelector(".adm-tab.active")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [pathname, user]);

  // Alto del bloque fijo → variable CSS --adm-top-h (la usan Ventas y Caja)
  const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = topRef.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--adm-top-h", `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, [user, pathname]);

  // Bloquear el acceso de administrador
  const lock = useCallback(() => {
    setAdmin(null);
    fetch("/api/auth/admin", { method: "DELETE", credentials: "include" }).catch(() => {});
  }, []);

  // Al salir de Caja / Contabilidad / Artículos / etc. se bloquea solo
  const prevPath = useRef<string | null>(null);
  useEffect(() => {
    if (prevPath.current && keepsAdmin(prevPath.current) && !keepsAdmin(pathname) && admin) lock();
    prevPath.current = pathname;
  }, [pathname, admin, lock]);

  // Vencimiento (30 min)
  useEffect(() => {
    if (!admin) return;
    const t = setInterval(() => { if (Date.now() >= admin.expiresAt) setAdmin(null); }, 15000);
    return () => clearInterval(t);
  }, [admin]);

  const logout = async () => {
    await fetch("/api/auth/login", { method: "DELETE", credentials: "include" });
    setUser(null); setAdmin(null);
    window.history.replaceState(null, "", "/admin");
  };

  const style = <style dangerouslySetInnerHTML={{ __html: BASE_CSS }} />;

  if (user === undefined)
    return <div style={{ minHeight: "100vh", background: "#f2f4f7", display: "flex", alignItems: "center", justifyContent: "center", color: "#444", fontFamily: "sans-serif" }}>Cargando...</div>;
  if (!user) return <>{style}<Login onLogin={(u) => { setUser(u); setAdmin(null); }} /></>;

  const isHome = pathname === "/admin";
  const sections = visibleSections(user.role);
  const current = sectionOf(pathname);
  // Secciones que piden la clave de administrador (Sin foto es parte de modificar artículos)
  const needsAdmin = !!current?.adminOnly || !!pathname?.startsWith("/admin/sin-foto");
  const isSaphirus = !!pathname?.startsWith("/admin/pedido-saphirus");
  const needsOwner = !!current?.owner || isSaphirus;  // Caja, Contabilidad, Usuarios y Pedido Saphirus: solo el dueño
  const blocked = needsOwner ? !admin?.owner : needsAdmin && !admin;
  // Pestañas internas: las de Proveedores las ve cualquiera; las de Tienda web y Artículos, con acceso de administrador
  const sub = current ? (current.href === "/admin/proveedores" || admin ? SUBNAV[current.href] : undefined) : undefined;

  return (
    <AdminUserContext.Provider value={{ user, admin, setAdmin, lock }}>
      <div className="adm">
        {style}

        <div className="adm-top" ref={topRef}>
          <header className="adm-head">
            <div className="adm-wrap">
              <Link href="/admin" className="adm-brand" title="Inicio">
                <div className="adm-logo">CT</div>
                <div className="adm-brand-txt">
                  <p style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.1 }}><span style={{ color: "#00B4D8" }}>Concepción</span> Tecnología</p>
                  <p className="adm-sub">Sistema de gestión</p>
                </div>
              </Link>
              <div className="adm-user">
                {admin && (
                  <div className="adm-mode" title={`Acceso de administrador: ${admin.name}`}>
                    <SectionIcon name="lock" size={13} />
                    <span className="txt">{admin.owner ? "Modo dueño" : "Modo administrador"}</span>
                    <button onClick={lock}>Bloquear</button>
                  </div>
                )}
                <div className="adm-who">
                  <b>{user.name}</b>
                  <span className={`adm-role ${user.role}`}>{user.role === "admin" ? "Administrador" : "Vendedor"}</span>
                </div>
                <button onClick={logout} className="adm-out">Salir</button>
              </div>
            </div>
          </header>

          {/* En el inicio no hay barra: las secciones están en pantalla */}
          {!isHome && (
            <nav className="adm-nav" aria-label="Secciones">
              <div className="adm-wrap adm-tabs">
                <Link href="/admin" className="adm-tab adm-home" title="Inicio"><span className="ico"><SectionIcon name="home" size={17} /></span></Link>
                {sections.map((s) => {
                  const active = current?.href === s.href;
                  return (
                    <Link key={s.href} href={s.href} className={`adm-tab ${active ? "active" : ""} ${s.soon ? "soon" : ""}`}>
                      <span className="ico"><SectionIcon name={s.icon} size={17} /></span>
                      {s.label}
                      {s.adminOnly && !(s.owner ? admin?.owner : admin) && (
                        <span className="adm-lock" title={s.owner ? "Solo el dueño" : "Pide clave de administrador"}><SectionIcon name="lock" size={12} /></span>
                      )}
                      {s.href === "/admin/caja" && badges.cajaAbierta && <span className="adm-dot" title="Caja abierta" />}
                      {s.href === "/admin/pedidos" && badges.pendingOrders > 0 && <span className="adm-badge">{badges.pendingOrders}</span>}
                      {s.href === "/admin/proveedores" && (badges.toReorder ?? 0) > 0 && <span className="adm-badge" style={{ background: "#25D366" }} title="Proveedores con pedido para enviar">{badges.toReorder}</span>}
                    </Link>
                  );
                })}
              </div>
            </nav>
          )}

          {sub && !blocked && (
            <div className="adm-subnav">
              <div className="adm-wrap">
                {sub.map((t) => {
                  const v = t.badge?.(badges);
                  return (
                    <Link key={t.href} href={t.href} className={`adm-sub-tab ${pathname?.startsWith(t.href) ? "active" : ""}`}>
                      {t.label}{v ? <span className="adm-badge" style={{ background: "#e5e7eb", color: "#444" }}>{v}</span> : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <main className="adm-wrap adm-main">
          {blocked
            ? <AdminUnlock key={pathname} ownerOnly={needsOwner} section={pathname?.startsWith("/admin/sin-foto") ? "Artículos sin foto" : isSaphirus ? "Pedido Saphirus" : current!.label} />
            : children}
        </main>
      </div>
    </AdminUserContext.Provider>
  );
}