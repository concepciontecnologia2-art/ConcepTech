"use client";
import { useState, useMemo, useEffect } from "react";

const WA       = process.env.NEXT_PUBLIC_WHATSAPP!;
const WA_FLOAT = "543865443450"; // número del botón flotante de WhatsApp
const MIN_BUY  = 80000;
const fmt = (n: number) => new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(n);
const GENERIC = "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&q=80";

const WA_PATH = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z";
const FB_PATH = "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z";
const IG_PATH = "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z";
const TT_PATH = "M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.78a4.85 4.85 0 01-1.01-.09z";

type Prod = { id:number; name:string; description:string; category_name:string; category_icon:string;
              price_retail:number; price_wholesale:number; available:boolean; image_url:string|null;
              stock_quantity:number; is_offer?:boolean; is_new?:boolean; };
type Cat  = { id:number; name:string; icon:string; slug:string };
type Item = Prod & { qty:number };

// ─── COMPONENTES AUXILIARES (fuera del componente principal para que no se remonten en cada render) ───
function CatIcon({ icon, size }: { icon?: string|null; size: number }) {
  if (!icon) return <span>📁</span>;
  if (icon.startsWith("http") || icon.startsWith("/")) return <img src={icon} alt="" style={{width:size,height:size,objectFit:"contain"}}/>;
  return <span dangerouslySetInnerHTML={{__html: icon}} />;
}

function WelcomeModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:10000, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.6)", backdropFilter:"blur(4px)" }}>
      <div style={{ background:"#ffffff", padding:24, borderRadius:16, width:"90%", maxWidth:360, textAlign:"center", boxShadow:"0 10px 25px rgba(0,0,0,0.2)" }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🚀</div>
        <h2 style={{ fontSize:18, fontWeight:800, marginBottom:12 }}>¡Nuevas funciones!</h2>
        <p style={{ fontSize:13, color:"#444", marginBottom:20, lineHeight:1.5 }}>
          Ahora podés gestionar tus productos de forma más rápida:
          <br/><br/>
          ❤️ <b>Favoritos:</b> Guardá lo que más te gusta.
          <br/>
          📋 <b>Mis pedidos:</b> Seguí tus pedidos anteriores.
        </p>
        <button onClick={onClose} style={{ width:"100%", padding:12, borderRadius:8, background:"#00B4D8", color:"#fff", border:"none", fontWeight:700, cursor:"pointer" }}>
          ¡Entendido!
        </button>
      </div>
    </div>
  );
}

function ProductImageCarousel({ productId, mainImage }: { productId:number; mainImage:string|null }) {
  const [imgIdx, setImgIdx] = useState(0);
  const [imgs, setImgs] = useState<string[]>([mainImage||GENERIC]);
  const [hasLoadedExtra, setHasLoadedExtra] = useState(false);

  const loadExtraImagesOnDemand = async (): Promise<string[]> => {
    if (hasLoadedExtra) return imgs;
    let all = imgs;
    try {
      const res = await fetch(`/api/products/${productId}/images`);
      if (res.ok) {
        const extra = await res.json();
        const list = [mainImage, ...extra.map((i:any)=>i.image_url)].filter(Boolean) as string[];
        all = list.length>0 ? list : [GENERIC];
        setImgs(all);
      }
    } catch {}
    setHasLoadedExtra(true);
    return all;
  };

  return (
    <div className="pimg">
      <img src={imgs[imgIdx] || GENERIC} alt="" loading="lazy"/>
      <button className="img-nav img-nav-left" onClick={async e=>{
        e.stopPropagation();
        const all = await loadExtraImagesOnDemand();
        setImgIdx(i=>i===0?all.length-1:i-1);
      }}>‹</button>
      <button className="img-nav img-nav-right" onClick={async e=>{
        e.stopPropagation();
        const all = await loadExtraImagesOnDemand();
        setImgIdx(i=>i===all.length-1?0:i+1);
      }}>›</button>
    </div>
  );
}

function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [installed, setInstalled] = useState(false);
  useEffect(()=>{
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent); setIsIOS(ios);
    if (window.matchMedia("(display-mode: standalone)").matches) { setInstalled(true); return; }
    const handler = (e:any)=>{ e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return ()=>window.removeEventListener("beforeinstallprompt", handler);
  },[]);
  if (installed) return null;
  const handleClick = async()=>{
    if (isIOS) { setShowHelp(true); return; }
    if (deferredPrompt) { deferredPrompt.prompt(); const choice = await deferredPrompt.userChoice; if (choice.outcome==="accepted") setInstalled(true); setDeferredPrompt(null); }
    else setShowHelp(true);
  };
  return (
    <>
      <button onClick={handleClick} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"14px 16px",background:"rgba(0,180,216,.06)",border:"1.5px solid rgba(0,180,216,.3)",borderRadius:14,color:"#00B4D8",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",width:"100%"}}>📲 Instalar aplicación</button>
      {showHelp&&(
        <div style={{position:"fixed",inset:0,zIndex:10000,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"flex-end",justifyContent:"center",padding:20}} onClick={()=>setShowHelp(false)}>
          <div style={{background:"#ffffff",borderRadius:20,padding:24,width:"100%",maxWidth:400}} onClick={e=>e.stopPropagation()}>
            <p style={{fontWeight:700,fontSize:16,marginBottom:12,color:"#111827"}}>Instalá la app</p>
            <p style={{fontSize:13,color:"#6B7280",lineHeight:1.6,marginBottom:6}}>{isIOS?"1. Tocá el botón compartir ⬆️ en Safari":"1. Tocá los 3 puntos ⋮ en Chrome"}</p>
            <p style={{fontSize:13,color:"#6B7280",lineHeight:1.6,marginBottom:16}}>2. Seleccioná "Agregar a pantalla de inicio"</p>
            <button onClick={()=>setShowHelp(false)} style={{width:"100%",padding:12,borderRadius:12,background:"#00B4D8",border:"none",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Entendido</button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── PÁGINA ───
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
  const [activeTab, setActiveTab] = useState<"home"|"cats"|"account">("home");
  const [catsOpen, setCatsOpen]   = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountTab, setAccountTab] = useState<"main"|"favs"|"orders">("main");
  const [visible, setVisible]     = useState<Record<string,number>>({});

  const [cart, setCart] = useState<Item[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("cart_mayorista");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  useEffect(() => { localStorage.setItem("cart_mayorista", JSON.stringify(cart)); }, [cart]);

  const [cartOpen, setCartOpen]   = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderDone, setOrderDone] = useState(false);
  const [payMethod, setPayMethod] = useState<"transfer"|"cash">("transfer");
  const [form, setForm] = useState({ name:"", phone:"", delivery:"pickup", address:"" });
  const [favIds, setFavIds] = useState<number[]>([]);
  const [historial, setHistorial] = useState<any[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [favProds, setFavProds] = useState<any[]>([]);

  // FAVORITOS E HISTORIAL
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
    setHistLoading(true);
    try {
      const res = await fetch(`/api/historial?phone=${encodeURIComponent(regForm.phone)}`);
      if (res.ok) {
        const data = await res.json();
        setHistorial(Array.isArray(data)?data:[]);
      }
    } catch(e) {}
    setHistLoading(false);
  };

  const openAccount = (tab: "main"|"favs"|"orders") => {
    setActiveTab("account");
    setAccountTab(tab);
    setAccountOpen(true);
    if (tab==="orders") loadHistorial();
  };
  const closeAccount = () => { setAccountOpen(false); setAccountTab("main"); setActiveTab("home"); };

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
        el.style.border = "2px solid #00B4D8";
        el.style.boxShadow = "0 0 0 4px rgba(0,180,216,.2)";
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

  const availableProds = useMemo(()=>products.filter(x=>x.available===true||(x.available as any)==="true"),[products]);
  const offers = useMemo(()=>availableProds.filter(p=>p.is_offer),[availableProds]);
  const random = useMemo(()=>[...availableProds].sort(()=>0.5-Math.random()).slice(0,8),[availableProds]);

  const grouped = useMemo(()=>{
    if(activeCat) return {"":filtered};
    const map:Record<string,Prod[]>={};
    filtered.forEach(p=>{if(!map[p.category_name])map[p.category_name]=[];map[p.category_name].push(p);});
    return map;
  },[filtered,activeCat]);

  // CARRITO
  const addToCart = (p:Prod)=>{
    setCart(prev=>{const ex=prev.find(i=>i.id===p.id);return ex?prev.map(i=>i.id===p.id?{...i,qty:i.qty+1}:i):[...prev,{...p,qty:1}];});
  };
  const setQty = (p:Prod, qty:number)=>{
    setCart(prev=>{
      const ex=prev.find(i=>i.id===p.id);
      return ex ? prev.map(i=>i.id===p.id?{...i,qty}:i).filter(i=>i.qty>0) : qty>0 ? [...prev,{...p,qty}] : prev;
    });
  };
  const removeFromCart = (id:number) => setCart(prev=>prev.filter(i=>i.id!==id));
  const updateQty=(id:number,d:number)=>setCart(prev=>prev.map(i=>i.id===id?{...i,qty:Math.max(0,i.qty+d)}:i).filter(i=>i.qty>0));
  const cartCount=cart.reduce((s,i)=>s+i.qty,0);
  const cartTotal=cart.reduce((s,i)=>s+i.qty*Number(i.price_wholesale),0);

  const shareProduct = (p:Prod, via:string) => {
    const url = `${window.location.origin}/mayorista/producto/${p.id}`;
    const text = `🛒 ${p.name} — ${fmt(Number(p.price_wholesale))} | Concepción Tecnología`;
    if (via==="wa") window.open(`https://wa.me/?text=${encodeURIComponent(text+"\n"+url)}`,"_blank");
    if (via==="fb") window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,"_blank");
    if (via==="ig") navigator.clipboard.writeText(text+"\n"+url).then(()=>alert("✅ Link copiado. Pegalo en Instagram.")).catch(()=>alert("Copiá este link:\n"+url));
  };

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

  // ─── PRODUCT CARD ───
  const renderCard = (p: Prod) => {
    const inCart = cart.find(i=>i.id===p.id);
    const esFav  = favIds.includes(p.id);
    const st = Number(p.stock_quantity);
    const stockClass = st<=3 ? "stock-none" : st<=10 ? "stock-low" : "stock-ok";
    const stockText  = st===0 ? "🔴 Sin stock" : st<=3 ? `🔴 ${st} u.` : st<=10 ? `🟡 ${st} u.` : `🟢 ${st} u.`;
    return (
      <div id={`producto-${p.id}`} className={`pcard${inCart?" in-cart":""}`} onClick={()=>window.location.href=`/mayorista/producto/${p.id}`}>
        <button className="fav-btn" onClick={e=>{e.stopPropagation();toggleFav(p.id);}}>{esFav?"❤️":"🤍"}</button>

        <div style={{position:"relative"}}>
          <ProductImageCarousel productId={p.id} mainImage={p.image_url}/>
          <div className="pbadges">
            {p.is_offer&&<span className="badge badge-offer">OFERTA</span>}
            {p.is_new&&<span className="badge badge-new">NUEVO</span>}
          </div>
          {inCart&&<div className="pqty-pill">×{inCart.qty}</div>}
        </div>

        <div className="pbody">
          <p className="pcat">{p.category_name}</p>
          <p className="pname" title={p.name}>{p.name}</p>
          <p className="pprice">{fmt(Number(p.price_wholesale))}</p>
          <p className="pretail">{fmt(Number(p.price_retail))}</p>
          <p className={`pstock ${stockClass}`}>{stockText}</p>

          <div className="pactions" onClick={e=>e.stopPropagation()}>
            <div className="qty-controls">
              <button className="qty-btn" onClick={()=>updateQty(p.id,-1)}>−</button>
              <input type="number" min="0" className="qty-input" value={inCart?.qty||0}
                onChange={e=>setQty(p, Math.max(0, Number(e.target.value)))}/>
              <button className="qty-btn qty-btn-solid" onClick={()=>addToCart(p)} disabled={st===0}>+</button>
            </div>
            <div className="share-row">
              <button className="share-btn" title="Compartir en WhatsApp" onClick={()=>shareProduct(p,"wa")}><svg width="15" height="15" viewBox="0 0 24 24" fill="#25D366"><path d={WA_PATH}/></svg></button>
              <button className="share-btn" title="Compartir en Facebook" onClick={()=>shareProduct(p,"fb")}><svg width="15" height="15" viewBox="0 0 24 24" fill="#1877F2"><path d={FB_PATH}/></svg></button>
              <button className="share-btn" title="Compartir en Instagram" onClick={()=>shareProduct(p,"ig")}><svg width="15" height="15" viewBox="0 0 24 24" fill="#E1306C"><path d={IG_PATH}/></svg></button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── CATEGORY SECTION ───
  const renderSection = (catName: string, prods: Prod[]) => {
    const key = catName || "all";
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const hayHash = prods.some(p => `#producto-${p.id}` === hash);
    const count = visible[key] ?? (hayHash ? prods.length : 12);
    const shown = prods.slice(0, count);
    const hasMore = count < prods.length;
    const hasLess = count > 12;
    const catObj = categories.find(c=>c.name===catName);
    return (
      <section key={key} style={{marginBottom:32,width:"100%",maxWidth:"100%"}}>
        {catName&&(
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,width:"100%"}}>
            <h2 style={{fontSize:16,fontWeight:800,color:"#111827",display:"flex",alignItems:"center",gap:8}}>
              {catObj?.icon ? <CatIcon icon={catObj.icon} size={20}/> : null}
              {catName}
            </h2>
            <div style={{flex:1,height:1,background:"linear-gradient(to right,#E5E7EB,transparent)"}}/>
            <button className="btn-outline-sm" onClick={()=>downloadCatalogoPDF(catName, prods)}>Descargar catálogo</button>
          </div>
        )}
        {prods.length===0
          ? <p style={{color:"#9CA3AF",fontSize:13}}>Sin productos.</p>
          : <>
              <div className="pg">{shown.map(p=><div key={p.id} style={{minWidth:0}}>{renderCard(p)}</div>)}</div>
              {(hasMore||hasLess)&&(
                <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:18}}>
                  {hasMore&&<button className="btn-loadmore" onClick={()=>setVisible(v=>({...v,[key]:Math.min(count+12,prods.length)}))}>Ver más ({prods.length-count})</button>}
                  {hasLess&&<button className="btn-loadless" onClick={()=>setVisible(v=>({...v,[key]:12}))}>Ver menos</button>}
                </div>
              )}
            </>
        }
      </section>
    );
  };

  // ─── PANTALLA DE REGISTRO ───
  if (!registered) return (
    <div className="auth-screen">
      <style dangerouslySetInnerHTML={{__html:GLOBAL_CSS}}/>
      <div className="auth-card-wrap">
        <div className="auth-header">
          <a href="/" className="auth-logo"><span style={{color:"#00B4D8"}}>Concepción</span> Tecnología</a>
          <div className="auth-pill">Precio Mayorista</div>
          <p className="auth-copy">Registrate para ver los precios mayoristas y hacer tus pedidos.</p>
          <p className="auth-min">COMPRA MINIMA $80.000</p>
        </div>
        <div className="auth-card">
          <div className="auth-fields">
            {([["Nombre completo","text","name","Tu nombre"],["Teléfono","tel","phone","3865 xxxxxx"]] as [string,string,string,string][]).map(([label,type,key,ph])=>(
              <div key={key}>
                <label className="field-label">{label.toUpperCase()}</label>
                <input type={type} className="fi" placeholder={ph}
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
      <a href={`https://wa.me/${WA_FLOAT}?text=${encodeURIComponent("Hola! Quiero hacer una consulta.")}`} target="_blank" rel="noopener noreferrer" className="fab-wa">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d={WA_PATH}/></svg>
      </a>
    </div>
  );

  return (
    <div className="app-root">
      <style dangerouslySetInnerHTML={{__html:GLOBAL_CSS}}/>

      {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}

      {/* ── HEADER MOBILE ── */}
      <header className="mobile-header">
        <div className="pad" style={{marginLeft:0,maxWidth:"100%"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",height:60,gap:12,width:"100%"}}>
            <a href="/" style={{display:"flex",alignItems:"center",gap:8,textDecoration:"none",flexShrink:0}}>
              <img src="/images/logo1.png" alt="Concepción Tecnología" style={{height:38,width:"auto",objectFit:"contain"}}/>
              <span style={{fontSize:9,padding:"2px 6px",background:"rgba(0,180,216,.1)",border:"1px solid rgba(0,180,216,.3)",borderRadius:4,color:"#00B4D8",fontWeight:700}}>MAYORISTA</span>
            </a>
            <a href="/" style={{padding:"6px 12px",borderRadius:10,background:"#00B4D8",color:"#fff",fontSize:11,fontWeight:700,textDecoration:"none",whiteSpace:"nowrap",display:"flex",flexDirection:"column",alignItems:"center",lineHeight:1.2,flexShrink:0}}>
              <span>Precios Minoristas</span>
              <small style={{fontSize:8,opacity:.9,fontWeight:500}}>Ver tienda</small>
            </a>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="body-with-sidebar">

          {/* ── SIDEBAR DESKTOP (sticky) ── */}
          <aside className="sidebar">
            <div style={{marginBottom:14,width:"100%"}}>
              <p className="side-label">Categorías</p>
              <button className={`side-item${!activeCat?" active":""}`} onClick={()=>setActiveCat(null)}>
                🏠 <span style={{flex:1}}>Todos</span>
                <span className="side-count">{availableProds.length}</span>
              </button>
              {categories.map(c=>{
                const count = availableProds.filter(p=>p.category_name===c.name).length;
                return (
                  <button key={c.id} className={`side-item${activeCat===c.slug?" active":""}`} onClick={()=>setActiveCat(activeCat===c.slug?null:c.slug)}>
                    <span style={{fontSize:16,flexShrink:0,display:"flex",alignItems:"center",width:18,justifyContent:"center"}}><CatIcon icon={c.icon} size={16}/></span>
                    <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</span>
                    <span className="side-count">{count}</span>
                  </button>
                );
              })}
            </div>

            <div style={{marginBottom:14,width:"100%"}}>
              <p className="side-label">Mi cuenta</p>
              <p style={{fontSize:12,color:"#374151",fontWeight:600,padding:"0 12px",marginBottom:6,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>👤 {regForm.name}</p>
              <button className="side-item" onClick={()=>openAccount("favs")}>
                ❤️ <span style={{flex:1}}>Favoritos</span>
                <span className="side-count">{favIds.length}</span>
              </button>
              <button className="side-item" onClick={()=>openAccount("orders")}>
                📋 <span style={{flex:1}}>Mis pedidos</span>
              </button>
            </div>

            <div style={{background:"linear-gradient(135deg,#0096C7,#00B4D8)",borderRadius:14,padding:12,color:"white",marginTop:"auto",width:"100%",flexShrink:0}}>
              <p style={{fontSize:13,fontWeight:800,marginBottom:4}}>Tienda minorista</p>
              <p style={{fontSize:10,opacity:.8,marginBottom:8,lineHeight:1.3}}>Comprá por unidad con precios minoristas.</p>
              <a href="/" style={{display:"block",width:"100%",padding:6,borderRadius:8,background:"rgba(255,255,255,.2)",border:"1px solid rgba(255,255,255,.3)",color:"white",fontSize:11,fontWeight:700,textDecoration:"none",textAlign:"center"}}>Ir a la tienda</a>
            </div>
          </aside>

          {/* ── COLUMNA DERECHA ── */}
          <div style={{width:"100%",minWidth:0,display:"flex",flexDirection:"column"}}>

            {/* HERO (solo desktop) */}
            <div className="hero">
              <div style={{maxWidth:1100,margin:"0 auto",display:"grid",gridTemplateColumns:"1fr 1fr",gap:30,alignItems:"center",position:"relative",zIndex:1,width:"100%"}}>
                <div>
                  <div style={{display:"inline-block",padding:"4px 12px",background:"rgba(0,180,216,.15)",border:"1px solid rgba(0,180,216,.3)",borderRadius:20,color:"#00B4D8",fontSize:11,fontWeight:700,marginBottom:12}}>Precios mayoristas</div>
                  <h1 style={{fontSize:40,fontWeight:900,color:"white",lineHeight:1.1,marginBottom:12,letterSpacing:"-1px"}}>Comprá <span style={{color:"#00B4D8"}}>por mayor</span><br/>al mejor precio</h1>
                  <p style={{fontSize:14,color:"rgba(255,255,255,.6)",lineHeight:1.5,marginBottom:24}}>Repuestos, accesorios, celulares y más.<br/>Compra mínima {fmt(MIN_BUY)}.</p>
                  <div style={{display:"flex",gap:10}}>
                    <button onClick={()=>window.scrollTo({top:400,behavior:"smooth"})} style={{padding:"10px 20px",borderRadius:12,background:"#00B4D8",color:"white",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Ver productos</button>
                    <a href="/" style={{padding:"10px 20px",borderRadius:12,background:"rgba(255,255,255,.1)",color:"white",border:"1px solid rgba(255,255,255,.2)",fontSize:13,fontWeight:600,textDecoration:"none",display:"flex",alignItems:"center"}}>Tienda minorista</a>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {random.slice(0,4).map(p=>(
                    <div key={p.id} onClick={()=>window.location.href=`/mayorista/producto/${p.id}`}
                      style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:14,padding:14,backdropFilter:"blur(8px)",cursor:"pointer",transition:"background .2s"}}
                      onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.1)"}
                      onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.06)"}>
                      <img src={p.image_url||GENERIC} alt={p.name} style={{width:44,height:44,objectFit:"contain",marginBottom:6,borderRadius:6}}/>
                      <p style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,.8)",lineHeight:1.2,marginBottom:3}}>{p.name}</p>
                      <p style={{fontSize:14,fontWeight:800,color:"#00B4D8"}}>{fmt(Number(p.price_wholesale))}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* BUSCADOR */}
            <div style={{background:"#fff",padding:"12px 16px 10px",borderBottom:"1px solid #E5E7EB",width:"100%",maxWidth:"100%"}}>
              <div className="pad" style={{padding:0}}>
                <div style={{display:"flex",gap:8,width:"100%",maxWidth:"100%"}}>
                  <div style={{position:"relative",flex:1,minWidth:0}}>
                    <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:15,color:"#9CA3AF",pointerEvents:"none"}}>🔍</span>
                    <input className="fi" style={{paddingLeft:40,background:"#F3F4F6",border:"none",borderRadius:12,width:"100%"}} placeholder="Buscar precio mayorista..." value={search} onChange={e=>setSearch(e.target.value)}/>
                  </div>
                  <select value={sort} onChange={e=>setSort(e.target.value as any)} style={{padding:"10px 10px",background:"#F3F4F6",border:"none",borderRadius:12,fontSize:12,fontFamily:"inherit",color:"#374151",outline:"none",cursor:"pointer",fontWeight:500,flexShrink:0}}>
                    <option value="default">Ordenar</option>
                    <option value="desc">Mayor precio</option>
                    <option value="asc">Menor precio</option>
                  </select>
                </div>
              </div>
            </div>

            {/* CONTENIDO */}
            <div className="pad" style={{paddingTop:18,paddingBottom:24,flex:1}}>

              {!activeCat&&!search&&(
                <div style={{background:"linear-gradient(135deg,#0096C7,#00B4D8)",borderRadius:20,padding:"20px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,overflow:"hidden",position:"relative"}}>
                  <div style={{position:"absolute",right:-30,top:-30,width:120,height:120,borderRadius:"50%",background:"rgba(255,255,255,.08)"}}/>
                  <div>
                    <p style={{fontSize:11,color:"rgba(255,255,255,.8)",fontWeight:500,marginBottom:4}}>Hola, {regForm.name}</p>
                    <p style={{fontSize:20,fontWeight:800,color:"#fff",lineHeight:1.2,marginBottom:6}}>Precios mayoristas</p>
                    <p style={{fontSize:12,color:"rgba(255,255,255,.9)",fontWeight:700}}>Compra mínima {fmt(MIN_BUY)}</p>
                  </div>
                  <div style={{fontSize:56,flexShrink:0,position:"relative",zIndex:1}}>📦</div>
                </div>
              )}

              {!activeCat&&!search&&offers.length>0&&(
                <section style={{marginBottom:24,width:"100%",overflow:"hidden"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                    <h2 style={{fontSize:16,fontWeight:800,color:"#111827"}}>Ofertas y Novedades</h2>
                    <div style={{flex:1,height:1,background:"linear-gradient(to right,#E5E7EB,transparent)"}}/>
                  </div>
                  <div className="hscroll">
                    {offers.map(p=><div key={p.id} style={{width:180,flexShrink:0}}>{renderCard(p)}</div>)}
                  </div>
                </section>
              )}

              {!activeCat&&!search&&random.length>0&&(
                <section style={{marginBottom:24,width:"100%",overflow:"hidden"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                    <h2 style={{fontSize:16,fontWeight:800,color:"#111827"}}>⚡ Destacados</h2>
                    <div style={{flex:1,height:1,background:"linear-gradient(to right,#E5E7EB,transparent)"}}/>
                  </div>
                  <div className="hscroll">
                    {random.map(p=><div key={p.id} style={{width:180,flexShrink:0}}>{renderCard(p)}</div>)}
                  </div>
                </section>
              )}

              {Object.entries(grouped).map(([catName,prods])=>renderSection(catName,prods))}
            </div>

            {/* ── FOOTER ── */}
            <footer style={{background:"#0D1117",padding:"36px 0 24px",width:"100%"}}>
              <div className="pad">
                <p style={{fontSize:22,fontWeight:800,color:"#ffffff",marginBottom:4}}><span style={{color:"#00B4D8"}}>Concepción</span> Tecnología</p>
                <p style={{fontSize:12,color:"rgba(255,255,255,.4)",marginBottom:24}}>Tu tienda de tecnología en Concepción, Tucumán</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:24,marginBottom:28}}>
                  <div>
                    <p className="foot-label">Local</p>
                    <p style={{fontSize:12,color:"rgba(255,255,255,.6)",marginBottom:5,lineHeight:1.5}}>Independencia 450<br/>Concepción, Tucumán</p>
                    <p style={{fontSize:12,color:"rgba(255,255,255,.6)",lineHeight:1.5}}>L-V 9-12 y 16-20hs<br/>Sáb 9-15hs</p>
                  </div>
                  <div>
                    <p className="foot-label">Categorías</p>
                    {categories.slice(0,5).map(c=><a key={c.id} href="#" onClick={e=>{e.preventDefault();setActiveCat(c.slug);window.scrollTo({top:200,behavior:"smooth"});}} className="foot-link">{c.name}</a>)}
                  </div>
                  <div>
                    <p className="foot-label">Servicios</p>
                    {[["Tienda minorista","/"],["Bot de WhatsApp",`https://wa.me/${WA}`],["Envíos a domicilio","#"],["Facturación","#"]].map(([l,h])=>(
                      <a key={l} href={h} className="foot-link">{l}</a>
                    ))}
                  </div>
                  <div>
                    <p className="foot-label">Redes</p>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {[
                        [FB_PATH,"#1877F2","https://www.facebook.com/share/1GtkZrvC6L/?mibextid=wwXIfr"],
                        [IG_PATH,"linear-gradient(135deg,#f09433,#dc2743,#bc1888)","https://www.instagram.com/concepciontecnologia?igsh=azFiYWFrOWhpcGV1"],
                        [TT_PATH,"#111","https://www.tiktok.com/@concepciontecnologia?_r=1&_t=ZS-96fPI9A4yBQ"],
                      ].map(([path,bg,href])=>(
                        <a key={href} href={href} target="_blank" rel="noopener noreferrer"
                          style={{width:36,height:36,borderRadius:10,background:bg,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",transition:"transform .15s"}}
                          onMouseEnter={e=>e.currentTarget.style.transform="scale(1.1)"}
                          onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d={path}/></svg>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{borderTop:"1px solid rgba(255,255,255,.08)",paddingTop:16,display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,alignItems:"center"}}>
                  <p style={{fontSize:11,color:"rgba(255,255,255,.25)"}}>© 2025 Concepción Tecnología</p>
                  <p style={{fontSize:11,color:"rgba(255,255,255,.4)",background:"rgba(255,255,255,.06)",padding:"5px 12px",borderRadius:8}}>L-V 9-12 y 16-20hs · Sáb 9-15hs</p>
                </div>
              </div>
            </footer>
          </div>
        </div>
      </main>

      {/* ── BOTTOM NAV (solo mobile) ── */}
      <nav className="bnav">
        {([
          ["home","🏠","Inicio",()=>{ setActiveCat(null); setSearch(""); window.scrollTo({top:0,behavior:"smooth"}); setActiveTab("home"); }],
          ["cats","📦","Categorías",()=>{ setActiveTab("cats"); setCatsOpen(true); }],
          ["account","👤","Cuenta",()=>openAccount("main")],
        ] as [string,string,string,()=>void][]).map(([tab,icon,label,fn])=>(
          <button key={tab} className={`bni${activeTab===tab?" active":""}`} onClick={fn}>
            <span className="bni-icon">{icon}</span>
            <span className="bni-label">{label}</span>
          </button>
        ))}
      </nav>

      {/* ── PANEL CATEGORÍAS (mobile) ── */}
      {catsOpen&&(
        <div className="mo" onClick={()=>{setCatsOpen(false);setActiveTab("home");}}>
          <div className="mb" onClick={e=>e.stopPropagation()} style={{maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexShrink:0}}>
              <h3 style={{fontSize:18,fontWeight:800,color:"#111827"}}>Categorías</h3>
              <button onClick={()=>{setCatsOpen(false);setActiveTab("home");}} className="icon-close">✕</button>
            </div>
            <div style={{overflowY:"auto",flex:1,paddingRight:4,display:"flex",flexDirection:"column",gap:4}}>
              <button className={`m-item${!activeCat?" active":""}`} onClick={()=>{setActiveCat(null);setCatsOpen(false);setActiveTab("home");}}>
                🏠 <span style={{flex:1}}>Todos los productos</span>
                <span className="m-count">{availableProds.length}</span>
              </button>
              {categories.map(c=>{
                const count = availableProds.filter(p=>p.category_name===c.name).length;
                return (
                  <button key={c.id} className={`m-item${activeCat===c.slug?" active":""}`} onClick={()=>{setActiveCat(c.slug);setCatsOpen(false);setActiveTab("home");}}>
                    <span style={{fontSize:20,display:"flex",alignItems:"center",width:24,justifyContent:"center",flexShrink:0}}><CatIcon icon={c.icon} size={20}/></span>
                    <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</span>
                    <span className="m-count">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── PANEL CUENTA (mobile y desktop) ── */}
      {accountOpen&&(
        <div className="mo" onClick={closeAccount}>
          <div className="mb" onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <h3 style={{fontSize:18,fontWeight:800,color:"#111827"}}>
                {accountTab==="main"?"Mi cuenta":accountTab==="favs"?"Mis favoritos":"Mis pedidos"}
              </h3>
              <button onClick={closeAccount} className="icon-close">✕</button>
            </div>

            {accountTab==="main"&&(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div style={{padding:"12px 16px",background:"rgba(0,180,216,.06)",borderRadius:12,border:"1px solid rgba(0,180,216,.15)",marginBottom:4}}>
                  <p style={{fontSize:13,fontWeight:600,color:"#111827"}}>👤 {regForm.name}</p>
                  <p style={{fontSize:12,color:"#6B7280"}}>📞 {regForm.phone}</p>
                </div>
                <InstallButton/>
                <button className="acc-btn" onClick={()=>setAccountTab("favs")}>
                  <span style={{fontSize:22}}>❤️</span>
                  <span style={{flex:1}}>Mis favoritos</span>
                  <span style={{background:"rgba(239,68,68,.1)",color:"#EF4444",padding:"2px 8px",borderRadius:20,fontSize:12,fontWeight:700}}>{favIds.length}</span>
                  <span style={{color:"#9CA3AF"}}>›</span>
                </button>
                <button className="acc-btn" onClick={()=>{setAccountTab("orders");loadHistorial();}}>
                  <span style={{fontSize:22}}>📋</span>
                  <span style={{flex:1}}>Mis pedidos</span>
                  <span style={{color:"#9CA3AF"}}>›</span>
                </button>
                <a href="/" style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:14,border:"1.5px solid rgba(0,180,216,.3)",background:"rgba(0,180,216,.06)",textDecoration:"none",fontSize:14,fontWeight:600,color:"#00B4D8"}}>
                  <span style={{fontSize:22}}>🏪</span>
                  <span style={{flex:1}}>Ir a la tienda minorista</span>
                  <span>›</span>
                </a>
              </div>
            )}

            {accountTab==="favs"&&(
              <div>
                <button className="back-btn" onClick={()=>setAccountTab("main")}>← Volver</button>
                {favProds.length===0
                  ? <div style={{textAlign:"center",padding:"32px 0"}}>
                      <p style={{fontSize:32,marginBottom:12}}>🤍</p>
                      <p style={{fontSize:14,color:"#6B7280",fontWeight:500}}>No tenés favoritos aún</p>
                      <p style={{fontSize:12,color:"#9CA3AF",marginTop:4}}>Tocá el ❤️ en cualquier producto</p>
                    </div>
                  : <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:"60vh",overflowY:"auto"}}>
                      {favProds.map((p:any)=>{
                        const inCart = cart.find(i=>i.id===p.id);
                        return (
                          <div key={p.id} style={{display:"flex",gap:10,alignItems:"center",padding:10,background:"#F9FAFB",borderRadius:12,border:"1px solid #E5E7EB"}}>
                            <img src={p.image_url||GENERIC} style={{width:48,height:48,objectFit:"cover",borderRadius:10,flexShrink:0}} loading="lazy" alt={p.name}/>
                            <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>window.location.href=`/mayorista/producto/${p.id}`}>
                              <p style={{fontSize:12,fontWeight:600,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</p>
                              <p style={{fontSize:13,color:"#00B4D8",fontWeight:700}}>{fmt(Number(p.price_wholesale))}</p>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <button className="qty-btn" onClick={()=>updateQty(p.id,-1)}>−</button>
                              <span style={{fontSize:13,fontWeight:700,minWidth:16,textAlign:"center"}}>{inCart?.qty||0}</span>
                              <button className="qty-btn qty-btn-solid" onClick={()=>addToCart(p)}>+</button>
                              <button onClick={()=>toggleFav(p.id)} style={{background:"none",border:"none",fontSize:16,cursor:"pointer",marginLeft:2}}>❤️</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                }
              </div>
            )}

            {accountTab==="orders"&&(
              <div>
                <button className="back-btn" onClick={()=>setAccountTab("main")}>← Volver</button>
                {histLoading
                  ? <p style={{textAlign:"center",color:"#6B7280",padding:"20px 0"}}>Cargando pedidos...</p>
                  : historial.length===0
                    ? <div style={{textAlign:"center",padding:"32px 0"}}>
                        <p style={{fontSize:32,marginBottom:12}}>📋</p>
                        <p style={{fontSize:14,color:"#6B7280",fontWeight:500}}>No tenés pedidos registrados</p>
                      </div>
                    : <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:"60vh",overflowY:"auto"}}>
                        {historial.map((o:any)=>{
                          const items = Array.isArray(o.items) ? o.items : [];
                          return (
                            <div key={o.id} style={{padding:12,background:"#F9FAFB",borderRadius:12,border:"1px solid #E5E7EB"}}>
                              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                                <p style={{fontSize:13,fontWeight:600,color:"#111827"}}>Pedido #{String(o.id).padStart(4,"0")}</p>
                                <p style={{fontSize:14,fontWeight:700,color:"#00B4D8"}}>{fmt(Number(o.total))}</p>
                              </div>
                              <p style={{fontSize:11,color:"#6B7280"}}>{new Date(o.created_at).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"})}</p>
                              <p style={{fontSize:11,fontWeight:600,marginTop:4,color:o.status==="completed"?"#10b981":o.status==="cancelled"?"#EF4444":"#F59E0B"}}>{o.status==="completed"?"Completado":o.status==="cancelled"?"Cancelado":"Pendiente"}</p>
                              {items.length>0&&(
                                <div style={{marginTop:8,borderTop:"1px solid #E5E7EB",paddingTop:8}}>
                                  {items.map((item:any,i:number)=>(<p key={i} style={{fontSize:11,color:"#444",marginBottom:2}}>• {item.qty}x {item.name}</p>))}
                                </div>
                              )}
                              <div style={{display:"flex",gap:8,marginTop:10}}>
                                <button className="btn-outline-sm" style={{flex:1}} onClick={()=>{
                                  items.forEach((item:any)=>{
                                    const prod = products.find(p=>p.name===item.name);
                                    if (prod) setCart(prev=>{ const ex=prev.find(i=>i.id===prod.id); return ex?prev.map(i=>i.id===prod.id?{...i,qty:i.qty+Number(item.qty||1)}:i):[...prev,{...prod,qty:Number(item.qty||1)}]; });
                                  });
                                  closeAccount(); setCartOpen(true);
                                }}>Repetir pedido</button>
                                <button className="btn-whatsapp-sm" onClick={()=>{
                                  const lines = items.map((i:any)=>`• ${i.qty}x ${i.name} — ${fmt(i.qty*Number(i.price))}`).join("\n");
                                  const msg = encodeURIComponent(`📦 *Repetir Pedido #${String(o.id).padStart(4,"0")} - Concepción Tecnología*\n\n${lines}\n\n*Total: ${fmt(Number(o.total))}*`);
                                  window.open(`https://wa.me/${WA}?text=${msg}`,"_blank");
                                }}>WhatsApp</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                }
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FAB WSP ── */}
      <a href={`https://wa.me/${WA_FLOAT}?text=${encodeURIComponent("Hola! Quiero hacer una consulta.")}`} target="_blank" rel="noopener noreferrer" className="fab-wa">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d={WA_PATH}/></svg>
      </a>

      {/* ── FAB SUBIR ── */}
      <button onClick={()=>window.scrollTo({top:0,behavior:"smooth"})} className={`fab-up ${cartCount>0?"has-cart":"no-cart"}`}>↑</button>

      {/* ── FAB CARRITO ── */}
      {cartCount>0&&!cartOpen&&(
        <button onClick={()=>setCartOpen(true)} className="fab-cart">
          🛒 <span style={{background:"rgba(255,255,255,.2)",borderRadius:20,padding:"1px 8px",fontSize:12}}>{cartCount}</span>
        </button>
      )}

      {/* ── DRAWER CARRITO ── */}
      {cartOpen&&(
        <div className="dr">
          <div className="ov" onClick={()=>setCartOpen(false)}/>
          <div className="dp">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <h2 style={{fontSize:18,fontWeight:800,color:"#111827"}}>Carrito Mayorista</h2>
              <button onClick={()=>setCartOpen(false)} className="icon-close">✕</button>
            </div>

            <div className="notice-box">
              <span style={{fontSize:22,marginTop:-2,flexShrink:0}}>💡</span>
              <div>
                <p style={{fontSize:12.5,color:"#1e40af",lineHeight:1.5,fontWeight:600}}>¿Venís del Bot de WhatsApp o tenés muchos productos?</p>
                <p style={{fontSize:12.5,color:"#1e40af",lineHeight:1.5,marginTop:6,opacity:.9}}>Podés entrar y salir de la app sin problema: tu carrito quedará guardado y no se perderá ningún producto. ¡Gracias por seguir confiando en nosotros!</p>
              </div>
            </div>

            {cart.map(item=>(
              <div key={item.id} style={{display:"flex",gap:10,alignItems:"center",padding:10,background:"#F9FAFB",borderRadius:14,border:"1px solid #E5E7EB",marginBottom:8}}>
                <img src={item.image_url||GENERIC} style={{width:44,height:44,objectFit:"cover",borderRadius:10,flexShrink:0}} loading="lazy" alt={item.name}/>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:12,fontWeight:600,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</p>
                  <p style={{fontSize:13,color:"#00B4D8",fontWeight:700}}>{fmt(Number(item.price_wholesale)*item.qty)}</p>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <button className="qty-btn" onClick={()=>updateQty(item.id,-1)}>−</button>
                  <span style={{fontSize:13,fontWeight:700,minWidth:16,textAlign:"center",color:"#111827"}}>{item.qty}</span>
                  <button className="qty-btn" onClick={()=>updateQty(item.id,1)}>+</button>
                  <button className="qty-btn qty-btn-danger" onClick={()=>removeFromCart(item.id)}>🗑️</button>
                </div>
              </div>
            ))}

            <div style={{padding:"12px 0",borderTop:"1px solid #E5E7EB",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:"#6B7280",fontSize:14}}>Total mayorista</span>
              <span style={{fontSize:22,fontWeight:800,color:"#00B4D8"}}>{fmt(cartTotal)}</span>
            </div>
            {cartTotal < MIN_BUY && (
              <p style={{fontSize:12,color:"#EF4444",fontWeight:700,textAlign:"center",marginBottom:10}}>
                ⚠️ COMPRA MÍNIMA {fmt(MIN_BUY)} — Te faltan {fmt(MIN_BUY-cartTotal)}
              </p>
            )}
            <button onClick={()=>{setCartOpen(false);setCheckoutOpen(true);}} style={{width:"100%",padding:13,borderRadius:14,background:"#00B4D8",border:"none",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Finalizar pedido →</button>
            <button onClick={()=>setCartOpen(false)} style={{marginTop:8,width:"100%",background:"none",border:"none",color:"#6B7280",fontSize:12,cursor:"pointer",padding:7,fontFamily:"inherit"}}>← Seguir agregando productos</button>
          </div>
        </div>
      )}

      {/* ── MODAL CHECKOUT ── */}
      {checkoutOpen&&!orderDone&&(
        <div className="mo">
          <div className="mb">
            <h2 style={{fontSize:18,fontWeight:800,marginBottom:4,color:"#111827"}}>Pedido Mayorista</h2>
            <p style={{fontSize:12,color:"#6B7280",marginBottom:16}}>Precio mayorista · Completá los datos de entrega</p>
            <div style={{display:"flex",flexDirection:"column",gap:11,marginBottom:14}}>
              <div><label className="field-label">NOMBRE *</label><input className="fi" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
              <div><label className="field-label">TELÉFONO *</label><input className="fi" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/></div>
              <div>
                <label className="field-label">ENTREGA</label>
                <div style={{display:"flex",gap:8}}>
                  {[["pickup","🏪 Retiro"],["delivery","🚗 Envío"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setForm(f=>({...f,delivery:v}))} className={`toggle-btn${form.delivery===v?" active":""}`}>{l}</button>
                  ))}
                </div>
              </div>
              {form.delivery==="delivery"&&(<div><label className="field-label">DIRECCIÓN *</label><input className="fi" placeholder="Calle, número, barrio" value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))}/></div>)}
              <div>
                <label className="field-label">MÉTODO DE PAGO</label>
                <div style={{display:"flex",gap:8}}>
                  {[["transfer","💳 Transferencia"],["cash","💵 Efectivo"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setPayMethod(v as "transfer"|"cash")} className={`toggle-btn${payMethod===v?" active":""}`}>{l}</button>
                  ))}
                </div>
              </div>
            </div>

            {payMethod==="cash"&&(<div style={{padding:"10px 13px",background:"rgba(16,185,129,.06)",borderRadius:12,border:"1px solid rgba(16,185,129,.2)",marginBottom:12}}><p style={{fontSize:12,color:"#10b981",fontWeight:600}}>💵 Pagás en efectivo al retirar o recibir el pedido</p></div>)}
            <div style={{padding:"10px 13px",background:"rgba(239,68,68,.06)",borderRadius:12,border:"1px solid rgba(239,68,68,.2)",marginBottom:12}}><p style={{fontSize:12,color:"#EF4444",fontWeight:700}}>⚠️ COMPRA MÍNIMA {fmt(MIN_BUY)}</p></div>

            <p style={{fontSize:13,color:"#6B7280",textAlign:"center",marginBottom:12}}>Total: <strong style={{color:"#00B4D8"}}>{fmt(cartTotal)}</strong> (Mayorista)</p>

            <button onClick={handleOrder} disabled={!form.name||!form.phone} style={{width:"100%",padding:13,background:"#25D366",border:"none",borderRadius:14,color:"white",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:(!form.name||!form.phone)?0.5:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              💬 Enviar pedido por WhatsApp
            </button>
            <button onClick={()=>{setCheckoutOpen(false);setCartOpen(true);}} style={{marginTop:8,width:"100%",background:"none",border:"none",color:"#6B7280",fontSize:12,cursor:"pointer",padding:7,fontFamily:"inherit"}}>← Volver al carrito</button>
          </div>
        </div>
      )}

      {/* ── PEDIDO EXITOSO ── */}
      {orderDone&&(
        <div className="mo">
          <div className="mb" style={{textAlign:"center"}}>
            <div style={{fontSize:52,marginBottom:12}}>✅</div>
            <h2 style={{fontSize:20,fontWeight:800,marginBottom:10,color:"#111827"}}>¡Pedido mayorista enviado!</h2>
            <p style={{color:"#6B7280",fontSize:14,lineHeight:1.6,marginBottom:20}}>En breve nos comunicamos para coordinar la entrega.</p>
            <button onClick={()=>{setOrderDone(false);setCheckoutOpen(false);setCart([]);setForm({name:regForm.name,phone:regForm.phone,delivery:"pickup",address:""});setPayMethod("transfer");}}
              style={{width:"100%",padding:13,borderRadius:14,background:"rgba(0,180,216,.12)",border:"1.5px solid rgba(0,180,216,.3)",color:"#00B4D8",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:8}}>
              🛒 Seguir comprando
            </button>
            <a href="/" style={{display:"block",width:"100%",padding:10,borderRadius:14,background:"#F3F4F6",border:"1px solid #E5E7EB",color:"#444",fontSize:13,fontWeight:600,textDecoration:"none"}}>← Volver a tienda minorista</a>
          </div>
        </div>
      )}
    </div>
  );
}

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; max-width: 100vw; background:#F8FAFC; margin: 0; padding: 0; overflow-x: clip; }
button{font-family:inherit}
input,select{font-family:inherit}

.app-root{min-height:100vh;background:#F8FAFC;color:#111827;font-family:'Inter',system-ui,sans-serif;width:100%;max-width:100vw;overflow-x:clip;padding-bottom:80px}
@media(min-width:768px){.app-root{padding-bottom:0}}

/* MODALES */
.mo{position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.6);backdrop-filter:blur(8px)}
@media(min-width:640px){.mo{align-items:center;padding:20px}}
.mb{background:#ffffff;border-radius:24px 24px 0 0;padding:24px 20px;width:100%;max-width:460px;animation:fU .25s ease;max-height:92vh;overflow-y:auto}
@media(min-width:640px){.mb{border-radius:24px}}
@keyframes fU{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}
.dr{position:fixed;inset:0;z-index:99998;display:flex;justify-content:flex-end}
.dp{position:relative;z-index:99999;background:#ffffff;width:90%;max-width:400px;height:100vh;overflow-y:auto;padding:20px 16px;animation:sI .25s ease;border-left:1px solid #E5E7EB}
@keyframes sI{from{transform:translateX(100%)}to{transform:translateX(0)}}
.ov{position:absolute;inset:0;background:rgba(0,0,0,.4);backdrop-filter:blur(4px)}
.fi{width:100%;padding:12px 16px;background:#F9FAFB;border:1.5px solid #E5E7EB;border-radius:12px;color:#111827;font-size:14px;outline:none;font-family:inherit;transition:border-color .2s}
.fi:focus{border-color:#00B4D8}
.field-label{font-size:11px;color:#374151;display:block;margin-bottom:4px;font-weight:700}
.icon-close{background:none;border:none;font-size:22px;cursor:pointer;color:#6B7280}
.back-btn{background:none;border:none;color:#00B4D8;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;margin-bottom:12px;padding:0}
.acc-btn{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:14px;border:1.5px solid #E5E7EB;background:white;cursor:pointer;font-family:inherit;font-size:14px;font-weight:600;color:#374151;text-align:left}
.toggle-btn{flex:1;padding:10px 6px;border-radius:12px;border:1.5px solid #E5E7EB;background:#F9FAFB;color:#6B7280;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit}
.toggle-btn.active{border-color:#00B4D8;background:rgba(0,180,216,.08);color:#00B4D8}
.notice-box{background:linear-gradient(135deg,#e0f2fe 0%,#bfdbfe 100%);border:1px solid #93c5fd;border-radius:12px;padding:14px;margin-bottom:16px;display:flex;align-items:flex-start;gap:10px}

/* CONTENEDOR */
.pad{width:100%;max-width:100%;padding:0 16px}
@media(min-width:768px){.pad{padding:0 32px}}
@media(min-width:1200px){.pad{padding:0 48px}}

/* HEADER MOBILE */
.mobile-header{position:fixed;top:0;left:0;right:0;z-index:9999;background:#ffffff;border-bottom:1px solid #E5E7EB;box-shadow:0 1px 8px rgba(0,0,0,0.04);width:100%}
@media(min-width:768px){.mobile-header{display:none !important}}
.main-content{padding-top:60px;width:100%;max-width:100%;overflow-x:clip}
@media(min-width:768px){.main-content{padding-top:0 !important}}

/* BOTTOM NAV */
.bnav{position:fixed;bottom:0;left:0;right:0;z-index:9000;background:#ffffff;border-top:1px solid #E5E7EB;display:flex;justify-content:space-around;align-items:center;padding:8px 0 calc(8px + env(safe-area-inset-bottom,0px));box-shadow:0 -4px 20px rgba(0,0,0,0.06)}
@media(min-width:768px){.bnav{display:none}}
.bni{display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;padding:4px 20px;border:none;background:transparent;font-family:inherit;min-width:60px}
.bni-icon{font-size:20px;transition:transform .15s}
.bni.active .bni-icon{transform:scale(1.15)}
.bni-label{font-size:10px;font-weight:600;color:#9CA3AF;transition:color .15s}
.bni.active .bni-label{color:#00B4D8}

/* GRILLA DE PRODUCTOS */
.pg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;width:100%;max-width:100%;align-items:stretch}
@media(min-width:640px){.pg{grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}}
@media(min-width:1024px){.pg{grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}}
@media(min-width:1440px){.pg{grid-template-columns:repeat(5,minmax(0,1fr));gap:18px}}
.hscroll{display:flex;gap:12px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none;width:100%;max-width:100%}
.hscroll::-webkit-scrollbar{display:none}

/* TARJETA DE PRODUCTO */
.pcard{background:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.05);border:1px solid #F3F4F6;display:flex;flex-direction:column;cursor:pointer;transition:box-shadow .2s,transform .2s;position:relative;height:100%;width:100%}
.pcard:hover{box-shadow:0 6px 20px rgba(0,180,216,0.1);transform:translateY(-2px)}
.pcard.in-cart{border-color:rgba(0,180,216,.4)}
.fav-btn{position:absolute;top:6px;right:6px;z-index:10;background:white;border:none;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,.1);font-size:12px}
.pimg{position:relative;padding-bottom:75%;overflow:hidden;background:#F8F8F8}
.pimg img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;padding:8px}
.img-nav{position:absolute;top:50%;transform:translateY(-50%);width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,.5);border:none;color:#fff;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2}
.img-nav-left{left:4px}
.img-nav-right{right:4px}
.pbadges{position:absolute;top:6px;left:6px;display:flex;flex-direction:column;gap:3px;align-items:flex-start;z-index:5}
.badge{color:#fff;font-size:8px;font-weight:700;padding:2px 6px;border-radius:4px}
.badge-offer{background:#EF4444}
.badge-new{background:#00B4D8}
.pqty-pill{position:absolute;bottom:6px;right:6px;z-index:5;background:#00B4D8;color:#fff;border-radius:4px;padding:2px 6px;font-size:9px;font-weight:700}
.pbody{padding:10px;flex:1;display:flex;flex-direction:column}
.pcat{font-size:9px;color:#9CA3AF;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
.pname{font-size:12px;font-weight:600;color:#111827;line-height:1.25;flex:1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:6px}
.pprice{font-size:16px;font-weight:800;color:#00B4D8}
.pretail{font-size:10px;color:#9CA3AF;text-decoration:line-through;margin-bottom:2px}
.pstock{font-size:10px;font-weight:600;margin-bottom:8px}
.stock-none{color:#EF4444}
.stock-low{color:#F59E0B}
.stock-ok{color:#10B981}
.pactions{display:flex;flex-direction:column;gap:6px;margin-top:auto}
.qty-controls{display:flex;align-items:center;gap:6px}
.qty-btn{width:26px;height:26px;border-radius:50%;border:1.5px solid rgba(0,180,216,.3);background:rgba(0,180,216,.08);color:#00B4D8;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.qty-btn:disabled{opacity:.5;cursor:not-allowed}
.qty-btn-danger{border-color:rgba(239,68,68,.3);background:rgba(239,68,68,.08);color:#EF4444;font-size:13px}
.qty-btn-solid{border:none;background:#00B4D8;color:#fff}
.qty-input{width:100%;min-width:0;text-align:center;border:1.5px solid rgba(0,180,216,.3);border-radius:6px;font-size:12px;padding:4px 0;color:#111827;outline:none;background:rgba(0,180,216,.04)}
.share-row{display:flex;gap:3px}
.share-btn{flex:1;padding:5px 0;border-radius:6px;background:#F3F4F6;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s}
.share-btn:hover{background:#E5E7EB}

.btn-outline-sm{padding:7px 14px;border-radius:8px;background:rgba(0,180,216,.1);border:1px solid rgba(0,180,216,.3);color:#00B4D8;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;font-family:inherit}
.btn-whatsapp-sm{flex:1;padding:8px;border-radius:8px;background:#25D366;border:none;color:#fff;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit}
.btn-loadmore{padding:8px 22px;border-radius:100px;background:rgba(0,180,216,.08);border:1.5px solid rgba(0,180,216,.25);color:#00B4D8;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
.btn-loadless{padding:8px 22px;border-radius:100px;background:#F3F4F6;border:1.5px solid #E5E7EB;color:#6B7280;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}

/* HERO (solo desktop) */
.hero{display:none;background:linear-gradient(135deg,#0D1117 0%,#0D2137 50%,#0D3355 100%);padding:50px 24px;position:relative;overflow:hidden;width:100%}
@media(min-width:768px){.hero{display:block}}

/* GRILLA PRINCIPAL DESKTOP CON SIDEBAR STICKY */
.body-with-sidebar{display:block;position:relative;width:100%;max-width:100%;overflow-x:clip}
@media(min-width:768px){
  .body-with-sidebar{display:grid;grid-template-columns:240px 1fr;width:100%;max-width:100%;margin:0;padding:0;align-items:start;min-height:100vh}
}
.sidebar{display:none}
@media(min-width:768px){
  .sidebar{display:flex;flex-direction:column;position:sticky;top:0;height:100vh;max-height:100vh;overflow-y:auto;scrollbar-width:none;padding:20px 14px;z-index:10;background:#F8FAFC;border-right:1px solid #E5E7EB}
  .sidebar::-webkit-scrollbar{display:none}
}
.side-label{font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
.side-item{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:10px;cursor:pointer;border:none;background:transparent;font-family:inherit;width:100%;text-align:left;font-size:12px;color:#6B7280;font-weight:500;border-left:3px solid transparent;transition:all .15s}
.side-item.active{background:rgba(0,180,216,.08);color:#00B4D8;font-weight:700;border-left-color:#00B4D8}
.side-count{font-size:10px;background:#F3F4F6;color:#6B7280;padding:2px 6px;border-radius:20px;flex-shrink:0}
.m-item{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;cursor:pointer;border:none;background:transparent;font-family:inherit;width:100%;text-align:left;font-size:14px;color:#374151;font-weight:500}
.m-item.active{background:rgba(0,180,216,.08);color:#00B4D8;font-weight:700}
.m-count{font-size:12px;background:#F3F4F6;color:#6B7280;padding:2px 8px;border-radius:20px;flex-shrink:0}

/* FOOTER */
.foot-label{font-size:10px;font-weight:700;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px}
.foot-link{display:block;font-size:12px;color:rgba(255,255,255,.55);margin-bottom:8px;text-decoration:none}

/* FABs */
.fab-wa{position:fixed;right:20px;z-index:9000;width:44px;height:44px;border-radius:50%;background:#25D366;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(37,211,102,.4);text-decoration:none;transition:bottom .3s}
.fab-cart{position:fixed;right:20px;z-index:9001;background:#00B4D8;color:#fff;border:none;border-radius:100px;padding:12px 20px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 20px rgba(0,180,216,.4);display:flex;align-items:center;gap:8px;font-family:inherit;transition:bottom .3s}
.fab-up{position:fixed;right:20px;z-index:8999;width:44px;height:44px;border-radius:50%;background:rgba(0,180,216,.15);border:1.5px solid rgba(0,180,216,.4);color:#00B4D8;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:bottom .3s}
@media(max-width:767px){
  .fab-wa{bottom:84px}
  .fab-cart{bottom:144px}
  .fab-up.has-cart{bottom:204px}
  .fab-up.no-cart{bottom:144px}
}
@media(min-width:768px){
  .fab-wa{bottom:24px}
  .fab-cart{bottom:84px}
  .fab-up.has-cart{bottom:144px}
  .fab-up.no-cart{bottom:84px}
}

/* REGISTRO */
.auth-screen{min-height:100vh;background:#F8FAFC;font-family:'Inter',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;padding:20px}
.auth-card-wrap{width:100%;max-width:420px}
.auth-header{text-align:center;margin-bottom:32px}
.auth-logo{display:inline-block;font-size:clamp(19px,4vw,22px);font-weight:800;color:#111827;text-decoration:none;margin-bottom:8px}
.auth-pill{display:inline-block;padding:4px 14px;background:rgba(0,180,216,.1);border:1px solid rgba(0,180,216,.3);border-radius:20px;font-size:12px;font-weight:600;color:#00B4D8;margin-bottom:8px}
.auth-copy{color:#6B7280;font-size:14px;line-height:1.5}
.auth-min{color:#EF4444;font-size:12px;font-weight:700;margin-top:6px}
.auth-card{background:#ffffff;border:1px solid #E5E7EB;border-radius:18px;padding:clamp(20px,5vw,28px)}
.auth-fields{display:flex;flex-direction:column;gap:14px}
.auth-error{color:#EF4444;font-size:12px;margin-top:10px}
.auth-back{display:block;text-align:center;margin-top:12px;font-size:12px;color:#6B7280;text-decoration:none}
.btn-primary-cyan{width:100%;margin-top:20px;padding:14px;background:#00B4D8;border:none;border-radius:12px;color:#fff;font-size:14px;font-weight:700;cursor:pointer}
.btn-primary-cyan:disabled{opacity:.6}
`;