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
        <link rel="manifest" href="/manifest.json"/>
        <meta name="theme-color" content="#00B4D8"/>
        <meta name="mobile-web-app-capable" content="yes"/>
        <meta name="apple-mobile-web-app-capable" content="yes"/>
        <meta name="apple-mobile-web-app-title" content="CT Admin"/>
      </head>
      <body>{children}</body>
    </html>
  );
}