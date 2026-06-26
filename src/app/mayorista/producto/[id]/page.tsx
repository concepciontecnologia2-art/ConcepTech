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
  const sendWhatsApp = () => {
  const items = cart.map(i => `• ${i.qty}x ${i.name} — ${fmt(i.qty * Number(i.price_wholesale))}`).join("\n");
  const total = cart.reduce((s, i) => s + i.qty * Number(i.price_wholesale), 0);
  
  const msg = encodeURIComponent(
    `📦 *Nuevo Pedido Mayorista*\n\n` +
    `${items}\n\n` +
    `*Total: ${fmt(total)}*\n\n` +
    `¡Espero confirmación!`
  );
  
  window.open(`https://wa.me/${WA}?text=${msg}`, "_blank");
};

  useEffect(() => {
    const saved = localStorage.getItem("cart");
    if (saved) setCart(JSON.parse(saved));
    fetch(`/api/products/${id}`)
      .then(r => r.json())
      .then(p => { setProduct(p); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => { localStorage.setItem("cart", JSON.stringify(cart)); }, [cart]);

  const updateCart = (p: any, delta: number) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === p.id);
      if (!existing && delta > 0) return [...prev, { ...p, qty: 1 }];
      return prev.map(i => i.id === p.id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0);
    });
  };

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Cargando...</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: 80 }}>
      {/* HEADER PROFESIONAL */}
      <header style={{ background: "#ffffff", padding: "16px 24px", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 10 }}>
        <a href="/mayorista" style={{ color: "#1e293b", textDecoration: "none", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          ← <span style={{ fontSize: 14 }}>Volver al catálogo</span>
        </a>
      </header>

      <main style={{ maxWidth: 600, margin: "24px auto", padding: "0 20px" }}>
        <div style={{ background: "#fff", padding: 24, borderRadius: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <img src={product?.image_url} style={{ width: "100%", borderRadius: 16, objectFit: "cover", marginBottom: 24 }} />
          
          <span style={{ background: "#eff6ff", color: "#2563eb", padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>Venta Mayorista</span>
          <h1 style={{ fontSize: 24, margin: "16px 0", color: "#0f172a" }}>{product?.name}</h1>
          <p style={{ fontSize: 28, fontWeight: 800, color: "#1e293b" }}>{fmt(Number(product?.price_wholesale))}</p>
          
          <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 12, background: "#f1f5f9", padding: 8, borderRadius: 12, width: "fit-content" }}>
            <button onClick={() => updateCart(product, -1)} style={{ width: 40, height: 40, borderRadius: 8, border: "none", background: "#fff", cursor: "pointer", fontWeight: 700 }}>−</button>
            <span style={{ width: 40, textAlign: "center", fontWeight: 700, fontSize: 16 }}>{cart.find(i => i.id === product?.id)?.qty || 0}</span>
            <button onClick={() => updateCart(product, 1)} style={{ width: 40, height: 40, borderRadius: 8, border: "none", background: "#3b82f6", color: "#fff", cursor: "pointer", fontWeight: 700 }}>+</button>
          </div>
        </div>
      </main>

      {/* CARRITO FLOTANTE ESTILIZADO */}
      {cart.length > 0 && (
        <button onClick={() => setIsCartOpen(true)} 
          style={{ position: "fixed", bottom: 24, right: 24, background: "#0f172a", color: "#fff", padding: "16px 24px", borderRadius: 16, border: "none", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.2)" }}>
          🛒 Ver Carrito ({cart.reduce((a, b) => a + b.qty, 0)})
        </button>
      )}

      {/* DRAWER PROFESIONAL */}
      {isCartOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }} onClick={() => setIsCartOpen(false)}>
          <div style={{ position: "absolute", right: 0, top: 0, height: "100%", width: "100%", maxWidth: 400, background: "#000000", padding: 24, animation: "slideIn 0.3s ease-out" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ margin: 0 }}>Tu pedido</h2>
              <button onClick={() => setIsCartOpen(false)} style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {cart.map(item => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: 13, color: "#f5f1f1" }}>{item.qty} unidades</div>
                  </div>
                  <div style={{ fontWeight: 700 }}>{fmt(item.price_wholesale * item.qty)}</div>
                </div>
              ))}
            </div>
            <button 
  onClick={sendWhatsApp}
  style={{ 
    width: "100%", 
    padding: 16, 
    background: "#22c55e", 
    color: "#fff", 
    border: "none", 
    borderRadius: 12, 
    marginTop: 32, 
    cursor: "pointer", 
    fontWeight: 700 
  }}
>
  Enviar pedido por WhatsApp
</button>
          </div>
        </div>
      )}
      
      <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </div>
  );
}