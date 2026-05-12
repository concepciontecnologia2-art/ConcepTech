import MayoristaPage from "@/components/store/MayoristaPage";

export const dynamic = "force-dynamic";

async function getData() {
  const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
  try {
    const [p, c] = await Promise.all([
      fetch(`${base}/api/products`, { cache:"no-store" }).then(r=>r.json()),
      fetch(`${base}/api/categories`, { cache:"no-store" }).then(r=>r.json()),
    ]);
    return {
      products: Array.isArray(p) ? p : [],
      categories: Array.isArray(c) ? c : []
    };
  } catch {
    return { products: [], categories: [] };
  }
}

export default async function Page() {
  const { products, categories } = await getData();
  return <MayoristaPage initialProducts={products} categories={categories}/>;
}