// Formato lindo para mostrar teléfonos guardados como 549 + característica + número.
// (Se puede usar en el navegador: no importa nada del servidor)
const AREA3 = ["220","221","223","230","236","237","249","260","261","263","264","266","280","291","294","297","298","299","336","341","342","343","345","348","351","353","358","362","364","370","376","379","380","381","383","385","387","388"];

export function fmtPhone(p: string | null | undefined): string {
  if (!p) return "";
  if (!p.startsWith("549") || p.length !== 13) return "+" + p;
  const n = p.slice(3);
  const a = n.startsWith("11") ? 2 : AREA3.includes(n.slice(0, 3)) ? 3 : 4;
  const rest = n.slice(a);
  const local = rest.length >= 7 ? `${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}` : rest;
  return `${n.slice(0, a)} ${local}`;
}

/**
 * Teléfono argentino → formato de WhatsApp (549 + característica + número).
 * Acepta "3865 575938", "03865-15-575938", "+54 9 3865 575938"...; del exterior con + adelante.
 * Devuelve "" si está vacío y null si no se puede interpretar. (Sirve en el navegador y en el servidor)
 */
export function toWhatsApp(raw: string | null | undefined): string | null {
  const t = (raw || "").trim();
  let d = t.replace(/\D/g, "");
  if (!d) return "";
  if (t.startsWith("+") && !d.startsWith("54")) return d.length >= 8 && d.length <= 15 ? d : null;
  if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("9") && d.length === 11) d = d.slice(1);
  if (d.startsWith("0")) d = d.slice(1);
  // Sacar el "15" de celular: característica (2 a 4 dígitos) + 15 + número
  if (d.length === 12) {
    for (const pos of [4, 3, 2]) {
      if (d.slice(pos, pos + 2) === "15") { d = d.slice(0, pos) + d.slice(pos + 2); break; }
    }
  }
  return d.length === 10 ? "549" + d : null;
}
