// Acceso de administrador (se pide al entrar a Caja, Contabilidad, Usuarios,
// Tienda web o para modificar artículos)
// POST   { username, password, scope? } → desbloquea por 30 min (tiene que ser un administrador)
//        scope "owner" → Caja, Contabilidad y Usuarios: solo acepta la clave del DUEÑO
//        (OWNER_USERNAME / OWNER_PASSWORD_HASH), que es distinta a la del ingreso.
// DELETE → vuelve a bloquear (se llama solo al salir de esas secciones)
// Máximo 5 intentos fallidos cada 15 minutos por IP.
import { NextRequest, NextResponse } from "next/server";
import {
  verifyCredentials, verifyOwner, ownerConfigError, OWNER_UID,
  getSessionUser, getAdmin, setAdminCookie, clearAdminCookie, clientIp,
} from "@/lib/auth";

const shape = (a: { name: string; username: string; uid: number }, exp: number) =>
  ({ name: a.name, username: a.username, owner: a.uid === OWNER_UID, expiresAt: exp });
import { hit, peek, reset, minutes } from "@/lib/ratelimit";
export const dynamic = "force-dynamic";

const MAX_FAILS = 5;
const WINDOW = 15 * 60;

export async function GET(req: NextRequest) {
  const a = getAdmin(req);
  return NextResponse.json(
    { admin: a ? shape(a, a.exp * 1000) : null },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: NextRequest) {
  if (!getSessionUser(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const key = `admin:${clientIp(req)}`;
  try {
    const { count, resetIn } = await peek(key, WINDOW);
    if (count >= MAX_FAILS)
      return NextResponse.json(
        { error: `Demasiados intentos fallidos. Probá de nuevo en ${minutes(resetIn)} min.` },
        { status: 429, headers: { "Retry-After": String(resetIn) } }
      );
  } catch (e) { console.error("[admin] rate limit no disponible", e); }

  const b = await req.json().catch(() => ({}));
  const username = typeof b.username === "string" ? b.username.slice(0, 100) : "";
  const password = typeof b.password === "string" ? b.password.slice(0, 200) : "";
  const ownerOnly = b.scope === "owner";

  if (ownerOnly) {
    const cfg = ownerConfigError();
    if (cfg) return NextResponse.json({ error: cfg }, { status: 500 });
  }

  // Primero la clave del dueño; si no es esa y la sección no es del dueño, un administrador común
  let user = username && password ? verifyOwner(username, password) : null;
  if (!user && !ownerOnly && username && password) user = await verifyCredentials(username, password);
  const allowed = !!user && user.role === "admin";
  if (user && allowed) {
    try { await reset(key); } catch {}
    const res = NextResponse.json({ ok: true, admin: shape(user, Date.now() + 30 * 60000) });
    try { setAdminCookie(res, user); }
    catch (e) {
      console.error("[admin]", e);
      return NextResponse.json({ error: "Configuración del servidor incompleta" }, { status: 500 });
    }
    return res;
  }

  try { await hit(key, WINDOW); } catch {}
  await new Promise((r) => setTimeout(r, 600));
  return NextResponse.json(
    { error: ownerOnly ? "Usuario o contraseña del dueño incorrectos" : !user ? "Usuario o contraseña incorrectos" : "Ese usuario no es administrador" },
    { status: 401 }
  );
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  clearAdminCookie(res);
  return res;
}
