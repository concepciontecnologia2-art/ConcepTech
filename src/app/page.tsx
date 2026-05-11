"use client";
import { useState, useEffect } from "react";
import StoreFront from "@/components/store/StoreFront";

export default function HomePage() {
  const [products, setProducts]     = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

  const loadData = () => {
    Promise.all([
      fetch("/api/products", { cache:"no-store" }).then(r=>r.json()),
      fetch("/api/categories", { cache:"no-store" }).then(r=>r.json()),
    ]).then(([p,c])=>{
      setProducts(Array.isArray(p)?p:[]);
      setCategories(Array.isArray(c)?c:[]);
      setLoading(false);
    }).catch(()=>setLoading(false));
  };

  useEffect(()=>{
  loadData();
  const interval = setInterval(loadData, 30000);
  return () => {
    clearInterval(interval);
  };
},[]);

  if (loading) return (
    <div style={{minHeight:"100vh",background:"#080c10",display:"flex",alignItems:"center",justifyContent:"center",color:"#445",fontFamily:"sans-serif",fontSize:14}}>
      Cargando...
    </div>
  );

  return <StoreFront initialProducts={products} categories={categories}/>;
}