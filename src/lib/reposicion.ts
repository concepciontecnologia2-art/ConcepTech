// ═══════════════════════════════════════════════════════════════════
// PEDIDOS A PROVEEDORES — reglas compartidas (servidor y pantalla)
// Apenas un producto queda con REORDER_AT unidades o menos, aparece en
// "Pedidos a proveedores". Se eligen los artículos y se arma UN mensaje
// que se manda al GRUPO de WhatsApp del negocio (no a cada proveedor).
// ═══════════════════════════════════════════════════════════════════

/** Con esta cantidad o menos, el producto hay que pedirlo */
export const REORDER_AT = 2;

/** Cantidad que se pide por defecto (se puede cambiar antes de enviar) */
export const DEFAULT_ORDER_QTY = 10;

/**
 * Cantidad sugerida para pedir: 10 unidades (lo que más se pide).
 * Si el producto tiene un mínimo cargado y el doble del mínimo da más, se usa eso.
 */
export function suggestedQty(stock: number, minStock: number) {
  const target = minStock > REORDER_AT ? minStock * 2 - Math.max(0, stock) : 0;
  return Math.max(DEFAULT_ORDER_QTY, target);
}

/**
 * Saphirus: Textil, Aerosol y Varilla vienen en bulto de 12 → se piden de a 12.
 * Devuelve el tamaño del bulto según el nombre, o null si se pide por unidad.
 */
export function saphirusBulto(name: string): number | null {
  const n = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\b(textil|textiles|aerosol|aerosoles|varilla|varillas)\b/.test(n) ? 12 : null;
}

/** Cantidad sugerida para un producto Saphirus: el bulto, o 10 si no viene en bulto */
export const saphirusSuggested = (name: string) => saphirusBulto(name) ?? DEFAULT_ORDER_QTY;

export type OrderLine = { name: string; sku?: string | null; quantity: number };

// ─── SAPHIRUS ───────────────────────────────────────────────────────
// Los proveedores cuyo nombre contiene "Saphirus" se manejan aparte, en su propia sección (Saphirus)
// (solo el dueño). No aparecen en "Pedidos a proveedores" para no pedir dos veces.
export const SAPHIRUS_LIKE = "%saphirus%";
/** SQL: true si el proveedor con ese alias de tabla es Saphirus */
export const isSaphirusSql = (alias: string) => `(${alias}.name ILIKE '${SAPHIRUS_LIKE}')`;

/** Texto del WhatsApp que se le manda al proveedor */
export function buildOrderMessage(supplier: { name: string; contact_name?: string | null }, lines: OrderLine[], business = "Concepción Tecnología", note?: string | null) {
  const who = (supplier.contact_name || supplier.name || "").trim().split(/\s+/)[0];
  const body = lines.map((l) => `• ${l.quantity} x ${l.name}${l.sku ? ` (${l.sku})` : ""}`).join("\n");
  const extra = note && note.trim() ? `\n\n${note.trim()}` : "";
  return `Hola${who ? ` ${who}` : ""}! Te paso un pedido de *${business}*:\n\n${body}${extra}\n\n¿Me confirmás disponibilidad y precio? ¡Gracias!`;
}

export const waUrl = (phone: string, text: string) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

// ─── MENSAJE AL GRUPO ───────────────────────────────────────────────
export type GroupSection = { title: string | null; lines: OrderLine[] };

/** Un solo mensaje con todo lo elegido, separado por proveedor */
export function buildGroupMessage(sections: GroupSection[], opts: { title?: string; note?: string | null; date?: Date } = {}) {
  const date = (opts.date || new Date()).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const parts = sections
    .filter((s) => s.lines.length)
    .map((s) => {
      const body = s.lines.map((l) => `• ${l.quantity} x ${l.name}${l.sku ? ` (${l.sku})` : ""}`).join("\n");
      return sections.length > 1 || s.title ? `*${s.title || "Sin proveedor"}*\n${body}` : body;
    });
  const note = opts.note && opts.note.trim() ? `\n\n📝 ${opts.note.trim()}` : "";
  return `*${opts.title || "Pedido"} – ${date}*\n\n${parts.join("\n\n")}${note}`;
}

/**
 * Link que abre WhatsApp con el mensaje ya escrito para elegir el chat (el grupo).
 * WhatsApp no permite abrir un GRUPO con el texto puesto, por eso se elige el grupo
 * en la lista (aparece primero si se lo fija arriba en WhatsApp).
 */
export const shareUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/** Link del grupo (solo servidor): variable WHATSAPP_GROUP_URL=https://chat.whatsapp.com/XXXX
 *  Acepta el link tal cual lo copia WhatsApp (con "?s=..." al final) y lo limpia. */
export const groupUrl = () => {
  const m = (process.env.WHATSAPP_GROUP_URL || "").trim().match(/^https:\/\/chat\.whatsapp\.com\/([A-Za-z0-9]{10,40})/);
  return m ? `https://chat.whatsapp.com/${m[1]}` : null;
};
