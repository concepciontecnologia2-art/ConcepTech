// Usuarios del sistema (solo el administrador)
// GET  → lista
// POST { username, display_name, password, role: "admin"|"vendedor" } → alta
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireOwner, errorResponse, PosError } from "@/lib/pos";
import { hashPassword } from "@/lib/auth";
export const dynamic = "force-dynamic";

const USER_COLS = `id, username, display_name, role, active, last_login_at, created_at`;

export async function GET(req: NextRequest) {
  const unauth = requireOwner(req); if (unauth) return unauth;
  try {
    const { rows } = await pool.query(`SELECT ${USER_COLS} FROM app_users ORDER BY active DESC, role, display_name`);
    return NextResponse.json({ users: rows, mainAdmin: process.env.ADMIN_USERNAME || null });
  } catch (e) { return errorResponse(e); }
}

export async function POST(req: NextRequest) {
  const unauth = requireOwner(req); if (unauth) return unauth;
  try {
    const b = await req.json().catch(() => ({}));
    const username = String(b.username || "").trim().toLowerCase();
    const name = String(b.display_name || "").replace(/\s+/g, " ").trim().slice(0, 80);
    const password = String(b.password || "");
    const role = b.role === "admin" ? "admin" : "vendedor";

    if (!/^[a-z0-9._-]{3,40}$/.test(username))
      throw new PosError("El usuario debe tener entre 3 y 40 letras o números, sin espacios");
    if (username === (process.env.ADMIN_USERNAME || "").toLowerCase())
      throw new PosError("Ese usuario ya existe");
    if (name.length < 2) throw new PosError("Ingresá el nombre de la persona");
    if (password.length < 6 || password.length > 200) throw new PosError("La contraseña debe tener al menos 6 caracteres");

    const { rows: [u] } = await pool.query(
      `INSERT INTO app_users (username, display_name, password_hash, role) VALUES ($1, $2, $3, $4)
       RETURNING ${USER_COLS}`,
      [username, name, hashPassword(password), role]
    );
    return NextResponse.json(u, { status: 201 });
  } catch (e: any) {
    if (e?.code === "23505") return NextResponse.json({ error: "Ese usuario ya existe" }, { status: 409 });
    return errorResponse(e);
  }
}
