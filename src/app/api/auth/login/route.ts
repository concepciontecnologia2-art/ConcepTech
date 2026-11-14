// POST   → iniciar sesión { username, password }
// DELETE → cerrar sesión
// Máximo 5 intentos fallidos cada 15 minutos por IP.
import { NextRequest, NextResponse } from "next/server";
import { verifyCredentials, setSessionCookie, clearSessionCookie, clientIp } from "@/lib/auth";
import { hit, peek, reset, minutes } from "@/lib/ratelimit";
export const dynamic = "force-dynamic";

const MAX_FAILS = 5;
const WINDOW = 15 * 60;

export async function POST(req: NextRequest) {
  const key = `login:${clientIp(req)}`;

  // ¿Esta IP ya está bloqueada?
  try {
    const { count, resetIn } = await peek(key, WINDOW);
    if (count >= MAX_FAILS)
      return NextResponse.json(
        { error: `Demasiados intentos fallidos. Probá de nuevo en ${minutes(resetIn)} min.` },
        { status: 429, headers: { "Retry-After": String(resetIn) } }
      );
  } catch (e) { console.error("[login] rate limit no disponible", e); }

  const b = await req.json().catch(() => ({}));
  const username = typeof b.username === "string" ? b.username.slice(0, 100) : "";
  const password = typeof b.password === "string" ? b.password.slice(0, 200) : "";

  const user = username && password ? await verifyCredentials(username, password) : null;
  if (user) {
    try { await reset(key); } catch {}
    const res = NextResponse.json({ ok: true, user: { name: user.name, role: user.role } });
    try { setSessionCookie(res, user); }
    catch (e) {
      console.error("[login]", e);
      return NextResponse.json({ error: "Configuración del servidor incompleta" }, { status: 500 });
    }
    return res;
  }

  // Intento fallido: suma al contador y demora la respuesta
  try { await hit(key, WINDOW); } catch {}
  await new Promise((r) => setTimeout(r, 600));
  return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
