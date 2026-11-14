"use client";
// ═══════════════════════════════════════════════════════════════════
// INICIO DEL PANEL — /admin
// Solo los botones de las secciones (cada usuario ve las suyas).
// Teclas 1 a 9 para entrar directo (según el orden en pantalla).
// ═══════════════════════════════════════════════════════════════════
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { visibleSections } from "@/lib/sections";
import { useAdminUser, SectionIcon } from "@/components/admin/session";

const CSS = `
  .home{max-width:1040px;margin:0 auto;padding-top:8px}
  .home-hi{font-size:14px;color:#6b7280;margin-bottom:16px}
  .home-hi b{color:#1a1a1a}
  .home-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .tile{position:relative;display:flex;flex-direction:column;gap:14px;padding:18px;background:#fff;border:1px solid #e5e7eb;border-radius:16px;text-decoration:none;color:#1a1a1a;min-height:138px;
        transition:border-color .15s,box-shadow .15s,transform .15s}
  .tile:hover{border-color:var(--c);box-shadow:0 10px 24px -12px var(--c);transform:translateY(-2px)}
  .tile:focus-visible{outline:3px solid var(--c);outline-offset:2px}
  .tile-ico{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;color:var(--c);background:color-mix(in srgb, var(--c) 12%, white)}
  .tile-t{font-size:17px;font-weight:800;letter-spacing:-.01em}
  .tile-d{font-size:12px;color:#8a919c;margin-top:2px}
  .tile-k{position:absolute;top:14px;right:14px;font:700 11px ui-monospace,SFMono-Regular,monospace;color:#9ca3af;border:1px solid #e5e7eb;border-bottom-width:2px;border-radius:6px;padding:1px 7px;background:#fff}
  .tile.soon{background:#fafbfc;border-style:dashed}
  .tile.soon .tile-t{color:#8a919c}
  .tile-soon{font-size:10px;font-weight:700;color:#9ca3af;background:#f0f2f5;border-radius:6px;padding:2px 7px;align-self:flex-start;margin-top:4px}
  @media(min-width:640px){ .home-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:14px} .tile{min-height:156px;padding:20px} }
  @media(min-width:1100px){ .home-grid{grid-template-columns:repeat(3,minmax(0,1fr))} }
  @media(max-width:379px){ .home-grid{grid-template-columns:minmax(0,1fr)} .tile{min-height:0;flex-direction:row;align-items:center} .tile-k{top:50%;transform:translateY(-50%)} }
`;

export default function AdminHome() {
  const user = useAdminUser();
  const router = useRouter();
  const sections = visibleSections(user?.role);

  // Teclas 1 a 9
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || ["INPUT", "TEXTAREA", "SELECT"].includes(el?.tagName)) return;
      const n = Number(e.key);
      const s = Number.isInteger(n) && n >= 1 ? sections[n - 1] : undefined;
      if (s) { e.preventDefault(); router.push(s.href); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [sections, router]);

  const hour = new Date().getHours();
  const greet = hour < 13 ? "Buen día" : hour < 20 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="home">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <p className="home-hi">{greet}, <b>{user?.name}</b></p>
      <div className="home-grid">
        {sections.map((s, i) => (
          <Link key={s.href} href={s.href} className={`tile ${s.soon ? "soon" : ""}`} style={{ ["--c" as string]: s.color } as React.CSSProperties}>
            <span className="tile-ico"><SectionIcon name={s.icon} size={24} /></span>
            <span>
              <span className="tile-t" style={{ display: "block" }}>{s.label}</span>
              <span className="tile-d" style={{ display: "block" }}>{s.desc}</span>
              {s.soon && <span className="tile-soon">Próximamente</span>}
              {s.adminOnly && !s.soon && <span className="tile-soon" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><SectionIcon name="lock" size={11} /> {s.owner ? "Solo el dueño" : "Administrador"}</span>}
            </span>
            <kbd className="tile-k">{i + 1}</kbd>
          </Link>
        ))}
      </div>
    </div>
  );
}
