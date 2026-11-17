// ESTADO DE LA COPIA AUTOMÁTICA — GET /api/backup/estado (solo el dueño).
// La copia diaria de GitHub anota en business_settings ('ultimo_backup') cuándo se hizo.
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireOwner, errorResponse } from "@/lib/pos";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const unauth = requireOwner(req); if (unauth) return unauth;
  try {
    const { rows } = await pool.query(
      "SELECT value, updated_at FROM business_settings WHERE key = 'ultimo_backup'"
    );
    if (!rows[0]) return NextResponse.json({ ultimo: null });
    let info: { bytes?: number; tablas?: number } = {};
    try { info = JSON.parse(rows[0].value || "{}"); } catch {}
    return NextResponse.json({ ultimo: { at: rows[0].updated_at, bytes: info.bytes ?? null, tablas: info.tablas ?? null } });
  } catch (e) { return errorResponse(e); }
}
