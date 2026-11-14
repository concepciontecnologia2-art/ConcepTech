// ═══════════════════════════════════════════════════════════════════
// MIDDLEWARE DE SEGURIDAD (corre antes de cada llamada a /api)
// Protección CSRF: cualquier POST/PUT/PATCH/DELETE que venga desde
// OTRO sitio web se rechaza. Los navegadores siempre mandan el header
// "Origin" en esas requests, así que una página maliciosa no puede
// usar la sesión del admin para borrar productos, anular ventas, etc.
// ═══════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Solo en desarrollo: túneles para probar desde el celular (VS Code, Cloudflare, ngrok).
// En producción (Vercel) NO se aceptan.
const DEV_TUNNELS = /\.(devtunnels\.ms|trycloudflare\.com|ngrok-free\.app|ngrok\.io|ngrok\.app)$/i;

// Dominios extra permitidos, separados por coma (ej. "concepciontecnologia.com.ar,www.concepciontecnologia.com.ar")
const EXTRA = (process.env.ALLOWED_ORIGINS || "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);

export function middleware(req: NextRequest) {
  if (!SAFE_METHODS.has(req.method)) {
    const origin = req.headers.get("origin");
    if (origin) {
      let originHost = "";
      try { originHost = new URL(origin).host.toLowerCase(); } catch {}
      // Un túnel o proxy puede cambiar el "host", así que se aceptan los dos encabezados
      const hosts = [req.headers.get("x-forwarded-host"), req.headers.get("host")]
        .filter(Boolean).map((h) => h!.split(",")[0].trim().toLowerCase());
      const ok =
        !!originHost && (
          hosts.includes(originHost) ||
          EXTRA.includes(originHost) ||
          (process.env.NODE_ENV !== "production" && DEV_TUNNELS.test(originHost.split(":")[0]))
        );
      if (!ok) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*"] };
