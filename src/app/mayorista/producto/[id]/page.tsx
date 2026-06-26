"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

const fmt = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
const WA = process.env.NEXT_PUBLIC_WHATSAPP!;
const GENERIC = "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&q=80";

export default function ProductoMayoristaPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<any>(null);
  const [images, setImages] = useState<string[]>([]);
  const [currentImg, setCurrentImg] = useState(0);
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    const saved = localStorage.getItem("mayorista_cart");
    if (saved) setCart(JSON.parse(saved));

    fetch(`/api/products/${id}`)
      .then(r => r.json())
      .then(p => {
        setProduct(p);
        setLoading(false);
        // Cargar fotos adicionales
        fetch(`/api/products/${id}/images`)
          .then(r => r.json())
          .then((extra: any[]) => {
            const all = [p.image_url, ...extra.map((i: any) => i.image_url)].filter(Boolean) as string[];
            setImages(all.length > 0 ? all : [GENERIC]);
          }).catch(() => setImages([p.image_url || GENERIC]));
      })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => { localStorage.setItem("mayorista_cart", JSON.stringify(cart)); }, [cart]);

  const addToCart = () => {
    if (!product) return;
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      return ex
        ? prev.map(i => i.id === product.id ? { ...i, qty: i.qty + qty } : i)
        : [...prev, { ...product, qty }];
    });
  };

  const updateQty = (id: number, d: number) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + d) } : i));
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const sendWhatsApp = () => {
    const items = cart.map(i => `• ${i.qty}x ${i.name} — ${fmt(i.qty * Number(i.price_wholesale))}`).join("\n");
    const total = cart.reduce((s, i) => s + i.qty * Number(i.price_wholesale), 0);
    const msg = encodeURIComponent(
      `📦 *Pedido Mayorista - Concepción Tecnología*\n\n${items}\n\n*Total: ${fmt(total)}*\n\n¡Espero confirmación!`
    );
    window.open(`https://wa.me/${WA}?text=${msg}`, "_blank");
  };

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + i.qty * Number(i.price_wholesale), 0);
  const itemInCart = cart.find(i => i.id === product?.id);

  const stockColor = !product ? "#666" :
    Number(product.stock_quantity) === 0 ? "#ef4444" :
    Number(product.stock_quantity) <= 3 ? "#ef4444" :
    Number(product.stock_quantity) <= 10 ? "#f59e0b" : "#10b981";

  const stockText = !product ? "" :
    Number(product.stock_quantity) === 0 ? "🔴 Sin stock" :
    Number(product.stock_quantity) <= 3 ? `🔴 Últimas ${product.stock_quantity} unidades` :
    Number(product.stock_quantity) <= 10 ? `🟡 ${product.stock_quantity} unidades disponibles` :
    `🟢 Stock disponible: ${product.stock_quantity} unidades`;

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f7ff", fontFamily: "system-ui" }}>
      <p style={{ color: "#0077b6", fontSize: 16 }}>Cargando...</p>
    </div>
  );

  if (!product) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f7ff", fontFamily: "system-ui" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 48 }}>😕</p>
        <p style={{ color: "#0077b6", fontWeight: 600 }}>Producto no encontrado</p>
        <a href="/mayorista" style={{ color: "#00b4d8", textDecoration: "none" }}>← Volver al catálogo</a>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f0f7ff", fontFamily: "'DM Sans', system-ui, sans-serif", paddingBottom: 100 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}`}</style>

      {/* HEADER */}
      <header style={{ background: "#0077b6", padding: "14px 20px", position: "sticky", top: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <a href="/mayorista" style={{ color: "#fff", fontWeight: 600, textDecoration: "none", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
          ← Volver al catálogo
        </a>
        {cartCount > 0 && (
          <button onClick={() => setIsCartOpen(true)}
            style={{ background: "#00b4d8", color: "#fff", border: "none", borderRadius: 20, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            🛒 {cartCount}
          </button>
        )}
      </header>

      <main style={{ maxWidth: 600, margin: "24px auto", padding: "0 16px" }}>
        <div style={{ background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,119,182,0.1)" }}>

          {/* CARRUSEL DE IMÁGENES */}
          <div style={{ position: "relative", aspectRatio: "1", background: "#f8f8f8" }}>
            <img
              src={images[currentImg] || GENERIC}
              alt={product.name}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
            {images.length > 1 && (
              <>
                <button onClick={() => setCurrentImg(i => i === 0 ? images.length - 1 : i - 1)}
                  style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,.5)", border: "none", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
                <button onClick={() => setCurrentImg(i => i === images.length - 1 ? 0 : i + 1)}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,.5)", border: "none", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
                <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6 }}>
                  {images.map((_, i) => (
                    <button key={i} onClick={() => setCurrentImg(i)}
                      style={{ width: i === currentImg ? 18 : 6, height: 6, borderRadius: 10, background: i === currentImg ? "#0077b6" : "rgba(255,255,255,.6)", border: "none", cursor: "pointer", padding: 0, transition: "all .3s" }} />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* MINIATURAS */}
          {images.length > 1 && (
            <div style={{ display: "flex", gap: 8, padding: "12px 16px", overflowX: "auto" }}>
              {images.map((url, i) => (
                <img key={i} src={url} onClick={() => setCurrentImg(i)}
                  style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", cursor: "pointer", border: `2px solid ${i === currentImg ? "#0077b6" : "#e5e7eb"}`, flexShrink: 0 }} />
              ))}
            </div>
          )}

          {/* INFO */}
          <div style={{ padding: "20px 20px 24px" }}>
            <span style={{ background: "#e0f2fe", color: "#0077b6", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
              📦 PRECIO MAYORISTA
            </span>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: "12px 0 6px", lineHeight: 1.3 }}>{product.name}</h1>
            {product.description && (
              <p style={{ fontSize: 13, color: "#666", marginBottom: 12, lineHeight: 1.5 }}>{product.description}</p>
            )}
            <p style={{ fontSize: 32, fontWeight: 800, color: "#0077b6", marginBottom: 4 }}>{fmt(Number(product.price_wholesale))}</p>
            <p style={{ fontSize: 12, color: "#999", textDecoration: "line-through", marginBottom: 8 }}>
              Minorista: {fmt(Number(product.price_retail))}
            </p>
            <p style={{ fontSize: 13, fontWeight: 700, color: stockColor, marginBottom: 20 }}>{stockText}</p>

            {/* CANTIDAD */}
            {Number(product.stock_quantity) > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: "#666", fontWeight: 600, display: "block", marginBottom: 8 }}>CANTIDAD:</label>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={() => setQty(q => Math.max(1, q - 1))}
                    style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid #0077b6", background: "#fff", color: "#0077b6", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>−</button>
                  <input type="number" min="1" value={qty} onChange={e => setQty(Math.max(1, Number(e.target.value)))}
                    style={{ width: 52, textAlign: "center", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 16, fontWeight: 700, padding: "6px 0", fontFamily: "inherit", color: "#0f172a", outline: "none" }} />
                  <button onClick={() => setQty(q => q + 1)}
                    style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "#0077b6", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>+</button>
                  {itemInCart && (
                    <span style={{ fontSize: 12, color: "#0077b6", fontWeight: 600 }}>✓ {itemInCart.qty} en carrito</span>
                  )}
                </div>
              </div>
            )}

            {/* BOTONES */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Number(product.stock_quantity) > 0 && (
                <button onClick={addToCart}
                  style={{ width: "100%", padding: 14, background: "#0077b6", border: "none", borderRadius: 12, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  🛒 Agregar al carrito
                </button>
              )}
              <a href="/mayorista"
                style={{ width: "100%", padding: 14, background: "#e0f2fe", borderRadius: 12, color: "#0077b6", fontSize: 14, fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                ← Ver más productos
              </a>
            </div>

            {/* COMPARTIR */}
            <div style={{ marginTop: 20, padding: 16, background: "#f0f7ff", borderRadius: 12 }}>
              <p style={{ fontSize: 11, color: "#666", fontWeight: 600, marginBottom: 10 }}>COMPARTIR PRODUCTO</p>
              <div style={{ display: "flex", gap: 8 }}>
                <a href={`https://wa.me/?text=${encodeURIComponent(`📦 ${product.name} — ${fmt(Number(product.price_wholesale))} | Concepción Tecnología\nhttps://concepciontecnologia.vercel.app/mayorista/producto/${id}`)}`}
                  target="_blank"
                  style={{ flex: 1, padding: 8, borderRadius: 8, background: "#25D366", color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none", textAlign: "center" }}>
                  WhatsApp
                </a>
                <button onClick={() => navigator.clipboard.writeText(`https://concepciontecnologia.vercel.app/mayorista/producto/${id}`).then(() => alert("✅ Link copiado!"))}
                  style={{ flex: 1, padding: 8, borderRadius: 8, background: "#f3f4f6", border: "1px solid #e5e7eb", color: "#444", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  📋 Copiar link
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* CARRITO FLOTANTE */}
      {cartCount > 0 && !isCartOpen && (
        <button onClick={() => setIsCartOpen(true)}
          style={{ position: "fixed", bottom: 20, right: 20, background: "#0077b6", color: "#fff", border: "none", borderRadius: 50, padding: "13px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(0,119,182,.4)", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit", zIndex: 100 }}>
          🛒 Carrito
          <span style={{ background: "rgba(255,255,255,.2)", borderRadius: 20, padding: "1px 9px", fontSize: 12 }}>{cartCount}</span>
        </button>
      )}

      {/* DRAWER CARRITO */}
      {isCartOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.5)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "flex-end" }}
          onClick={() => setIsCartOpen(false)}>
          <div style={{ background: "#fff", width: "100%", maxWidth: 420, height: "100vh", overflowY: "auto", padding: 24, animation: "slideIn .25s ease" }}
            onClick={e => e.stopPropagation()}>
            <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ color: "#0077b6", fontFamily: "inherit" }}>Tu pedido mayorista</h2>
              <button onClick={() => setIsCartOpen(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#666" }}>✕</button>
            </div>

            {cart.map(item => (
              <div key={item.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: 10, background: "#f0f7ff", borderRadius: 10, marginBottom: 8 }}>
                <img src={item.image_url || GENERIC} style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} alt={item.name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</p>
                  <p style={{ fontSize: 13, color: "#0077b6", fontWeight: 700 }}>{fmt(Number(item.price_wholesale) * item.qty)}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button onClick={() => updateQty(item.id, -1)} style={{ width: 26, height: 26, borderRadius: "50%", border: "1px solid #0077b6", background: "#fff", color: "#0077b6", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>−</button>
                  <span style={{ fontSize: 13, fontWeight: 600, minWidth: 16, textAlign: "center" }}>{item.qty}</span>
                  <button onClick={() => updateQty(item.id, 1)} style={{ width: 26, height: 26, borderRadius: "50%", border: "none", background: "#0077b6", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>+</button>
                  <button onClick={() => removeFromCart(item.id)} style={{ width: 26, height: 26, borderRadius: "50%", border: "1px solid rgba(239,68,68,.3)", background: "rgba(239,68,68,.08)", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>🗑️</button>
                </div>
              </div>
            ))}

            <div style={{ padding: "12px 0", borderTop: "1px solid #e5e7eb", margin: "12px 0", display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#666", fontSize: 14 }}>Total mayorista</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: "#0077b6" }}>{fmt(cartTotal)}</span>
            </div>

            {cartTotal < 80000 && (
              <p style={{ fontSize: 12, color: "#ef4444", fontWeight: 700, textAlign: "center", marginBottom: 10 }}>
                ⚠️ COMPRA MÍNIMA $80.000 — Te faltan {fmt(80000 - cartTotal)}
              </p>
            )}

            <button onClick={sendWhatsApp}
              style={{ width: "100%", padding: 14, background: "#25D366", border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 8 }}>
              💬 Enviar pedido por WhatsApp
            </button>
            <button onClick={() => setIsCartOpen(false)}
              style={{ width: "100%", padding: 10, background: "#f0f7ff", border: "none", borderRadius: 12, color: "#0077b6", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              ← Seguir comprando
            </button>
          </div>
        </div>
      )}
    </div>
  );
}