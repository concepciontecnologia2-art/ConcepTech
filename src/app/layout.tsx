import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Concepción Tecnología",
  description: "Tu tienda de tecnología en Concepción, Tucumán.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="Concepción Tecnología" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="apple-touch-icon" href="/images/logo.png"/>
      </head>
      <body>{children}</body>
    </html>
  );
}