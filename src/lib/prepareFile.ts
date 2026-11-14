// Prepara fotos y PDF para mandarlos a la IA (se usa en Compras y en Lista de precios)

/** Achica la foto antes de mandarla (más rápido y entra en el límite del servidor) */
export async function prepareFile(file: File, opts: { max?: number } = {}): Promise<{ mime: string; data: string; preview: string; name: string }> {
  const toB64 = (blob: Blob) => new Promise<string>((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] || "");
    r.onerror = () => fail(new Error("No se pudo leer el archivo"));
    r.readAsDataURL(blob);
  });
  if (file.type === "application/pdf") {
    if (file.size > 3_000_000) throw new Error(`${file.name}: el PDF pesa más de 3 MB`);
    return { mime: "application/pdf", data: await toB64(file), preview: "", name: file.name };
  }
  try {
    const bmp = await createImageBitmap(file);
    const max = opts.max ?? 1800;
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob: Blob = await new Promise((ok) => canvas.toBlob((b) => ok(b!), "image/jpeg", 0.82));
    return { mime: "image/jpeg", data: await toB64(blob), preview: URL.createObjectURL(blob), name: file.name };
  } catch {
    // Ej. HEIC del iPhone en una compu: se manda tal cual (la IA lo entiende)
    if (file.size > 3_000_000) throw new Error(`${file.name}: la foto pesa demasiado; sacala de nuevo o en JPG`);
    const mime = file.type || (/\.hei[cf]$/i.test(file.name) ? "image/heic" : "image/jpeg");
    return { mime, data: await toB64(file), preview: "", name: file.name };
  }
}
