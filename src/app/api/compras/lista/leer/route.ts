// POST { images?: [{ mime, data(base64) }], text?: "planilla en texto", supplier_id? }
//   → la IA lee la LISTA DE PRECIOS del proveedor y se sugiere qué artículo del sistema es cada renglón.
//   No guarda nada: se guarda al confirmar en /api/compras/lista.
//   Las planillas grandes (Excel) el navegador las manda en partes de ~150 renglones.
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin, errorResponse, PosError } from "@/lib/pos";
import { limitByIp } from "@/lib/ratelimit";
import { readPriceList, type InvoiceImage } from "@/lib/gemini";
import { bestMatches, normText } from "@/lib/matching";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"]);

export async function POST(req: NextRequest) {
  const unauth = requireAdmin(req); if (unauth) return unauth;
  try {
    const limited = await limitByIp(req, "lista-ia", 60, 10 * 60);
    if (limited) return limited;

    const b = await req.json().catch(() => ({}));
    const text = typeof b.text === "string" ? b.text.trim() : "";
    const rawImages = Array.isArray(b.images) ? b.images : [];
    if (!text && !rawImages.length) throw new PosError("Subí la lista: foto, PDF o Excel");
    if (text.length > 60_000) throw new PosError("La parte de la planilla es muy larga");
    if (rawImages.length > 6) throw new PosError("Máximo 6 fotos por vez");
    let size = 0;
    const images: InvoiceImage[] = rawImages.map((i: any) => {
      if (!MIMES.has(i?.mime) || typeof i?.data !== "string") throw new PosError("Formato no soportado: usá foto, PDF o Excel");
      if (!/^[A-Za-z0-9+/=]+$/.test(i.data.slice(0, 200))) throw new PosError("Archivo inválido");
      size += i.data.length;
      return { mime: i.mime, data: i.data };
    });
    if (size > 4_200_000) throw new PosError("Los archivos son muy pesados. Probá con menos fotos o un PDF más liviano.");

    const supplierId = Number(b.supplier_id) || null;
    const data = await readPriceList({ images, text });

    const [{ rows: products }, { rows: suppliers }] = await Promise.all([
      pool.query(`SELECT id, name, sku, supplier_id, cost_price::float AS cost_price,
                         price_retail::float AS price_retail, price_wholesale::float AS price_wholesale
                  FROM products`),
      pool.query(`SELECT id, name FROM suppliers WHERE active = TRUE`),
    ]);

    let supplier = supplierId ? suppliers.find((s: any) => s.id === supplierId) : null;
    if (!supplier && data.proveedor) {
      const n = normText(data.proveedor);
      supplier = suppliers.find((s: any) => { const sn = normText(s.name); return sn && (n.includes(sn) || sn.includes(n)); }) || null;
    }

    const byId = new Map(products.map((p: any) => [p.id, p]));
    const info = (id: number) => {
      const p: any = byId.get(id);
      return { cost_price: p.cost_price, price_retail: p.price_retail, price_wholesale: p.price_wholesale };
    };
    const items = data.items.map((it) => {
      const matches = bestMatches(it.descripcion, it.codigo, products, supplier?.id ?? null).map((m) => ({ ...m, ...info(m.id) }));
      return { ...it, matches, product_id: matches[0] && matches[0].score >= 0.55 ? matches[0].id : null };
    });

    return NextResponse.json({
      supplier: supplier ? { id: supplier.id, name: supplier.name } : null,
      proveedor: data.proveedor,
      precios_con_iva: data.precios_con_iva,
      items,
    });
  } catch (e) { return errorResponse(e); }
}
