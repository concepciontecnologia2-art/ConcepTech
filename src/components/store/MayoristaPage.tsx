"use client";
import { useState, useMemo, useEffect } from "react";

const WA    = process.env.NEXT_PUBLIC_WHATSAPP!;
const fmt = (n: number) => new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(n);

type Prod = { id:number; name:string; description:string; category_name:string; category_icon:string;
              price_retail:number; price_wholesale:number; available:boolean; image_url:string|null;
              stock_quantity:number; };
type Cat  = { id:number; name:string; icon:string; slug:string };
type Item = Prod & { qty:number };

const GENERIC = "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&q=80";

export default function MayoristaPage({ initialProducts, categories }: { initialProducts: Prod[]; categories: Cat[] }) {
  const [showWelcome, setShowWelcome] = useState(true);
  const [registered, setRegistered] = useState(false);
  const [regForm, setRegForm] = useState({ name:"", phone:"" });
  const [regError, setRegError]   = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [products] = useState<Prod[]>(initialProducts);
  const [search, setSearch]       = useState("");
  const [activeCat, setActiveCat] = useState<string|null>(null);
  const [sort, setSort]           = useState<"default"|"asc"|"desc">("default");
  const [cart, setCart] = useState<Item[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("cart_mayorista");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem("cart_mayorista", JSON.stringify(cart));
  }, [cart]);

  const WelcomeModal = ({ onClose }: { onClose: () => void }) => (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
      <div style={{ background: "#ffffff", padding: "24px", borderRadius: 16, width: "90%", maxWidth: 360, textAlign: "center", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🚀</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>¡Nuevas funciones!</h2>
        <p style={{ fontSize: 13, color: "#444", marginBottom: 20, lineHeight: 1.5 }}>
          Ahora podés gestionar tus productos de forma más rápida:
          <br/><br/>
          ❤️ <b>Favoritos:</b> Guardá lo que más te gusta.
          <br/>
          Mis <b>Pedidos:</b> Seguí tus pedidos anteriores.
        </p>
        <button onClick={onClose} style={{ width: "100%", padding: "12px", borderRadius: 8, background: "#0077b6", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}>
          ¡Entendido!
        </button>
      </div>
    </div>
  );

  const [cartOpen, setCartOpen]   = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderDone, setOrderDone] = useState(false);
  const [payMethod, setPayMethod] = useState<"transfer"|"cash">("transfer");
  const [form, setForm] = useState({ name:"", phone:"", delivery:"pickup", address:"" });
  const [favIds, setFavIds] = useState<number[]>([]);
  const [showFavs, setShowFavs] = useState(false);
  const [showHistorial, setShowHistorial] = useState(false);
  const [historial, setHistorial] = useState<any[]>([]);
  const [favProds, setFavProds] = useState<any[]>([]);

  // FUNCIONES FAVORITOS E HISTORIAL
  const loadFavs = async (phone: string) => {
    if (!phone) return;
    try {
      const res = await fetch(`/api/favoritos?phone=${encodeURIComponent(phone)}`);
      if (res.ok) {
        const data = await res.json();
        setFavProds(Array.isArray(data)?data:[]);
        setFavIds(Array.isArray(data)?data.map((p:any) => p.id):[]);
      }
    } catch(e) {}
  };

  const toggleFav = async (productId: number) => {
    const esFav = favIds.includes(productId);
    if (esFav) {
      await fetch("/api/favoritos", { method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({phone:regForm.phone, product_id:productId}) });
      setFavIds(prev => prev.filter(id => id !== productId));
      setFavProds(prev => prev.filter((p:any) => p.id !== productId));
    } else {
      await fetch("/api/favoritos", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({phone:regForm.phone, product_id:productId}) });
      setFavIds(prev => [...prev, productId]);
      const prod = products.find(p => p.id === productId);
      if (prod) setFavProds(prev => [...prev, prod]);
    }
  };

  const loadHistorial = async () => {
    if (!regForm.phone) return;
    try {
      const res = await fetch(`/api/historial?phone=${encodeURIComponent(regForm.phone)}`);
      if (res.ok) {
        const data = await res.json();
        setHistorial(Array.isArray(data)?data:[]);
      }
    } catch(e) {}
  };

  // EFECTOS
  useEffect(()=>{
    const name = localStorage.getItem("mayorista_name") || "";
    const phone = localStorage.getItem("mayorista_phone") || "";
    if (name && phone) {
      setRegistered(true);
      setRegForm({ name, phone });
      setForm(f=>({...f, name, phone }));
      loadFavs(phone);
    }
  },[]);

  useEffect(()=>{
    if (!registered || initialProducts.length === 0) return;
    const hash = window.location.hash;
    if (!hash.startsWith("#producto-")) return;
    const id = hash.replace("#producto-","");
    const intentar = (intentos = 0) => {
      const el = document.getElementById(`producto-${id}`);
      if (el) {
        el.scrollIntoView({behavior:"smooth", block:"center"});
        el.style.border = "2px solid #3b82f6";
        el.style.boxShadow = "0 0 0 4px rgba(59,130,246,.2)";
        setTimeout(()=>{ el.style.border = ""; el.style.boxShadow = ""; }, 2000);
      } else if (intentos < 10) {
        setTimeout(()=>intentar(intentos + 1), 300);
      }
    };
    setTimeout(()=>intentar(), 500);
  },[registered, initialProducts]);

  const handleRegister = async () => {
    if (!regForm.name||!regForm.phone) { setRegError("Completá todos los campos"); return; }
    setRegLoading(true);
    try {
      await fetch("/api/wholesale-register",{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ name:regForm.name, phone:regForm.phone }) });
    } catch(e){}
    localStorage.setItem("mayorista_name", regForm.name);
    localStorage.setItem("mayorista_phone", regForm.phone);
    setRegistered(true);
    setForm(f=>({...f, name:regForm.name, phone:regForm.phone }));
    loadFavs(regForm.phone);
    setRegLoading(false);
  };

  const filtered = useMemo(() => {
    let p = products.filter(x=>x.available===true||(x.available as any)==="true");
    if (activeCat) p = p.filter(x=>{ const cat=categories.find(c=>c.slug===activeCat); return cat?.name===x.category_name; });
    if (search.trim()) p = p.filter(x=>x.name.toUpperCase().includes(search.toUpperCase()));
    if (sort==="asc")  p=[...p].sort((a,b)=>Number(a.price_wholesale)-Number(b.price_wholesale));
    if (sort==="desc") p=[...p].sort((a,b)=>Number(b.price_wholesale)-Number(a.price_wholesale));
    return p;
  }, [products, activeCat, search, sort, categories]);

  const grouped = useMemo(()=>{
    if(activeCat) return {"":filtered};
    const map:Record<string,Prod[]>={};
    filtered.forEach(p=>{if(!map[p.category_name])map[p.category_name]=[];map[p.category_name].push(p);});
    return map;
  },[filtered,activeCat]);

  const addToCart = (p:Prod)=>{
    setCart(prev=>{const ex=prev.find(i=>i.id===p.id);return ex?prev.map(i=>i.id===p.id?{...i,qty:i.qty+1}:i):[...prev,{...p,qty:1}];});
  };
  const removeFromCart = (id:number) => setCart(prev=>prev.filter(i=>i.id!==id));
  const updateQty=(id:number,d:number)=>setCart(prev=>prev.map(i=>i.id===id?{...i,qty:Math.max(0,i.qty+d)}:i).filter(i=>i.qty>0));
  const cartCount=cart.reduce((s,i)=>s+i.qty,0);
  const cartTotal=cart.reduce((s,i)=>s+i.qty*Number(i.price_wholesale),0);

  const handleOrder=async()=>{
    if(!form.name||!form.phone)return;
    try {
      await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({customer_name:form.name,phone:form.phone,email:"",sale_type:"wholesale",
          delivery_type:form.delivery,address:form.address||null,
          items:cart.map(i=>({id:i.id,name:i.name,qty:i.qty,price:Number(i.price_wholesale)})),total:cartTotal})});
    } catch(e){}
    const lines=cart.map(i=>`• ${i.qty}x ${i.name} — ${fmt(i.qty*Number(i.price_wholesale))}`).join("\n");
    const msg=encodeURIComponent(`📦 *Pedido Mayorista - Concepción Tecnología*\n\n👤 ${form.name}\n📞 ${form.phone}\n📦 ${form.delivery==="pickup"?"Retira en local":`Envío: ${form.address}`}\n💳 Pago: ${payMethod==="transfer"?"Transferencia":"Efectivo"}\n\n${lines}\n\n*Total: ${fmt(cartTotal)}*`);
    window.open(`https://wa.me/${WA}?text=${msg}`,"_blank");
    setTimeout(()=>setOrderDone(true),600);
  };

  const downloadCatalogoPDF = (catName: string, prods: any[]) => {
    const lines = prods.map((p:any)=>
      `${p.name}\n   Precio mayorista: $${Number(p.price_wholesale).toLocaleString("es-AR")} | Stock: ${p.stock_quantity??0} u.`
    ).join("\n\n");
    const txt =
`══════════════════════════════════════
     CONCEPCIÓN TECNOLOGÍA
  Independencia 450, Concepción, Tucumán
  WhatsApp: 3865630488
  L-V 9-12 y 16-20hs · Sáb 9-15hs
══════════════════════════════════════
  CATÁLOGO MAYORISTA — ${catName.toUpperCase()}
══════════════════════════════════════

${lines}

══════════════════════════════════════
  Pedidos: 3865630488
══════════════════════════════════════`;
    const blob = new Blob([txt], { type:"text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `catalogo-${catName.toLowerCase().replace(/\s+/g,"-")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  // Carrusel optimizado: Lazy-loading de imágenes al presionar controles
  const ProductImageCarousel = ({ productId, mainImage }: { productId:number; mainImage:string|null }) => {
    const [imgIdx, setImgIdx] = useState(0);
    const [imgs, setImgs] = useState<string[]>([mainImage||GENERIC]);
    const [hasLoadedExtra, setHasLoadedExtra] = useState(false);

    const loadExtraImagesOnDemand = async () => {
      if (hasLoadedExtra) return;
      try {
        const res = await fetch(`/api/products/${productId}/images`);
        if (res.ok) {
          const extra = await res.json();
          const all = [mainImage, ...extra.map((i:any)=>i.image_url)].filter(Boolean) as string[];
          setImgs(all.length>0?all:[GENERIC]);
        }
      } catch {}
      setHasLoadedExtra(true);
    };

    return (
      <div className="prod-img-box">
        <img src={imgs[imgIdx]} alt="" loading="lazy"/>
        <button className="img-nav img-nav-left" onClick={async e=>{
          e.stopPropagation();
          await loadExtraImagesOnDemand();
          setImgIdx(i=>i===0?imgs.length-1:i-1);
        }}>‹</button>
        <button className="img-nav img-nav-right" onClick={async e=>{
          e.stopPropagation();
          await loadExtraImagesOnDemand();
          setImgIdx(i=>i===imgs.length-1?0:i+1);
        }}>›</button>
      </div>
    );
  };

  const MayoristaCategorySection = ({ catName, prods }: { catName: string; prods: any[] }) => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const hayHashEnEstaCat = prods.some(p => `#producto-${p.id}` === hash);
    const [visibleCount, setVisibleCount] = useState(hayHashEnEstaCat ? prods.length : 12);
    const visible = prods.slice(0, visibleCount);
    const hasMore = visibleCount < prods.length;
    const hasLess = visibleCount > 12;

    return (
      <section className="cat-section">
        {catName && (
          <div className="cat-section-head">
            <h2 className="cat-section-title">
              {categories.find((c: any) => c.name === catName)?.icon} {catName}
            </h2>
            <button className="btn-outline-sm" onClick={() => downloadCatalogoPDF(catName, prods)}>
              Descargar catálogo
            </button>
          </div>
        )}

        {/* GRILLA DE PRODUCTOS RESPONSIVE */}
        <div className="products-grid">
          {visible.map(p => {
            const inCart = cart.find((i: any) => i.id === p.id);
            const esFav = favIds.includes(p.id);

            return (
              <div
                key={p.id}
                id={`producto-${p.id}`}
                className={`product-card ${inCart ? "in-cart" : ""}`}
                onClick={() => window.location.href = `/mayorista/producto/${p.id}`}
              >
                {/* BOTÓN FAVORITO */}
                <button
                  className="fav-btn"
                  onClick={e => { e.stopPropagation(); toggleFav(p.id); }}
                >
                  {esFav ? "❤️" : "🤍"}
                </button>

                {/* IMAGEN Y ETIQUETAS */}
                <div className="prod-media">
                  <ProductImageCarousel productId={p.id} mainImage={p.image_url} />

                  <div className="prod-badges">
                    {p.is_offer && <span className="badge badge-offer">OFERTA</span>}
                    {p.is_new && <span className="badge badge-new">NUEVO</span>}
                  </div>

                  {inCart && (
                    <div className="prod-qty-pill">×{inCart.qty}</div>
                  )}
                </div>

                {/* CONTENIDO */}
                <div className="prod-body">
                  <p className="prod-name">{p.name}</p>

                  {p.description && (
                    <p className="prod-desc">{p.description}</p>
                  )}

                  {/* PRECIOS */}
                  <div className="prod-prices" onClick={e => e.stopPropagation()}>
                    <div>
                      <p className="prod-price-wholesale">{fmt(Number(p.price_wholesale))}</p>
                      <p className="prod-price-retail">{fmt(Number(p.price_retail))}</p>
                    </div>
                  </div>

                  {/* STOCK */}
                  <p className={`prod-stock ${Number(p.stock_quantity) === 0 ? "stock-none" : Number(p.stock_quantity) <= 3 ? "stock-none" : Number(p.stock_quantity) <= 10 ? "stock-low" : "stock-ok"}`}>
                    {Number(p.stock_quantity) === 0 ? "🔴 Sin stock" : Number(p.stock_quantity) <= 3 ? `🔴 ${p.stock_quantity} u.` : Number(p.stock_quantity) <= 10 ? `🟡 ${p.stock_quantity} u.` : `🟢 ${p.stock_quantity} u.`}
                  </p>

                  {/* CONTROLES DE CANTIDAD */}
                  <div className="qty-controls" onClick={e => e.stopPropagation()}>
                    <button className="qty-btn" onClick={() => updateQty(p.id, -1)}>−</button>

                    <input
                      type="number"
                      min="0"
                      className="qty-input"
                      value={inCart?.qty || 0}
                      onChange={e => {
                        const qty = Math.max(0, Number(e.target.value));
                        setCart(prev => {
                          const ex = prev.find(i => i.id === p.id);
                          return ex ? prev.map(i => i.id === p.id ? { ...i, qty } : i).filter(i => i.qty > 0) : qty > 0 ? [...prev, { ...p, qty }] : prev;
                        });
                      }}
                    />

                    <button className="qty-btn" onClick={() => addToCart(p)} disabled={Number(p.stock_quantity) === 0}>+</button>
                  </div>

                  {/* BOTONES DE COMPARTIR */}
                  <div className="share-row" onClick={e => e.stopPropagation()}>
                    {[
                      ["wa", <svg key="wa" width="14" height="14" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>],
                      ["fb", <svg key="fb" width="14" height="14" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>],
                      ["ig", <svg key="ig" width="14" height="14" viewBox="0 0 24 24" fill="url(#igm)"><defs><linearGradient id="igm" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f09433"/><stop offset="50%" stopColor="#dc2743"/><stop offset="100%" stopColor="#bc1888"/></linearGradient></defs><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>],
                    ].map(([via, icon]) => (
                      <button
                        key={via as string}
                        className="share-btn"
                        onClick={() => {
                          const url = `${window.location.origin}/mayorista/producto/${p.id}`;
                          const text = `🛒 ${p.name} — ${fmt(Number(p.price_wholesale))} | Concepción Tecnología`;
                          if (via === "wa") window.open(`https://wa.me/?text=${encodeURIComponent(text + "\n" + url)}`, "_blank");
                          if (via === "fb") window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank");
                          if (via === "ig") navigator.clipboard.writeText(text + "\n" + url).then(() => alert("✅ Link copiado!"));
                        }}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* BOTONES DE VER MÁS / VER MENOS */}
        {(hasMore || hasLess) && (
          <div className="loadmore-row">
            {hasMore && (
              <button
                className="btn-loadmore"
                onClick={() => setVisibleCount(v => Math.min(v + 12, prods.length))}
              >
                Ver más
              </button>
            )}
            {hasLess && (
              <button
                className="btn-loadless"
                onClick={() => setVisibleCount(12)}
              >
                Ver menos
              </button>
            )}
          </div>
        )}
      </section>
    );
  };

  if (!registered) return (
    <div className="auth-screen">
      <style dangerouslySetInnerHTML={{__html:GLOBAL_CSS}}/>
      <div className="auth-card-wrap">
        <div className="auth-header">
          <a href="/" className="auth-logo">
            <span className="accent-cyan">Concepción</span> Tecnología
          </a>
          <div className="auth-pill">Precio Mayorista</div>
          <p className="auth-copy">Registrate para ver los precios mayoristas y hacer tus pedidos.</p>
          <p className="auth-min">COMPRA MINIMA $80.000</p>
        </div>
        <div className="auth-card">
          <div className="auth-fields">
            {([["Nombre completo","text","name","Tu nombre"],["Teléfono","tel","phone","3865 xxxxxx"]] as [string,string,string,string][]).map(([label,type,key,ph])=>(
              <div key={key}>
                <label className="field-label">{label.toUpperCase()}</label>
                <input type={type} className="if2" placeholder={ph}
                  value={(regForm as Record<string,string>)[key]}
                  onChange={e=>setRegForm(f=>({...f,[key]:e.target.value}))}
                  onKeyDown={e=>e.key==="Enter"&&handleRegister()}/>
              </div>
            ))}
          </div>
          {regError&&<p className="auth-error">{regError}</p>}
          <button onClick={handleRegister} disabled={regLoading} className="btn-primary-cyan">
            {regLoading?"Registrando...":"Acceder a precios mayoristas"}
          </button>
          <a href="/" className="auth-back">Volver a tienda minorista</a>
        </div>
      </div>
    </div>
  );

  return (
    <div className="app-root">
      <style dangerouslySetInnerHTML={{__html:GLOBAL_CSS}}/>

      {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}

      {/* HEADER */}
      <header className="app-header">
        <div className="header-inner">
          <div className="header-top">
            <h1 className="header-title">
              <span className="accent-cyan">Concepción</span> Tecnologia <span className="header-tag">MAYORISTA</span>
            </h1>
            {cartCount > 0 && (
              <button onClick={() => setCartOpen(true)} className="header-cart-btn">
                🛒 {cartCount}
              </button>
            )}
          </div>
          <p className="header-sub">{regForm.name} · <span className="header-min">Mínima $80.000</span></p>
          <div className="header-actions">
            <button onClick={() => setShowFavs(true)} className="chip-btn">❤️ Favoritos</button>
            <button onClick={() => { setShowHistorial(true); loadHistorial(); }} className="chip-btn">Mis Pedidos</button>
            <a href="/" className="chip-btn chip-link">Minorista</a>
          </div>
        </div>
      </header>

      <main className="app-main">
        {/* Buscador y Ordenador */}
        <div className="search-row">
          <input className="if3 search-input" placeholder="Buscar precio mayorista" value={search} onChange={e => setSearch(e.target.value)} />
          <select
            className="if3 sort-select"
            value={sort}
            onChange={(e) => setSort(e.target.value as "default" | "asc" | "desc")}
          >
            <option value="default">Ordenar</option>
            <option value="desc">Más caro</option>
            <option value="asc">Más barato</option>
          </select>
        </div>

        {/* Categorías */}
        <div className="cat-scroll">
          <button className={`pb2 ${!activeCat ? "active" : ""}`} onClick={() => setActiveCat(null)}>Todos</button>
          {categories.map(c => (
            <button key={c.id} className={`pb2 ${activeCat === c.slug ? "active" : ""}`} onClick={() => setActiveCat(activeCat === c.slug ? null : c.slug)}>{c.icon} {c.name}</button>
          ))}
        </div>

        {/* Listado de Productos */}
        {Object.entries(grouped).map(([catName, prods]) => (
          <MayoristaCategorySection key={catName} catName={catName} prods={prods} />
        ))}
      </main>

      {/* CARRITO FLOTANTE */}
      {cartCount>0&&!cartOpen&&(
        <button onClick={()=>setCartOpen(true)} className="fab-cart">
          {"🛒 Carrito "}
          <span className="fab-cart-count">{cartCount}</span>
        </button>
      )}

      {/* DRAWER CARRITO */}
      {cartOpen&&(
        <div className="drawer">
          <div className="overlay" onClick={()=>setCartOpen(false)}/>
          <div className="drawer-panel">
            <div className="drawer-head">
              <h2 className="drawer-title">Carrito Mayorista</h2>
              <button onClick={()=>setCartOpen(false)} className="icon-close">✕</button>
            </div>
            {/* CARTEL DE AVISO */}
            <div className="notice-box">
              <span className="notice-icon">💡</span>
              <div>
                <p className="notice-strong">¿Venís del Bot de WhatsApp o tenés muchos productos?</p>
                <p className="notice-soft">Podés entrar y salir de la app sin problema: tu carrito quedará guardado y no se perderá ningún producto. ¡Gracias por seguir confiando en nosotros!</p>
              </div>
            </div>
            {cart.map(item=>(
              <div key={item.id} className="cart-line">
                <img src={item.image_url||GENERIC} className="cart-line-img" alt={item.name}/>
                <div className="cart-line-info">
                  <p className="cart-line-name">{item.name}</p>
                  <p className="cart-line-price">{fmt(Number(item.price_wholesale)*item.qty)}</p>
                </div>
                <div className="cart-line-controls">
                  <button onClick={()=>updateQty(item.id,-1)} className="qty-btn">−</button>
                  <span className="cart-line-qty">{item.qty}</span>
                  <button onClick={()=>updateQty(item.id,1)} className="qty-btn">+</button>
                  <button onClick={()=>removeFromCart(item.id)} className="qty-btn qty-btn-danger">🗑️</button>
                </div>
              </div>
            ))}
            <div className="cart-total-row">
              <span className="cart-total-label">Total mayorista</span>
              <span className="cart-total-value">{fmt(cartTotal)}</span>
            </div>
            {cartTotal < 80000 && (
              <p className="cart-min-warning">
                {"⚠️ COMPRA MÍNIMA $80.000 — Te faltan "}{fmt(80000-cartTotal)}
              </p>
            )}
            <button onClick={()=>{setCartOpen(false);setCheckoutOpen(true)}} className="btn-primary-outline">
              Finalizar pedido →
            </button>
            <button onClick={()=>setCartOpen(false)} className="btn-secondary">
              ← Seguir agregando productos
            </button>
          </div>
        </div>
      )}

      {/* MODAL CHECKOUT */}
      {checkoutOpen&&!orderDone&&(
        <div className="modal">
          <div className="modal-box">
            <h2 className="modal-title">Pedido Mayorista</h2>
            <p className="modal-subtitle">Completá los datos de entrega</p>
            <div className="checkout-fields">
              <div>
                <label className="field-label">NOMBRE</label>
                <input className="if3" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
              </div>
              <div>
                <label className="field-label">TELÉFONO</label>
                <input className="if3" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/>
              </div>
              <div>
                <label className="field-label">ENTREGA</label>
                <div className="toggle-row">
                  {[["pickup","🏪 Retiro"],["delivery","🚗 Envío"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setForm(f=>({...f,delivery:v}))}
                      className={`toggle-btn ${form.delivery===v?"active":""}`}>{l}</button>
                  ))}
                </div>
              </div>
              {form.delivery==="delivery"&&(
                <div>
                  <label className="field-label">DIRECCIÓN</label>
                  <input className="if3" placeholder="Calle, número, barrio" value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))}/>
                </div>
              )}
              <div>
                <label className="field-label">MÉTODO DE PAGO</label>
                <div className="toggle-row">
                  {[["transfer","💳 Transferencia"],["cash","💵 Efectivo"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setPayMethod(v as "transfer"|"cash")}
                      className={`toggle-btn ${payMethod===v?"active":""}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {payMethod==="cash"&&(
              <div className="info-box info-box-green">
                <p>{"💵 Pagás en efectivo al retirar o recibir el pedido"}</p>
              </div>
            )}

            <div className="info-box info-box-red">
              <p>{"⚠️ COMPRA MÍNIMA $80.000"}</p>
            </div>

            <p className="checkout-total">Total: <strong>{fmt(cartTotal)}</strong> (Mayorista)</p>

            <button onClick={handleOrder} disabled={!form.name||!form.phone} className="btn-whatsapp">
              {"💬 Enviar pedido por WhatsApp"}
            </button>
            <button onClick={()=>{setCheckoutOpen(false);setCartOpen(true);}} className="btn-text">{"← Volver al carrito"}</button>
          </div>
        </div>
      )}

      {/* PEDIDO EXITOSO */}
      {orderDone&&(
        <div className="modal">
          <div className="modal-box modal-box-center">
            <div className="success-icon">✅</div>
            <h2 className="modal-title">{"¡Pedido mayorista enviado!"}</h2>
            <p className="success-copy">En breve nos comunicamos para coordinar la entrega.</p>
            <button onClick={()=>{setOrderDone(false);setCheckoutOpen(false);setCart([]);setForm({name:regForm.name,phone:regForm.phone,delivery:"pickup",address:""});setPayMethod("transfer");}}
              className="btn-primary-outline">
              🛒 Seguir comprando
            </button>
            <a href="/" className="btn-secondary btn-secondary-link">
              ← Volver a tienda minorista
            </a>
          </div>
        </div>
      )}

      {/* BOTÓN SUBIR */}
      <button onClick={()=>window.scrollTo({top:0,behavior:"smooth"})} className="btn-scrolltop" style={{bottom:cartCount>0?"calc(72px + env(safe-area-inset-bottom))":"calc(20px + env(safe-area-inset-bottom))"}}>
        ↑
      </button>

      {/* MODAL FAVORITOS */}
      {showFavs && (
        <div className="modal" onClick={() => setShowFavs(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <h3 className="modal-title" style={{marginBottom:0}}>Mis favoritos</h3>
              <button onClick={() => setShowFavs(false)} className="icon-close icon-close-circle">✕</button>
            </div>

            <div className="modal-scroll">
              {favProds.length === 0 ? (
                <p className="empty-msg">No tenés productos favoritos.</p>
              ) : (
                favProds.map((p: any) => {
                  const inCart = cart.find(i => i.id === p.id);
                  return (
                    <div key={p.id} className="fav-line">
                      <a href={`/mayorista/producto/${p.id}`} className="fav-line-link">
                        <img src={p.image_url || GENERIC} className="fav-line-img" alt={p.name} />
                        <div className="fav-line-info">
                          <p className="fav-line-name">{p.name}</p>
                          <p className="fav-line-price">{fmt(Number(p.price_wholesale))}</p>
                        </div>
                      </a>

                      <div className="fav-line-controls">
                        <button onClick={(e) => { e.preventDefault(); updateQty(p.id, -1); }} className="qty-btn">−</button>
                        <span className="fav-line-qty">{inCart?.qty || 0}</span>
                        <button onClick={(e) => { e.preventDefault(); addToCart(p); }} className="qty-btn qty-btn-solid">+</button>
                        <button onClick={(e) => { e.preventDefault(); toggleFav(p.id); }} className="fav-line-heart">❤️</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL HISTORIAL */}
      {showHistorial && (
        <div className="modal" onClick={() => setShowHistorial(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <h3 className="modal-title" style={{marginBottom:0}}>Mis pedidos</h3>
              <button onClick={() => setShowHistorial(false)} className="icon-close">✕</button>
            </div>
            <div className="modal-scroll">
              {historial.map((o: any) => {
                const items = Array.isArray(o.items) ? o.items : [];
                return (
                  <div key={o.id} className="order-card">
                    <div className="order-card-head">
                      <p className="order-id">Pedido #{String(o.id).padStart(4, "0")}</p>
                      <p className="order-total">{fmt(Number(o.total))}</p>
                    </div>
                    <p className="order-date">{new Date(o.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}</p>
                    <p className={`order-status ${o.status === "completed" ? "status-ok" : o.status === "cancelled" ? "status-bad" : "status-pending"}`}>
                      {o.status === "completed" ? "Completado" : o.status === "cancelled" ? "Cancelado" : "Pendiente"}
                    </p>
                    {items.length > 0 && (
                      <div className="order-items">
                        {items.map((item: any, i: number) => (
                          <p key={i} className="order-item-line">• {item.qty}x {item.name}</p>
                        ))}
                      </div>
                    )}
                    <div className="order-actions">
                      <button onClick={() => { items.forEach((item: any) => { const prod = products.find(p => p.name === item.name); if (prod) addToCart(prod); }); setShowHistorial(false); setCartOpen(true); }} className="btn-outline-sm btn-outline-sm-flex">Repetir pedido</button>
                      <button onClick={() => { const lines = items.map((i: any) => `• ${i.qty}x ${i.name} — ${fmt(i.qty * Number(i.price))}`).join("\n"); const msg = encodeURIComponent(`📦 *Repetir Pedido #${String(o.id).padStart(4, "0")} - Concepción Tecnología*\n\n${lines}\n\n*Total: ${fmt(Number(o.total))}*`); window.open(`https://wa.me/${WA}?text=${msg}`, "_blank"); }} className="btn-whatsapp-sm">WhatsApp</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');

:root{
  --cyan:#00B4D8;
  --blue:#3b82f6;
  --ink:#1a1a1a;
  --muted:#666666;
  --line:#e5e7eb;
  --bg-soft:#f9fafb;
  --danger:#ef4444;
  --success:#10b981;
  --warning:#f59e0b;
  --wa-green:#25D366;
  --radius-lg:18px;
  --radius-md:12px;
  --radius-sm:8px;
  --container:1280px;
}

*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
button{font-family:inherit}
input,select{font-family:inherit}

/* ---------- LAYOUT SHELLS ---------- */
.app-root{min-height:100vh;background:#ffffff;color:var(--ink);font-family:'DM Sans',system-ui,sans-serif}
.app-header{position:sticky;top:0;z-index:50;border-bottom:1px solid var(--line);background:#ffffff;backdrop-filter:saturate(180%) blur(6px)}
.header-inner{max-width:var(--container);margin:0 auto;padding:10px 16px}
.header-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px}
.header-title{font-family:'Syne',sans-serif;font-weight:800;font-size:clamp(15px,3.6vw,20px);display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.header-tag{font-size:9px;padding:2px 6px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:4px;color:var(--blue);vertical-align:middle;font-weight:700}
.header-cart-btn{padding:6px 12px;border-radius:8px;background:#0077b6;color:#fff;border:none;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0}
.header-sub{font-size:11px;color:var(--muted);margin-bottom:8px}
.header-min{color:var(--danger);font-weight:700}
.header-actions{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}
.header-actions::-webkit-scrollbar{display:none}
.chip-btn{padding:5px 10px;border-radius:7px;background:var(--bg-soft);border:1px solid var(--line);font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;color:var(--ink);text-decoration:none;flex-shrink:0}
.chip-link{display:flex;align-items:center}

.app-main{max-width:var(--container);margin:0 auto;padding:14px 16px 60px}

.accent-cyan{color:var(--cyan)}

/* ---------- SEARCH / SORT ---------- */
.search-row{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.search-input{flex:1 1 200px;min-width:0}
.sort-select{flex:0 0 auto;width:130px}
.if3{padding:10px 13px;font-size:13px;height:40px;background:#f9fafb;border:1px solid var(--line);border-radius:10px;color:var(--ink);outline:none}
.if3:focus{border-color:rgba(59,130,246,.45)}

/* ---------- CATEGORY CHIPS ---------- */
.cat-scroll{display:flex;gap:7px;overflow-x:auto;padding-bottom:6px;margin-bottom:18px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.cat-scroll::-webkit-scrollbar{display:none}
.pb2{padding:6px 14px;border-radius:100px;border:1px solid var(--line);background:#ffffff;color:#444;cursor:pointer;font-size:12.5px;font-weight:500;white-space:nowrap;transition:all .15s;flex-shrink:0}
.pb2:hover,.pb2.active{border-color:rgba(59,130,246,.5);color:var(--blue);background:rgba(59,130,246,.08)}

/* ---------- PRODUCT GRID ---------- */
.cat-section{margin-bottom:36px}
.cat-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.cat-section-title{font-family:'Syne',sans-serif;font-size:clamp(15px,2.6vw,18px);font-weight:700;color:var(--ink);display:flex;align-items:center;gap:6px}
.btn-outline-sm{padding:7px 14px;border-radius:8px;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.3);color:var(--blue);font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap}

.products-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
@media(min-width:560px){.products-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}}
@media(min-width:820px){.products-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}}
@media(min-width:1140px){.products-grid{grid-template-columns:repeat(5,minmax(0,1fr))}}
@media(min-width:1440px){.products-grid{grid-template-columns:repeat(6,minmax(0,1fr))}}

.product-card{background:#ffffff;border:1px solid var(--line);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;transition:border-color .2s,box-shadow .2s;position:relative;cursor:pointer}
.product-card:hover{border-color:rgba(59,130,246,.5);box-shadow:0 4px 16px rgba(0,0,0,.06)}
.product-card.in-cart{border-color:rgba(59,130,246,.4)}

.fav-btn{position:absolute;top:8px;right:8px;z-index:10;background:#fff;border:none;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.1);font-size:15px}

.prod-media{position:relative;overflow:hidden;background:#f8f8f8;width:100%}
.prod-img-box{padding-bottom:75%;position:relative;overflow:hidden;background:#f8f8f8}
@media(min-width:560px){.prod-img-box{padding-bottom:82%}}
.prod-img-box img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;background:#f8f8f8}
.img-nav{position:absolute;top:50%;transform:translateY(-50%);width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,.5);border:none;color:#fff;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2}
.img-nav-left{left:4px}
.img-nav-right{right:4px}
.img-dots{position:absolute;bottom:4px;left:50%;transform:translateX(-50%);display:flex;gap:4px;z-index:2}
.img-dot{width:5px;height:5px;border-radius:10px;background:rgba(255,255,255,.6);cursor:pointer;transition:all .3s}
.img-dot.active{width:14px;background:var(--blue)}

.prod-badges{position:absolute;top:6px;left:6px;display:flex;gap:4px;z-index:5}
.badge{color:#fff;font-size:9px;font-weight:700;padding:2px 6px;border-radius:20px}
.badge-offer{background:var(--danger)}
.badge-new{background:#00B4D8;color:#080c10}
.prod-qty-pill{position:absolute;top:6px;right:42px;z-index:5;background:var(--blue);color:#fff;border-radius:20px;padding:2px 7px;font-size:11px;font-weight:700}

.prod-body{padding:10px 12px 12px;flex:1;display:flex;flex-direction:column;gap:6px}
.prod-name{font-size:clamp(12px,1.6vw,13.5px);font-weight:600;color:var(--ink);line-height:1.3}
.prod-desc{font-size:10.5px;color:var(--muted);line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.prod-prices{display:flex;align-items:center;justify-content:space-between;margin-top:2px}
.prod-price-wholesale{font-size:clamp(15px,2.2vw,17px);font-weight:800;color:var(--blue)}
.prod-price-retail{font-size:10.5px;color:#999;text-decoration:line-through}
.prod-stock{font-size:10.5px;font-weight:700}
.stock-none{color:var(--danger)}
.stock-low{color:var(--warning)}
.stock-ok{color:var(--success)}

.qty-controls{display:flex;align-items:center;gap:6px}
.qty-btn{width:26px;height:26px;border-radius:50%;border:1px solid rgba(59,130,246,.3);background:rgba(59,130,246,.08);color:var(--blue);font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.qty-btn:disabled{opacity:.5;cursor:not-allowed}
.qty-btn-danger{border-color:rgba(239,68,68,.3);background:rgba(239,68,68,.08);color:var(--danger)}
.qty-btn-solid{border:none;background:var(--blue);color:#fff}
.qty-input{width:100%;text-align:center;border:1px solid rgba(59,130,246,.3);border-radius:6px;font-size:11px;padding:4px 0;color:var(--ink);outline:none;background:rgba(59,130,246,.04)}

.share-row{display:flex;gap:4px;margin-top:4px}
.share-btn{flex:1;padding:5px 0;border-radius:6px;background:rgba(255,255,255,.04);border:1px solid var(--line);cursor:pointer;display:flex;align-items:center;justify-content:center}

.loadmore-row{display:flex;gap:8px;justify-content:center;margin-top:18px}
.btn-loadmore{padding:9px 22px;border-radius:8px;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.25);color:var(--blue);font-size:12.5px;font-weight:600;cursor:pointer}
.btn-loadless{padding:9px 22px;border-radius:8px;background:rgba(255,255,255,.05);border:1px solid var(--line);color:#666;font-size:12.5px;font-weight:600;cursor:pointer}

/* ---------- FLOATING BUTTONS ---------- */
.fab-cart{position:fixed;bottom:calc(20px + env(safe-area-inset-bottom));right:20px;z-index:9001;background:var(--blue);color:#fff;border:none;border-radius:50px;padding:13px 22px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 24px rgba(59,130,246,.4);display:flex;align-items:center;gap:8px}
.fab-cart-count{background:rgba(255,255,255,.2);border-radius:20px;padding:1px 9px;font-size:12px}
.btn-scrolltop{position:fixed;right:20px;z-index:9000;width:42px;height:42px;border-radius:50%;background:rgba(0,180,216,.15);border:1px solid rgba(0,180,216,.4);color:var(--cyan);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:bottom .3s}

/* ---------- DRAWER / MODAL SHELLS ---------- */
.drawer{position:fixed;inset:0;z-index:100;display:flex;justify-content:flex-end}
.drawer-panel{position:relative;z-index:1;background:#ffffff;border-left:1px solid var(--line);width:100%;max-width:440px;height:100vh;overflow-y:auto;padding:20px 16px;animation:slideIn .25s ease}
@media(min-width:640px){.drawer-panel{padding:24px}}
@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
.overlay{position:absolute;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(4px)}
.drawer-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.drawer-title{font-family:'Syne',sans-serif;font-size:18px;font-weight:700;color:var(--ink)}
.icon-close{background:none;border:none;color:#666;font-size:20px;cursor:pointer}
.icon-close-circle{background:#f3f4f6;border-radius:50%;width:32px;height:32px}

.modal{position:fixed;inset:0;z-index:200;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.6);backdrop-filter:blur(8px);padding:0}
@media(min-width:640px){.modal{align-items:center;padding:20px}}
.modal-box{background:#ffffff;border:1px solid var(--line);border-radius:20px 20px 0 0;padding:22px 18px;width:100%;max-width:480px;max-height:88vh;overflow-y:auto}
@media(min-width:640px){.modal-box{border-radius:20px;padding:28px}}
.modal-box-center{text-align:center}
.modal-title{font-family:'Syne',sans-serif;font-size:clamp(17px,3vw,20px);font-weight:700;margin-bottom:4px;color:var(--ink)}
.modal-subtitle{font-size:13px;color:var(--muted);margin-bottom:18px}
.modal-scroll{overflow-y:auto;flex:1;max-height:60vh}

/* ---------- NOTICE / INFO BOXES ---------- */
.notice-box{background:linear-gradient(135deg,#e0f2fe 0%,#bfdbfe 100%);border:1px solid #93c5fd;border-radius:12px;padding:14px;margin-bottom:16px;display:flex;align-items:flex-start;gap:10px}
.notice-icon{font-size:22px;margin-top:-2px;flex-shrink:0}
.notice-strong{font-size:12.5px;color:#1e40af;line-height:1.5;font-weight:600}
.notice-soft{font-size:12.5px;color:#1e40af;line-height:1.5;margin-top:6px;opacity:.9}
.info-box{padding:11px 13px;border-radius:10px;margin-bottom:14px}
.info-box p{font-size:12px;font-weight:700}
.info-box-green{background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.2)}
.info-box-green p{color:var(--success)}
.info-box-red{background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2)}
.info-box-red p{color:var(--danger)}

/* ---------- CART LINES ---------- */
.cart-line{display:flex;gap:10px;align-items:center;padding:10px;background:var(--bg-soft);border-radius:10px;border:1px solid var(--line);margin-bottom:8px;flex-wrap:wrap}
.cart-line-img{width:44px;height:44px;object-fit:cover;border-radius:7px;flex-shrink:0}
.cart-line-info{flex:1;min-width:120px}
.cart-line-name{font-size:12px;font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cart-line-price{font-size:13px;color:var(--blue);font-weight:700}
.cart-line-controls{display:flex;align-items:center;gap:6px;flex-shrink:0}
.cart-line-qty{font-size:13px;font-weight:600;min-width:14px;text-align:center;color:var(--ink)}
.cart-total-row{padding:12px 0;border-top:1px solid var(--line);margin-bottom:14px;display:flex;justify-content:space-between;align-items:center}
.cart-total-label{color:#666;font-size:14px}
.cart-total-value{font-size:clamp(18px,3vw,21px);font-weight:800;color:var(--blue)}
.cart-min-warning{font-size:12px;color:var(--danger);font-weight:700;text-align:center;margin-bottom:10px}

/* ---------- BUTTONS (shared) ---------- */
.btn-primary-outline{width:100%;padding:13px;border-radius:10px;background:rgba(59,130,246,.12);border:1px solid rgba(59,130,246,.3);color:var(--blue);font-size:14px;font-weight:600;cursor:pointer;margin-bottom:8px}
.btn-secondary{width:100%;padding:10px;border-radius:10px;background:#f3f4f6;border:1px solid var(--line);color:#444;font-size:13px;font-weight:600;cursor:pointer;display:block;text-align:center;text-decoration:none}
.btn-secondary-link{margin-top:0}
.btn-text{width:100%;background:none;border:none;color:#666;font-size:12px;cursor:pointer;padding:7px}
.btn-whatsapp{width:100%;padding:14px;background:var(--wa-green);border:none;border-radius:12px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:8px}
.btn-whatsapp:disabled{opacity:.5;cursor:not-allowed}
.btn-whatsapp-sm{flex:1;padding:8px;border-radius:8px;background:var(--wa-green);border:none;color:#fff;font-size:11px;font-weight:600;cursor:pointer}
.btn-outline-sm-flex{flex:1}
.btn-primary-cyan{width:100%;margin-top:20px;padding:14px;background:rgba(0,180,216,.15);border:1px solid rgba(0,180,216,.4);border-radius:10px;color:var(--cyan);font-size:14px;font-weight:700;cursor:pointer}
.btn-primary-cyan:disabled{opacity:.6}

/* ---------- CHECKOUT FORM ---------- */
.checkout-fields{display:flex;flex-direction:column;gap:12px;margin-bottom:16px}
.field-label{font-size:11px;color:#444;display:block;margin-bottom:5px;font-weight:600}
.toggle-row{display:flex;gap:8px}
.toggle-btn{flex:1;padding:9px 6px;border-radius:8px;border:1px solid var(--line);background:var(--bg-soft);color:#444;cursor:pointer;font-size:12px;font-weight:600}
.toggle-btn.active{border-color:var(--blue);background:rgba(59,130,246,.1);color:var(--blue)}
.checkout-total{font-size:13px;color:#666;text-align:center;margin-bottom:14px}
.checkout-total strong{color:var(--blue)}

/* ---------- SUCCESS MODAL ---------- */
.success-icon{font-size:52px;margin-bottom:12px}
.success-copy{color:#666;font-size:14px;line-height:1.6;margin-bottom:22px}

/* ---------- FAVORITES ---------- */
.empty-msg{text-align:center;color:#666;font-size:13px;padding:20px 0}
.fav-line{display:flex;gap:10px;align-items:center;padding:8px;background:var(--bg-soft);border-radius:10px;margin-bottom:8px;border:1px solid var(--line);flex-wrap:wrap}
.fav-line-link{display:flex;gap:10px;align-items:center;flex:1;text-decoration:none;color:inherit;min-width:140px}
.fav-line-img{width:48px;height:48px;object-fit:cover;border-radius:8px;flex-shrink:0}
.fav-line-name{font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fav-line-price{font-size:13px;color:var(--blue);font-weight:700}
.fav-line-controls{display:flex;align-items:center;gap:6px;flex-shrink:0}
.fav-line-qty{font-size:13px;font-weight:600;min-width:20px;text-align:center}
.fav-line-heart{background:none;border:none;font-size:18px;cursor:pointer;margin-left:4px}

/* ---------- ORDERS HISTORY ---------- */
.order-card{padding:12px;background:var(--bg-soft);border-radius:10px;margin-bottom:8px;border:1px solid var(--line)}
.order-card-head{display:flex;justify-content:space-between;margin-bottom:4px;gap:8px}
.order-id{font-size:13px;font-weight:600;color:var(--ink)}
.order-total{font-size:14px;font-weight:700;color:var(--blue)}
.order-date{font-size:11px;color:#666}
.order-status{font-size:11px;font-weight:600;margin-top:4px}
.status-ok{color:var(--success)}
.status-bad{color:var(--danger)}
.status-pending{color:var(--warning)}
.order-items{margin-top:8px;border-top:1px solid var(--line);padding-top:8px}
.order-item-line{font-size:11px;color:#444;margin-bottom:2px}
.order-actions{display:flex;gap:8px;margin-top:10px}

/* ---------- AUTH / REGISTER SCREEN ---------- */
.auth-screen{min-height:100vh;background:#ffffff;font-family:'DM Sans',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;padding:20px}
.auth-card-wrap{width:100%;max-width:420px}
.auth-header{text-align:center;margin-bottom:32px}
.auth-logo{display:inline-block;font-family:'Syne',sans-serif;font-size:clamp(19px,4vw,22px);font-weight:800;color:var(--ink);text-decoration:none;margin-bottom:8px}
.auth-pill{display:inline-block;padding:4px 14px;background:rgba(0,180,216,.1);border:1px solid rgba(0,180,216,.3);border-radius:20px;font-size:12px;font-weight:600;color:var(--cyan);margin-bottom:8px}
.auth-copy{color:#666;font-size:14px;line-height:1.5}
.auth-min{color:var(--danger);font-size:12px;font-weight:700;margin-top:6px}
.auth-card{background:var(--bg-soft);border:1px solid var(--line);border-radius:18px;padding:clamp(20px,5vw,28px)}
.auth-fields{display:flex;flex-direction:column;gap:14px}
.if2{width:100%;padding:13px 16px;background:#f9fafb;border:1px solid var(--line);border-radius:10px;color:var(--ink);font-size:14px;outline:none;transition:border-color .2s}
.if2:focus{border-color:rgba(0,180,216,.4)}
.if2::placeholder{color:#999}
.auth-error{color:var(--danger);font-size:12px;margin-top:10px}
.auth-back{display:block;text-align:center;margin-top:12px;font-size:12px;color:#666;text-decoration:none}

/* ---------- SMALL SCREEN REFINEMENTS ---------- */
@media(max-width:400px){
  .products-grid{gap:9px}
  .prod-body{padding:8px 9px 10px}
  .header-inner{padding:8px 12px}
  .app-main{padding:12px 12px 60px}
}
`;