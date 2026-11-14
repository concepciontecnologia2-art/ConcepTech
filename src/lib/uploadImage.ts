// Sube una foto de producto (se usa en Artículos: foto principal, fotos extra, "Sin foto" y alta).
// - Achica la foto en el navegador (las del celular pesan 4–10 MB y Vercel corta en 4,5 MB)
// - Devuelve la URL o tira un error con un mensaje claro para mostrar
const MAX_SIDE = 1600;

async function shrink(file: File): Promise<Blob> {
  if (file.type === "image/gif") return file;           // los GIF se suben tal cual (pueden ser animados)
  if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name))
    throw new Error("Las fotos HEIC del iPhone no se pueden subir desde la compu. Mandala por WhatsApp o exportala como JPG y probá de nuevo.");
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file); }
  catch { throw new Error("No se pudo abrir la imagen. Usá una foto JPG, PNG o WEBP."); }
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size < 1_500_000 && /jpeg|png|webp/.test(file.type)) { bmp.close(); return file; }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); // fondo blanco para PNG transparentes
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!blob) throw new Error("No se pudo procesar la imagen");
  return blob;
}

export async function uploadProductImage(file: File): Promise<string> {
  const blob = await shrink(file);
  const fd = new FormData();
  fd.append("file", blob, "foto.jpg");
  let res: Response;
  try { res = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd }); }
  catch { throw new Error("Sin conexión: no se pudo subir la foto"); }
  const json: any = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403)
    throw new Error("Se venció el acceso de administrador. Tocá \"Modificar artículos\" para volver a entrar y subí la foto de nuevo.");
  if (res.status === 413) throw new Error("La foto es demasiado pesada");
  if (!res.ok || !json.url) throw new Error(json.error || `No se pudo subir la foto (error ${res.status})`);
  return json.url as string;
}
