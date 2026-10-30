"use client";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";

// ─── COMPONENTE LOADING SCREEN ───
const Letters = ({ text, start }: { text: string; start: number }) => (
  <>
    {text.split("").map((c, i) => (
      <span key={i} className="ls-letter" style={{ animationDelay: `${(start + i) * 55}ms` }}>
        {c}
      </span>
    ))}
  </>
);

function LoadingScreen({ isFading }: { isFading: boolean }) {
  return (
    <div className={`ls-wrap ${isFading ? "ls-fade-out" : ""}`} role="status" aria-label=" ">
      <style>{`
        .ls-wrap{position:fixed;inset:0;z-index:99999;background:#F8FAFC;display:flex;align-items:center;justify-content:center;font-family:'Inter',system-ui,sans-serif;opacity:1;transition:opacity 0.4s ease}
        .ls-fade-out{opacity:0;pointer-events:none}
        .ls-inner{display:flex;flex-direction:column;align-items:center;gap:18px;padding:0 20px;text-align:center}
        .ls-title{font-size:clamp(26px,7vw,42px);font-weight:800;letter-spacing:-.5px;line-height:1.15;color:#111827}
        .ls-cyan{color:#00B4D8}
        .ls-line{display:block}
        @media(min-width:640px){.ls-line{display:inline}}
        .ls-letter{display:inline-block;opacity:0;transform:translateY(14px);animation:ls-in .5s ease forwards}
        .ls-space{display:inline-block;width:.3em}
        .ls-bar{width:140px;height:3px;border-radius:3px;background:#E5E7EB;overflow:hidden;opacity:0;animation:ls-fade .4s ease 1s forwards}
        .ls-bar span{display:block;height:100%;width:45%;border-radius:3px;background:linear-gradient(90deg,#0096C7,#00B4D8);animation:ls-move 1.1s ease-in-out infinite}
        @keyframes ls-in{to{opacity:1;transform:translateY(0)}}
        @keyframes ls-fade{to{opacity:1}}
        @keyframes ls-move{0%{transform:translateX(-110%)}100%{transform:translateX(250%)}}
        @media(prefers-reduced-motion:reduce){
          .ls-letter{animation:none;opacity:1;transform:none}
          .ls-bar{animation:none;opacity:1}
          .ls-bar span{animation:none;width:100%}
        }
      `}</style>
      <div className="ls-inner">
        <p className="ls-title">
          <span className="ls-line ls-cyan"><Letters text="Concepción" start={0} /></span>
          <span className="ls-space" />
          <span className="ls-line"><Letters text="Tecnología" start={10} /></span>
        </p>
        <div className="ls-bar"><span /></div>
      </div>
    </div>
  );
}

const WA    = process.env.NEXT_PUBLIC_WHATSAPP!;
const WA_FLOAT = "543865443450"; // número del botón de WhatsApp
const WA_PATH = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z";
const ALIAS = process.env.NEXT_PUBLIC_STORE_ALIAS!;
const MAPS  = process.env.NEXT_PUBLIC_MAPS_URL!;
const fmt = (n: number) => new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(n);
const GENERIC = "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&q=80";

type Sub  = { id:number; name:string; slug:string };
type Cat  = { id:number; name:string; icon:string|null; slug:string; subcategories:Sub[] };
type Prod = { id:number; name:string; description:string; category_name:string; category_icon:string|null;
              subcategory_name:string; price_retail:number; price_wholesale:number;
              is_offer:boolean; is_new:boolean; available:boolean; image_url:string|null;
              stock_quantity:number; };
type Item = Prod & { qty:number };

export default function StoreFront({ initialProducts, categories }: { initialProducts:Prod[]; categories:Cat[] }) {
  // ─── ESTADO DE CARGA Y TRANSICIÓN SUAVE ───
  const [isLoading, setIsLoading] = useState(true);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // Comienza a desvanecerse a los 1200ms
    const fadeTimer = setTimeout(() => setIsFading(true), 1200);
    // Remueve el componente del DOM una vez terminada la animación de desvanecimiento (1200ms + 400ms)
    const removeTimer = setTimeout(() => setIsLoading(false), 1600);
    
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  const [products]  = useState<Prod[]>(initialProducts);
  const [search, setSearch]        = useState("");
  const [activeCat, setActiveCat] = useState<string|null>(null);
  const [activeSub, setActiveSub] = useState<number|null>(null);
  const [sort, setSort]            = useState<"default"|"asc"|"desc">("default");
  const [activeTab, setActiveTab] = useState<"home"|"cats"|"account">("home");
  const [catsOpen, setCatsOpen]   = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  // Hace que la barra inferior llegue hasta el borde real de la pantalla (Chrome/Safari en iPhone)
  useEffect(()=>{
    const m = document.querySelector('meta[name="viewport"]');
    if (m && !(m.getAttribute("content")||"").includes("viewport-fit")) {
      m.setAttribute("content", (m.getAttribute("content")||"width=device-width, initial-scale=1") + ", viewport-fit=cover");
    }
  },[]);

  // CARRITO
  const [cart, setCart] = useState<Item[]>(()=>{
    if (typeof window === "undefined") return [];
    try { const s = localStorage.getItem("cart_minorista"); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  useEffect(()=>{ localStorage.setItem("cart_minorista", JSON.stringify(cart)); },[cart]);
  const [cartOpen, setCartOpen]   = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderDone, setOrderDone] = useState(false);
  const [sending, setSending]     = useState(false);
  const [countdown, setCountdown] = useState<number|null>(null);
  const [payMethod, setPayMethod] = useState<"transfer"|"cash">("transfer");
  const [form, setForm] = useState({ name:"", phone:"", delivery:"pickup", address:"" });

  // FAVORITOS
  const [favIds, setFavIds] = useState<number[]>(()=>{
    if (typeof window === "undefined") return [];
    try { const s = localStorage.getItem("fav_minorista"); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  useEffect(()=>{ localStorage.setItem("fav_minorista", JSON.stringify(favIds)); },[favIds]);
  const toggleFav = (id:number) => setFavIds(prev=>prev.includes(id)?prev.filter(i=>i!==id):[...prev,id]);
  const favProds = products.filter(p=>favIds.includes(p.id));

  // CUENTA
  const [userReg, setUserReg] = useState(()=>{
    if (typeof window === "undefined") return { name:"", phone:"" };
    try { return JSON.parse(localStorage.getItem("user_minorista")||"{}") || { name:"", phone:"" }; } catch { return { name:"", phone:"" }; }
  });
  const [regForm, setRegForm] = useState({ name: userReg.name||"", phone: userReg.phone||"" });
  const [historial, setHistorial] = useState<any[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [accountTab, setAccountTab] = useState<"main"|"favs"|"orders"|"register">("main");

  const loadHistorial = async (phone:string) => {
    if (!phone) return;
    setHistLoading(true);
    try {
      const res = await fetch(`/api/historial?phone=${encodeURIComponent(phone)}`);
      if (res.ok) { const d = await res.json(); setHistorial(Array.isArray(d)?d:[]); }
    } catch(e) {}
    setHistLoading(false);
  };

  const saveUser = () => {
    if (!regForm.name||!regForm.phone) return;
    localStorage.setItem("user_minorista", JSON.stringify({ name:regForm.name, phone:regForm.phone }));
    setUserReg({ name:regForm.name, phone:regForm.phone });
    setForm(f=>({...f, name:regForm.name, phone:regForm.phone }));
    loadHistorial(regForm.phone);
    setAccountTab("main");
  };

  const filtered = useMemo(() => {
    let p = products.filter(x => x.available);
    if (activeCat) p = p.filter(x => { const cat = categories.find(c=>c.slug===activeCat); return cat?.name===x.category_name; });
    if (activeSub) p = p.filter(x => { const cat = categories.find(c=>c.slug===activeCat); const sub = cat?.subcategories?.find(s=>s.id===activeSub); return sub?.name===x.subcategory_name; });
    if (search.trim()) p = p.filter(x => x.name.toUpperCase().includes(search.toUpperCase()) || x.description?.toUpperCase().includes(search.toUpperCase()));
    if (sort==="asc")  p = [...p].sort((a,b)=>Number(a.price_retail)-Number(b.price_retail));
    if (sort==="desc") p = [...p].sort((a,b)=>Number(b.price_retail)-Number(a.price_retail));
    return p;
  }, [products, activeCat, activeSub, search, sort, categories]);

  const offers   = useMemo(()=>products.filter(p=>p.is_offer&&p.available),[products]);
  const random   = useMemo(()=>[...products.filter(p => p.available)].sort(()=>0.5-Math.random()).slice(0,8),[initialProducts]);

  const grouped = useMemo(()=>{
    if (activeCat) return {"":filtered};
    const map:Record<string,Prod[]>={};
    filtered.forEach(p=>{if(!map[p.category_name])map[p.category_name]=[];map[p.category_name].push(p);});
    return map;
  },[filtered,activeCat]);

  const addToCart = useCallback((p:Prod, e?:React.MouseEvent)=>{
    if (e) e.stopPropagation();
    setCart(prev=>{const ex=prev.find(i=>i.id===p.id);return ex?prev.map(i=>i.id===p.id?{...i,qty:i.qty+1}:i):[...prev,{...p,qty:1}];});
    setCartOpen(true);
  },[]);

  const updateQty = (id:number,d:number) => setCart(prev=>prev.map(i=>i.id===id?{...i,qty:Math.max(0,i.qty+d)}:i).filter(i=>i.qty>0));
  const cartCount = cart.reduce((s,i)=>s+i.qty,0);
  const cartTotal = cart.reduce((s,i)=>s+i.qty*Number(i.price_retail),0);

  const shareProduct = (p:Prod, via:string) => {
    const url = `${window.location.origin}/producto/${p.id}`;
    const text = `🛒 ${p.name} — ${fmt(Number(p.price_retail))} | Concepción Tecnología`;
    if (via==="wa") window.open(`https://wa.me/?text=${encodeURIComponent(text+"\n"+url)}`,"_blank");
    if (via==="fb") window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,"_blank");
    if (via==="ig") navigator.clipboard.writeText(text+"\n"+url).then(()=>alert("✅ Link copiado. Pegalo en Instagram.")).catch(()=>alert("Copiá este link:\n"+url));
  };

  const handleOrder = async () => {
    if (!form.name||!form.phone||sending) return;
    setSending(true);
    try {
      await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({customer_name:form.name,phone:form.phone,sale_type:"retail",
          delivery_type:form.delivery,address:form.address||null,
          items:cart.map(i=>({id:i.id,name:i.name,qty:i.qty,price:Number(i.price_retail)})),total:cartTotal})});
    } catch(e){}
    const lines = cart.map(i=>`• ${i.qty}x ${i.name} — ${fmt(i.qty*Number(i.price_retail))}`).join("\n");
    const pagoMsg = payMethod==="transfer" ? `💳 Alias: Consultar\n\n⚠️ *Adjuntá el comprobante de transferencia para confirmar tu pedido.*` : `💵 *Paga en efectivo al momento de la entrega.*`;
    const msg = encodeURIComponent(`🛒 *Concepción Tecnología*\n\n👤 ${form.name}\n📞 ${form.phone}\n📦 ${form.delivery==="pickup"?"Retira en local":`Envío a: ${form.address}`}\n💳 Pago: ${payMethod==="transfer"?"Transferencia":"Efectivo"}\n\n*Productos:*\n${lines}\n\n*Total: ${fmt(cartTotal)}*\n\n${pagoMsg}`);
    window.open(`https://wa.me/${WA}?text=${msg}`,"_blank");
    setSending(false);
    setCountdown(10);
    const interval = setInterval(()=>{
      setCountdown(prev=>{ if (prev===null||prev<=1) { clearInterval(interval); setOrderDone(true); setCountdown(null); return null; } return prev-1; });
    },1000);
  };

  // ─── CARRUSEL ───
  const Carrusel = ({ images }: { images: { src:string; alt:string }[] }) => {
    const [current, setCurrent] = useState(0);
    const [isMobile, setIsMobile] = useState(false);
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const isDragging = useRef(false);
    useEffect(()=>{ const check=()=>setIsMobile(window.innerWidth<768); check(); window.addEventListener("resize",check); return()=>window.removeEventListener("resize",check); },[]);
    useEffect(()=>{ if(!products.length)return; const hash=window.location.hash; if(!hash.startsWith("#producto-"))return; const id=hash.replace("#producto-",""); setTimeout(()=>{ const el=document.getElementById(`producto-${id}`); if(el)el.scrollIntoView({behavior:"smooth",block:"center"}); },500); },[products]);
    useEffect(()=>{ const interval=setInterval(()=>{ if(!document.hidden)setCurrent(prev=>(prev+1)%images.length); },3000); return()=>clearInterval(interval); },[images.length]);
    const handleTouchStart=(e:React.TouchEvent)=>{ touchStartX.current=e.touches[0].clientX; touchStartY.current=e.touches[0].clientY; isDragging.current=false; };
    const handleTouchMove=(e:React.TouchEvent)=>{ const dx=Math.abs(e.touches[0].clientX-touchStartX.current); const dy=Math.abs(e.touches[0].clientY-touchStartY.current); if(dx>dy){isDragging.current=true;e.stopPropagation();} };
    const handleTouchEnd=(e:React.TouchEvent)=>{ if(!isDragging.current)return; const diff=touchStartX.current-e.changedTouches[0].clientX; if(diff>40)setCurrent(i=>i===images.length-1?0:i+1); else if(diff<-40)setCurrent(i=>i===0?images.length-1:i-1); isDragging.current=false; };
    if (!isMobile) return (
      <div style={{display:"grid",gridTemplateColumns:`repeat(${images.length},1fr)`,gap:12,marginBottom:8,width:"100%",maxWidth:"100%"}}>
        {images.map((img,i)=>(<div key={i} style={{borderRadius:16,overflow:"hidden",background:"#F3F4F6"}}><img src={img.src} alt={img.alt} style={{width:"100%",height:"auto",display:"block",objectFit:"contain"}}/></div>))}
      </div>
    );
    return (
      <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
        style={{position:"relative",borderRadius:20,background:"#F3F4F6",width:"100%",maxWidth:"100%",marginBottom:8,overflow:"hidden"}}>
        <div style={{display:"flex",width:`${images.length*100}%`,transform:`translateX(-${current*(100/images.length)}%)`,transition:"transform .35s ease"}}>
          {images.map((img,i)=>(<div key={i} style={{width:`${100/images.length}%`,flexShrink:0}}><img src={img.src} alt={img.alt} style={{width:"100%",height:"auto",display:"block",objectFit:"contain"}} draggable={false}/></div>))}
        </div>
        <button onClick={()=>setCurrent(i=>i===0?images.length-1:i-1)} style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",zIndex:2,width:32,height:32,borderRadius:"50%",background:"rgba(0,0,0,.6)",border:"none",color:"#fff",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
        <button onClick={()=>setCurrent(i=>i===images.length-1?0:i+1)} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",zIndex:2,width:32,height:32,borderRadius:"50%",background:"rgba(0,0,0,.6)",border:"none",color:"#fff",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
        <div style={{position:"absolute",bottom:10,left:"50%",transform:"translateX(-50%)",display:"flex",gap:6,zIndex:2}}>
          {images.map((_,i)=>(<button key={i} onClick={()=>setCurrent(i)} style={{width:i===current?20:6,height:6,borderRadius:10,background:i===current?"#00B4D8":"rgba(255,255,255,.5)",border:"none",cursor:"pointer",transition:"all .3s",padding:0}}/>))}
        </div>
      </div>
    );
  };

  // ─── PRODUCT CARD ───
  const ProductCard = ({p}:{p:Prod}) => {
    const inCart = cart.find(i=>i.id===p.id);
    const esFav  = favIds.includes(p.id);
    const stockColor = Number(p.stock_quantity)===0?"#EF4444":Number(p.stock_quantity)<=3?"#EF4444":Number(p.stock_quantity)<=10?"#F59E0B":"#10B981";
    
    return (
      <div id={`producto-${p.id}`}
        onClick={()=>window.location.href=`/producto/${p.id}`}
        style={{background:"#FFFFFF",borderRadius:14,overflow:"hidden",boxShadow:"0 2px 6px rgba(0,0,0,0.05)",border:`1px solid ${inCart?"rgba(0,180,216,.4)":"#F3F4F6"}`,display:"flex",flexDirection:"column",cursor:"pointer",transition:"box-shadow .2s,transform .2s",position:"relative",height:"100%",width:"100%",boxSizing:"border-box"}}
        onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 6px 20px rgba(0,180,216,0.1);";e.currentTarget.style.transform="translateY(-2px)";}}
        onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 2px 6px rgba(0,0,0,0.05)";e.currentTarget.style.transform="translateY(0)";}}>
        
        {/* FAV BTN */}
        <button onClick={e=>{e.stopPropagation();toggleFav(p.id);}}
          style={{position:"absolute",top:6,right:6,zIndex:10,background:"white",border:"none",borderRadius:"50%",width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",boxShadow:"0 2px 4px rgba(0,0,0,.1)",fontSize:12}}>
          {esFav?"❤️":"🤍"}
        </button>
        
        {/* IMG */}
        <div style={{position:"relative",paddingBottom:"75%",overflow:"hidden",background:"#F8F8F8"}}>
          <img src={p.image_url||GENERIC} alt={p.name} loading="lazy"
            style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",objectFit:"contain",padding:8}}/>
          <div style={{position:"absolute",top:6,left:6,display:"flex",flexDirection:"column",gap:3,alignItems:"flex-start"}}>
            {p.is_offer&&<span style={{background:"#EF4444",color:"#fff",fontSize:8,fontWeight:700,padding:"2px 6px",borderRadius:4}}>OFERTA</span>}
            {p.is_new&&<span style={{background:"#00B4D8",color:"#fff",fontSize:8,fontWeight:700,padding:"2px 6px",borderRadius:4}}>NUEVO</span>}
          </div>
          {inCart&&<div style={{position:"absolute",bottom:6,right:6,background:"#00B4D8",color:"#fff",borderRadius:4,padding:"2px 6px",fontSize:9,fontWeight:700}}>×{inCart.qty}</div>}
        </div>
        
        {/* BODY */}
        <div style={{padding:"10px",flex:1,display:"flex",flexDirection:"column"}}>
          <p style={{fontSize:9,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:3}}>{p.category_name}</p>
          <p style={{fontSize:12,fontWeight:600,color:"#111827",lineHeight:1.25,flex:1,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden",marginBottom:6}} title={p.name}>{p.name}</p>
          <p style={{fontSize:16,fontWeight:800,color:"#00B4D8",marginBottom:2}}>{fmt(Number(p.price_retail))}</p>
          <p style={{fontSize:10,fontWeight:600,color:stockColor,marginBottom:10}}>
            {Number(p.stock_quantity)===0?"Sin stock":Number(p.stock_quantity)<=10?`¡Últimas ${p.stock_quantity} u.!`:`${p.stock_quantity} disponibles`}
          </p>
          
          {/* BOTONES CON ICONOS REALES DE REDES SOCIALES */}
          <div style={{display:"flex",flexDirection:"column",gap:5,marginTop:"auto"}} onClick={e=>e.stopPropagation()}>
            <button onClick={e=>{ if(Number(p.stock_quantity)>0) addToCart(p,e); }}
              disabled={Number(p.stock_quantity)===0}
              style={{width:"100%",padding:"7px",borderRadius:6,border:"none",background:Number(p.stock_quantity)===0?"#E5E7EB":"#00B4D8",color:"white",fontSize:12,fontWeight:700,cursor:Number(p.stock_quantity)===0?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5,transition:"background .15s"}}>
              {Number(p.stock_quantity)===0 ? "Agotado" : "🛒 Agregar"}
            </button>
            <div style={{display:"flex",gap:3}}>
              {/* WhatsApp */}
              <button onClick={()=>shareProduct(p, "wa")} title="Compartir en WhatsApp"
                style={{flex:1,padding:"5px 0",borderRadius:6,background:"#F3F4F6",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"background .15s"}}
                onMouseEnter={e=>e.currentTarget.style.background="#E5E7EB"}
                onMouseLeave={e=>e.currentTarget.style.background="#F3F4F6"}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </button>
              {/* Facebook */}
              <button onClick={()=>shareProduct(p, "fb")} title="Compartir en Facebook"
                style={{flex:1,padding:"5px 0",borderRadius:6,background:"#F3F4F6",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"background .15s"}}
                onMouseEnter={e=>e.currentTarget.style.background="#E5E7EB"}
                onMouseLeave={e=>e.currentTarget.style.background="#F3F4F6"}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </button>
              {/* Instagram */}
              <button onClick={()=>shareProduct(p, "ig")} title="Compartir en Instagram"
                style={{flex:1,padding:"5px 0",borderRadius:6,background:"#F3F4F6",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"background .15s"}}
                onMouseEnter={e=>e.currentTarget.style.background="#E5E7EB"}
                onMouseLeave={e=>e.currentTarget.style.background="#F3F4F6"}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="#E1306C"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── CATEGORY SECTION ───
  const CategorySection = ({ catName, prods, categories }: { catName:string; prods:Prod[]; categories:Cat[] }) => {
    const [visibleCount, setVisibleCount] = useState(8);
    const visible = prods.slice(0, visibleCount);
    const hasMore = visibleCount < prods.length;
    const hasLess = visibleCount > 8;
    const catObj = categories.find(c=>c.name===catName);
    return (
      <section style={{marginBottom:32, width:"100%", maxWidth:"100%", boxSizing:"border-box"}}>
        {catName&&(
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14, width:"100%"}}>
            <h2 style={{fontSize:16,fontWeight:800,color:"#111827",display:"flex",alignItems:"center",gap:8}}>
              {catObj?.icon ? (
                catObj.icon.startsWith("http") || catObj.icon.startsWith("/") ? (
                  <img src={catObj.icon} alt="" style={{width:20,height:20,objectFit:"contain"}}/>
                ) : (
                  <span dangerouslySetInnerHTML={{__html: catObj.icon}} />
                )
              ) : null}
              {catName}
            </h2>
            <div style={{flex:1,height:1,background:"linear-gradient(to right,#E5E7EB,transparent)"}}/>
          </div>
        )}
        {prods.length===0
          ? <p style={{color:"#9CA3AF",fontSize:13}}>Sin productos.</p>
          : <>
              <div className="pg">{visible.map(p=><ProductCard key={p.id} p={p}/>)}</div>
              <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:18}}>
                {hasMore&&<button onClick={()=>setVisibleCount(v=>Math.min(v+8,prods.length))} style={{padding:"8px 22px",borderRadius:100,background:"rgba(0,180,216,.08)",border:"1.5px solid rgba(0,180,216,.25)",color:"#00B4D8",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Ver más ({prods.length-visibleCount})</button>}
                {hasLess&&<button onClick={()=>setVisibleCount(8)} style={{padding:"8px 22px",borderRadius:100,background:"#F3F4F6",border:"1.5px solid #E5E7EB",color:"#6B7280",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Ver menos</button>}
              </div>
            </>
        }
      </section>
    );
  };

  // ─── INSTALL BUTTON ───
  const InstallButton = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isIOS, setIsIOS] = useState(false);
    const [showIOSHelp, setShowIOSHelp] = useState(false);
    const [installed, setInstalled] = useState(false);
    useEffect(()=>{ const ios=/iphone|ipad|ipod/i.test(navigator.userAgent); setIsIOS(ios); if(window.matchMedia("(display-mode: standalone)").matches){setInstalled(true);return;} const handler=(e:any)=>{e.preventDefault();setDeferredPrompt(e);}; window.addEventListener("beforeinstallprompt",handler); return()=>window.removeEventListener("beforeinstallprompt",handler); },[]);
    if (installed) return null;
    const handleClick = async()=>{ if(isIOS){setShowIOSHelp(true);return;} if(deferredPrompt){deferredPrompt.prompt(); const choice=await deferredPrompt.userChoice; if(choice.outcome==="accepted")setInstalled(true); setDeferredPrompt(null);}else{setShowIOSHelp(true);} };
    return (
      <>
        <button onClick={handleClick} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"14px 16px",background:"rgba(0,180,216,.06)",border:"1.5px solid rgba(0,180,216,.3)",borderRadius:14,color:"#00B4D8",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",width:"100%"}}>📲 Instalar aplicación</button>
        {showIOSHelp&&(<div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"flex-end",justifyContent:"center",padding:20}} onClick={()=>setShowIOSHelp(false)}><div style={{background:"#ffffff",borderRadius:20,padding:24,width:"100%",maxWidth:400}} onClick={e=>e.stopPropagation()}><p style={{fontWeight:700,fontSize:16,marginBottom:12,color:"#111827"}}>Instalá la app</p><p style={{fontSize:13,color:"#6B7280",lineHeight:1.6,marginBottom:6}}>{isIOS?"1. Tocá el botón compartir ⬆️ en Safari":"1. Tocá los 3 puntos ⋮ en Chrome"}</p><p style={{fontSize:13,color:"#6B7280",lineHeight:1.6,marginBottom:16}}>{isIOS?'2. Seleccioná "Agregar a pantalla de inicio"':'2. Seleccioná "Agregar a pantalla de inicio"'}</p><button onClick={()=>setShowIOSHelp(false)} style={{width:"100%",padding:12,borderRadius:12,background:"#00B4D8",border:"none",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Entendido</button></div></div>)}
      </>
    );
  };

  return (
    <div style={{minHeight:"100vh",background:"#F8FAFC",color:"#111827",fontFamily:"'Inter',system-ui,sans-serif",width:"100%",maxWidth:"100vw",overflowX:"clip",paddingBottom:"calc(80px + env(safe-area-inset-bottom,0px))",boxSizing:"border-box"}}>
      {/* ── PANTALLA DE CARGA INICIAL ── */}
      {isLoading && <LoadingScreen isFading={isFading} />}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { width: 100%; max-width: 100vw; background:#F8FAFC; margin: 0; padding: 0; overflow-x: clip; }

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
        
        /* CONTENEDOR PRINCIPAL */
        .pad{width:100%; max-width:100%; padding:0 16px; box-sizing:border-box;}
        @media(min-width:768px){.pad{padding:0 32px;}}
        @media(min-width:1200px){.pad{padding:0 48px;}}

        /* HEADER MOBILE */
        .mobile-header { position: fixed; top: 0; left: 0; right: 0; z-index: 9999; padding-top: env(safe-area-inset-top,0px); background: #ffffff; border-bottom: 1px solid #E5E7EB; box-shadow: 0 1px 8px rgba(0,0,0,0.04); width:100%; box-sizing:border-box; }
        @media(min-width:768px){ .mobile-header { display: none !important; } }
        
        .main-content { padding-top: calc(60px + env(safe-area-inset-top,0px)); width:100%; max-width:100%; box-sizing:border-box; overflow-x:clip; }
        @media(min-width:768px){ .main-content { padding-top: 0 !important; } }

        /* BOTTOM NAV */
        .bnav::after{content:"";position:absolute;left:0;right:0;top:100%;height:240px;background:#ffffff}
        .bnav{position:fixed;bottom:0;left:0;right:0;z-index:9000;background:#ffffff;border-top:1px solid #E5E7EB;display:flex;justify-content:space-around;align-items:center;padding:8px 0 calc(8px + env(safe-area-inset-bottom,0px));box-shadow:0 -4px 20px rgba(0,0,0,0.06)}
        @media(min-width:768px){.bnav{display:none}}
        .bni{display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;padding:4px 2px;border:none;background:transparent;font-family:inherit;flex:1;min-width:0;text-decoration:none}
        .bni-icon{position:relative;display:flex;align-items:center;justify-content:center;height:24px}
        .bni-badge{position:absolute;top:-4px;right:-10px;min-width:16px;height:16px;padding:0 4px;border-radius:20px;background:#00B4D8;color:#fff;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;line-height:1}
        .bni-icon{font-size:20px;transition:transform .15s}
        .bni.active .bni-icon{transform:scale(1.15)}
        .bni-label{font-size:10px;font-weight:600;color:#9CA3AF;transition:color .15s}
        .bni.active .bni-label{color:#00B4D8}

        /* GRID DE PRODUCTOS */
        .pg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;width:100%;max-width:100%;box-sizing:border-box;align-items:stretch;}
        @media(min-width:640px){.pg{grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}}
        @media(min-width:1024px){.pg{grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}}
        @media(min-width:1440px){.pg{grid-template-columns:repeat(5,minmax(0,1fr));gap:18px}}

        /* HERO DESKTOP */
        .hero{display:none;background:linear-gradient(135deg,#0D1117 0%,#0D2137 50%,#0D3355 100%);padding:50px 24px;position:relative;overflow:hidden;width:100%;box-sizing:border-box;}
        @media(min-width:768px){.hero{display:block;}}

        /* GRILLA PRINCIPAL DESKTOP (ALTURA COMPLETA PARA QUE EL STICKY CUBRA TODA LA VISTA) */
        .body-with-sidebar{display:block; position:relative; width:100%; max-width:100%; box-sizing:border-box; overflow-x:clip;}
        @media(min-width:768px){
          .body-with-sidebar{
             display: grid;
             grid-template-columns: 240px 1fr;
             width: 100%;
             max-width: 100%;
             margin: 0;
             padding: 0;
             align-items: start;
             min-height: 100vh;
          }
        }
        
        .sidebar{display:none}
        @media(min-width:768px){
          .sidebar{
            display:flex;
            flex-direction:column;
            position:sticky;
            top:0;
            height:100vh;
            max-height:100vh;
            overflow-y:auto;
            scrollbar-width:none;
            padding:20px 14px;
            z-index:10;
            background:#F8FAFC;
            border-right:1px solid #E5E7EB;
            box-sizing:border-box;
          }
          .sidebar::-webkit-scrollbar { display: none; }
        }

        .fab-wa { position: fixed; right: 20px; z-index: 9000; width: 44px; height: 44px; border-radius: 50%; background: #25D366; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 16px rgba(37,211,102,.4); text-decoration: none; transition: bottom .3s; }
        .fab-cart { position: fixed; right: 20px; z-index: 9001; background: #00B4D8; color: #fff; border: none; border-radius: 100px; padding: 12px 20px; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 20px rgba(0,180,216,.4); display: flex; align-items: center; gap: 8px; font-family: inherit; transition: bottom .3s; }
        .fab-up { position: fixed; right: 20px; z-index: 8999; width: 44px; height: 44px; border-radius: 50%; background: rgba(0,180,216,.15); border: 1.5px solid rgba(0,180,216,.4); color: #00B4D8; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: bottom .3s; }

        @media(max-width: 767px) {
  .fab-wa, .fab-cart { display: none !important; }
  .fab-up.has-cart, .fab-up.no-cart {
    bottom: calc(76px + env(safe-area-inset-bottom, 0px));
    right: 12px;
    width: 40px;
    height: 40px;
    background: rgba(255,255,255,.95);
  }
}
        @media(min-width: 768px) {
          .fab-wa { bottom: 24px; }
          .fab-cart { bottom: 84px; }
          .fab-up.has-cart { bottom: 144px; }
          .fab-up.no-cart { bottom: 84px; }
        }
      `}</style>

      {/* ── HEADER MOBILE ── */}
      <header className="mobile-header">
        <div className="pad" style={{marginLeft:0,maxWidth:"100%"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",height:60,gap:12, width:"100%"}}>
            <a href="/" style={{display:"flex",alignItems:"center",textDecoration:"none",flexShrink:0}}>
              <img src="/images/logo1.png" alt="Concepción Tecnología" style={{height:38,width:"auto",objectFit:"contain"}}/>
            </a>
            <a href="/mayorista" style={{padding:"6px 12px",borderRadius:10,background:"#00B4D8",color:"#fff",fontSize:11,fontWeight:700,textDecoration:"none",whiteSpace:"nowrap",display:"flex",flexDirection:"column",alignItems:"center",lineHeight:1.2,flexShrink:0}}>
              <span>Precios Mayoristas</span>
              <small style={{fontSize:8,opacity:.9,fontWeight:500}}>Ver catálogo</small>
            </a>
          </div>
        </div>
      </header>

      <main className="main-content">

        {/* ── LAYOUT CON SIDEBAR Y CONTENIDO EN GRILLA ── */}
        <div className="body-with-sidebar">

          {/* SIDEBAR DESKTOP FIJO (IZQUIERDA) CON ALTURA 100vh REAL */}
          <aside className="sidebar">
            <div style={{marginBottom:14, width:"100%"}}>
              <p style={{fontSize:10,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>Categorías</p>
              <button onClick={()=>setActiveCat(null)} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:10,cursor:"pointer",border:"none",background:!activeCat?"rgba(0,180,216,.08)":"transparent",fontFamily:"inherit",width:"100%",textAlign:"left",fontSize:12,color:!activeCat?"#00B4D8":"#6B7280",fontWeight:!activeCat?700:500,borderLeft:!activeCat?"3px solid #00B4D8":"3px solid transparent"}}>
                🏠 <span style={{flex:1}}>Todos</span>
                <span style={{fontSize:10,background:"#F3F4F6",color:"#6B7280",padding:"2px 6px",borderRadius:20}}>{products.filter(p=>p.available).length}</span>
              </button>
              {categories.map(c=>{ 
                const count = products.filter(p=>p.available&&p.category_name===c.name).length; 
                return (
                  <button key={c.id} onClick={()=>setActiveCat(activeCat===c.slug?null:c.slug)} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:10,cursor:"pointer",border:"none",background:activeCat===c.slug?"rgba(0,180,216,.08)":"transparent",fontFamily:"inherit",width:"100%",textAlign:"left",fontSize:12,color:activeCat===c.slug?"#00B4D8":"#6B7280",fontWeight:activeCat===c.slug?700:500,borderLeft:activeCat===c.slug?"3px solid #00B4D8":"3px solid transparent",transition:"all .15s"}}>
                    <span style={{fontSize:16,flexShrink:0,display:"flex",alignItems:"center",width:18,justifyContent:"center"}}>
                      {c.icon ? (
                        c.icon.startsWith("http") || c.icon.startsWith("/") ? (
                          <img src={c.icon} alt="" style={{width:16,height:16,objectFit:"contain"}}/>
                        ) : (
                          <span dangerouslySetInnerHTML={{__html: c.icon}} />
                        )
                      ) : "📁"}
                    </span>
                    <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</span>
                    <span style={{fontSize:10,background:"#F3F4F6",color:"#6B7280",padding:"2px 6px",borderRadius:20,flexShrink:0}}>{count}</span>
                  </button>
                );
              })}
            </div>
            <div style={{background:"linear-gradient(135deg,#0096C7,#00B4D8)",borderRadius:14,padding:12,color:"white",marginTop:"auto",width:"100%",flexShrink:0}}>
              <p style={{fontSize:13,fontWeight:800,marginBottom:4}}>Precios Mayoristas</p>
              <p style={{fontSize:10,opacity:.8,marginBottom:8,lineHeight:1.3}}>Registrate gratis y accedé a precios especiales.</p>
              <a href="/mayorista" style={{display:"block",width:"100%",padding:"6px",borderRadius:8,background:"rgba(255,255,255,.2)",border:"1px solid rgba(255,255,255,.3)",color:"white",fontSize:11,fontWeight:700,textDecoration:"none",textAlign:"center"}}>Registrarme</a>
            </div>
          </aside>

          {/* COLUMNA DERECHA (CONTENEDOR DE PRODUCTOS + SEARCH + HERO + FOOTER) */}
          <div style={{width:"100%", minWidth:0, display:"flex", flexDirection:"column"}}>

            {/* HERO DESKTOP */}
            <div className="hero">
              <div style={{maxWidth:1100,margin:"0 auto",display:"grid",gridTemplateColumns:"1fr 1fr",gap:30,alignItems:"center",position:"relative",zIndex:1,width:"100%",boxSizing:"border-box"}}>
                <div>
                  <div style={{display:"inline-block",padding:"4px 12px",background:"rgba(0,180,216,.15)",border:"1px solid rgba(0,180,216,.3)",borderRadius:20,color:"#00B4D8",fontSize:11,fontWeight:700,marginBottom:12}}>Concepción, Tucumán</div>
                  <h1 style={{fontSize:40,fontWeight:900,color:"white",lineHeight:1.1,marginBottom:12,letterSpacing:"-1px"}}>Tu tienda de<br/><span style={{color:"#00B4D8"}}>tecnología</span><br/>de confianza</h1>
                  <p style={{fontSize:14,color:"rgba(255,255,255,.6)",lineHeight:1.5,marginBottom:24}}>Repuestos, accesorios, celulares y más.<br/>Ventas por mayor y menor.</p>
                  <div style={{display:"flex",gap:10}}>
                    <button onClick={()=>window.scrollTo({top:400,behavior:"smooth"})} style={{padding:"10px 20px",borderRadius:12,background:"#00B4D8",color:"white",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Ver productos</button>
                    <a href="/mayorista" style={{padding:"10px 20px",borderRadius:12,background:"rgba(255,255,255,.1)",color:"white",border:"1px solid rgba(255,255,255,.2)",fontSize:13,fontWeight:600,textDecoration:"none",display:"flex",alignItems:"center"}}>Precios mayoristas</a>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {random.slice(0,4).map(p=>(
                    <div key={p.id} onClick={()=>window.location.href=`/producto/${p.id}`}
                      style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:14,padding:14,backdropFilter:"blur(8px)",cursor:"pointer",transition:"background .2s"}}
                      onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.1)"}
                      onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.06)"}>
                      <img src={p.image_url||GENERIC} alt={p.name} style={{width:44,height:44,objectFit:"contain",marginBottom:6,borderRadius:6}}/>
                      <p style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,.8)",lineHeight:1.2,marginBottom:3}}>{p.name}</p>
                      <p style={{fontSize:14,fontWeight:800,color:"#00B4D8"}}>{fmt(Number(p.price_retail))}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* SEARCH BAR CONTAINER */}
            <div style={{background:"#fff",padding:"12px 16px 10px",borderBottom:"1px solid #E5E7EB", width:"100%", maxWidth:"100%", boxSizing:"border-box"}}>
              <div className="pad" style={{padding:0, boxSizing:"border-box"}}>
                <div style={{display:"flex",gap:8, width:"100%", maxWidth:"100%", boxSizing:"border-box"}}>
                  <div style={{position:"relative",flex:1,minWidth:0}}>
                    <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:15,color:"#9CA3AF",pointerEvents:"none"}}>🔍</span>
                    <input className="fi" style={{paddingLeft:40,background:"#F3F4F6",border:"none",borderRadius:12, width:"100%", boxSizing:"border-box"}} placeholder="Buscar productos..." value={search} onChange={e=>setSearch(e.target.value)}/>
                  </div>
                  <select value={sort} onChange={e=>setSort(e.target.value as any)} style={{padding:"10px 10px",background:"#F3F4F6",border:"none",borderRadius:12,fontSize:12,fontFamily:"inherit",color:"#374151",outline:"none",cursor:"pointer",fontWeight:500, flexShrink:0}}>
                    <option value="default">Ordenar</option>
                    <option value="desc">Mayor precio</option>
                    <option value="asc">Menor precio</option>
                  </select>
                </div>
              </div>
            </div>

            {/* SECCIÓN DE CONTENIDO Y PRODUCTOS */}
            <div className="pad" style={{paddingTop:18,paddingBottom:24, flex:1}}>

              {/* BANNER PROMO */}
              {!activeCat&&!search&&(
                <div style={{background:"linear-gradient(135deg,#0096C7,#00B4D8)",borderRadius:20,padding:"20px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,overflow:"hidden",position:"relative"}}>
                  <div style={{position:"absolute",right:-30,top:-30,width:120,height:120,borderRadius:"50%",background:"rgba(255,255,255,.08)"}}/>
                  <div>
                    <p style={{fontSize:11,color:"rgba(255,255,255,.8)",fontWeight:500,marginBottom:4}}>Concepción Tecnología</p>
                    <p style={{fontSize:20,fontWeight:800,color:"#fff",lineHeight:1.2,marginBottom:12}}>Ventas por<br/>mayor y menor</p>
                    <a href={MAPS} target="_blank" style={{display:"inline-block",padding:"7px 16px",background:"rgba(255,255,255,.2)",borderRadius:10,color:"#fff",fontSize:12,fontWeight:700,textDecoration:"none"}}>Ver local →</a>
                  </div>
                  <div style={{fontSize:56,flexShrink:0,position:"relative",zIndex:1}}>📱</div>
                </div>
              )}

              {/* OFERTAS */}
              {!activeCat&&!search&&(
                <section style={{marginBottom:24, width:"100%", overflow:"hidden"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                    <h2 style={{fontSize:16,fontWeight:800,color:"#111827"}}>Ofertas y Novedades</h2>
                    <div style={{flex:1,height:1,background:"linear-gradient(to right,#E5E7EB,transparent)"}}/>
                  </div>
                  <Carrusel images={[{src:"/images/12.jpeg",alt:"novedad 26"},{src:"/images/6.jpg",alt:"novedad 6"},{src:"/images/13.jpeg",alt:"novedad 27"},{src:"/images/11.jpeg",alt:"novedad 28"},{src:"/images/14.jpeg",alt:"novedad 29"},{src:"/images/novedad3.jpg",alt:"Oferta 3"},{src:"/images/novedad1.jpg",alt:"Novedad 1"},{src:"/images/1.jpg",alt:"Novedad 2"},{src:"/images/5.jpg",alt:"Novedad 5"}]}/>
                  {offers.length>0&&(
                    <div style={{display:"flex",gap:12,overflowX:"auto",paddingBottom:8,scrollbarWidth:"none",marginTop:14,width:"100%",maxWidth:"100%"}}>
                      {offers.map(p=><div key={p.id} style={{width:180,flexShrink:0}}><ProductCard p={p}/></div>)}
                    </div>
                  )}
                </section>
              )}

              {/* DESTACADOS */}
              {!activeCat&&!search&&random.length>0&&(
                <section style={{marginBottom:24, width:"100%", overflow:"hidden"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                    <h2 style={{fontSize:16,fontWeight:800,color:"#111827"}}>⚡ Destacados</h2>
                    <div style={{flex:1,height:1,background:"linear-gradient(to right,#E5E7EB,transparent)"}}/>
                  </div>
                  <div style={{display:"flex",gap:12,overflowX:"auto",paddingBottom:8,scrollbarWidth:"none",width:"100%",maxWidth:"100%"}}>
                    {random.map(p=><div key={p.id} style={{width:180,flexShrink:0}}><ProductCard p={p}/></div>)}
                  </div>
                </section>
              )}

              {/* PRODUCTOS POR CATEGORÍA */}
              {Object.entries(grouped).map(([catName,prods])=>(
                <CategorySection key={catName||"all"} catName={catName} prods={prods} categories={categories}/>
              ))}
            </div>

            {/* ── FOOTER ── */}
            <footer style={{background:"#0D1117",padding:"36px 0 24px", width:"100%"}}>
              <div className="pad">
                <p style={{fontSize:22,fontWeight:800,color:"#ffffff",marginBottom:4}}><span style={{color:"#00B4D8"}}>Concepción</span> Tecnología</p>
                <p style={{fontSize:12,color:"rgba(255,255,255,.4)",marginBottom:24}}>Tu tienda de tecnología en Concepción, Tucumán</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:24,marginBottom:28}}>
                  <div>
                    <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,.35)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:10}}>Local</p>
                    <p style={{fontSize:12,color:"rgba(255,255,255,.6)",marginBottom:5,lineHeight:1.5}}>Independencia 450<br/>Concepción, Tucumán</p>
                    <p style={{fontSize:12,color:"rgba(255,255,255,.6)",lineHeight:1.5}}>L-V 9-12 y 16-20hs<br/>Sáb 9-15hs</p>
                  </div>
                  <div>
                    <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,.35)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:10}}>Categorías</p>
                    {categories.slice(0,5).map(c=><a key={c.id} href="#" onClick={e=>{e.preventDefault();setActiveCat(c.slug);window.scrollTo({top:200,behavior:"smooth"});}} style={{display:"block",fontSize:12,color:"rgba(255,255,255,.55)",marginBottom:8,textDecoration:"none"}}>{c.name}</a>)}
                  </div>
                  <div>
                    <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,.35)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:10}}>Servicios</p>
                    {[["Precios Mayoristas","/mayorista"],["Bot de WhatsApp",`https://wa.me/${WA}`],["Envíos a domicilio","#"],["Facturación","#"]].map(([l,h])=>(
                      <a key={l} href={h} style={{display:"block",fontSize:12,color:"rgba(255,255,255,.55)",marginBottom:8,textDecoration:"none"}}>{l}</a>
                    ))}
                  </div>
                  <div>
                    <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,.35)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:10}}>Redes</p>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {[
                        [<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,"#1877F2","https://www.facebook.com/share/1GtkZrvC6L/?mibextid=wwXIfr"],
                        [<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>,"linear-gradient(135deg,#f09433,#dc2743,#bc1888)","https://www.instagram.com/concepciontecnologia?igsh=azFiYWFrOWhpcGV1"],
                        [<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>],["tt",<svg key="tt" width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.78a4.85 4.85 0 01-1.01-.09z"/></svg>,"#111","https://www.tiktok.com/@concepciontecnologia?_r=1&_t=ZS-96fPI9A4yBQ"],
                      ].map(([icon,bg,href])=>(
                        <a key={href as string} href={href as string} target="_blank"
                          style={{width:36,height:36,borderRadius:10,background:bg as string,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",transition:"transform .15s"}}
                          onMouseEnter={e=>e.currentTarget.style.transform="scale(1.1)"}
                          onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
                          {icon}
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
        {[
          ["home","🏠","Inicio",()=>{ setActiveCat(null); setSearch(""); window.scrollTo({top:0,behavior:"smooth"}); setActiveTab("home"); }],
          ["cats","📦","Categorías",()=>{ setActiveTab("cats"); setCatsOpen(true); }],
          ["cart","🛒","Carrito",()=>{ setCartOpen(true); }],
          ["account","👤","Cuenta",()=>{ setActiveTab("account"); setAccountOpen(true); if(userReg.phone) loadHistorial(userReg.phone); }],
        ].map(([tab,icon,label,fn])=>(
          <button key={tab as string} className={`bni${activeTab===tab?" active":""}`} onClick={fn as any}>
            <span className="bni-icon">{icon as string}{tab==="cart"&&cartCount>0&&<span className="bni-badge">{cartCount}</span>}</span>
            <span className="bni-label">{label as string}</span>
          </button>
        ))}
        <a href={`https://wa.me/${WA_FLOAT}?text=${encodeURIComponent("Hola! Quiero hacer una consulta.")}`} target="_blank" rel="noopener noreferrer" className="bni">
          <span className="bni-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="#25D366"><path d={WA_PATH}/></svg></span>
          <span className="bni-label">WhatsApp</span>
        </a>
      </nav>

      {/* ── PANEL CATEGORÍAS (mobile) ── */}
      {catsOpen&&(
        <div className="mo" onClick={()=>setCatsOpen(false)}>
          <div className="mb" onClick={e=>e.stopPropagation()} style={{maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexShrink:0}}>
              <h3 style={{fontSize:18,fontWeight:800,color:"#111827"}}>Categorías</h3>
              <button onClick={()=>setCatsOpen(false)} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#6B7280"}}>✕</button>
            </div>
            <div style={{overflowY:"auto",flex:1,paddingRight:4,display:"flex",flexDirection:"column",gap:4}}>
              <button onClick={()=>{setActiveCat(null);setActiveSub(null);setCatsOpen(false);setActiveTab("home");}} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,cursor:"pointer",border:"none",background:!activeCat?"rgba(0,180,216,.08)":"transparent",fontFamily:"inherit",width:"100%",textAlign:"left",fontSize:14,color:!activeCat?"#00B4D8":"#374151",fontWeight:!activeCat?700:500}}>
                🏠 <span style={{flex:1}}>Todos los productos</span>
                <span style={{fontSize:12,background:"#F3F4F6",color:"#6B7280",padding:"2px 8px",borderRadius:20}}>{products.filter(p=>p.available).length}</span>
              </button>
              {categories.map(c=>{ 
                const count=products.filter(p=>p.available&&p.category_name===c.name).length; 
                return (
                  <button key={c.id} onClick={()=>{setActiveCat(c.slug);setActiveSub(null);setCatsOpen(false);setActiveTab("home");}} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,cursor:"pointer",border:"none",background:activeCat===c.slug?"rgba(0,180,216,.08)":"transparent",fontFamily:"inherit",width:"100%",textAlign:"left",fontSize:14,color:activeCat===c.slug?"#00B4D8":"#374151",fontWeight:activeCat===c.slug?700:500}}>
                    <span style={{fontSize:20,display:"flex",alignItems:"center",width:24,justifyContent:"center",flexShrink:0}}>
                      {c.icon ? (
                        c.icon.startsWith("http") || c.icon.startsWith("/") ? (
                          <img src={c.icon} alt="" style={{width:20,height:20,objectFit:"contain"}}/>
                        ) : (
                          <span dangerouslySetInnerHTML={{__html: c.icon}} />
                        )
                      ) : "📁"}
                    </span>
                    <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</span>
                    <span style={{fontSize:12,background:"#F3F4F6",color:"#6B7280",padding:"2px 8px",borderRadius:20,flexShrink:0}}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── PANEL CUENTA (mobile) ── */}
      {accountOpen&&(
        <div className="mo" onClick={()=>{setAccountOpen(false);setAccountTab("main");}}>
          <div className="mb" onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <h3 style={{fontSize:18,fontWeight:800,color:"#111827"}}>
                {accountTab==="main"?"Mi cuenta":accountTab==="favs"?"Mis favoritos":accountTab==="orders"?"Mis pedidos":"Mis datos"}
              </h3>
              <button onClick={()=>{setAccountOpen(false);setAccountTab("main");}} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#6B7280"}}>✕</button>
            </div>

            {accountTab==="main"&&(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {userReg.name&&(
                  <div style={{padding:"12px 16px",background:"rgba(0,180,216,.06)",borderRadius:12,border:"1px solid rgba(0,180,216,.15)",marginBottom:4}}>
                    <p style={{fontSize:13,fontWeight:600,color:"#111827"}}>👤 {userReg.name}</p>
                    <p style={{fontSize:12,color:"#6B7280"}}>📞 {userReg.phone}</p>
                  </div>
                )}
                
                <InstallButton/>

                <button onClick={()=>setAccountTab("favs")} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:14,border:"1.5px solid #E5E7EB",background:"white",cursor:"pointer",fontFamily:"inherit",fontSize:14,fontWeight:600,color:"#374151",textAlign:"left"}}>
                  <span style={{fontSize:22}}>❤️</span>
                  <span style={{flex:1}}>Mis favoritos</span>
                  <span style={{background:"rgba(239,68,68,.1)",color:"#EF4444",padding:"2px 8px",borderRadius:20,fontSize:12,fontWeight:700}}>{favIds.length}</span>
                  <span style={{color:"#9CA3AF"}}>›</span>
                </button>
                <button onClick={()=>{ if(!userReg.phone){setAccountTab("register");} else {setAccountTab("orders");} }} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:14,border:"1.5px solid #E5E7EB",background:"white",cursor:"pointer",fontFamily:"inherit",fontSize:14,fontWeight:600,color:"#374151",textAlign:"left"}}>
                  <span style={{fontSize:22}}>📋</span>
                  <span style={{flex:1}}>Mis pedidos</span>
                  <span style={{color:"#9CA3AF"}}>›</span>
                </button>
                <button onClick={()=>setAccountTab("register")} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:14,border:"1.5px solid #E5E7EB",background:"white",cursor:"pointer",fontFamily:"inherit",fontSize:14,fontWeight:600,color:"#374151",textAlign:"left"}}>
                  <span style={{fontSize:22}}>✏️</span>
                  <span style={{flex:1}}>{userReg.name?"Editar mis datos":"Guardar mis datos"}</span>
                  <span style={{color:"#9CA3AF"}}>›</span>
                </button>
                <a href="/mayorista" style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:14,border:"1.5px solid rgba(0,180,216,.3)",background:"rgba(0,180,216,.06)",textDecoration:"none",fontSize:14,fontWeight:600,color:"#00B4D8"}}>
                  <span style={{fontSize:22}}>📦</span>
                  <span style={{flex:1}}>Acceder a precios mayoristas</span>
                  <span>›</span>
                </a>
              </div>
            )}

            {accountTab==="favs"&&(
              <div>
                <button onClick={()=>setAccountTab("main")} style={{background:"none",border:"none",color:"#00B4D8",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:12,padding:0}}>← Volver</button>
                {favProds.length===0
                  ? <div style={{textAlign:"center",padding:"32px 0"}}>
                      <p style={{fontSize:32,marginBottom:12}}>🤍</p>
                      <p style={{fontSize:14,color:"#6B7280",fontWeight:500}}>No tenés favoritos aún</p>
                      <p style={{fontSize:12,color:"#9CA3AF",marginTop:4}}>Tocá el ❤️ en cualquier producto</p>
                    </div>
                  : <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:"60vh",overflowY:"auto"}}>
                      {favProds.map(p=>{
                        const inCart=cart.find(i=>i.id===p.id);
                        return (
                          <div key={p.id} style={{display:"flex",gap:10,alignItems:"center",padding:10,background:"#F9FAFB",borderRadius:12,border:"1px solid #E5E7EB"}}>
                            <img src={p.image_url||GENERIC} style={{width:48,height:48,objectFit:"cover",borderRadius:10,flexShrink:0}} loading="lazy" alt={p.name}/>
                            <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>window.location.href=`/producto/${p.id}`}>
                              <p style={{fontSize:12,fontWeight:600,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</p>
                              <p style={{fontSize:13,color:"#00B4D8",fontWeight:700}}>{fmt(Number(p.price_retail))}</p>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <button onClick={()=>updateQty(p.id,-1)} style={{width:26,height:26,borderRadius:"50%",border:"1.5px solid rgba(0,180,216,.3)",background:"rgba(0,180,216,.08)",color:"#00B4D8",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                              <span style={{fontSize:13,fontWeight:700,minWidth:16,textAlign:"center"}}>{inCart?.qty||0}</span>
                              <button onClick={()=>addToCart(p)} style={{width:26,height:26,borderRadius:"50%",border:"none",background:"#00B4D8",color:"#fff",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
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
                <button onClick={()=>setAccountTab("main")} style={{background:"none",border:"none",color:"#00B4D8",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:12,padding:0}}>← Volver</button>
                {histLoading
                  ? <p style={{textAlign:"center",color:"#6B7280",padding:"20px 0"}}>Cargando pedidos...</p>
                  : historial.length===0
                    ? <div style={{textAlign:"center",padding:"32px 0"}}>
                        <p style={{fontSize:32,marginBottom:12}}>📋</p>
                        <p style={{fontSize:14,color:"#6B7280",fontWeight:500}}>No tenés pedidos registrados</p>
                      </div>
                    : <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:"60vh",overflowY:"auto"}}>
                        {historial.map((o:any)=>(
                          <div key={o.id} style={{padding:12,background:"#F9FAFB",borderRadius:12,border:"1px solid #E5E7EB"}}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                              <p style={{fontSize:13,fontWeight:600,color:"#111827"}}>Pedido #{String(o.id).padStart(4,"0")}</p>
                              <p style={{fontSize:14,fontWeight:700,color:"#00B4D8"}}>{fmt(Number(o.total))}</p>
                            </div>
                            <p style={{fontSize:11,color:"#6B7280"}}>{new Date(o.created_at).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"})}</p>
                            <p style={{fontSize:11,fontWeight:600,marginTop:4,color:o.status==="completed"?"#10b981":o.status==="cancelled"?"#EF4444":"#F59E0B"}}>{o.status==="completed"?"Completado":o.status==="cancelled"?"Cancelado":"Pendiente"}</p>
                          </div>
                        ))}
                      </div>
                }
              </div>
            )}

            {accountTab==="register"&&(
              <div>
                <button onClick={()=>setAccountTab("main")} style={{background:"none",border:"none",color:"#00B4D8",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:12,padding:0}}>← Volver</button>
                <p style={{fontSize:13,color:"#6B7280",marginBottom:16,lineHeight:1.5}}>Guardá tus datos para ver el historial de pedidos y no tener que completarlos cada vez.</p>
                <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:16}}>
                  <div>
                    <label style={{fontSize:11,color:"#374151",display:"block",marginBottom:4,fontWeight:700}}>NOMBRE</label>
                    <input className="fi" placeholder="Tu nombre completo" value={regForm.name} onChange={e=>setRegForm(f=>({...f,name:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,color:"#374151",display:"block",marginBottom:4,fontWeight:700}}>TELÉFONO</label>
                    <input className="fi" placeholder="3865 xxxxxx" value={regForm.phone} onChange={e=>setRegForm(f=>({...f,phone:e.target.value}))}/>
                  </div>
                </div>
                <button onClick={saveUser} disabled={!regForm.name||!regForm.phone}
                  style={{width:"100%",padding:13,borderRadius:12,background:"#00B4D8",border:"none",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:(!regForm.name||!regForm.phone) ? 0.5 : 1}}>
                  Guardar datos
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FAB WSP ── */}
      <a href={`https://wa.me/${WA_FLOAT}?text=${encodeURIComponent("Hola! Quiero hacer una consulta.")}`} target="_blank" rel="noopener noreferrer" className="fab-wa">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      </a>

      {/* ── FAB SUBIR ── */}
      <button onClick={()=>window.scrollTo({top:0,behavior:"smooth"})} className={`fab-up ${cartCount>0?'has-cart':'no-cart'}`}>
        ↑
      </button>

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
              <h2 style={{fontSize:18,fontWeight:800,color:"#111827"}}>Tu carrito</h2>
              <button onClick={()=>setCartOpen(false)} style={{background:"none",border:"none",color:"#6B7280",fontSize:22,cursor:"pointer"}}>✕</button>
            </div>
            {cart.map(item=>(
              <div key={item.id} style={{display:"flex",gap:10,alignItems:"center",padding:10,background:"#F9FAFB",borderRadius:14,border:"1px solid #E5E7EB",marginBottom:8}}>
                <img src={item.image_url||GENERIC} style={{width:44,height:44,objectFit:"cover",borderRadius:10,flexShrink:0}} loading="lazy" alt={item.name}/>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:12,fontWeight:600,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</p>
                  <p style={{fontSize:13,color:"#00B4D8",fontWeight:700}}>{fmt(Number(item.price_retail)*item.qty)}</p>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <button onClick={()=>updateQty(item.id,-1)} style={{width:28,height:28,borderRadius:"50%",border:"1.5px solid rgba(0,180,216,.3)",background:"rgba(0,180,216,.08)",color:"#00B4D8",fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                  <span style={{fontSize:13,fontWeight:700,minWidth:16,textAlign:"center",color:"#111827"}}>{item.qty}</span>
                  <button onClick={()=>updateQty(item.id,1)} style={{width:28,height:28,borderRadius:"50%",border:"1.5px solid rgba(0,180,216,.3)",background:"rgba(0,180,216,.08)",color:"#00B4D8",fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                  <button onClick={()=>setCart(prev=>prev.filter(i=>i.id!==item.id))} style={{width:28,height:28,borderRadius:"50%",border:"1.5px solid rgba(239,68,68,.3)",background:"rgba(239,68,68,.08)",color:"#EF4444",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>🗑️</button>
                </div>
              </div>
            ))}
            {cart.length===0&&<p style={{textAlign:"center",color:"#6B7280",fontSize:14,padding:"32px 0"}}>Tu carrito está vacío</p>}
            <div style={{padding:"12px 0",borderTop:"1px solid #E5E7EB",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:"#6B7280",fontSize:14}}>Total</span>
              <span style={{fontSize:22,fontWeight:800,color:"#00B4D8"}}>{fmt(cartTotal)}</span>
            </div>
            {cart.length>0&&<button onClick={()=>{setCartOpen(false);setCheckoutOpen(true);}} style={{width:"100%",padding:13,borderRadius:14,background:"#00B4D8",border:"none",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Finalizar pedido →</button>}
            <button onClick={()=>setCartOpen(false)} style={{marginTop:8,width:"100%",background:"none",border:"none",color:"#6B7280",fontSize:12,cursor:"pointer",padding:7,fontFamily:"inherit"}}>← Seguir comprando</button>
          </div>
        </div>
      )}

      {/* ── MODAL CHECKOUT ── */}
      {checkoutOpen&&!orderDone&&(
        <div className="mo">
          <div className="mb">
            <h2 style={{fontSize:18,fontWeight:800,marginBottom:4,color:"#111827"}}>Finalizar pedido</h2>
            <p style={{fontSize:12,color:"#6B7280",marginBottom:16}}>Precio minorista · Completá tus datos</p>
            <div style={{display:"flex",flexDirection:"column",gap:11,marginBottom:14}}>
              <div><label style={{fontSize:11,color:"#374151",display:"block",marginBottom:4,fontWeight:700}}>NOMBRE *</label><input className="fi" placeholder="Tu nombre completo" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
              <div><label style={{fontSize:11,color:"#374151",display:"block",marginBottom:4,fontWeight:700}}>TELÉFONO *</label><input className="fi" placeholder="3865 xxxxxx" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/></div>
              <div>
                <label style={{fontSize:11,color:"#374151",display:"block",marginBottom:4,fontWeight:700}}>ENTREGA</label>
                <div style={{display:"flex",gap:8}}>
                  {[["pickup","🏪 Retiro"],["delivery","🚗 Envío"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setForm(f=>({...f,delivery:v}))} style={{flex:1,padding:"10px 6px",borderRadius:12,border:`1.5px solid ${form.delivery===v?"#00B4D8":"#E5E7EB"}`,background:form.delivery===v?"rgba(0,180,216,.08)":"#F9FAFB",color:form.delivery===v?"#00B4D8":"#6B7280",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>{l}</button>
                  ))}
                </div>
              </div>
              {form.delivery==="delivery"&&(<div><label style={{fontSize:11,color:"#374151",display:"block",marginBottom:4,fontWeight:700}}>DIRECCIÓN *</label><input className="fi" placeholder="Calle, número, barrio" value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))}/></div>)}
              <div>
                <label style={{fontSize:11,color:"#374151",display:"block",marginBottom:6,fontWeight:700}}>MÉTODO DE PAGO</label>
                <div style={{display:"flex",gap:8}}>
                  {[["transfer","💳 Transferencia"],["cash","💵 Efectivo"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setPayMethod(v as any)} style={{flex:1,padding:"10px 6px",borderRadius:12,border:`1.5px solid ${payMethod===v?"#00B4D8":"#E5E7EB"}`,background:payMethod===v?"rgba(0,180,216,.08)":"#F9FAFB",color:payMethod===v?"#00B4D8":"#6B7280",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
            {payMethod==="cash"&&(<div style={{padding:"10px 13px",background:"rgba(16,185,129,.06)",borderRadius:12,border:"1px solid rgba(16,185,129,.2)",marginBottom:12}}><p style={{fontSize:12,color:"#10b981",fontWeight:600}}>💵 Pagás en efectivo al retirar o recibir el pedido</p></div>)}
            <p style={{fontSize:13,color:"#6B7280",textAlign:"center",marginBottom:12}}>Total: <strong style={{color:"#00B4D8"}}>{fmt(cartTotal)}</strong></p>
            {countdown!==null ? (
              <div style={{textAlign:"center",padding:"16px 0"}}>
                <div style={{fontSize:48,fontWeight:800,color:"#00B4D8",lineHeight:1}}>{countdown}</div>
                <p style={{fontSize:13,color:"#6B7280",marginTop:6}}>Abriendo WhatsApp en {countdown}{countdown!==1?" segundos...":" segundo..."}</p>
                <div style={{height:4,background:"#E5E7EB",borderRadius:2,marginTop:12,overflow:"hidden"}}><div style={{height:"100%",background:"#00B4D8",borderRadius:2,transition:"width 1s linear",width:`${(countdown/10)*100}%`}}/></div>
              </div>
            ) : (
              <>
                <button onClick={handleOrder} disabled={!form.name||!form.phone||sending} style={{width:"100%",padding:13,background:"#25D366",border:"none",borderRadius:14,color:"white",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:(!form.name||!form.phone||sending) ? 0.5 : 1,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  {sending?"Procesando...":"💬 Enviar pedido por WhatsApp"}
                </button>
                <button onClick={()=>{setCheckoutOpen(false);setCartOpen(true);}} style={{marginTop:8,width:"100%",background:"none",border:"none",color:"#6B7280",fontSize:12,cursor:"pointer",padding:7,fontFamily:"inherit"}}>← Volver</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── PEDIDO EXITOSO ── */}
      {orderDone&&(
        <div className="mo">
          <div className="mb" style={{textAlign:"center"}}>
            <div style={{fontSize:52,marginBottom:12}}>✅</div>
            <h2 style={{fontSize:20,fontWeight:800,marginBottom:10,color:"#111827"}}>¡Pedido realizado!</h2>
            <p style={{color:"#6B7280",fontSize:14,lineHeight:1.6,marginBottom:8}}>En breve nos comunicamos con vos para confirmar.</p>
            <p style={{color:"#F59E0B",fontSize:13,marginBottom:20,fontWeight:500}}>⚠️ No olvidés adjuntar el comprobante en WhatsApp</p>
            <button onClick={()=>{setOrderDone(false);setCheckoutOpen(false);setCart([]);setForm({name:userReg.name||"",phone:userReg.phone||"",delivery:"pickup",address:""});setPayMethod("transfer");}}
              style={{width:"100%",padding:13,borderRadius:14,background:"rgba(0,180,216,.12)",border:"1.5px solid rgba(0,180,216,.3)",color:"#00B4D8",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              Volver a la tienda
            </button>
          </div>
        </div>
      )}
    </div>
  );
}