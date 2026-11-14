import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, getAdmin, OWNER_UID } from "@/lib/auth";
export const dynamic = "force-dynamic";

// → { ok, user: { name, role }, admin: { name, expiresAt } | null }
//   admin = acceso de administrador desbloqueado en este navegador
export async function GET(req: NextRequest) {
  const u = getSessionUser(req);
  const a = u ? getAdmin(req) : null;
  return NextResponse.json(
    {
      ok: !!u,
      user: u ? { name: u.name, role: u.role, username: u.username } : null,
      admin: a ? { name: a.name, username: a.username, owner: a.uid === OWNER_UID, expiresAt: a.exp * 1000 } : null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
