"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

const fmt = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
const WA = process.env.NEXT_PUBLIC_WHATSAPP!;

export default function ProductoMayoristaPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<any>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("cart");
    if (saved) setCart(JSON.parse(saved));
    fetch(`/api/products/${id}`)
      .then(r => r.json())
      .then(p => { setProduct(p); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => { localStorage.setItem("cart", JSON.stringify(cart)); }, [cart]);

  const addToCart = (p: any) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === p.id);
      return ex ? prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i) : [...prev, { ...p, qty: 1 }];
    });
  };

  const updateQty = (id: number, d: number) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + d) } : i).filter(i => i.qty > 0));
  };

  const sendWhatsApp = () => {
    const items = cart.map(i => `• ${i.qty}x ${i.name} — ${fmt(i.qty * Number(i.price_wholesale))}`).join("\n");
    const total = cart.reduce((s, i) => s + i.qty * Number(i.price_wholesale), 0);
    const msg = encodeURIComponent(`📦 *Nuevo Pedido Mayorista*\n\n${items}\n\n*Total: ${fmt(total)}*\n\n¡Espero confirmación!`);
    window.open(`https://wa.me/${WA}?text=${msg}`, "_blank");
    setCart([]);
    localStorage.removeItem("cart");
    setIsCartOpen(false);
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}>Cargando...</div>;
  if (!product) return <div style={{ padding: 40, textAlign: "center" }}>Producto no encontrado.</div>;

  const itemInCart = cart.find(i => i.id === product.id);

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui" }}>
      <header style={{ background: "#fff", padding: 20, borderBottom: "1px solid #e2e8f0" }}>
        <a href="/mayorista" style={{ color: "#000", fontWeight: 700, textDecoration: "none" }}>← Volver al catálogo</a>
      </header>

      <main style={{ maxWidth: 600, margin: "24px auto", padding: "0 20px" }}>
        <div style={{ background: "#fff", padding: 24, borderRadius: 20, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <img src={product.image_url} style={{ width: "100%", borderRadius: 12 }} alt={product.name} />
          <h1 style={{ fontSize: 24, marginTop: 16 }}>{product.name}</h1>
          <p style={{ fontSize: 28, fontWeight: 800, color: "#3b82f6" }}>{fmt(Number(product.price_wholesale))}</p>
          
          <div style={{ display: "flex", alignItems: "center", gap: 15, marginTop: 20 }}>
            <button onClick={() => updateQty(product.id, -1)} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #ccc", cursor: "pointer" }}>-</button>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{itemInCart?.qty || 0}</span>
            <button onClick={() => addToCart(product)} style={{ padding: "10px 20px", borderRadius: 8, background: "#3b82f6", color: "#fff", border: "none", cursor: "pointer" }}>+</button>
          </div>
        </div>
      </main>

      {cart.length > 0 && (
        <button onClick={() => setIsCartOpen(true)} style={{ position: "fixed", bottom: 20, right: 20, background: "#000", color: "#fff", padding: "15px 25px", borderRadius: 30, border: "none", cursor: "pointer", zIndex: 999 }}>
          🛒 Ver Carrito ({cart.reduce((a, b) => a + b.qty, 0)})
        </button>
      )}

      {isCartOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, backdropFilter: "blur(4px)" }} onClick={() => setIsCartOpen(false)}>
          <div style={{ position: "absolute", right: 0, top: 20, bottom: 20, width: "90%", maxWidth: 400, background: "#fff", padding: 24, borderRadius: "24px 0 0 24px", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>Tu Pedido</h2>
              <button onClick={() => setIsCartOpen(false)} style={{ border: "none", background: "#f1f5f9", padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}>← Volver</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {cart.map(item => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", margin: "15px 0" }}>
                  <span>{item.qty}x {item.name}</span>
                  <button onClick={() => setCart(prev => prev.filter(p => p.id !== item.id))} style={{ color: "red", border: "none", background: "none", cursor: "pointer" }}>✕</button>
                </div>
              ))}
            </div>
            <button onClick={sendWhatsApp} style={{ width: "100%", padding: 15, background: "#22c55e", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>Enviar por WhatsApp</button>
          </div>
        </div>
      )}
    </div>
  );
}