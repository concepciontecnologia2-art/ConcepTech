import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // 1. Verificación de sesión de administrador
  const cookie = req.cookies.get("ct_admin");
  if (cookie?.value !== process.env.SESSION_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    // 2. Extracción del archivo recibido
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Sin archivo" }, { status: 400 });
    }

    // 3. Conversión del archivo a Buffer/Base64 para garantizar compatibilidad con ImageKit API
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4. Preparación de los datos para la API de ImageKit
    const uploadData = new FormData();
    uploadData.append("file", buffer.toString("base64"));
    uploadData.append("fileName", file.name);
    uploadData.append("folder", "/conceptech");

    // 5. Autenticación Basic Auth con Private Key
    const authHeader = Buffer.from(`${process.env.IMAGEKIT_PRIVATE_KEY}:`).toString("base64");

    const res = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
      },
      body: uploadData,
    });

    const json = await res.json();

    if (!res.ok || !json.url) {
      console.error("Error respuesta ImageKit:", json);
      return NextResponse.json({ error: json.message || "Error al subir a ImageKit" }, { status: 500 });
    }

    // Retorna la URL directa de la imagen subida
    return NextResponse.json({ url: json.url });
  } catch (error) {
    console.error("Error interno en subida:", error);
    return NextResponse.json({ error: "Error en el servidor al procesar la imagen" }, { status: 500 });
  }
}