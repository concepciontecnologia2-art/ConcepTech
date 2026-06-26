import type { Metadata } from "next";
import { query } from "@/lib/db";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const rows = await query(
    `SELECT name, price_wholesale, image_url FROM products WHERE id = $1`,
    [id]
  ).catch(() => []);

  const product = rows[0];
  if (!product) return { title: "Producto Mayorista — Concepción Tecnología" };

  const price = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(product.price_wholesale));

  return {
    title: `${product.name} (Mayorista) — Concepción Tecnología`,
    description: `Precio mayorista: ${price}. Concepción Tecnología, Venta al por mayor.`,
    openGraph: {
      title: `📦 ${product.name} | Mayorista`,
      description: `${price} — Concepción Tecnología`,
      images: product.image_url ? [{ url: String(product.image_url), width: 800, height: 800 }] : [],
    },
  };
}

export default function ProductoLayout({ children }: { children: React.ReactNode }) {
  return children;
}