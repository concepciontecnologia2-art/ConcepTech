// ═══════════════════════════════════════════════════════════════════
// GEMINI (Google) — lectura de facturas y remitos de proveedores
// Solo corre en el servidor: la API key nunca llega al navegador.
//
// .env.local / Vercel:
//   GEMINI_API_KEY=...            (gratis en aistudio.google.com → Get API key)
//   GEMINI_MODEL=gemini-3.5-flash-lite   (opcional; si Google lo retira, se usa el que sugiere)
// ═══════════════════════════════════════════════════════════════════
import { PosError } from "@/lib/pos";
import { aCastellano } from "@/lib/castellano";

export type InvoiceImage = { mime: string; data: string }; // data = base64 sin "data:..."

export type InvoiceLine = {
  descripcion: string;            // tal cual figura en la factura
  nombre_es: string;              // el mismo producto con nombre en castellano (sin "preto", portugués traducido)
  codigo: string | null;
  cantidad: number;
  precio_unitario: number | null; // por unidad, después de bonificaciones de la línea
  subtotal: number | null;
  categoria_id: number | null;   // categoría del sistema que la IA eligió (para crear artículos nuevos)
};

export type InvoiceRead = {
  moneda: "ARS" | "USD";          // en qué moneda están los precios de la factura
  proveedor: string | null;
  cuit: string | null;
  tipo: string | null;           // "A", "B", "C", "X", "remito"...
  iva_discriminado: boolean;     // true si los precios NO incluyen IVA (factura A)
  numero: string | null;
  fecha: string | null;          // YYYY-MM-DD
  total: number | null;
  items: InvoiceLine[];
};

const PROMPT = `Sos un asistente que carga compras en el sistema de un local de electrónica y accesorios de celular en Argentina.
Te paso la foto (o PDF) de una factura, remito o presupuesto de un PROVEEDOR. Extraé los datos y devolvé SOLO el JSON pedido.

Reglas:
- "items": una entrada por cada renglón de producto. No incluyas renglones de envío, flete, percepciones, impuestos ni subtotales.
- "descripcion": el nombre del producto tal como aparece (corregí solo errores obvios de lectura).
- "nombre_es": el MISMO producto con el nombre en castellano (español de Argentina), para cargarlo en el sistema:
  · Traducí al castellano toda palabra en portugués u otro idioma: "TAMPA" → "Tapa", "BAT" → "Batería", "CONEC" → "Conector",
    "COM" → "con", "S/" → "sin", "C/" → "con", "DIAGNOSTICAVEL" → "con diagnóstico", "GRAFITE" → "Grafito",
    "BLUE" → "Azul", "RED" → "Rojo", "WHITE" → "Blanco", "GREY"/"CINZA" → "Gris", "PRETO"/"BLACK" en una tapa o funda → "Negro".
  · En pantallas, módulos y frontales BORRÁ la palabra "PRETO" (y "BLACK"): no la traduzcas, no hace falta.
  · Escribí completas las marcas abreviadas: "SAM" → "Samsung", "MOTO" → "Motorola", "XIAOMI REDMI" queda igual.
  · "ORI" → "Original". Mantené modelos, códigos y medidas exactamente como están (A04, G24 Power, 14C, 5G, 4G).
  · Formato de título: primera letra en mayúscula, sin MAYÚSCULAS sostenidas (ej. "Frontal Samsung A04 Original").
  · Sacá símbolos sueltos que no aportan ("&&", "**", comillas).
- "moneda": "USD" si los precios de la factura están en dólares (US$, U$S, USD, "dólar", "TOTAL PY", precios chicos de proveedor de Paraguay o Brasil con dos decimales como 7,00 o 12,20 por un repuesto), si no "ARS".
  Si hay una columna en dólares y otra convertida a otra moneda o con recargo (ej. "TOTAL PY" y "TOTAL ARG"), usá SOLO los valores en dólares.
- "codigo": el código o SKU del producto si figura; si no, null.
- "cantidad": número entero de unidades. Si dice "x10" o "pack x 10" dentro de la cantidad, usá las unidades totales.
- "precio_unitario": precio de UNA unidad tal como figura en la moneda de la factura, ya aplicado el descuento o bonificación de ese renglón. Sin símbolo $, con punto decimal.
  Si la factura tiene columna de precio unitario (ej. "ATACADO", "UNIT.", "P. UNIT.") usá esa; si solo tiene el total del renglón, dividilo por la cantidad.
- "subtotal": importe total del renglón, o null si no se lee.
- Números argentinos: "1.234,50" es 1234.50.
- "iva_discriminado": true si la factura muestra el IVA aparte (factura A, precios netos sin IVA); false si los precios ya incluyen IVA (factura B, C, X o remito).
- "fecha" en formato YYYY-MM-DD. "proveedor" es quien VENDE (no "Concepción Tecnología").
- Si un renglón no tiene descripción del producto, no lo incluyas.
- Si algo no se lee con seguridad, poné null. No inventes productos.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    moneda: { type: "STRING", enum: ["ARS", "USD"] },
    proveedor: { type: "STRING", nullable: true },
    cuit: { type: "STRING", nullable: true },
    tipo: { type: "STRING", nullable: true },
    iva_discriminado: { type: "BOOLEAN" },
    numero: { type: "STRING", nullable: true },
    fecha: { type: "STRING", nullable: true },
    total: { type: "NUMBER", nullable: true },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          descripcion: { type: "STRING" },
          nombre_es: { type: "STRING" },
          codigo: { type: "STRING", nullable: true },
          cantidad: { type: "INTEGER" },
          precio_unitario: { type: "NUMBER", nullable: true },
          subtotal: { type: "NUMBER", nullable: true },
          categoria_id: { type: "INTEGER" },
        },
        required: ["descripcion", "nombre_es", "cantidad", "categoria_id"],
      },
    },
  },
  required: ["moneda", "iva_discriminado", "items"],
};

// Leer una factura no necesita "pensar": con el razonamiento apagado responde mucho más rápido
const thinkingFor = (model: string) =>
  /gemini-[3-9]|latest/.test(model) ? { thinkingLevel: "low" } : /2\.5-flash/.test(model) ? { thinkingBudget: 0 } : undefined;

async function callModel(model: string, key: string, parts: unknown[], schema: unknown, thinking = true, timeoutMs = 50_000) {
  const base = process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com";
  const tc = thinking ? thinkingFor(model) : undefined;
  return fetch(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: schema, ...(tc ? { thinkingConfig: tc } : {}) },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

const imageParts = (images: InvoiceImage[]) => images.map((i) => ({ inline_data: { mime_type: i.mime, data: i.data } }));

/** Llama a Gemini y devuelve el JSON que respondió (con errores en castellano) */
export async function askGemini(parts: unknown[], schema: unknown, what = "el archivo"): Promise<any> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new PosError("Falta configurar GEMINI_API_KEY en el servidor", 500);

  // Se prueba el modelo elegido y, si Google está saturado o no responde, otros modelos gratis
  // (Google retira modelos seguido: si uno ya no existe, se usa el que Google sugiere en el error)
  const preferred = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const models = [preferred, ...(process.env.GEMINI_FALLBACKS || "gemini-3.5-flash,gemini-flash-lite-latest,gemini-flash-latest")
    .split(",").map((m) => m.trim()).filter((m) => m && m !== preferred)];
  const t0 = Date.now();
  const left = () => 55_000 - (Date.now() - t0);
  let res: Response | null = null;
  let lastErr: any = null;
  for (let i = 0; i < models.length && left() > 8_000; i++) {
    const model = models[i];
    const ts = Date.now();
    // al primero se le dan hasta 25 s; si no contesta, queda tiempo para otro modelo
    const timeout = Math.min(left() - 2_000, i < models.length - 1 ? 25_000 : 55_000);
    try {
      let r = await callModel(model, key, parts, schema, true, timeout);
      if (r.status === 400) {
        const peek: any = await r.clone().json().catch(() => ({}));
        // ese modelo no acepta la opción de "pensar menos": se repite sin ella
        if (/thinking/i.test(peek?.error?.message || "")) r = await callModel(model, key, parts, schema, false, Math.max(5_000, left() - 2_000));
      }
      console.log(`[gemini] ${model} → ${r.status} en ${((Date.now() - ts) / 1000).toFixed(1)}s`);
      res = r;
      if (r.status === 404) {
        // "...no longer available... use models/gemini-X instead" → se prueba ese a continuación
        const peek: any = await r.clone().json().catch(() => ({}));
        const sug = String(peek?.error?.message || "").match(/use models\/([\w.-]+)/i)?.[1];
        if (sug && !models.includes(sug)) models.splice(i + 1, 0, sug);
        console.error(`[gemini] ${model} ya no está disponible${sug ? `; probando ${sug}` : ""}. Conviene poner GEMINI_MODEL=${sug || "gemini-3.5-flash-lite"} en el .env`);
      }
      // 404 = modelo inexistente · 500/503 = Google saturado → se prueba el siguiente
      if ([404, 500, 503].includes(r.status) && i < models.length - 1) continue;
      break;
    } catch (e: any) {
      lastErr = e;
      console.error(`[gemini] ${model} sin respuesta tras ${((Date.now() - ts) / 1000).toFixed(1)}s:`, e?.name, e?.cause?.code || e?.message);
    }
  }
  if (!res) {
    throw new PosError(
      lastErr?.name === "TimeoutError" || !lastErr
        ? "La IA está muy lenta en este momento. Probá de nuevo en un rato."
        : "No se pudo conectar con la IA. Revisá la conexión a internet de la compu.", 502);
  }

  const body: any = await res.json().catch(() => ({}));
  if (res.status === 429) throw new PosError("Se alcanzó el límite gratis de la IA por ahora. Esperá un minuto y probá de nuevo.", 429);
  if (res.status === 400 || res.status === 403) {
    console.error("[gemini]", res.status, body?.error?.message);
    const badKey = res.status === 403 || /api key/i.test(body?.error?.message || "");
    throw new PosError(badKey ? "La API key de Gemini no es válida o no tiene permiso (revisá GEMINI_API_KEY)" : "La IA no pudo procesar el archivo (¿es una imagen o PDF válido?)", 502);
  }
  if (res.status === 503 || res.status === 500) { console.error("[gemini]", res.status, body?.error?.message); throw new PosError("Google está saturado en este momento. Probá de nuevo en un minuto.", 503); }
  if (!res.ok) { console.error("[gemini]", res.status, body?.error?.message); throw new PosError(`La IA no respondió bien (${res.status}). Probá de nuevo.`, 502); }

  const text: string | undefined = body?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("");
  if (!text) throw new PosError(`La IA no pudo leer ${what}. Probá con una foto más clara.`, 422);
  try { return JSON.parse(text); }
  catch { throw new PosError("La IA devolvió algo que no se entiende. Probá de nuevo (o con menos renglones).", 502); }
}

/** Lee la factura con Gemini y devuelve los datos ordenados */
export type Category = { id: number; name: string; subs?: string[] };

export async function readInvoice(images: InvoiceImage[], categories: Category[] = [], sheetText?: string): Promise<{ data: InvoiceRead; raw: unknown }> {
  // Se le pasan las categorías del local para que elija a cuál va cada producto
  const catText = categories.length
    ? `\n\nCATEGORÍAS DEL LOCAL (id: nombre — subcategorías):\n${categories.map((c) => `${c.id}: ${c.name}${c.subs?.length ? ` — ${c.subs.join(", ")}` : ""}`).join("\n")}
- "categoria_id": SIEMPRE poné el id de la categoría de la lista de arriba que mejor corresponda a ese producto según qué es (ej. un cable USB va en la de cables o cargadores, una funda en la de fundas, un mouse en la de accesorios de PC o gaming). Usá SOLO ids de la lista. Si el nombre no deja claro qué es, elegí igual la más probable (por marca, código o el resto de la factura); nunca lo dejes vacío.`
    : `\n- "categoria_id": null.`;
  const parts: unknown[] = [{ text: PROMPT + catText }];
  // Factura en Excel/CSV: va como texto (una fila por renglón, celdas separadas por ";")
  if (sheetText) parts.push({ text: "La factura llegó como PLANILLA de Excel en lugar de foto. Cada renglón es una fila y las columnas van separadas por \";\". Puede tener encabezados, datos del proveedor o totales en otras filas: tomá solo los renglones de productos.\n\nPLANILLA:\n" + sheetText });
  parts.push(...imageParts(images));
  const parsed = await askGemini(parts, SCHEMA, "la factura");
  const valid = new Set(categories.map((c) => c.id));
  const data = clean(parsed);
  for (const it of data.items) if (it.categoria_id != null && !valid.has(it.categoria_id)) it.categoria_id = null;
  return { data, raw: parsed };
}

// ═══════════════════════════════════════════════════════════════════
// LISTA DE PRECIOS del proveedor (foto, PDF o texto sacado de un Excel)
// ═══════════════════════════════════════════════════════════════════
export type PriceItem = { descripcion: string; codigo: string | null; precio: number };
export type PriceListRead = { proveedor: string | null; precios_con_iva: boolean | null; items: PriceItem[] };

const LIST_PROMPT = `Sos un asistente de un local de electrónica y accesorios de celular en Argentina.
Te paso la LISTA DE PRECIOS de un proveedor (foto, PDF o el texto de una planilla). Extraé cada producto con su precio y devolvé SOLO el JSON pedido.

Reglas:
- "items": una entrada por producto que tenga precio. Ignorá títulos, encabezados, categorías sueltas, condiciones de venta y renglones sin precio.
- "descripcion": el nombre del producto tal como aparece, sumando la marca o categoría del título si el renglón solo no se entiende (ej. título "FUNDAS SAMSUNG" + renglón "A54 silicona" → "Funda Samsung A54 silicona").
- "codigo": el código o SKU si figura; si no, null.
- "precio": precio de UNA unidad, sin $ y con punto decimal. Números argentinos: "1.234,50" es 1234.50.
  Si hay varias columnas de precio (ej. minorista / mayorista / por cantidad / contado), usá la del precio de COSTO para el comerciante: la mayorista o la de menor cantidad mínima. Si dice "x10" o "pack x 10", dividí para dar el precio por unidad.
  Si el precio está en dólares (USD, U$S), poné el número tal cual y aclaralo agregando " [USD]" al final de la descripción.
- "precios_con_iva": true si la lista dice que los precios incluyen IVA, false si dice "+ IVA" o "sin IVA", null si no aclara.
- "proveedor": el nombre de quien emite la lista, o null.
- No inventes productos ni precios. Si un precio no se lee con seguridad, salteá ese renglón.`;

const LIST_SCHEMA = {
  type: "OBJECT",
  properties: {
    proveedor: { type: "STRING", nullable: true },
    precios_con_iva: { type: "BOOLEAN", nullable: true },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          descripcion: { type: "STRING" },
          codigo: { type: "STRING", nullable: true },
          precio: { type: "NUMBER" },
        },
        required: ["descripcion", "precio"],
      },
    },
  },
  required: ["items"],
};

export async function readPriceList(input: { images?: InvoiceImage[]; text?: string }): Promise<PriceListRead> {
  const parts: unknown[] = [{ text: LIST_PROMPT }];
  if (input.text) parts.push({ text: "PLANILLA (columnas separadas por ;):\n" + input.text });
  if (input.images?.length) parts.push(...imageParts(input.images));
  const p = await askGemini(parts, LIST_SCHEMA, "la lista");
  const items: PriceItem[] = (Array.isArray(p?.items) ? p.items : [])
    .slice(0, 800)
    .map((i: any) => ({ descripcion: str(i?.descripcion, 255) || "", codigo: str(i?.codigo, 60), precio: num(i?.precio) ?? 0 }))
    .filter((i: PriceItem) => i.descripcion && i.precio > 0);
  return {
    proveedor: str(p?.proveedor, 150),
    precios_con_iva: typeof p?.precios_con_iva === "boolean" ? p.precios_con_iva : null,
    items,
  };
}

// Normaliza lo que devuelve la IA (nunca confiar del todo)
const num = (v: unknown) => {
  const n = typeof v === "string" ? Number(v.replace(/\./g, "").replace(",", ".")) : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};
const str = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

function clean(p: any): InvoiceRead {
  const items: InvoiceLine[] = (Array.isArray(p?.items) ? p.items : [])
    .slice(0, 150)
    .map((i: any) => ({
      descripcion: str(i?.descripcion, 255) || "",
      nombre_es: aCastellano(str(i?.nombre_es, 255) || str(i?.descripcion, 255) || ""),
      codigo: str(i?.codigo, 60),
      cantidad: Math.max(1, Math.min(9999, Math.round(Number(i?.cantidad) || 1))),
      precio_unitario: num(i?.precio_unitario),
      subtotal: num(i?.subtotal),
      categoria_id: Number.isInteger(Number(i?.categoria_id)) && Number(i?.categoria_id) > 0 ? Number(i.categoria_id) : null,
    }))
    .filter((i: InvoiceLine) => i.descripcion);
  const fecha = str(p?.fecha, 10);
  return {
    moneda: p?.moneda === "USD" ? "USD" : "ARS",
    proveedor: str(p?.proveedor, 150),
    cuit: str(p?.cuit, 20),
    tipo: str(p?.tipo, 20),
    iva_discriminado: p?.iva_discriminado === true,
    numero: str(p?.numero, 60),
    fecha: fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null,
    total: num(p?.total),
    items,
  };
}

// ═══════════════════════════════════════════════════════════════════
// ¿ES EL MISMO PRODUCTO? — para renglones de factura dudosos.
// Se le pasan pocos candidatos del catálogo por renglón y elige cuál es
// el mismo producto (aunque esté escrito distinto) o ninguno. Solo texto: es rápido.
// ═══════════════════════════════════════════════════════════════════
export type MatchQuestion = { linea: number; producto: string; candidatos: { id: number; nombre: string }[] };

const SAME_PROMPT = `Sos el encargado de stock de un local de accesorios y repuestos de celulares en Argentina.
Para cada renglón de una factura de proveedor te paso el producto y algunos artículos del catálogo del local.
Decidí si alguno es EXACTAMENTE el mismo producto, aunque esté escrito distinto (abreviado, en portugués, con otro orden de palabras,
"Frontal" = "Módulo" = "Pantalla", "Sam" = "Samsung", "Moto" = "Motorola", "Bat" = "Batería", "Ori" = "Original").
Es OTRO producto si cambia el modelo (A04 ≠ A04s ≠ A05, G24 ≠ G24 Power), la capacidad, la medida, el color o la calidad (Original ≠ Premium/Incell).
Si un artículo del catálogo lista varios modelos compatibles y el de la factura es uno de ellos con la misma calidad, es el mismo.
Ante la duda, respondé null: es preferible crear un artículo nuevo que sumar stock al equivocado.
Devolvé para cada renglón el "id" elegido (de SUS candidatos) o null.`;

const SAME_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: { linea: { type: "INTEGER" }, id: { type: "INTEGER", nullable: true } },
    required: ["linea", "id"],
  },
};

export async function confirmMatches(qs: MatchQuestion[]): Promise<Map<number, number | null>> {
  const out = new Map<number, number | null>();
  if (!qs.length) return out;
  const text = qs.map((q) => `RENGLÓN ${q.linea}: ${q.producto}\n${q.candidatos.map((c) => `  - id ${c.id}: ${c.nombre}`).join("\n")}`).join("\n\n");
  const parsed = await askGemini([{ text: `${SAME_PROMPT}\n\n${text}` }], SAME_SCHEMA, "los productos");
  for (const r of Array.isArray(parsed) ? parsed : []) {
    const q = qs.find((x) => x.linea === Number(r?.linea));
    if (!q) continue;
    const id = Number(r?.id);
    out.set(q.linea, q.candidatos.some((c) => c.id === id) ? id : null);   // solo ids que se le ofrecieron
  }
  return out;
}
