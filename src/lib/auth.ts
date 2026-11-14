// ═══════════════════════════════════════════════════════════════════
// SESIÓN Y USUARIOS
// Hay dos tipos de usuario:
//   admin    → ve y modifica todo (caja, contabilidad, artículos, usuarios)
//   vendedor → vende, consulta artículos y carga clientes/proveedores
// El administrador principal es el del .env (ADMIN_USERNAME / ADMIN_PASSWORD_HASH);
// los demás se crean desde la sección Usuarios (tabla app_users).
//
// La cookie ya NO guarda SESSION_SECRET. Guarda un token firmado
// (HMAC-SHA256) que vence a las 12 horas. Si alguien lo copia, deja de
// servir al vencer; y cambiando SESSION_SECRET en Vercel se cierran
// TODAS las sesiones abiertas al instante.
// ═══════════════════════════════════════════════════════════════════
import crypto from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export type Role = "admin" | "vendedor";
/** uid 0 = administrador principal del .env */
export type SessionUser = { uid: number; username: string; name: string; role: Role };

export const SESSION_COOKIE = "ct_admin";
const SESSION_HOURS = 12;

// Acceso de administrador: además de la sesión normal, Caja, Contabilidad,
// modificar artículos, Tienda web y Usuarios piden usuario y contraseña de un
// administrador. Ese permiso dura ADMIN_MINUTES o hasta que se sale de la sección.
export const ADMIN_COOKIE = "ct_elev";
export const ADMIN_MINUTES = 30;

function secret(): string | null {
  const s = process.env.SESSION_SECRET || "";
  // Un secreto corto se puede adivinar: si no tiene al menos 32 caracteres, nadie entra
  return s.length >= 32 ? s : null;
}

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

function sign(payload: string, key: string) {
  return crypto.createHmac("sha256", key).update(payload).digest("base64url");
}

/** Comparación en tiempo constante (no da pistas por el tiempo de respuesta) */
export function safeEqual(a: string, b: string) {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Clave del link público de un ticket (/ticket/123?k=...): solo quien tiene el link lo ve */
export function ticketKey(id: number): string | null {
  const key = secret();
  return key ? sign(`ticket:${id}`, key).slice(0, 22) : null;
}
export function checkTicketKey(id: number, k: string | null | undefined): boolean {
  const good = ticketKey(id);
  return !!good && !!k && safeEqual(good, k);
}

function makeToken(user: SessionUser, seconds: number, kind: "s" | "adm") {
  const key = secret();
  if (!key) throw new Error("SESSION_SECRET falta o tiene menos de 32 caracteres");
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({
    k: kind, u: user.username, n: user.name, r: user.role, id: user.uid, iat: now, exp: now + seconds,
  }));
  return `${payload}.${sign(payload, key)}`;
}

export function createSessionToken(user: SessionUser) {
  return makeToken(user, SESSION_HOURS * 3600, "s");
}

/** Lee un token firmado; kind "adm" = acceso de administrador, "s" = sesión normal */
function readToken(token: string | undefined | null, kind: "s" | "adm"): (SessionUser & { exp: number }) | null {
  const key = secret();
  if (!key || !token || token.length > 800) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (!safeEqual(sig, sign(payload, key))) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof d.exp !== "number" || d.exp <= Math.floor(Date.now() / 1000)) return null;
    // Un token de un tipo no sirve como el otro (las sesiones viejas no tienen "k")
    if ((d.k === "adm") !== (kind === "adm")) return null;
    // Sesiones viejas (antes de existir los roles) eran todas del admin
    const role: Role = d.r === "vendedor" ? "vendedor" : "admin";
    if (kind === "adm" && role !== "admin") return null;
    return { uid: Number(d.id) || 0, username: String(d.u || ""), name: String(d.n || d.u || "Admin"), role, exp: d.exp };
  } catch {
    return null;
  }
}

/** Devuelve el usuario de la sesión, o null si el token no sirve o venció */
export function readSessionToken(token: string | undefined | null): SessionUser | null {
  const u = readToken(token, "s");
  if (!u) return null;
  const { exp, ...user } = u;
  return user;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  return readSessionToken(token) !== null;
}

export function getSessionUser(req: NextRequest): SessionUser | null {
  return readSessionToken(req.cookies.get(SESSION_COOKIE)?.value);
}

/** Cualquier usuario con sesión (admin o vendedor) */
export function isAuthenticated(req: NextRequest) {
  return getSessionUser(req) !== null;
}

/**
 * Administrador que desbloqueó el acceso hace menos de ADMIN_MINUTES (o null).
 * Hace falta además una sesión normal abierta en ese navegador.
 */
export function getAdmin(req: NextRequest): (SessionUser & { exp: number }) | null {
  if (!getSessionUser(req)) return null;
  return readToken(req.cookies.get(ADMIN_COOKIE)?.value, "adm");
}

/**
 * DUEÑO: tiene un usuario y contraseña APARTE, distintos a los del ingreso al
 * sistema (OWNER_USERNAME / OWNER_PASSWORD_HASH en el .env y en Vercel).
 * Solo con esa clave se entra a Caja, Contabilidad y Usuarios.
 */
export const OWNER_UID = -1;

export function getOwner(req: NextRequest) {
  const a = getAdmin(req);
  return a && a.uid === OWNER_UID ? a : null;
}

/** ¿Están cargados los datos del dueño en el .env? */
export function ownerConfigError(): string | null {
  const u = (process.env.OWNER_USERNAME || "").trim().toLowerCase();
  if (!u || !(process.env.OWNER_PASSWORD_HASH || process.env.OWNER_PASSWORD))
    return "Falta configurar el usuario del dueño (OWNER_USERNAME y OWNER_PASSWORD_HASH)";
  if (u === (process.env.ADMIN_USERNAME || "").trim().toLowerCase())
    return "El usuario del dueño tiene que ser distinto al del ingreso al sistema";
  return null;
}

/** Verifica la clave del dueño. Devuelve el usuario dueño o null. */
export function verifyOwner(username: string, password: string): SessionUser | null {
  if (ownerConfigError()) return null;
  const expected = (process.env.OWNER_USERNAME || "").trim().toLowerCase();
  const userOk = safeEqual(username.trim().toLowerCase(), expected);
  let passOk = false;
  const hash = process.env.OWNER_PASSWORD_HASH;
  if (hash) passOk = checkPasswordHash(password, hash);
  else {
    const plain = process.env.OWNER_PASSWORD || "";
    passOk = plain.length > 0 && safeEqual(password, plain);
  }
  if (!userOk || !passOk) return null;
  return { uid: OWNER_UID, username: expected, name: process.env.OWNER_DISPLAY_NAME || "Dueño", role: "admin" };
}

/** ¿Tiene el acceso de administrador desbloqueado? */
export function isAdminRequest(req: NextRequest) {
  return getAdmin(req) !== null;
}

export function setAdminCookie(res: NextResponse, user: SessionUser) {
  res.cookies.set({
    name: ADMIN_COOKIE,
    value: makeToken(user, ADMIN_MINUTES * 60, "adm"),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_MINUTES * 60,
  });
}

export function clearAdminCookie(res: NextResponse) {
  res.cookies.set({ name: ADMIN_COOKIE, value: "", maxAge: 0, path: "/", httpOnly: true, sameSite: "strict" });
}

/** Para Server Components (si alguna vez se usan) */
export async function checkAdminSession() {
  try { return readToken((await cookies()).get(ADMIN_COOKIE)?.value, "adm") !== null; }
  catch { return false; }
}

export function setSessionCookie(res: NextResponse, user: SessionUser) {
  res.cookies.set({
    name: SESSION_COOKIE,
    value: createSessionToken(user),
    httpOnly: true,                                   // JavaScript no la puede leer
    secure: process.env.NODE_ENV === "production",    // solo por HTTPS
    sameSite: "strict",                               // no viaja desde otros sitios (CSRF)
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set({ name: SESSION_COOKIE, value: "", maxAge: 0, path: "/", httpOnly: true, sameSite: "strict" });
  clearAdminCookie(res);
}

// ─── Contraseñas ─────────────────────────────────────────────────────
// Formato guardado: scrypt$<salt base64>$<hash base64>  (nunca la contraseña en texto)
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function checkPasswordHash(password: string, stored: string): boolean {
  // Acepta "scrypt$sal$hash" y "scrypt:sal:hash". En el .env conviene el de ":",
  // porque Next.js interpreta los "$" del .env como variables y rompe el valor.
  const [algo, saltB64, hashB64] = (stored || "").trim().split(/[$:]/);
  if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  if (expected.length < 16) return false;
  const got = crypto.scryptSync(password, Buffer.from(saltB64, "base64"), expected.length);
  return crypto.timingSafeEqual(got, expected);
}

// Hash de relleno: si el usuario no existe se calcula igual, así la respuesta
// tarda lo mismo y no se puede adivinar qué usuarios existen
const DUMMY_HASH = hashPassword(crypto.randomBytes(12).toString("hex"));

/** Administrador principal (.env). ADMIN_PASSWORD_HASH recomendado; si no, ADMIN_PASSWORD */
function verifyEnvAdmin(username: string, password: string): boolean {
  const expectedUser = process.env.ADMIN_USERNAME || "";
  const userOk = expectedUser.length > 0 && safeEqual(username.toLowerCase(), expectedUser.toLowerCase());
  let passOk = false;
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (hash) passOk = checkPasswordHash(password, hash);
  else {
    const plain = process.env.ADMIN_PASSWORD || "";
    passOk = plain.length > 0 && safeEqual(password, plain);
  }
  return userOk && passOk;
}

/** Devuelve el usuario si el usuario y la contraseña son correctos */
export async function verifyCredentials(username: string, password: string): Promise<SessionUser | null> {
  const uname = username.trim().toLowerCase();
  if (verifyEnvAdmin(uname, password)) {
    return { uid: 0, username: uname, name: process.env.ADMIN_DISPLAY_NAME || "Administrador", role: "admin" };
  }
  let row: any = null;
  try {
    const { rows } = await pool.query(
      `SELECT id, username, display_name, password_hash, role, active FROM app_users WHERE LOWER(username) = $1`, [uname]);
    row = rows[0] || null;
  } catch (e) {
    // Si todavía no se corrió el SQL 04 la tabla no existe: entra solo el admin del .env
    console.error("[login] app_users no disponible", e);
  }
  const ok = checkPasswordHash(password, row?.password_hash || DUMMY_HASH);
  if (!row || !ok || !row.active) return null;
  pool.query(`UPDATE app_users SET last_login_at = NOW() WHERE id = $1`, [row.id]).catch(() => {});
  return { uid: row.id, username: row.username, name: row.display_name, role: row.role === "admin" ? "admin" : "vendedor" };
}

// ─── IP del cliente (Vercel la pone en x-forwarded-for) ──────────────
export function clientIp(req: NextRequest) {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] || req.headers.get("x-real-ip") || "local").trim().slice(0, 64);
}
