// GET ?k=CLAVE → ticket PÚBLICO (el link que se le manda al cliente por WhatsApp).
//   Sin la clave correcta no muestra nada. No incluye el teléfono del cliente.
import { NextRequest, NextResponse } from "next/server";
import { errorResponse, PosError } from "@/lib/pos";
import { getTicketData } from "@/lib/ticket";
import { checkTicketKey } from "@/lib/auth";
import { limitByIp } from "@/lib/ratelimit";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const limited = await limitByIp(req, "ticket-publico", 60, 10 * 60);
    if (limited) return limited;
    const raw = (await params).id;
    const id = /^\d{1,9}$/.test(raw) ? Number(raw) : 0;
    if (!id || !checkTicketKey(id, req.nextUrl.searchParams.get("k"))) throw new PosError("Ticket no encontrado", 404);
    const data = await getTicketData(id);
    if (!data) throw new PosError("Ticket no encontrado", 404);
    const { customer_phone: _p, seller_name: _s, customer_doc: _d, customer_address: _a, ...sale } = data.sale;
    return NextResponse.json({ sale: { ...sale, seller_name: null, customer_doc: null, customer_address: null }, business: data.business });
  } catch (e) { return errorResponse(e); }
}
