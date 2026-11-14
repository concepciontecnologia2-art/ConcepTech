// GET → una venta con todo lo necesario para imprimir el ticket (80 mm)
//       + los datos del negocio que van en el encabezado
//       + share_key: clave del link público para mandar el ticket por WhatsApp.
import { NextRequest, NextResponse } from "next/server";
import { requireUser, errorResponse, PosError } from "@/lib/pos";
import { getTicketData } from "@/lib/ticket";
import { ticketKey } from "@/lib/auth";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const unauth = requireUser(req); if (unauth) return unauth;
  try {
    const raw = (await params).id;
    if (!/^\d{1,9}$/.test(raw)) throw new PosError("Venta inválida", 404);
    const data = await getTicketData(Number(raw));
    if (!data) throw new PosError("La venta no existe", 404);
    return NextResponse.json({ ...data, share_key: ticketKey(Number(raw)) });
  } catch (e) { return errorResponse(e); }
}
