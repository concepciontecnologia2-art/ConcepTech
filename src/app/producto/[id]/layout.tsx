import { Metadata } from "next";
import { query } from "@/lib/db";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await query(
    `SELECT name, price_retail, image_url, description FROM products WHERE id = $1`,
    [id]
  ).then(r => r[0]).catch(() => null);

  if (!product) return { title: "Producto — Concepción Tecnología" };

  const price = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(product.price_retail));

  return {
    title: `${product.name} — Concepción Tecnología`,
    description: `${product.name} · ${price} · Concepción Tecnología, Independencia 450, Tucumán.`,
    openGraph: {
      title: `🛒 ${product.name}`,
      description: `${price} — Concepción Tecnología`,
      images: product.image_url ? [{ url: product.image_url, width: 800, height: 800 }] : [],
      url: `https://concep-tech.vercel.app/producto/${id}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `🛒 ${product.name}`,
      description: `${price} — Concepción Tecnología`,
      images: product.image_url ? [product.image_url] : [],
    },
  };
}

export default function ProductoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}