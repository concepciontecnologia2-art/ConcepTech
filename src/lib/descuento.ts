// Texto del descuento en las boletas: "Descuento 3%" cuando fue un porcentaje.
// No se guarda el % en la venta: se deduce del monto. Si el monto corresponde a un
// porcentaje "redondo" (3%, 5%, 7,5%…) se muestra; si fue un monto fijo en pesos, no.
export function discountPct(subtotal: number, discount: number): number | null {
  if (!(subtotal > 0) || !(discount > 0)) return null;
  const pct = (discount / subtotal) * 100;
  for (const step of [1, 0.5, 0.25, 0.1]) {
    const r = Math.round(pct / step) * step;
    // el monto se guardó redondeado a centavos: tolerancia de 1 centavo
    if (r > 0 && Math.abs((subtotal * r) / 100 - discount) <= 0.011) return Math.round(r * 100) / 100;
  }
  return null;
}

export function discountLabel(subtotal: number, discount: number) {
  const p = discountPct(subtotal, discount);
  return p ? `Descuento ${String(p).replace(".", ",")}%` : "Descuento";
}
