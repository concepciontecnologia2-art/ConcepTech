// ═══════════════════════════════════════════════════════════════════
// Nombres de productos en castellano (red de seguridad después de la IA)
// Facturas de proveedores de Paraguay/Brasil vienen con palabras en portugués
// o abreviadas: se borra "preto" y se traducen las más comunes.
// ═══════════════════════════════════════════════════════════════════

// palabra (en minúsculas, sin acentos) → reemplazo ("" = se borra)
const PT_ES: Record<string, string> = {
  preto: "", preta: "",
  tampa: "Tapa", conec: "Conector", com: "con", sem: "sin",
  cinza: "Gris", branco: "Blanco", branca: "Blanca", vermelho: "Rojo", vermelha: "Roja",
  grafite: "Grafito", dourado: "Dorado", prata: "Plateado", rosa: "Rosa", verde: "Verde",
  diagnosticavel: "con diagnóstico", carregador: "Cargador", fone: "Auricular", capinha: "Funda", pelicula: "Templado",
};
const sinAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function aCastellano(name: string): string {
  const limpio = (name || "")
    .replace(/&&|\*\*|["“”]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      const k = sinAcento(w).replace(/[^a-z]/g, "");
      return k in PT_ES && /^[^\d]+$/.test(w) ? PT_ES[k] : w;
    })
    .filter((w) => w !== "")
    .join(" ")
    .trim();
  return limpio || (name || "").trim();
}
