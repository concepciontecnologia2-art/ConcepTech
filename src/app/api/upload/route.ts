import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const cookie = req.cookies.get("ct_admin");
  if (cookie?.value !== process.env.SESSION_SECRET)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "Sin archivo" }, { status: 400 });

    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", "conceptech_uploads");
    data.append("folder", "conceptech");

    console.log("Subiendo a Cloudinary, cloud:", process.env.CLOUDINARY_CLOUD_NAME);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: "POST", body: data }
    );

    const json = await res.json();
    console.log("Respuesta Cloudinary:", json);

    if (!json.secure_url) return NextResponse.json({ error: json.error?.message || "Error al subir" }, { status: 500 });
    return NextResponse.json({ url: json.secure_url });
  } catch(e:any) {
    console.error("Error upload:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}