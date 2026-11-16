// ═══════════════════════════════════════════════════════════════════
// SECCIONES DEL SISTEMA
// Las usan el menú de arriba y la pantalla de inicio (/admin).
// adminOnly → para entrar se pide usuario y contraseña de un administrador
//             (aunque la compu ya tenga una sesión abierta).
// owner     → solo el DUEÑO, con su usuario y contraseña únicos (Caja, Contabilidad, Usuarios).
// ═══════════════════════════════════════════════════════════════════

export type Role = "admin" | "vendedor";

export type Section = {
  href: string;
  label: string;
  desc: string;
  icon: keyof typeof ICONS;
  color: string;        // color del ícono
  adminOnly?: boolean;
  owner?: boolean;
  soon?: boolean;
  match?: string[];     // otras rutas que pertenecen a esta sección
};

export const SECTIONS: Section[] = [
  { href: "/admin/ventas", label: "Ventas", desc: "Vender y cobrar", icon: "cart", color: "#0891b2" },
  { href: "/admin/caja", label: "Caja", desc: "Abrir, cerrar y resumen del día", icon: "register", color: "#059669", adminOnly: true, owner: true },
  { href: "/admin/articulos", label: "Artículos", desc: "Precios, stock y fotos", icon: "box", color: "#d97706", match: ["/admin/productos", "/admin/sin-foto"] },
  { href: "/admin/clientes", label: "Clientes", desc: "Fichas e historial", icon: "users", color: "#7c3aed" },
  { href: "/admin/proveedores", label: "Proveedores", desc: "Contactos y pedidos por WhatsApp", icon: "truck", color: "#4f46e5", match: ["/admin/reposicion", "/admin/pedido-saphirus"] },
  { href: "/admin/contabilidad", label: "Contabilidad", desc: "Ganancias, gastos y cierres", icon: "chart", color: "#db2777", adminOnly: true, owner: true },
  { href: "/admin/pedidos", label: "Tienda web", desc: "Pedidos de la página", icon: "globe", color: "#0284c7", adminOnly: true, match: ["/admin/resumen"] },
  { href: "/admin/compras", label: "Compras", desc: "Cargar facturas por foto", icon: "camera", color: "#0d9488", adminOnly: true, match: ["/admin/carga-stock"] },
  { href: "/admin/usuarios", label: "Usuarios", desc: "Vendedores y permisos", icon: "lock", color: "#475569", adminOnly: true, owner: true },
];

// Todos ven todas las secciones; las de administrador muestran un candado
export const visibleSections = (_role?: Role | null) => SECTIONS;

/** Rutas donde el acceso de administrador sigue activo (al salir de ellas se bloquea) */
export const keepsAdmin = (path: string | null | undefined) =>
  !!path && (!!sectionOf(path)?.adminOnly || path.startsWith("/admin/articulos") || path.startsWith("/admin/sin-foto") || path.startsWith("/admin/pedido-saphirus"));

export const sectionOf = (path: string | null | undefined): Section | null => {
  if (!path) return null;
  return SECTIONS.find((s) => path.startsWith(s.href) || s.match?.some((m) => path.startsWith(m))) || null;
};

// Íconos (trazos SVG de 24×24)
export const ICONS = {
  cart: "M3 3h2l2.4 12.2a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.5L22 7H6 M9 21h.01 M18 21h.01",
  register: "M4 10h16v10H4z M7 10V5h10v5 M8 14h2 M8 17h2 M13 14h3 M13 17h3 M9 7h6",
  box: "M21 8l-9-5-9 5 9 5 9-5z M3 8v8l9 5 9-5V8 M12 13v8",
  users: "M9 11a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6 M16 4.5a3 3 0 0 1 0 6 M21 20c0-2.6-1.6-4.8-4-5.6",
  truck: "M3 6h11v10H3z M14 10h4l3 3v3h-7 M7 20a1.8 1.8 0 1 0 0-3.6A1.8 1.8 0 0 0 7 20z M17 20a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z",
  chart: "M3 3v18h18 M7 15l4-4 3 3 6-7 M16 7h4v4",
  globe: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M2 12h20 M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
  camera: "M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  lock: "M4 11h16v10H4z M8 11V7a4 4 0 0 1 8 0v4",
  home: "M3 11l9-8 9 8 M5 10v10h14V10",
} as const;