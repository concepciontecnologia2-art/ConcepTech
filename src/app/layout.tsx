import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Concepción Tecnología",
  description: "Tu tienda de tecnología en Concepción, Tucumán.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body>{children}</body></html>;
}