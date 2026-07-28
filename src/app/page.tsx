"use client";
import { useState, useEffect } from "react";
import StoreFront from "@/components/store/StoreFront";

export default function HomePage() {
  const [products, setProducts]     = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

 const loadData = async () => {
  try {
    const [productsRes, categoriesRes] = await Promise.all([
      fetch("/api/products", {
        credentials: "include",
        next: { revalidate: 300 } // caché de 5 minutos
      }),
      fetch("/api/categories", { 
        cache: "no-store" 
      }),
    ]);

    const p = await productsRes.json();
    const c = await categoriesRes.json();

    setProducts(Array.isArray(p) ? p : []);
    setCategories(Array.isArray(c) ? c : []);
  } catch (error) {
    console.error("Error al cargar los datos:", error);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
  loadData();
  const interval = setInterval(loadData, 3600000); // 1 hora
  return () => {
    clearInterval(interval);
  };
}, []);

  if (loading) return (
    <div style={{minHeight:"100vh",background:"#080c10",display:"flex",alignItems:"center",justifyContent:"center",color:"#445",fontFamily:"sans-serif",fontSize:14}}>
      Cargando...
    </div>
  );

  return <StoreFront initialProducts={products} categories={categories}/>;
}