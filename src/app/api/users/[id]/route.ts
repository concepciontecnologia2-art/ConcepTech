// Usuarios del sistema (solo el administrador)
// PATCH { display_name?, role?, active?, password? } → editar / cambiar contraseña / desactivar
// DELETE → borrar el usuario
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireOwner, errorResponse, PosError } from "@/lib/pos";
import { hashPassword, getAdmin } from "@/lib/auth";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const USER_COLS = `id, username, display_name, role, active, last_login_at, created_at`;

const parseId = (v: string) => {
  if (!/^\d{1,9}$/.test(v)) throw new PosError("Usuario inválido", 404);
  return Number(v);
};

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const unauth = requireOwner(req); if (unauth) return unauth;
  try {
    const id = parseId((await params).id);
    const me = getAdmin(req)!;
    const b = await req.json().catch(() => ({}));

    const sets: string[] = [];
    const vals: unknown[] = [id];
    if (b.display_name !== undefined) {
      const name = String(b.display_name).replace(/\s+/g, " ").trim().slice(0, 80);
      if (name.length < 2) throw new PosError("Ingresá el nombre de la persona");
      vals.push(name); sets.push(`display_name = $${vals.length}`);
    }
    if (b.role !== undefined) {
      if (b.role !== "admin" && b.role !== "vendedor") throw new PosError("Rol inválido");
      if (me.uid === id && b.role !== "admin") throw new PosError("No podés quitarte el permiso de administrador a vos mismo");
      vals.push(b.role); sets.push(`role = $${vals.length}`);
    }
    if (b.active !== undefined) {
      if (typeof b.active !== "boolean") throw new PosError("Valor inválido");
      if (me.uid === id && !b.active) throw new PosError("No podés desactivar tu propio usuario");
      vals.push(b.active); sets.push(`active = $${vals.length}`);
    }
    if (b.password !== undefined) {
      const p = String(b.password);
      if (p.length < 6 || p.length > 200) throw new PosError("La contraseña debe tener al menos 6 caracteres");
      vals.push(hashPassword(p)); sets.push(`password_hash = $${vals.length}`);
    }
    if (!sets.length) throw new PosError("No hay cambios");

    const { rows: [u] } = await pool.query(
      `UPDATE app_users SET ${sets.join(", ")} WHERE id = $1 RETURNING ${USER_COLS}`, vals);
    if (!u) throw new PosError("El usuario no existe", 404);
    return NextResponse.json(u);
  } catch (e) { return errorResponse(e); }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const unauth = requireOwner(req); if (unauth) return unauth;
  try {
    const id = parseId((await params).id);
    if (getAdmin(req)!.uid === id) throw new PosError("No podés borrar tu propio usuario");
    const { rowCount } = await pool.query(`DELETE FROM app_users WHERE id = $1`, [id]);
    if (!rowCount) throw new PosError("El usuario no existe", 404);
    return NextResponse.json({ ok: true });
  } catch (e) { return errorResponse(e); }
}
