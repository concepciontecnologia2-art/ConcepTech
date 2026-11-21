// POST { images: [{ mime, data(base64) }], supplier_id? }
//   → la IA lee la factura y se sugiere con qué artículo del sistema va cada renglón.
//   No guarda nada: se guarda recién al confirmar en /api/compras.
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin, errorResponse, PosError } from "@/lib/pos";
import { limitByIp } from "@/lib/ratelimit";
import { readInvoice, confirmMatches, type InvoiceImage, type InvoiceLine } from "@/lib/gemini";
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
    const t0 = Date.now();
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

    // 1) Emparejar cada renglón: por código y por palabras (con el nombre original y el traducido)
    const sid = supplier?.id ?? null;
    const matched = data.items.map((it) => {
      const byName = (s: string) => bestMatches(s, it.codigo, products, sid, 5);
      const a = byName(it.descripcion), b = it.nombre_es && it.nombre_es !== it.descripcion ? byName(it.nombre_es) : [];
      const all = new Map<number, { id: number; name: string; score: number }>();
      for (const m of [...a, ...b]) if (!all.has(m.id) || all.get(m.id)!.score < m.score) all.set(m.id, m);
      const matches = [...all.values()].sort((x, y) => y.score - x.score).slice(0, 5);
      const product_id = matches[0] && matches[0].score >= 0.55 ? matches[0].id : null;
      return { it, matches, product_id, match_by_ai: false };
    });

    // 2) Renglones dudosos (se parecen pero no tanto): la IA decide si es el mismo producto escrito distinto
    const dudosos = matched
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => !m.product_id && m.matches.some((c) => c.score >= 0.3))
      .slice(0, 60);
    // Vercel corta a los 60 s: si leer la factura ya tardó mucho, se saltea este paso (quedan para revisar a mano)
    if (dudosos.length && Date.now() - t0 < 40_000) {
      try {
        const res = await confirmMatches(dudosos.map(({ m, i }) => ({
          linea: i + 1, producto: `${m.it.nombre_es} (en la factura: ${m.it.descripcion})`,
          candidatos: m.matches.filter((c) => c.score >= 0.25).map((c) => ({ id: c.id, nombre: c.name })),
        })));
        for (const { m, i } of dudosos) {
          const id = res.get(i + 1);
          if (id) { m.product_id = id; m.match_by_ai = true; }
        }
      } catch (e) { console.error("[compras/leer] confirmar con IA:", e); }   // si falla, quedan como nuevos para revisar
    }

    // 3) Juntar renglones repetidos (mismo artículo, mismo código o mismo nombre nuevo): no duplicar
    type Out = InvoiceLine & { matches: typeof matched[number]["matches"]; product_id: number | null; match_by_ai: boolean; merged: number };
    const byKey = new Map<string, Out>();
    for (const m of matched) {
      const key = m.product_id ? `p:${m.product_id}` : m.it.codigo ? `c:${normText(m.it.codigo)}` : `n:${normText(m.it.nombre_es || m.it.descripcion)}`;
      const prev = byKey.get(key);
      if (!prev) { byKey.set(key, { ...m.it, matches: m.matches, product_id: m.product_id, match_by_ai: m.match_by_ai, merged: 1 }); continue; }
      const q1 = prev.cantidad, q2 = m.it.cantidad;
      // costo unitario: promedio ponderado por cantidad
      if (prev.precio_unitario != null && m.it.precio_unitario != null)
        prev.precio_unitario = Math.round(((prev.precio_unitario * q1 + m.it.precio_unitario * q2) / (q1 + q2)) * 100) / 100;
      else prev.precio_unitario = prev.precio_unitario ?? m.it.precio_unitario;
      prev.cantidad = q1 + q2;
      prev.subtotal = prev.subtotal != null && m.it.subtotal != null ? prev.subtotal + m.it.subtotal : null;
      prev.merged += 1;
    }

    const lines = [...byKey.values()].map((it) => {
      // Si no coincide con nada, se crea como artículo nuevo: se sugiere la categoría del más parecido
      const near: any = !it.product_id && it.matches[0] && it.matches[0].score >= 0.2 ? products.find((p: any) => p.id === it.matches[0].id) : null;
      return { ...it, suggested_category_id: it.categoria_id ?? near?.category_id ?? null, category_by_ai: it.categoria_id != null };
    });
    const merged = data.items.length - lines.length;

    return NextResponse.json({ invoice: { ...data, items: undefined }, supplier: supplier ? { id: supplier.id, name: supplier.name } : null, lines, merged, raw });
  } catch (e) { return errorResponse(e); }
}
