// ═══════════════════════════════════════════════════════════════════
// CLIENTES Y PROVEEDORES — validaciones compartidas
// Lo usan las rutas /api/crm/customers y /api/crm/suppliers.
// ═══════════════════════════════════════════════════════════════════
import { PosError } from "@/lib/pos";
import { toWhatsApp } from "@/lib/phone";

/** Texto opcional: recorta espacios y largo máximo. Vacío → null */
export function optText(v: unknown, max: number): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
}

/** Texto largo opcional (notas, dirección): conserva saltos de línea */
export function optLongText(v: unknown, max: number): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\r\n/g, "\n").trim();
  return s ? s.slice(0, max) : null;
}

export function reqName(v: unknown, what = "el nombre"): string {
  const s = optText(v, 150);
  if (!s || s.length < 2) throw new PosError(`Ingresá ${what}`);
  return s;
}

export function optEmail(v: unknown): string | null {
  const s = optText(v, 150);
  if (!s) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) throw new PosError("El email no es válido");
  return s.toLowerCase();
}

export function optDocument(v: unknown): string | null {
  const s = optText(v, 20);
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 11) throw new PosError("El DNI / CUIT no es válido");
  return digits;
}

/**
 * Normaliza un teléfono argentino al formato de WhatsApp: 549 + característica + número.
 * Acepta "3865 575938", "03865-15-575938", "+54 9 3865 575938", "381 15 4123456"...
 * Números del exterior: escribirlos con + adelante (ej. "+598 99 123 456").
 * Devuelve null si está vacío; tira error si no se puede interpretar.
 */
export function normalizePhone(v: unknown, what = "El teléfono"): string | null {
  const raw = optText(v, 40);
  if (!raw) return null;
  const r = toWhatsApp(raw);
  if (r === "") return null;
  if (r === null) throw new PosError(`${what} no es válido: escribilo con característica, ej. 3865 575938`);
  return r;
}

/** Para comparar teléfonos escritos de cualquier forma (pedidos web, etc.) */
export function samePhone(a: unknown, b: unknown): boolean {
  try {
    const x = normalizePhone(a), y = normalizePhone(b);
    return !!x && x === y;
  } catch { return false; }
}

/** Id numérico de la URL */
export function parseId(v: string): number {
  if (!/^\d{1,9}$/.test(v)) throw new PosError("Id inválido", 404);
  return Number(v);
}

/** Escapa comodines para usar en ILIKE */
export const likeTerm = (t: string) => `%${t.replace(/[\\%_]/g, (m) => "\\" + m)}%`;

type Queryable = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> };

// ─── Clientes ────────────────────────────────────────────────────────
export function customerFields(b: any) {
  return {
    name: reqName(b?.name, "el nombre del cliente"),
    phone: normalizePhone(b?.phone),
    email: optEmail(b?.email),
    dni_cuit: optDocument(b?.dni_cuit),
    address: optLongText(b?.address, 300),
    city: optText(b?.city, 80),
    customer_type: b?.customer_type === "wholesale" ? "wholesale" : "retail",
    notes: optLongText(b?.notes, 1000),
  };
}

/** Evita cargar dos veces la misma persona (mismo teléfono o mismo DNI/CUIT) */
export async function checkCustomerDuplicates(db: Queryable, f: { phone: string | null; dni_cuit: string | null }, exceptId: number | null) {
  if (f.phone) {
    const { rows: [d] } = await db.query(
      `SELECT name FROM customers WHERE phone = $1 AND id <> COALESCE($2::int, 0) LIMIT 1`, [f.phone, exceptId]);
    if (d) throw new PosError(`Ya hay un cliente con ese teléfono: ${d.name}`, 409);
  }
  if (f.dni_cuit) {
    const { rows: [d] } = await db.query(
      `SELECT name FROM customers WHERE dni_cuit = $1 AND id <> COALESCE($2::int, 0) LIMIT 1`, [f.dni_cuit, exceptId]);
    if (d) throw new PosError(`Ya hay un cliente con ese DNI / CUIT: ${d.name}`, 409);
  }
}

// ─── Proveedores ─────────────────────────────────────────────────────
export function supplierFields(b: any) {
  return {
    name: reqName(b?.name, "el nombre del proveedor"),
    contact_name: optText(b?.contact_name, 150),
    whatsapp: normalizePhone(b?.whatsapp, "El WhatsApp"),
    phone: optText(b?.phone, 30),
    email: optEmail(b?.email),
    cuit: optDocument(b?.cuit),
    address: optLongText(b?.address, 300),
    notes: optLongText(b?.notes, 1000),
  };
}

export async function checkSupplierDuplicates(db: Queryable, name: string, exceptId: number | null) {
  const { rows: [d] } = await db.query(
    `SELECT name FROM suppliers WHERE LOWER(name) = LOWER($1) AND id <> COALESCE($2::int, 0) LIMIT 1`, [name, exceptId]);
  if (d) throw new PosError(`Ya existe un proveedor llamado ${d.name}`, 409);
}
