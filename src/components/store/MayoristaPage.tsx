"use client";
import { useState, useMemo, useEffect } from "react";

const WA    = process.env.NEXT_PUBLIC_WHATSAPP!;
const ALIAS = process.env.NEXT_PUBLIC_STORE_ALIAS!;
const fmt = (n: number) => new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(n);

type Prod = { id:number; name:string; description:string; category_name:string; category_icon:string;
              price_retail:number; price_wholesale:number; available:boolean; image_url:string|null;
              stock_quantity:number; };
type Cat  = { id:number; name:string; icon:string; slug:string };
type Item = Prod & { qty:number };

export default function MayoristaPage({ initialProducts, categories }: { initialProducts: Prod[]; categories: Cat[] }) {
  const [registered, setRegistered] = useState(false);
  const [regForm, setRegForm] = useState({ name:"", phone:"" });
  const [regError, setRegError]   = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [products] = useState<Prod[]>(initialProducts);
  const [search, setSearch]       = useState("");
  const [activeCat, setActiveCat] = useState<string|null>(null);
  const [sort, setSort]           = useState<"default"|"asc"|"desc">("default");
  const [cart, setCart]           = useState<Item[]>([]);
  const [cartOpen, setCartOpen]   = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderDone, setOrderDone] = useState(false);
  const [payMethod, setPayMethod] = useState<"transfer"|"cash">("transfer");
  const [form, setForm] = useState({ name:"", phone:"", delivery:"pickup", address:"" });

  useEffect(()=>{
    const name = localStorage.getItem("mayorista_name") || "";
    const phone = localStorage.getItem("mayorista_phone") || "";
    if (name) {
      setRegistered(true);
      setRegForm({ name, phone });
      setForm(f=>({...f, name, phone }));
    }
  },[]);


 useEffect(()=>{
  if (!registered) return;
  const hash = window.location.hash;
  if (!hash.startsWith("#producto-")) return;
  const id = hash.replace("#producto-","");

  // Buscar el producto en la lista
  const prod = initialProducts.find((p:any) => String(p.id) === id);
  if (!prod) return;

  // Filtrar por la categoría del producto para que aparezca
  setActiveCat(null); // mostrar todos
  setSearch(""); // limpiar búsqueda

  const intentar = (intentos = 0) => {
    const el = document.getElementById(`producto-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.border = "2px solid #3b82f6";
      el.style.boxShadow = "0 0 0 4px rgba(59,130,246,.2)";
      setTimeout(()=>{
        el.style.border = "";
        el.style.boxShadow = "";
      }, 2000);
    } else if (intentos < 20) {
      setTimeout(()=>intentar(intentos + 1), 400);
    }
  };

  setTimeout(()=>intentar(), 800);
},[registered]);

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
    const pagoMsg = payMethod==="transfer"
      ? `💵 *Paga en efectivo al momento de la entrega.*`
      : `💵 *Paga en efectivo al momento de la entrega.*`;
    const msg=encodeURIComponent(`📦 *Pedido Mayorista - Concepción Tecnología*\n\n👤 ${form.name}\n📞 ${form.phone}\n📦 ${form.delivery==="pickup"?"Retira en local":`Envío: ${form.address}`}\n💳 Pago: ${payMethod==="transfer"?"Transferencia":"Efectivo"}\n\n${lines}\n\n*Total: ${fmt(cartTotal)}*\n\n${pagoMsg}`);
    window.open(`https://wa.me/${WA}?text=${msg}`,"_blank");
    setTimeout(()=>setOrderDone(true),600);
  };

  const GENERIC="https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&q=80";

  const downloadCatalogoPDF = (catName: string, prods: any[]) => {
    const lines = prods.map((p:any)=>
      `${p.name}\n   Precio mayorista: $${Number(p.price_wholesale).toLocaleString("es-AR")} | Stock: ${p.stock_quantity??0} u.`
    ).join("\n\n");
    const txt =
`══════════════════════════════════════
     CONCEPCIÓN TECNOLOGÍA
  Independencia 450, Concepción, Tucumán
  WhatsApp: 3865630488
  L-V 9-12 y 16-20hs
══════════════════════════════════════
  CATÁLOGO MAYORISTA
  Categoría: ${catName.toUpperCase()}
  Fecha: ${new Date().toLocaleDateString("es-AR")}
  Compra mínima: $80.000
  Precios sujetos a cambio
══════════════════════════════════════

${lines}

══════════════════════════════════════
  Pedidos por WhatsApp: 3865630488
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
  const ProductImageCarousel = ({ productId, mainImage }: { productId:number; mainImage:string|null }) => {
  const GENERIC = "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&q=80";
  const [imgIdx, setImgIdx] = useState(0);
  const [imgs, setImgs] = useState<string[]>([mainImage||GENERIC]);

  useEffect(()=>{
    fetch(`/api/products/${productId}/images`)
      .then(r=>r.json())
      .then((extra:any[])=>{
        const all = [mainImage, ...extra.map((i:any)=>i.image_url)].filter(Boolean) as string[];
        setImgs(all.length>0?all:[GENERIC]);
      }).catch(()=>{});
  },[productId]);

  return (
    <div style={{paddingBottom:"65%",position:"relative",overflow:"hidden",background:"#f8f8f8"}}>
      <img src={imgs[imgIdx]} alt="" style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",objectFit:"contain",background:"#f8f8f8"}} loading="lazy"/>
      {imgs.length>1&&(
        <>
          <button onClick={e=>{e.stopPropagation();setImgIdx(i=>i===0?imgs.length-1:i-1);}}
            style={{position:"absolute",left:4,top:"50%",transform:"translateY(-50%)",width:24,height:24,borderRadius:"50%",background:"rgba(0,0,0,.5)",border:"none",color:"#fff",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>‹</button>
          <button onClick={e=>{e.stopPropagation();setImgIdx(i=>i===imgs.length-1?0:i+1);}}
            style={{position:"absolute",right:4,top:"50%",transform:"translateY(-50%)",width:24,height:24,borderRadius:"50%",background:"rgba(0,0,0,.5)",border:"none",color:"#fff",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>›</button>
          <div style={{position:"absolute",bottom:4,left:"50%",transform:"translateX(-50%)",display:"flex",gap:4,zIndex:2}}>
            {imgs.map((_,i)=>(
              <div key={i} onClick={e=>{e.stopPropagation();setImgIdx(i);}}
                style={{width:i===imgIdx?14:5,height:5,borderRadius:10,background:i===imgIdx?"#3b82f6":"rgba(255,255,255,.6)",cursor:"pointer",transition:"all .3s"}}/>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

  const MayoristaCategorySection = ({ catName, prods }: { catName:string; prods:any[] }) => {
  const hash = typeof window !== "undefined" ? window.location.hash : "";
  const hayHashEnEstaCat = prods.some(p => `#producto-${p.id}` === hash);
  const [visibleCount, setVisibleCount] = useState(hayHashEnEstaCat ? prods.length : 6);
  const visible = prods.slice(0, visibleCount);
const hasMore = visibleCount < prods.length;
const hasLess = visibleCount > 6;
  return (
    <section style={{marginBottom:40}}>
      {catName&&(
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:700,color:"#1a1a1a",display:"flex",alignItems:"center",gap:6}}>
            {categories.find((c:any)=>c.name===catName)?.icon} {catName}
          </h2>
          <button onClick={()=>downloadCatalogoPDF(catName, prods)}
            style={{padding:"7px 14px",borderRadius:8,background:"rgba(59,130,246,.1)",border:"1px solid rgba(59,130,246,.3)",color:"#3b82f6",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap"}}>
            {"📄 Descargar catálogo"}
          </button>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:14}}>
        {visible.map(p=>{
          const inCart=cart.find((i:any)=>i.id===p.id);
          return (
            <div key={p.id} id={`producto-${p.id}`} style={{background:"#ffffff",border:`1px solid ${inCart?"rgba(59,130,246,.4)":"#e5e7eb"}`,borderRadius:14,overflow:"hidden",transition:"all .25s"}}>
              <ProductImageCarousel productId={p.id} mainImage={p.image_url}/>
              <div style={{padding:"12px 13px"}}>
                <p style={{fontSize:12,fontWeight:600,color:"#1a1a1a",lineHeight:1.3,marginBottom:4}}>{p.name}</p>
                {p.description&&<p style={{fontSize:10,color:"#666",lineHeight:1.4,marginBottom:8,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{p.description}</p>}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <button onClick={()=>updateQty(p.id,-1)} style={{width:26,height:26,borderRadius:"50%",border:"1px solid rgba(59,130,246,.3)",background:"rgba(59,130,246,.08)",color:"#3b82f6",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                       <input type="number" min="0" value={inCart?.qty||0}
  onChange={e=>{const qty=Math.max(0,Number(e.target.value)); setCart(prev=>{const ex=prev.find(i=>i.id===p.id); return ex?prev.map(i=>i.id===p.id?{...i,qty}:i):qty>0?[...prev,{...p,qty}]:prev;});}}
  style={{width:36,textAlign:"center",border:"1px solid rgba(59,130,246,.3)",borderRadius:6,fontSize:12,padding:"3px 0",fontFamily:"inherit",color:"#1a1a1a",outline:"none",background:"rgba(59,130,246,.04)"}}/>
                    <button onClick={()=>addToCart(p)} disabled={Number(p.stock_quantity)===0} style={{width:26,height:26,borderRadius:"50%",border:"1px solid rgba(59,130,246,.3)",background:"rgba(59,130,246,.08)",color:"#3b82f6",fontSize:14,cursor:Number(p.stock_quantity)===0?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <p style={{fontSize:18,fontWeight:800,color:"#3b82f6"}}>{fmt(Number(p.price_wholesale))}</p>
                    <p style={{fontSize:11,color:"#999",textDecoration:"line-through"}}>{fmt(Number(p.price_retail))}</p>
                  </div>
                </div>
               <p style={{fontSize:10,fontWeight:700,marginBottom:6,color:
  Number(p.stock_quantity)===0?"#ef4444":
  Number(p.stock_quantity)<=3?"#ef4444":
  Number(p.stock_quantity)<=10?"#f59e0b":"#10b981"}}>
  {Number(p.stock_quantity)===0?"🔴 Sin stock":
   Number(p.stock_quantity)<=3?`🔴 ${p.stock_quantity} u.`:
   Number(p.stock_quantity)<=10?`🟡 ${p.stock_quantity} u.`:
   `🟢 ${p.stock_quantity} u.`}
</p>
                <div style={{display:"flex",gap:4,marginTop:6}}>
                  {[
                    ["wa",<svg key="wa" width="14" height="14" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>],
                    ["fb",<svg key="fb" width="14" height="14" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>],
                    ["ig",<svg key="ig" width="14" height="14" viewBox="0 0 24 24" fill="url(#igm)"><defs><linearGradient id="igm" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f09433"/><stop offset="50%" stopColor="#dc2743"/><stop offset="100%" stopColor="#bc1888"/></linearGradient></defs><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>],
                  ].map(([via,icon])=>(
                    <button key={via as string} onClick={()=>{
                      const url = `${window.location.origin}/producto/${p.id}`;
                      const text = `🛒 ${p.name} — ${fmt(Number(p.price_wholesale))} | Concepción Tecnología`;
                      if (via==="wa") window.open(`https://wa.me/?text=${encodeURIComponent(text+"\n"+url)}`,"_blank");
                      if (via==="fb") window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,"_blank");
                      if (via==="ig") navigator.clipboard.writeText(text+"\n"+url).then(()=>alert("✅ Link copiado!"));
                    }}
                      style={{flex:1,padding:"5px 0",borderRadius:6,background:"rgba(255,255,255,.04)",border:"1px solid #e5e7eb",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:12}}>
        {hasMore&&<button onClick={()=>setVisibleCount(v=>Math.min(v+6,prods.length))}
          style={{padding:"8px 20px",borderRadius:8,background:"rgba(59,130,246,.08)",border:"1px solid rgba(59,130,246,.25)",color:"#3b82f6",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
          {`▼ Ver más (${prods.length-visibleCount} restantes)`}
        </button>}
        {hasLess&&<button onClick={()=>setVisibleCount(6)}
          style={{padding:"8px 20px",borderRadius:8,background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.25)",color:"#ef4444",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
          {"▲ Ver menos"}
        </button>}
      </div>
    </section>
  );
};

  if (!registered) return (
    <div style={{minHeight:"100vh",background:"#ffffff",fontFamily:"'DM Sans',system-ui,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <style dangerouslySetInnerHTML={{__html:`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Syne:wght@700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}.if2{width:100%;padding:13px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;color:#1a1a1a;font-size:14px;outline:none;transition:border-color .2s;font-family:inherit}.if2:focus{border-color:rgba(0,180,216,.4)}.if2::placeholder{color:#999}`}}/>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <a href="/" style={{display:"inline-block",fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,color:"#1a1a1a",textDecoration:"none",marginBottom:8}}>
            <span style={{color:"#00B4D8"}}>Concepción</span> Tecnología
          </a>
          <div style={{display:"inline-block",padding:"4px 14px",background:"rgba(0,180,216,.1)",border:"1px solid rgba(0,180,216,.3)",borderRadius:20,fontSize:12,fontWeight:600,color:"#00B4D8",marginBottom:8}}>
            {"📦 Precio Mayorista"}
          </div>
          <p style={{color:"#666",fontSize:14,lineHeight:1.5}}>Registrate para ver los precios mayoristas y hacer tus pedidos.</p>
          <p style={{color:"#ef4444",fontSize:12,fontWeight:700,marginTop:6}}>{"⚠️ COMPRA MÍNIMA $80.000"}</p>
        </div>
        <div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:18,padding:28}}>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {([["Nombre completo","text","name","Tu nombre"],["Teléfono","tel","phone","3865 xxxxxx"]] as [string,string,string,string][]).map(([label,type,key,ph])=>(
              <div key={key}>
                <label style={{fontSize:11,color:"#444",display:"block",marginBottom:5,fontWeight:600}}>{label.toUpperCase()}</label>
                <input type={type} className="if2" placeholder={ph}
                  value={(regForm as Record<string,string>)[key]}
                  onChange={e=>setRegForm(f=>({...f,[key]:e.target.value}))}
                  onKeyDown={e=>e.key==="Enter"&&handleRegister()}/>
              </div>
            ))}
          </div>
          {regError&&<p style={{color:"#ef4444",fontSize:12,marginTop:10}}>{regError}</p>}
          <button onClick={handleRegister} disabled={regLoading}
            style={{width:"100%",marginTop:20,padding:14,background:"rgba(0,180,216,.15)",border:"1px solid rgba(0,180,216,.4)",borderRadius:10,color:"#00B4D8",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:regLoading?.6:1}}>
            {regLoading?"Registrando...":"Acceder a precios mayoristas →"}
          </button>
          <a href="/" style={{display:"block",textAlign:"center",marginTop:12,fontSize:12,color:"#666",textDecoration:"none"}}>{"← Volver a tienda minorista"}</a>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#ffffff",color:"#1a1a1a",fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .if3{width:100%;padding:13px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;color:#1a1a1a;font-size:14px;outline:none;font-family:inherit}
        .if3:focus{border-color:rgba(59,130,246,.4)}
        .sx2{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none;-webkit-overflow-scrolling:auto}
        .sx2::-webkit-scrollbar{display:none}
        .pb2{padding:7px 16px;border-radius:100px;border:1px solid #e5e7eb;background:#ffffff;color:#444;cursor:pointer;font-size:13px;font-weight:500;white-space:nowrap;font-family:inherit;transition:all .2s}
        .pb2:hover,.pb2.active{border-color:rgba(59,130,246,.5);color:#3b82f6;background:rgba(59,130,246,.08)}
        .drawer{position:fixed;inset:0;z-index:100;display:flex;justify-content:flex-end}
        .drawer-panel{position:relative;z-index:1;background:#ffffff;border-left:1px solid #e5e7eb;width:100%;max-width:440px;height:100vh;overflow-y:auto;padding:24px;animation:slideIn .25s ease}
        @keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
        .overlay{position:absolute;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(4px)}
        .modal{position:fixed;inset:0;z-index:200;display:flex;align-items:flex-end;justify-content:center;padding:0;background:rgba(0,0,0,.6);backdrop-filter:blur(8px)}
        @media(min-width:640px){.modal{align-items:center;padding:20px}}
        .modal-box{background:#ffffff;border:1px solid #e5e7eb;border-radius:20px 20px 0 0;padding:28px;width:100%;max-width:480px;max-height:92vh;overflow-y:auto;animation:fU .25s ease}
        @media(min-width:640px){.modal-box{border-radius:20px}}
        @keyframes fU{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}
      `}</style>

      {/* HEADER */}
      <header style={{position:"sticky",top:0,zIndex:50,borderBottom:"1px solid #e5e7eb",background:"#ffffff",padding:"14px 20px"}}>
        <div style={{maxWidth:1400,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
          <div>
            <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(15px,3vw,20px)",fontWeight:800,color:"#1a1a1a"}}>
              <span style={{color:"#00B4D8"}}>Concepción</span> Tecnología
              <span style={{marginLeft:10,padding:"3px 10px",background:"rgba(59,130,246,.1)",border:"1px solid rgba(59,130,246,.3)",borderRadius:20,fontSize:11,color:"#3b82f6"}}>MAYORISTA</span>
            </h1>
            <p style={{fontSize:11,color:"#666",marginTop:2}}>Bienvenido, {regForm.name} · <span style={{color:"#ef4444",fontWeight:700}}>Compra mínima $80.000</span></p>
          </div>
          <div style={{display:"flex",gap:8}}>
            <a href="/" style={{padding:"7px 14px",borderRadius:8,background:"#f3f4f6",border:"1px solid #e5e7eb",color:"#444",fontSize:12,fontWeight:600,textDecoration:"none"}}>{"← Minorista"}</a>
            {cartCount>0&&<button onClick={()=>setCartOpen(true)} style={{padding:"7px 16px",borderRadius:8,background:"#3b82f6",color:"#ffffff",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"🛒 "}{cartCount}</button>}
          </div>
        </div>
      </header>

      <main style={{maxWidth:1400,margin:"0 auto",padding:"24px 20px 100px"}}>
        {/* BÚSQUEDA */}
        <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
          <div style={{position:"relative",flex:1,minWidth:220}}>
            <span style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",fontSize:15}}>🔍</span>
            <input className="if3" style={{paddingLeft:40}} placeholder="Buscar producto..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <select value={sort} onChange={e=>setSort(e.target.value as "default"|"asc"|"desc")}
            style={{padding:"12px 14px",background:"#ffffff",border:"1px solid #e5e7eb",borderRadius:10,color:"#1a1a1a",fontSize:13,outline:"none",fontFamily:"inherit",cursor:"pointer"}}>
            <option value="default">Ordenar</option>
            <option value="desc">Mayor precio</option>
            <option value="asc">Menor precio</option>
          </select>
        </div>

        {/* CATEGORÍAS */}
        <div className="sx2" style={{marginBottom:18}}>
          <button className={`pb2 ${!activeCat?"active":""}`} onClick={()=>setActiveCat(null)}>{"✦ Todos"}</button>
          {categories.map(c=>(
            <button key={c.id} className={`pb2 ${activeCat===c.slug?"active":""}`} onClick={()=>setActiveCat(activeCat===c.slug?null:c.slug)}>
              {c.icon} {c.name}
            </button>
          ))}
        </div>

        {/* PRODUCTOS */}
        {Object.entries(grouped).map(([catName,prods])=>(
          <MayoristaCategorySection key={catName} catName={catName} prods={prods}/>
        ))}
      </main>

      {/* BOTÓN SUBIR */}
      <button onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}
        style={{position:"fixed",bottom:cartCount>0?80:20,right:20,zIndex:9000,width:42,height:42,borderRadius:"50%",background:"rgba(59,130,246,.15)",border:"1px solid rgba(59,130,246,.4)",color:"#3b82f6",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>
        ↑
      </button>

      {/* CARRITO FLOTANTE */}
      {cartCount>0&&!cartOpen&&(
        <button onClick={()=>setCartOpen(true)} style={{position:"fixed",bottom:20,right:20,zIndex:9001,background:"#3b82f6",color:"#fff",border:"none",borderRadius:50,padding:"13px 22px",fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 24px rgba(59,130,246,.4)",display:"flex",alignItems:"center",gap:8,fontFamily:"inherit"}}>
          {"🛒 Carrito "}
          <span style={{background:"rgba(255,255,255,.2)",borderRadius:20,padding:"1px 9px",fontSize:12}}>{cartCount}</span>
        </button>
      )}

      {/* DRAWER CARRITO */}
      {cartOpen&&(
        <div className="drawer">
          <div className="overlay" onClick={()=>setCartOpen(false)}/>
          <div className="drawer-panel">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:19,fontWeight:700,color:"#1a1a1a"}}>Carrito Mayorista</h2>
              <button onClick={()=>setCartOpen(false)} style={{background:"none",border:"none",color:"#666",fontSize:22,cursor:"pointer"}}>✕</button>
            </div>
            {cart.map(item=>(
              <div key={item.id} style={{display:"flex",gap:10,alignItems:"center",padding:10,background:"#f9fafb",borderRadius:10,border:"1px solid #e5e7eb",marginBottom:8}}>
                <img src={item.image_url||GENERIC} style={{width:44,height:44,objectFit:"cover",borderRadius:7,flexShrink:0}} alt={item.name}/>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:12,fontWeight:600,color:"#1a1a1a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</p>
                  <p style={{fontSize:13,color:"#3b82f6",fontWeight:700}}>{fmt(Number(item.price_wholesale)*item.qty)}</p>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <button onClick={()=>updateQty(item.id,-1)} style={{width:26,height:26,borderRadius:"50%",border:"1px solid rgba(59,130,246,.3)",background:"rgba(59,130,246,.08)",color:"#3b82f6",fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                  <span style={{fontSize:13,fontWeight:600,minWidth:14,textAlign:"center",color:"#1a1a1a"}}>{item.qty}</span>
                  <button onClick={()=>updateQty(item.id,1)} style={{width:26,height:26,borderRadius:"50%",border:"1px solid rgba(59,130,246,.3)",background:"rgba(59,130,246,.08)",color:"#3b82f6",fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                  <button onClick={()=>removeFromCart(item.id)} style={{width:26,height:26,borderRadius:"50%",border:"1px solid rgba(239,68,68,.3)",background:"rgba(239,68,68,.08)",color:"#ef4444",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>🗑️</button>
                </div>
              </div>
            ))}
            <div style={{padding:"12px 0",borderTop:"1px solid #e5e7eb",marginBottom:14,display:"flex",justifyContent:"space-between"}}>
              <span style={{color:"#666",fontSize:14}}>Total mayorista</span>
              <span style={{fontSize:21,fontWeight:800,color:"#3b82f6"}}>{fmt(cartTotal)}</span>
            </div>
            {cartTotal < 80000 && (
              <p style={{fontSize:12,color:"#ef4444",fontWeight:700,textAlign:"center",marginBottom:10}}>
                {"⚠️ COMPRA MÍNIMA $80.000 — Te faltan "}{fmt(80000-cartTotal)}
              </p>
            )}
            <button onClick={()=>{setCartOpen(false);setCheckoutOpen(true)}} style={{width:"100%",padding:13,borderRadius:10,background:"rgba(59,130,246,.12)",border:"1px solid rgba(59,130,246,.3)",color:"#3b82f6",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:8}}>
              Finalizar pedido →
            </button>
            <button onClick={()=>setCartOpen(false)} style={{width:"100%",padding:10,borderRadius:10,background:"#f3f4f6",border:"1px solid #e5e7eb",color:"#444",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              ← Seguir agregando productos
            </button>
          </div>
        </div>
      )}

      {/* MODAL CHECKOUT */}
      {checkoutOpen&&!orderDone&&(
        <div className="modal">
          <div className="modal-box">
            <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:19,fontWeight:700,marginBottom:4,color:"#1a1a1a"}}>Pedido Mayorista</h2>
            <p style={{fontSize:13,color:"#666",marginBottom:18}}>Completá los datos de entrega</p>
            <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:16}}>
              <div>
                <label style={{fontSize:11,color:"#444",display:"block",marginBottom:5,fontWeight:600}}>NOMBRE</label>
                <input className="if3" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
              </div>
              <div>
                <label style={{fontSize:11,color:"#444",display:"block",marginBottom:5,fontWeight:600}}>TELÉFONO</label>
                <input className="if3" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/>
              </div>
              <div>
                <label style={{fontSize:11,color:"#444",display:"block",marginBottom:5,fontWeight:600}}>ENTREGA</label>
                <div style={{display:"flex",gap:8}}>
                  {[["pickup","🏪 Retiro"],["delivery","🚗 Envío"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setForm(f=>({...f,delivery:v}))}
                      style={{flex:1,padding:"9px 6px",borderRadius:8,border:`1px solid ${form.delivery===v?"#3b82f6":"#e5e7eb"}`,background:form.delivery===v?"rgba(59,130,246,.1)":"#f9fafb",color:form.delivery===v?"#3b82f6":"#444",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>{l}</button>
                  ))}
                </div>
              </div>
              {form.delivery==="delivery"&&(
                <div>
                  <label style={{fontSize:11,color:"#444",display:"block",marginBottom:5,fontWeight:600}}>DIRECCIÓN</label>
                  <input className="if3" placeholder="Calle, número, barrio" value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))}/>
                </div>
              )}
              <div>
                <label style={{fontSize:11,color:"#444",display:"block",marginBottom:6,fontWeight:600}}>MÉTODO DE PAGO</label>
                <div style={{display:"flex",gap:8}}>
                  {[["transfer","💳 Transferencia"],["cash","💵 Efectivo"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setPayMethod(v as "transfer"|"cash")}
                      style={{flex:1,padding:"9px 6px",borderRadius:8,border:`1px solid ${payMethod===v?"#3b82f6":"#e5e7eb"}`,background:payMethod===v?"rgba(59,130,246,.1)":"#f9fafb",color:payMethod===v?"#3b82f6":"#444",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {payMethod==="cash"&&(
              <div style={{padding:"11px 13px",background:"rgba(16,185,129,.06)",borderRadius:10,border:"1px solid rgba(16,185,129,.2)",marginBottom:14}}>
                <p style={{fontSize:12,color:"#10b981",fontWeight:600}}>{"💵 Pagás en efectivo al retirar o recibir el pedido"}</p>
              </div>
            )}

            <div style={{padding:"10px 13px",background:"rgba(239,68,68,.06)",borderRadius:10,border:"1px solid rgba(239,68,68,.2)",marginBottom:14}}>
              <p style={{fontSize:12,color:"#ef4444",fontWeight:700}}>{"⚠️ COMPRA MÍNIMA $80.000"}</p>
            </div>

            <p style={{fontSize:13,color:"#666",textAlign:"center",marginBottom:14}}>Total: <strong style={{color:"#3b82f6"}}>{fmt(cartTotal)}</strong> (Mayorista)</p>

            <button onClick={handleOrder} disabled={!form.name||!form.phone}
              style={{width:"100%",padding:14,background:"#25D366",border:"none",borderRadius:12,color:"white",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:(!form.name||!form.phone)?.5:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:8}}>
              {"💬 Enviar pedido por WhatsApp"}
            </button>
            <button onClick={()=>{setCheckoutOpen(false);setCartOpen(true);}} style={{width:"100%",background:"none",border:"none",color:"#666",fontSize:12,cursor:"pointer",padding:7,fontFamily:"inherit"}}>{"← Volver al carrito"}</button>
          </div>
        </div>
      )}

      {/* PEDIDO EXITOSO */}
      {orderDone&&(
        <div className="modal">
          <div className="modal-box" style={{textAlign:"center"}}>
            <div style={{fontSize:56,marginBottom:12}}>✅</div>
            <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,marginBottom:10,color:"#1a1a1a"}}>{"¡Pedido mayorista enviado!"}</h2>
            <p style={{color:"#666",fontSize:14,lineHeight:1.6,marginBottom:22}}>En breve nos comunicamos para coordinar la entrega.</p>
            <button onClick={()=>{setOrderDone(false);setCheckoutOpen(false);setCart([]);setForm({name:regForm.name,phone:regForm.phone,delivery:"pickup",address:""});setPayMethod("transfer");}}
              style={{width:"100%",padding:12,borderRadius:10,background:"rgba(59,130,246,.12)",border:"1px solid rgba(59,130,246,.3)",color:"#3b82f6",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:8}}>
              🛒 Seguir comprando
            </button>
            <a href="/" style={{display:"block",width:"100%",padding:12,borderRadius:10,background:"#f3f4f6",border:"1px solid #e5e7eb",color:"#444",fontSize:14,fontWeight:600,textDecoration:"none",textAlign:"center"}}>
              ← Volver a tienda minorista
            </a>
          </div>
        </div>
      )}
    </div>
  );
}