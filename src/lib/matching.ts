// ═══════════════════════════════════════════════════════════════════
// Emparejar lo que dice la factura con los artículos del sistema
// (sin IA: por código y por palabras en común)
// ═══════════════════════════════════════════════════════════════════

export type Candidate = { id: number; name: string; sku: string | null; supplier_id: number | null };

const STOP = new Set(["de", "del", "la", "el", "para", "con", "x", "y", "en", "a", "por", "unid", "u", "un", "una"]);

export const normText = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/(\d)\s*(mts?|metros?)\b/g, "$1m")                 // "1 mts" → "1m"
    .replace(/(\d)\s*(w|mah|gb|tb|mm|cm|m|v|a|hz)\b/g, "$1$2")   // "25 w" → "25w"
    .replace(/[^a-z0-9]+/g, " ").trim();

// Sinónimos y abreviaturas (también portugués): se comparan como si fueran la misma palabra.
// "" = palabra que no suma nada a la comparación (se ignora).
const SYN: Record<string, string> = {
  sam: "samsung", sams: "samsung", moto: "motorola", mot: "motorola", xiaomi: "xiaomi", redmi: "redmi",
  bat: "bateria", batt: "bateria", battery: "bateria",
  frontal: "modulo", pantalla: "modulo", display: "modulo", lcd: "modulo", tela: "modulo",
  tampa: "tapa", conec: "conector", conect: "conector", pin: "conector",
  ori: "original", orig: "original", premium: "premium",
  preto: "", preta: "", black: "negro", com: "", sem: "sin",
  cinza: "gris", grey: "gris", gray: "gris", branco: "blanco", white: "blanco", red: "rojo", vermelho: "rojo", blue: "azul",
  grafite: "grafito", graphite: "grafito",
};
const COLORES = new Set(["negro", "blanco", "rojo", "azul", "gris", "grafito", "verde", "rosa", "dorado", "plateado", "violeta", "amarillo", "celeste", "lila", "naranja"]);
const tokens = (s: string) =>
  normText(s).split(" ").map((t) => (t in SYN ? SYN[t] : t)).filter((t) => t.length > 1 && !STOP.has(t));

/** Devuelve los mejores artículos para una línea de la factura (score de 0 a 1) */
export function bestMatches(desc: string, code: string | null, products: Candidate[], supplierId: number | null, limit = 3) {
  const codeN = code ? normText(code).replace(/ /g, "") : "";
  const dt = tokens(desc);
  const dset = new Set(dt);
  const out: { id: number; name: string; score: number }[] = [];

  for (const p of products) {
    let score = 0;
    const sku = p.sku ? normText(p.sku).replace(/ /g, "") : "";
    if (codeN && sku && codeN === sku) score = 1;
    else {
      const pt = tokens(p.name);
      if (!pt.length || !dt.length) continue;
      let common = 0, weight = 0, total = 0;
      for (const t of new Set(pt)) {
        const w = /\d/.test(t) ? 2 : 1; // números y modelos (a54, 25w, 13) pesan más
        total += w;
        if (dset.has(t)) { common++; weight += w; }
      }
      if (!common) continue;
      const totalD = dt.reduce((n, t) => n + (/\d/.test(t) ? 2 : 1), 0);
      score = (2 * weight) / (total + totalD); // Dice ponderado
      // Modelos distintos (iPhone 14 vs 15, A54 vs A34, 20W vs 25W): casi seguro es otro producto
      const conflicts = pt.filter((t) => /\d/.test(t) && !dset.has(t)).length;
      if (conflicts && dt.some((t) => /\d/.test(t))) score *= Math.pow(0.5, conflicts);
      // Colores distintos (tapa azul vs tapa roja): es otro producto
      const pc = pt.filter((t) => COLORES.has(t)), dc = dt.filter((t) => COLORES.has(t));
      if (pc.length && dc.length && !pc.some((c) => dc.includes(c))) score *= 0.3;
      if (supplierId && p.supplier_id === supplierId) score = Math.min(1, score + 0.08);
    }
    if (score >= 0.25) out.push({ id: p.id, name: p.name, score: Math.round(score * 100) / 100 });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
