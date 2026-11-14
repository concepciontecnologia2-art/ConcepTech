// Cálculo de precios de venta cuando cambia el costo (lo usan la pantalla y el servidor, así dan igual)
export const round10 = (n: number) => Math.round(n / 10) * 10;

export type PriceMode = "cost" | "margin" | "pct";
type Current = { cost_price: number | null; price_retail: number; price_wholesale: number | null };

/** Precios de venta nuevos. `skipped` = no se pudo mantener el margen porque no tenía costo anterior */
export function newSalePrice(mode: PriceMode, p: Current, newCost: number, rPct: number, wPct: number) {
  if (mode === "pct") return { retail: round10(newCost * (1 + rPct / 100)), wholesale: round10(newCost * (1 + wPct / 100)), skipped: false };
  if (mode === "margin") {
    if (!p.cost_price || p.cost_price <= 0) return { retail: p.price_retail, wholesale: p.price_wholesale, skipped: true };
    const f = newCost / p.cost_price;
    return {
      retail: round10(p.price_retail * f),
      wholesale: p.price_wholesale != null && p.price_wholesale > 0 ? round10(p.price_wholesale * f) : p.price_wholesale,
      skipped: false,
    };
  }
  return { retail: p.price_retail, wholesale: p.price_wholesale, skipped: false };
}
