"use client";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";

const WA    = process.env.NEXT_PUBLIC_WHATSAPP!;
const ALIAS = process.env.NEXT_PUBLIC_STORE_ALIAS!;
const MAPS  = process.env.NEXT_PUBLIC_MAPS_URL!;
const fmt = (n: number) => new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(n);

type Sub  = { id:number; name:string; slug:string };
type Cat  = { id:number; name:string; icon:string; slug:string; subcategories:Sub[] };
type Prod = { id:number; name:string; description:string; category_name:string; category_icon:string;
              subcategory_name:string; price_retail:number; price_wholesale:number;
              is_offer:boolean; is_new:boolean; available:boolean; image_url:string|null;
              stock_quantity:number; };
type Item = Prod & { qty:number };

export default function StoreFront({ initialProducts, categories }: { initialProducts:Prod[]; categories:Cat[] }) {
  const [products]  = useState<Prod[]>(initialProducts);
  const [search, setSearch]       = useState("");
  const [activeCat, setActiveCat] = useState<string|null>(null);
  const [activeSub, setActiveSub] = useState<number|null>(null);
  const [sort, setSort]           = useState<"default"|"asc"|"desc">("default");
  const [cart, setCart]           = useState<Item[]>([]);
  const [cartOpen, setCartOpen]   = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderDone, setOrderDone] = useState(false);
  const [sending, setSending]     = useState(false);
  const [countdown, setCountdown] = useState<number|null>(null);
  const [payMethod, setPayMethod] = useState<"transfer"|"cash">("transfer");
  const [form, setForm] = useState({ name:"", phone:"", delivery:"pickup", address:"" });

  const playClick = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.setValueAtTime(880, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.08);
      g.gain.setValueAtTime(0.3, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      o.start(ctx.currentTime);
      o.stop(ctx.currentTime + 0.12);
    } catch(e){}
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
  const newProds = useMemo(()=>products.filter(p=>p.is_new&&p.available),[products]);
  const random   = useMemo(()=>[...products].filter(p=>p.available).sort(()=>Math.random()-.5).slice(0,8),[products]);

  const grouped = useMemo(()=>{
    if (activeCat) return {"":filtered};
    const map:Record<string,Prod[]>={};
    filtered.forEach(p=>{if(!map[p.category_name])map[p.category_name]=[];map[p.category_name].push(p);});
    return map;
  },[filtered,activeCat]);

  const addToCart = useCallback((p:Prod)=>{
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
  if (via==="ig") navigator.clipboard.writeText(text+"\n"+url)
    .then(()=>alert("✅ Link copiado. Pegalo en Instagram."))
    .catch(()=>alert("Copiá este link:\n"+url));
};
  const handleOrder = async () => {
    if (!form.name||!form.phone||sending) return;
    setSending(true);
    try {
      await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({customer_name:form.name,phone:form.phone,sale_type:"retail",
          delivery_type:form.delivery,address:form.address||null,
          items:cart.map(i=>({id:i.id,name:i.name,qty:i.qty,price:Number(i.price_retail)})),total:cartTotal})});
    } catch(e){console.error(e);}
    const lines = cart.map(i=>`• ${i.qty}x ${i.name} — ${fmt(i.qty*Number(i.price_retail))}`).join("\n");
    const pagoMsg = payMethod==="transfer"
      ? `💳 Alias: *${ALIAS}*\n\n⚠️ *Adjuntá el comprobante de transferencia para confirmar tu pedido.*`
      : `💵 *Paga en efectivo al momento de la entrega.*`;
    const msg = encodeURIComponent(`🛒 *Concepción Tecnología*\n\n👤 ${form.name}\n📞 ${form.phone}\n📦 ${form.delivery==="pickup"?"Retira en local":`Envío a: ${form.address}`}\n💳 Pago: ${payMethod==="transfer"?"Transferencia":"Efectivo"}\n\n*Productos:*\n${lines}\n\n*Total: ${fmt(cartTotal)}*\n\n${pagoMsg}`);
    window.open(`https://wa.me/${WA}?text=${msg}`,"_blank");
    setSending(false);
    setCountdown(10);
    const interval = setInterval(()=>{
      setCountdown(prev=>{
        if (prev===null||prev<=1) { clearInterval(interval); setOrderDone(true); setCountdown(null); return null; }
        return prev-1;
      });
    },1000);
  };

  const GENERIC = "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&q=80";
  const activeCatData = categories.find(c=>c.slug===activeCat);

  const ProductCard = ({p}:{p:Prod}) => {
    const inCart = cart.find(i=>i.id===p.id);
    return (
      <div id={`producto-${p.id}`} style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:14,overflow:"hidden",display:"flex",flexDirection:"column",transition:"border-color .2s",height:"100%"}}
       onClick={()=>window.location.href=`/producto/${p.id}`}
      onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(0,180,216,.35)"}
        onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(255,255,255,.07)"}>
        <div style={{position:"relative",paddingBottom:"65%",overflow:"hidden",background:"#f8f8f8"}}>
          <img src={p.image_url||GENERIC} alt={p.name}
            style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",objectFit:"contain",background:"#f8f8f8"}} loading="lazy"/>
          <div style={{position:"absolute",top:6,left:6,display:"flex",gap:4}}>
            {p.is_offer&&<span style={{background:"#ef4444",color:"#fff",fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:20}}>OFERTA</span>}
            {p.is_new&&<span style={{background:"#00B4D8",color:"#080c10",fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:20}}>NUEVO</span>}
          </div>
          {inCart&&<div style={{position:"absolute",top:6,right:6,background:"#00B4D8",color:"#080c10",borderRadius:20,padding:"2px 7px",fontSize:11,fontWeight:700}}>×{inCart.qty}</div>}
        </div>
        <div style={{padding:"10px 12px 12px",flex:1,display:"flex",flexDirection:"column",gap:5}}>
          <p style={{fontSize:12,fontWeight:600,color:"#1a1a1a",lineHeight:1.3}}>{p.name}</p>
          {p.description&&<p style={{fontSize:10,color:"#666",lineHeight:1.4,flex:1,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{p.description}</p>}
          <p style={{fontSize:16,fontWeight:800,color:"#00B4D8"}}>{fmt(Number(p.price_retail))}</p>
            <p style={{fontSize:10,fontWeight:700,marginBottom:4,color:
  Number(p.stock_quantity)===0?"#ef4444":
  Number(p.stock_quantity)<=3?"#ef4444":
  Number(p.stock_quantity)<=10?"#f59e0b":"#10b981"}}>
  {Number(p.stock_quantity)===0?"🔴 Sin stock":
   Number(p.stock_quantity)<=3?`🔴 ${p.stock_quantity} u.`:
   Number(p.stock_quantity)<=10?`🟡 ${p.stock_quantity} u.`:
   `🟢 ${p.stock_quantity} u.`}
</p>

           {Number(p.stock_quantity)>0&&(
  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
    <button onClick={e=>{e.stopPropagation(); setCart(prev=>{const ex=prev.find(i=>i.id===p.id); return ex?prev.map(i=>i.id===p.id?{...i,qty:Math.max(1,i.qty-1)}:i):prev;});}}
      style={{width:26,height:26,borderRadius:"50%",border:"1px solid rgba(0,180,216,.3)",background:"rgba(0,180,216,.08)",color:"#00B4D8",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
    <input type="number" min="1" value={inCart?.qty||1}
      onChange={e=>{e.stopPropagation(); const qty=Math.max(1,Number(e.target.value)); setCart(prev=>{const ex=prev.find(i=>i.id===p.id); return ex?prev.map(i=>i.id===p.id?{...i,qty}:i):prev;});}}
      style={{width:40,textAlign:"center",border:"1px solid #e5e7eb",borderRadius:6,fontSize:12,padding:"3px 0",fontFamily:"inherit",color:"#1a1a1a",outline:"none"}}/>
    <button onClick={e=>{e.stopPropagation(); setCart(prev=>{const ex=prev.find(i=>i.id===p.id); return ex?prev.map(i=>i.id===p.id?{...i,qty:i.qty+1}:i):prev;});}}
      style={{width:26,height:26,borderRadius:"50%",border:"1px solid rgba(0,180,216,.3)",background:"rgba(0,180,216,.08)",color:"#00B4D8",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
  </div>
)}
<button onClick={e=>{e.stopPropagation(); Number(p.stock_quantity)>0?addToCart(p):null;}}
  disabled={Number(p.stock_quantity)===0}
  style={{width:"100%",padding:"8px",borderRadius:8,background:Number(p.stock_quantity)===0?"rgba(255,255,255,.05)":"rgba(0,180,216,.12)",border:`1px solid ${Number(p.stock_quantity)===0?"rgba(255,255,255,.1)":"rgba(0,180,216,.3)"}`,color:Number(p.stock_quantity)===0?"#666":"#00B4D8",fontSize:11,fontWeight:600,cursor:Number(p.stock_quantity)===0?"not-allowed":"pointer",fontFamily:"inherit",transition:"background .2s"}}
  onMouseEnter={e=>{if(Number(p.stock_quantity)>0)e.currentTarget.style.background="rgba(0,180,216,.25)"}}
  onMouseLeave={e=>{if(Number(p.stock_quantity)>0)e.currentTarget.style.background="rgba(0,180,216,.12)"}}>
  {Number(p.stock_quantity)===0?"Sin stock":inCart?`✓ (${inCart?.qty})`:"+ Agregar"}
</button>
          <div style={{display:"flex",gap:4,marginTop:2}}>
            {[
              ["wa", <svg key="wa" width="14" height="14" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>],
              ["fb", <svg key="fb" width="14" height="14" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>],
              ["ig", <svg key="ig" width="14" height="14" viewBox="0 0 24 24" fill="url(#ig)"><defs><linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f09433"/><stop offset="25%" stopColor="#e6683c"/><stop offset="50%" stopColor="#dc2743"/><stop offset="75%" stopColor="#cc2366"/><stop offset="100%" stopColor="#bc1888"/></linearGradient></defs><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>],
            ].map(([via, icon])=>(
              <button onClick={e=>{e.stopPropagation(); shareProduct(p, via as string);}}
                style={{flex:1,padding:"5px 0",borderRadius:6,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"opacity .15s"}}
                onMouseEnter={e=>e.currentTarget.style.opacity=".7"}
                onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                {icon}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const Carrusel = ({ images }: { images: { src:string; alt:string }[] }) => {
    const [current, setCurrent] = useState(0);
    const [isMobile, setIsMobile] = useState(false);
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const isDragging = useRef(false);

    useEffect(()=>{
      const check = () => setIsMobile(window.innerWidth < 768);
      check();
      window.addEventListener("resize", check);
      return () => window.removeEventListener("resize", check);
    },[]);

    useEffect(()=>{
  if (!products.length) return;
  const hash = window.location.hash;
  if (!hash.startsWith("#producto-")) return;
  const id = hash.replace("#producto-","");
  setTimeout(()=>{
    const el = document.getElementById(`producto-${id}`);
    if (el) el.scrollIntoView({behavior:"smooth", block:"center"});
  }, 500);
},[products]);

useEffect(()=>{
  const params = new URLSearchParams(window.location.search);
  const agregarId = params.get("agregarId");
  const qty = Number(params.get("qty")||1);
  if (!agregarId||!products.length) return;
  const prod = products.find(p=>p.id===Number(agregarId));
  if (!prod) return;
  setCart(prev=>{
    const ex = prev.find(i=>i.id===prod.id);
    if (ex) return prev.map(i=>i.id===prod.id?{...i,qty:i.qty+qty}:i);
    return [...prev,{...prod,qty}];
  });
  setCartOpen(true);
  window.history.replaceState({},"","/");
},[products]);

    const handleTouchStart = (e: React.TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      isDragging.current = false;
    };
    const handleTouchMove = (e: React.TouchEvent) => {
      const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
      const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
      if (dx > dy) { isDragging.current = true; e.stopPropagation(); }
    };
    const handleTouchEnd = (e: React.TouchEvent) => {
      if (!isDragging.current) return;
      const diff = touchStartX.current - e.changedTouches[0].clientX;
      if (diff > 40) setCurrent(i=>i===images.length-1?0:i+1);
      else if (diff < -40) setCurrent(i=>i===0?images.length-1:i-1);
      isDragging.current = false;
    };

    if (!isMobile) return (
      <div style={{display:"grid",gridTemplateColumns:`repeat(${images.length},1fr)`,gap:12,marginBottom:8}}>
        {images.map((img,i)=>(
          <div key={i} style={{borderRadius:12,overflow:"hidden",background:"#f3f4f6"}}>
            <img src={img.src} alt={img.alt} style={{width:"100%",height:"auto",display:"block",objectFit:"contain"}}/>
          </div>
        ))}
      </div>
    );

    return (
      <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
        style={{position:"relative",borderRadius:14,background:"#f3f4f6",width:"100%",marginBottom:8,overflow:"hidden"}}>
        <div style={{display:"flex",width:`${images.length*100}%`,transform:`translateX(-${current*(100/images.length)}%)`,transition:"transform .35s ease"}}>
          {images.map((img,i)=>(
            <div key={i} style={{width:`${100/images.length}%`,flexShrink:0}}>
              <img src={img.src} alt={img.alt} style={{width:"100%",height:"auto",display:"block",objectFit:"contain"}} draggable={false}/>
            </div>
          ))}
        </div>
        <button onClick={()=>setCurrent(i=>i===0?images.length-1:i-1)}
          style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",zIndex:2,width:36,height:36,borderRadius:"50%",background:"rgba(0,0,0,.7)",border:"1px solid rgba(255,255,255,.3)",color:"#fff",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
        <button onClick={()=>setCurrent(i=>i===images.length-1?0:i+1)}
          style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",zIndex:2,width:36,height:36,borderRadius:"50%",background:"rgba(0,0,0,.7)",border:"1px solid rgba(255,255,255,.3)",color:"#fff",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
        <div style={{position:"absolute",bottom:8,left:"50%",transform:"translateX(-50%)",display:"flex",gap:6,zIndex:2}}>
          {images.map((_,i)=>(
            <button key={i} onClick={()=>setCurrent(i)}
              style={{width:i===current?18:6,height:6,borderRadius:10,background:i===current?"#00B4D8":"rgba(255,255,255,.4)",border:"none",cursor:"pointer",transition:"all .3s",padding:0}}/>
          ))}
        </div>
      </div>
    );
  };

  const CategorySection = ({ catName, prods, categories }: { catName:string; prods:Prod[]; categories:Cat[] }) => {
    const [visibleCount, setVisibleCount] = useState(6);
    const visible = prods.slice(0, visibleCount);
    const hasMore = visibleCount < prods.length;
    const hasLess = visibleCount > 6;
    return (
      <section style={{marginBottom:32}}>
        {catName&&<h2 className="st">{categories.find(c=>c.name===catName)?.icon} {catName}</h2>}
        {prods.length===0
          ?<p style={{color:"#888",fontSize:13}}>Sin productos.</p>
          :<>
            <div className="pg">{visible.map(p=><ProductCard key={p.id} p={p}/>)}</div>
            <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:12}}>
              {hasMore&&<button onClick={()=>setVisibleCount(v=>Math.min(v+6,prods.length))}
                style={{padding:"8px 20px",borderRadius:8,background:"rgba(0,180,216,.08)",border:"1px solid rgba(0,180,216,.25)",color:"#00B4D8",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                {`▼ Ver más (${prods.length-visibleCount} restantes)`}
              </button>}
              {hasLess&&<button onClick={()=>setVisibleCount(6)}
                style={{padding:"8px 20px",borderRadius:8,background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.25)",color:"#ef4444",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                {"▲ Ver menos"}
              </button>}
            </div>
          </>
        }
      </section>
    );
  };

 const InstallButton = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  useEffect(()=>{
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);
    const handler = (e:any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return ()=>window.removeEventListener("beforeinstallprompt", handler);
  },[]);

  return (
    <>
      <button onClick={async()=>{
        if (isIOS) { setShowIOSHelp(true); return; }
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
      }}
        style={{display:"flex",alignItems:"center",gap:6,padding:"6px 14px",background:"rgba(0,180,216,.1)",border:"1px solid rgba(0,180,216,.3)",borderRadius:20,color:"#00B4D8",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",margin:"8px auto 0",width:"fit-content"}}>
        📲 Instalar app
      </button>
      {showIOSHelp&&(
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"flex-end",justifyContent:"center",padding:20}} onClick={()=>setShowIOSHelp(false)}>
          <div style={{background:"#ffffff",borderRadius:16,padding:24,width:"100%",maxWidth:400}} onClick={e=>e.stopPropagation()}>
            <p style={{fontWeight:700,fontSize:16,marginBottom:12,color:"#1a1a1a"}}>Instalar en iPhone</p>
            <p style={{fontSize:13,color:"#666",lineHeight:1.6,marginBottom:8}}>1. Tocá el botón <strong>compartir</strong> ⬆️ en Safari</p>
            <p style={{fontSize:13,color:"#666",lineHeight:1.6,marginBottom:16}}>2. Seleccioná <strong>"Agregar a pantalla de inicio"</strong></p>
            <button onClick={()=>setShowIOSHelp(false)} style={{width:"100%",padding:12,borderRadius:10,background:"#00B4D8",border:"none",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>Entendido</button>
          </div>
        </div>
      )}
    </>
  );
};
  return (
    <div style={{minHeight:"100vh",background:"#ffffff",color:"#1a1a1a",fontFamily:"'DM Sans',system-ui,sans-serif",overflowX:"hidden",width:"100%"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Syne:wght@700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { overflow-x: hidden; width: 100%; background:#ffffff; }
        .gbg{display:none}
        .sx{display:flex;gap:10px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none;-webkit-overflow-scrolling:auto}
        .sx::-webkit-scrollbar{display:none}
        .pb{padding:7px 14px;border-radius:100px;border:1px solid #e5e7eb;background:#ffffff;color:#444;cursor:pointer;font-size:12px;font-weight:500;white-space:nowrap;font-family:inherit;transition:all .2s;flex-shrink:0}
        .pb:hover,.pb.active{border-color:rgba(0,180,216,.5);color:#00B4D8;background:rgba(0,180,216,.08)}
        .if{width:100%;padding:11px 14px 11px 40px;background:#ffffff;border:1px solid rgba(0,180,216,.2);border-radius:10px;color:#1a1a1a;font-size:14px;outline:none;transition:border-color .2s;font-family:inherit}
        .if:focus{border-color:rgba(0,180,216,.5)}
        .if::placeholder{color:#888}
        .dr{position:fixed;inset:0;z-index:99998;display:flex;justify-content:flex-end}
        .dp{position:relative;z-index:99999;background:#ffffff;border-left:1px solid #e5e7eb;width:90%;max-width:400px;height:100vh;overflow-y:auto;padding:20px 16px;animation:sI .25s ease}
        @keyframes sI{from{transform:translateX(100%)}to{transform:translateX(0)}}
        .ov{position:absolute;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(4px)}
        .mo{position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.6);backdrop-filter:blur(8px)}
        @media(min-width:640px){.mo{align-items:center;padding:20px}}
        .mb{background:#ffffff;border:1px solid #e5e7eb;border-radius:20px 20px 0 0;padding:24px 20px;width:100%;max-width:460px;animation:fU .25s ease;max-height:92vh;overflow-y:auto}
        @media(min-width:640px){.mb{border-radius:20px}}
        @keyframes fU{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}
        .fi{width:100%;padding:11px 13px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:9px;color:#1a1a1a;font-size:14px;outline:none;font-family:inherit}
        .fi:focus{border-color:rgba(0,180,216,.4)}
        .st{font-family:'Syne',sans-serif;font-size:15px;color:#000000;margin-bottom:12px;display:flex;align-items:center;gap:8px}
        .st::after{content:'';flex:1;height:1px;background:linear-gradient(to right,rgba(0,180,216,.2),transparent)}
        .pg{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;width:100%}
        @media(min-width:480px){.pg{grid-template-columns:repeat(3,1fr);gap:10px}}
        @media(min-width:768px){.pg{grid-template-columns:repeat(4,1fr);gap:12px}}
        @media(min-width:1024px){.pg{grid-template-columns:repeat(5,1fr);gap:14px}}
        @media(min-width:1400px){.pg{grid-template-columns:repeat(6,1fr);gap:16px}}
        .pad{width:100%;padding:0 12px}
        @media(min-width:768px){.pad{padding:0 32px}}
        @media(min-width:1200px){.pad{padding:0 48px}}
        .img-banner{border-radius:12px;overflow:hidden;background:#f3f4f6}
        .img-banner img{width:100%;height:auto;display:block;object-fit:contain}
        .banner-grid{display:grid;grid-template-columns:1fr;gap:10px;margin-bottom:16px}
        @media(min-width:480px){.banner-grid{grid-template-columns:repeat(2,1fr)}}
        @media(min-width:768px){.banner-grid{grid-template-columns:repeat(3,1fr)}}
      `}</style>


      {/* HEADER */}
      <header style={{position:"fixed",top:0,left:0,right:0,zIndex:9999,borderBottom:"1px solid #e5e7eb",background:"#ffffff",padding:"10px 0"}}>
        <div className="pad">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
            <a href={MAPS} target="_blank" style={{fontSize:10,color:"#666",textDecoration:"none",flexShrink:0,display:"flex",alignItems:"center",gap:3}}
              onMouseEnter={e=>e.currentTarget.style.color="#00B4D8"}
              onMouseLeave={e=>e.currentTarget.style.color="#666"}>
              {"📍 Maps"}
            </a>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
              <img src="/images/logo1.png" alt="Concepción Tecnología" style={{height:"clamp(35px,8vw,55px)",width:"auto",objectFit:"contain"}}/>
              <span style={{fontSize:10,color:"#00B4D8",fontWeight:700,marginTop:2}}>{"💰 Ventas por mayor y menor"}</span>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",flexShrink:0}}>
             <a href="/mayorista" style={{padding:"7px 12px",borderRadius:8,background:"#00B4D8",border:"none",color:"#ffffff",fontSize:12,fontWeight:700,textDecoration:"none",whiteSpace:"nowrap",display:"flex",flexDirection:"column",alignItems:"center",lineHeight:1.2}}>
  <span>📦 Precios Mayoristas</span>
  <span style={{fontSize:9,opacity:.85}}>Tocá para ver</span>
</a>
              <span style={{fontSize:9,color:"#666",marginTop:3,textAlign:"right",whiteSpace:"nowrap"}}>
                {"Registrate · Compra mín. $80.000"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div style={{height:100}}/>

      <main style={{width:"100%",paddingBottom:100}}>
        <div className="pad" style={{paddingTop:24}}>

           {/* BOTÓN INSTALAR APP */}
<div style={{display:"flex",justifyContent:"center",padding:"8px 0 0"}}>
  <InstallButton/>
</div>
          

          {/* BÚSQUEDA */}
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            <div style={{position:"relative",flex:1,minWidth:0}}>
              <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:15,pointerEvents:"none"}}>🔍</span>
              <input className="if" placeholder="PRECIO POR MENOR" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <select value={sort} onChange={e=>setSort(e.target.value as "default"|"asc"|"desc")}
              style={{padding:"11px 10px",background:"#ffffff",border:"1px solid #e5e7eb",borderRadius:10,color:"#1a1a1a",fontSize:12,outline:"none",cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
              <option value="default">Ordenar</option>
              <option value="desc">Mayor precio</option>
              <option value="asc">Menor precio</option>
            </select>
          </div>

          {/* CATEGORÍAS */}
          <div className="sx" style={{marginBottom:10}}>
            <button className={`pb ${!activeCat?"active":""}`} onClick={()=>{playClick();setActiveCat(null);setActiveSub(null)}}>✦ Todos</button>
            {categories.map(c=>(
              <button key={c.id} className={`pb ${activeCat===c.slug?"active":""}`}
                onClick={()=>{playClick();setActiveCat(activeCat===c.slug?null:c.slug);setActiveSub(null)}}>
                {c.icon} {c.name}
              </button>
            ))}
          </div>

          {/* SUBCATEGORÍAS */}
          {activeCatData&&(activeCatData.subcategories?.length??0)>0&&(
            <div className="sx" style={{marginBottom:14}}>
              <button className={`pb ${!activeSub?"active":""}`} onClick={()=>{playClick();setActiveSub(null)}} style={{fontSize:11,padding:"5px 10px"}}>Todos</button>
              {activeCatData.subcategories.map(s=>(
                <button key={s.id} className={`pb ${activeSub===s.id?"active":""}`}
                  onClick={()=>{playClick();setActiveSub(activeSub===s.id?null:s.id)}} style={{fontSize:11,padding:"5px 10px"}}>
                  {s.name}
                </button>
              ))}
            </div>
          )}


          {!activeCat&&!search&&(
  <a href={`https://wa.me/${WA}?text=${encodeURIComponent("Hola! Quiero hacer una consulta.")}`} target="_blank"
    style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"12px 20px",background:"#25D366",borderRadius:12,color:"#ffffff",textDecoration:"none",fontWeight:700,fontSize:14,marginBottom:16,fontFamily:"inherit"}}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#ffffff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
    💬 Consultas por WhatsApp
  </a>
)}

 {/* BANNER LINK */}
<a href="https://concepciontecnologia2-art.github.io/REVISTA-DIGITAL/" target="_blank"
  style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"12px 20px",background:"rgba(0,180,216,.08)",border:"1px solid rgba(0,180,216,.25)",borderRadius:12,color:"#00B4D8",fontWeight:700,fontSize:14,textDecoration:"none",marginBottom:14,fontFamily:"inherit"}}>
  Ingresa aqui y mira todo el fixture del mundial!!!
</a>

          {/* OFERTAS Y NOVEDADES */}
          {!activeCat&&!search&&(
            <section style={{marginBottom:28}}>
              <h2 className="st">{"🔥 Ofertas y ✨ Novedades"}</h2>
              <Carrusel images={[
              { src:"/images/12.jpeg", alt:"novedad 26"},
              { src:"/images/6.jpg", alt:"novedad 6"},
              { src:"/images/13.jpeg", alt:"novedad 27"},
              { src:"/images/11.jpeg", alt:"novedad 28"},
              { src:"/images/14.jpeg", alt:"novedad 29"},
                { src:"/images/novedad3.jpg", alt:"Oferta 3" },
                { src:"/images/novedad1.jpg", alt:"Novedad 1" },
                { src:"/images/1.jpg", alt:"Novedad 2" },
                { src:"/images/5.jpg", alt:"Novedad 5" },
                
                
              ]}/>
              {offers.length>0&&(
                <div className="sx" style={{marginTop:14}}>
                  {offers.map(p=><div key={p.id} style={{width:180,flexShrink:0}}><ProductCard p={p}/></div>)}
                </div>
              )}
            </section>
          )}

          {/* DESTACADOS */}
          {!activeCat&&!search&&random.length>0&&(
            <section style={{marginBottom:28}}>
              <h2 className="st">{"⚡ Destacados"}</h2>
              <div className="sx">
                {random.map(p=><div key={p.id} style={{width:180,flexShrink:0}}><ProductCard p={p}/></div>)}
              </div>
            </section>
          )}

          {/* PRODUCTOS POR CATEGORÍA */}
          {Object.entries(grouped).map(([catName,prods])=>(
            <CategorySection key={catName||"all"} catName={catName} prods={prods} categories={categories}/>
          ))}
        </div>
      </main>

      {/* FOOTER */}
      <footer style={{borderTop:"1px solid #e5e7eb",padding:"24px 0",background:"#f9fafb"}}>
        <div className="pad" style={{display:"flex",flexWrap:"wrap",gap:20,justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <p style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:800,color:"#1a1a1a",marginBottom:4}}><span style={{color:"#00B4D8"}}>Concepción</span> Tecnología</p>
            <p style={{fontSize:12,color:"#666"}}>{"📍 Independencia 450, Concepción, Tucumán"}</p>
            <p style={{fontSize:12,color:"#666",marginTop:2}}>{"🕐 Lunes a Viernes: 9-12 y 16-20hs · Sábados: 9-15hs"}</p>
          </div>
          <div style={{display:"flex",gap:10}}>
            {[
  [<svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,"https://www.facebook.com/share/1GtkZrvC6L/?mibextid=wwXIfr"],
  [<svg width="18" height="18" viewBox="0 0 24 24" fill="url(#igf)"><defs><linearGradient id="igf" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f09433"/><stop offset="50%" stopColor="#dc2743"/><stop offset="100%" stopColor="#bc1888"/></linearGradient></defs><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>,"https://www.instagram.com/concepciontecnologia?igsh=azFiYWFrOWhpcGV1"],
  [<svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>,`https://wa.me/${WA}`],

[<svg key="tt" width="18" height="18" viewBox="0 0 24 24" fill="#000000"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.78a4.85 4.85 0 01-1.01-.09z"/></svg>,"https://www.tiktok.com/@concepciontecnologia?_r=1&_t=ZS-96fPI9A4yBQ"],].map(([icon,href])=>(
              <a key={href as string} href={href as string} target="_blank"
                style={{width:40,height:40,borderRadius:10,background:"#ffffff",border:"1px solid #e5e7eb",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,textDecoration:"none",transition:"border-color .2s"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(0,180,216,.4)"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="#e5e7eb"}>
                {icon}
              </a>
            ))}
          </div>
        </div>
      </footer>

      {/* BOTÓN SUBIR */}
      <button onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}
        style={{position:"fixed",bottom:cartCount>0?72:20,right:20,zIndex:9000,width:42,height:42,borderRadius:"50%",background:"rgba(0,180,216,.15)",border:"1px solid rgba(0,180,216,.4)",color:"#00B4D8",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",transition:"bottom .3s"}}>
        ↑
      </button>

      {/* CARRITO FLOTANTE */}
      {cartCount>0&&!cartOpen&&(
        <button onClick={()=>setCartOpen(true)} style={{position:"fixed",bottom:20,right:20,zIndex:9001,background:"#00B4D8",color:"#080c10",border:"none",borderRadius:50,padding:"12px 20px",fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 20px rgba(0,180,216,.4)",display:"flex",alignItems:"center",gap:8,fontFamily:"inherit"}}>
          🛒 <span style={{background:"#080c10",color:"#00B4D8",borderRadius:20,padding:"1px 8px",fontSize:12}}>{cartCount}</span>
        </button>
      )}

      {/* DRAWER CARRITO */}
      {cartOpen&&(
        <div className="dr">
          <div className="ov" onClick={()=>setCartOpen(false)}/>
          <div className="dp">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:700,color:"#1a1a1a"}}>Tu carrito</h2>
              <button onClick={()=>setCartOpen(false)} style={{background:"none",border:"none",color:"#666",fontSize:22,cursor:"pointer"}}>✕</button>
            </div>
            {cart.map(item=>(
              <div key={item.id} style={{display:"flex",gap:10,alignItems:"center",padding:9,background:"#f9fafb",borderRadius:10,border:"1px solid #e5e7eb",marginBottom:8}}>
                <img src={item.image_url||GENERIC} style={{width:42,height:42,objectFit:"cover",borderRadius:7,flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:12,fontWeight:600,color:"#1a1a1a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</p>
                  <p style={{fontSize:13,color:"#00B4D8",fontWeight:700}}>{fmt(Number(item.price_retail)*item.qty)}</p>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
  <button onClick={()=>updateQty(item.id,-1)} style={{width:26,height:26,borderRadius:"50%",border:"1px solid rgba(0,180,216,.3)",background:"rgba(0,180,216,.08)",color:"#00B4D8",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
  <span style={{fontSize:13,fontWeight:600,minWidth:14,textAlign:"center",color:"#1a1a1a"}}>{item.qty}</span>
  <button onClick={()=>updateQty(item.id,1)} style={{width:26,height:26,borderRadius:"50%",border:"1px solid rgba(0,180,216,.3)",background:"rgba(0,180,216,.08)",color:"#00B4D8",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
  <button onClick={()=>setCart(prev=>prev.filter(i=>i.id!==item.id))} style={{width:26,height:26,borderRadius:"50%",border:"1px solid rgba(239,68,68,.3)",background:"rgba(239,68,68,.08)",color:"#ef4444",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>🗑️</button>
</div>
              </div>
            ))}
            <div style={{padding:"12px 0",borderTop:"1px solid #e5e7eb",marginBottom:12,display:"flex",justifyContent:"space-between"}}>
              <span style={{color:"#666",fontSize:14}}>Total</span>
              <span style={{fontSize:21,fontWeight:800,color:"#00B4D8"}}>{fmt(cartTotal)}</span>
            </div>
            <button onClick={()=>{setCartOpen(false);setCheckoutOpen(true)}} style={{width:"100%",padding:12,borderRadius:10,background:"rgba(0,180,216,.12)",border:"1px solid rgba(0,180,216,.3)",color:"#00B4D8",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              Continuar →
            </button>
            <button onClick={()=>setCartOpen(false)} style={{marginTop:8,width:"100%",background:"none",border:"none",color:"#666",fontSize:12,cursor:"pointer",padding:7,fontFamily:"inherit"}}>{"← Seguir comprando"}</button>
          </div>
        </div>
      )}

      {/* MODAL CHECKOUT */}
      {checkoutOpen&&!orderDone&&(
        <div className="mo">
          <div className="mb">
            <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:700,marginBottom:4,color:"#1a1a1a"}}>Finalizar pedido</h2>
            <p style={{fontSize:12,color:"#666",marginBottom:16}}>Precio minorista · Completá tus datos</p>
            <div style={{display:"flex",flexDirection:"column",gap:11,marginBottom:14}}>
              <div>
                <label style={{fontSize:11,color:"#444",display:"block",marginBottom:4,fontWeight:600}}>NOMBRE *</label>
                <input className="fi" placeholder="Tu nombre completo" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
              </div>
              <div>
                <label style={{fontSize:11,color:"#444",display:"block",marginBottom:4,fontWeight:600}}>TELÉFONO *</label>
                <input className="fi" placeholder="3865 xxxxxx" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/>
              </div>
              <div>
                <label style={{fontSize:11,color:"#444",display:"block",marginBottom:4,fontWeight:600}}>ENTREGA</label>
                <div style={{display:"flex",gap:8}}>
                  {[["pickup","🏪 Retiro"],["delivery","🚗 Envío"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setForm(f=>({...f,delivery:v}))}
                      style={{flex:1,padding:"9px 6px",borderRadius:8,border:`1px solid ${form.delivery===v?"#00B4D8":"#e5e7eb"}`,background:form.delivery===v?"rgba(0,180,216,.1)":"#f9fafb",color:form.delivery===v?"#00B4D8":"#444",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>{l}</button>
                  ))}
                </div>
              </div>
              {form.delivery==="delivery"&&(
                <div>
                  <label style={{fontSize:11,color:"#444",display:"block",marginBottom:4,fontWeight:600}}>DIRECCIÓN *</label>
                  <input className="fi" placeholder="Calle, número, barrio" value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))}/>
                </div>
              )}
              <div>
                <label style={{fontSize:11,color:"#444",display:"block",marginBottom:6,fontWeight:600}}>MÉTODO DE PAGO</label>
                <div style={{display:"flex",gap:8}}>
                  {[["transfer","💳 Transferencia"],["cash","💵 Efectivo"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setPayMethod(v as "transfer"|"cash")}
                      style={{flex:1,padding:"9px 6px",borderRadius:8,border:`1px solid ${payMethod===v?"#00B4D8":"#e5e7eb"}`,background:payMethod===v?"rgba(0,180,216,.1)":"#f9fafb",color:payMethod===v?"#00B4D8":"#444",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

         
            
            {payMethod==="cash"&&(
              <div style={{padding:"10px 13px",background:"rgba(16,185,129,.06)",borderRadius:10,border:"1px solid rgba(16,185,129,.2)",marginBottom:12}}>
                <p style={{fontSize:12,color:"#10b981",fontWeight:600}}>{"💵 Pagás en efectivo al retirar o recibir el pedido"}</p>
              </div>
            )}

            <p style={{fontSize:13,color:"#666",textAlign:"center",marginBottom:12}}>Total: <strong style={{color:"#00B4D8"}}>{fmt(cartTotal)}</strong></p>

           
            {countdown!==null ? (
              <div style={{textAlign:"center",padding:"16px 0"}}>
                <div style={{fontSize:48,fontWeight:800,color:"#00B4D8",fontFamily:"'Syne',sans-serif",lineHeight:1}}>{countdown}</div>
                <p style={{fontSize:13,color:"#666",marginTop:6}}>{"Abriendo WhatsApp en "}{countdown}{countdown!==1?" segundos...":" segundo..."}</p>
                <div style={{height:4,background:"#e5e7eb",borderRadius:2,marginTop:12,overflow:"hidden"}}>
                  <div style={{height:"100%",background:"#00B4D8",borderRadius:2,transition:"width 1s linear",width:`${(countdown/10)*100}%`}}/>
                </div>
              </div>
            ) : (
              <>
                <button onClick={handleOrder} disabled={!form.name||!form.phone||sending}
                  style={{width:"100%",padding:13,background:"#25D366",border:"none",borderRadius:11,color:"white",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:(!form.name||!form.phone||sending)?.5:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  {"💬 "}{sending?"Procesando...":"Enviar pedido por WhatsApp"}
                </button>
                <button onClick={()=>{setCheckoutOpen(false);setCartOpen(true)}} style={{marginTop:8,width:"100%",background:"none",border:"none",color:"#666",fontSize:12,cursor:"pointer",padding:7,fontFamily:"inherit"}}>{"← Volver"}</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* PEDIDO EXITOSO */}
      {orderDone&&(
        <div className="mo">
          <div className="mb" style={{textAlign:"center"}}>
            <div style={{fontSize:52,marginBottom:12}}>✅</div>
            <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,marginBottom:10,color:"#1a1a1a"}}>{"¡Pedido realizado!"}</h2>
            <p style={{color:"#666",fontSize:14,lineHeight:1.6,marginBottom:8}}>En breve nos comunicamos con vos para confirmar.</p>
            <p style={{color:"#f59e0b",fontSize:13,marginBottom:20,fontWeight:500}}>{"⚠️ No olvidés adjuntar el comprobante en WhatsApp"}</p>
            <button onClick={()=>{setOrderDone(false);setCheckoutOpen(false);setCart([]);setForm({name:"",phone:"",delivery:"pickup",address:""});setPayMethod("transfer");}}
              style={{width:"100%",padding:12,borderRadius:10,background:"rgba(0,180,216,.12)",border:"1px solid rgba(0,180,216,.3)",color:"#00B4D8",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              Volver a la tienda
            </button>
          </div>
        </div>
      )}
    </div>
  );
}