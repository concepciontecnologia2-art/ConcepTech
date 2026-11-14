// POST → subir una imagen de producto a ImageKit (solo admin)
// Solo acepta JPG, PNG, WEBP o GIF de hasta 5 MB, y verifica el contenido
// real del archivo (no solo la extensión), para que no se pueda subir
// un HTML/SVG/ejecutable disfrazado de imagen.
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated, isAdminRequest } from "@/lib/auth";
import { limitByIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;

// Firma de los primeros bytes de cada formato permitido
function detectImage(buf: Buffer): { ext: string } | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png" };
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return { ext: "webp" };
  if (buf.subarray(0, 4).toString("ascii") === "GIF8") return { ext: "gif" };
  return null;
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const limited = await limitByIp(req, "upload", 60, 10 * 60);
  if (limited) return limited;

  try {
    const len = Number(req.headers.get("content-length") || 0);
    if (len > MAX_BYTES + 100_000) return NextResponse.json({ error: "La imagen supera los 5 MB" }, { status: 413 });

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Sin archivo" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "La imagen supera los 5 MB" }, { status: 413 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const kind = detectImage(buffer);
    if (!kind) return NextResponse.json({ error: "Formato no permitido. Usá JPG, PNG, WEBP o GIF." }, { status: 415 });

    // Nombre generado por el servidor (no se usa el nombre que manda el navegador)
    const fileName = `producto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${kind.ext}`;

    const uploadData = new FormData();
    uploadData.append("file", buffer.toString("base64"));
    uploadData.append("fileName", fileName);
    uploadData.append("folder", "/conceptech");

    if (!process.env.IMAGEKIT_PRIVATE_KEY)
      return NextResponse.json({ error: "Falta configurar IMAGEKIT_PRIVATE_KEY en el servidor" }, { status: 500 });
    const authHeader = Buffer.from(`${process.env.IMAGEKIT_PRIVATE_KEY}:`).toString("base64");
    const res = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
      method: "POST",
      headers: { Authorization: `Basic ${authHeader}` },
      body: uploadData,
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json.url) {
      console.error("Error respuesta ImageKit:", res.status, json);
      const why = res.status === 401 || res.status === 403
        ? "La clave de ImageKit no es válida (¿la cambiaste y falta actualizar IMAGEKIT_PRIVATE_KEY?)"
        : `ImageKit rechazó la imagen${json?.message ? `: ${json.message}` : ""}`;
      return NextResponse.json({ error: why }, { status: 502 });
    }
    return NextResponse.json({ url: json.url });
  } catch (error) {
    console.error("Error interno en subida:", error);
    return NextResponse.json({ error: "Error en el servidor al procesar la imagen" }, { status: 500 });
  }
}
