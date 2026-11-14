import type { Metadata, Viewport } from "next";
import "./globals.css";
import NoZoom from "@/components/NoZoom";

export const metadata: Metadata = {
  title: "Concepción Tecnología",
  description: "Tu tienda de tecnología en Concepción, Tucumán.",
};

// Sin zoom en ningún dispositivo (Next arma la etiqueta viewport con esto)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Concepción Tecnología" />
        <link rel="apple-touch-icon" href="/images/logo.png" />
      </head>
      <body>
        <NoZoom />
        {children}
      </body>
    </html>
  );
}
