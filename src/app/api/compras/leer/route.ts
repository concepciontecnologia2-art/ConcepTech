// POST { images: [{ mime, data(base64) }], supplier_id? }
//   → la IA lee la factura y se sugiere con qué artículo del sistema va cada renglón.
//   No guarda nada: se guarda recién al confirmar en /api/compras.
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin, errorResponse, PosError } from "@/lib/pos";
import { limitByIp } from "@/lib/ratelimit";
import { readInvoice, type InvoiceImage } from "@/lib/gemini";
import { bestMatches, normText } from "@/lib/matching";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // la IA puede tardar unos segundos

const MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"]);

export async function POST(req: NextRequest) {
  const unauth = requireAdmin(req); if (unauth) return unauth;
  try {
    const limited = await limitByIp(req, "compras-ia", 20, 10 * 60);
    if (limited) return limited;

    const b = await req.json().catch(() => ({}));
    if (!Array.isArray(b.images) || b.images.length === 0) throw new PosError("Subí al menos una foto");
    if (b.images.length > 4) throw new PosError("Máximo 4 fotos por factura");
    let size = 0;
    const images: InvoiceImage[] = b.images.map((i: any) => {
      if (!MIMES.has(i?.mime) || typeof i?.data !== "string") throw new PosError("Formato no soportado: usá foto (JPG/PNG) o PDF");
      if (!/^[A-Za-z0-9+/=]+$/.test(i.data.slice(0, 200))) throw new PosError("Archivo inválido");
      size += i.data.length;
      return { mime: i.mime, data: i.data };
    });
    // Vercel acepta hasta 4,5 MB por pedido
    if (size > 4_200_000) throw new PosError("Las fotos son muy pesadas. Probá con menos fotos o un PDF más liviano.");

    const supplierId = Number(b.supplier_id) || null;
    // Categorías (con subcategorías) para que la IA clasifique los productos nuevos
    const { rows: cats } = await pool.query(
      `SELECT c.id, c.name, COALESCE(array_agg(s.name ORDER BY s.name) FILTER (WHERE s.id IS NOT NULL), '{}') AS subs
       FROM categories c LEFT JOIN subcategories s ON s.category_id = c.id
       GROUP BY c.id ORDER BY c.sort_order, c.name`);
    const { data, raw } = await readInvoice(images, cats);

    const [{ rows: products }, { rows: suppliers }] = await Promise.all([
      pool.query(`SELECT id, name, sku, supplier_id, category_id FROM products`),
      pool.query(`SELECT id, name, cuit FROM suppliers WHERE active = TRUE`),
    ]);

    // Proveedor: el elegido, o el que coincida por CUIT o nombre
    let supplier = supplierId ? suppliers.find((s: any) => s.id === supplierId) : null;
    if (!supplier && data.cuit) {
      const c = data.cuit.replace(/\D/g, "");
      supplier = suppliers.find((s: any) => s.cuit && s.cuit.replace(/\D/g, "") === c) || null;
    }
    if (!supplier && data.proveedor) {
      const n = normText(data.proveedor);
      supplier = suppliers.find((s: any) => { const sn = normText(s.name); return sn && (n.includes(sn) || sn.includes(n)); }) || null;
    }

    const lines = data.items.map((it) => {
      const matches = bestMatches(it.descripcion, it.codigo, products, supplier?.id ?? null);
      const product_id = matches[0] && matches[0].score >= 0.55 ? matches[0].id : null;
      // Si no coincide con nada, se crea como artículo nuevo: se sugiere la categoría del más parecido
      const near: any = !product_id && matches[0] && matches[0].score >= 0.2 ? products.find((p: any) => p.id === matches[0].id) : null;
      // Categoría: la que eligió la IA; si no eligió, la del artículo más parecido
      return { ...it, matches, product_id, suggested_category_id: it.categoria_id ?? near?.category_id ?? null, category_by_ai: it.categoria_id != null };
    });

    return NextResponse.json({ invoice: { ...data, items: undefined }, supplier: supplier ? { id: supplier.id, name: supplier.name } : null, lines, raw });
  } catch (e) { return errorResponse(e); }
}
