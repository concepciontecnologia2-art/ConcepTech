"use client";
import { useState, useMemo } from "react";

const WA    = process.env.NEXT_PUBLIC_WHATSAPP!;
const ALIAS = process.env.NEXT_PUBLIC_STORE_ALIAS!;
const fmt = (n: number) => new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(n);

type Prod = { id:number; name:string; description:string; category_name:string; category_icon:string;
              price_retail:number; price_wholesale:number; available:boolean; image_url:string|null; };
type Cat  = { id:number; name:string; icon:string; slug:string };
type Item = Prod & { qty:number };

export default function MayoristaPage({ initialProducts, categories }: { initialProducts: Prod[]; categories: Cat[] }) {
  const [registered, setRegistered] = useState(() => {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("mayorista_email");
});
const [regForm, setRegForm] = useState(() => {
  if (typeof window === "undefined") return { name:"", phone:"", email:"" };
  return {
    name:  localStorage.getItem("mayorista_name")  || "",
    phone: localStorage.getItem("mayorista_phone") || "",
    email: localStorage.getItem("mayorista_email") || "",
  };
});
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [products] = useState<Prod[]>(initialProducts);
  const [search, setSearch]     = useState("");
  const [activeCat, setActiveCat] = useState<string|null>(null);
  const [sort, setSort]         = useState<"default"|"asc"|"desc">("default");
  const [cart, setCart]         = useState<Item[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderDone, setOrderDone] = useState(false);
  const [form, setForm] = useState({ name:regForm.name, phone:regForm.phone, delivery:"pickup", address:"" });

  const handleRegister = async () => {
    if (!regForm.name || !regForm.phone || !regForm.email) { setRegError("Completá todos los campos"); return; }
    setRegLoading(true);
    const res = await fetch("/api/wholesale-register",{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(regForm) });
    if (res.ok) { setRegistered(true); setForm(f=>({...f,name:regForm.name,phone:regForm.phone})); }
    else setRegError("Error al registrar. Intentá de nuevo.");
    setRegLoading(false);
 
  localStorage.setItem("mayorista_name",  regForm.name);
localStorage.setItem("mayorista_phone", regForm.phone);
localStorage.setItem("mayorista_email", regForm.email);
 };
  const filtered = useMemo(() => {
    let p = products.filter(x=>x.available);
    if (activeCat) p = p.filter(x=>{ const cat=categories.find(c=>c.slug===activeCat); return cat?.name===x.category_name; });
    if (search.trim()) p = p.filter(x=>x.name.toLowerCase().includes(search.toLowerCase()));
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
    setCartOpen(true);
  };
  const updateQty=(id:number,d:number)=>setCart(prev=>prev.map(i=>i.id===id?{...i,qty:Math.max(0,i.qty+d)}:i).filter(i=>i.qty>0));
  const cartCount=cart.reduce((s,i)=>s+i.qty,0);
  const cartTotal=cart.reduce((s,i)=>s+i.qty*Number(i.price_wholesale),0);

  const handleOrder=async()=>{
    if(!form.name||!form.phone)return;
    await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({customer_name:form.name,phone:form.phone,email:regForm.email,sale_type:"wholesale",
        delivery_type:form.delivery,address:form.address||null,
        items:cart.map(i=>({id:i.id,name:i.name,qty:i.qty,price:Number(i.price_wholesale)})),total:cartTotal})});
    const lines=cart.map(i=>`• ${i.qty}x ${i.name} — ${fmt(i.qty*Number(i.price_wholesale))}`).join("\n");
    const msg=encodeURIComponent(`📦 *Pedido Mayorista - Concepción Tecnología*\n\n👤 ${form.name}\n📞 ${form.phone}\n📦 ${form.delivery==="pickup"?"Retira en local":`Envío: ${form.address}`}\n\n${lines}\n\n*Total: ${fmt(cartTotal)}*\n💳 Alias: *${ALIAS}*`);
    window.open(`https://wa.me/${WA}?text=${msg}`,"_blank");
    setTimeout(()=>setOrderDone(true),600);
  };

  const GENERIC="https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&q=80";

  if (!registered) return (
    <div style={{minHeight:"100vh",background:"#ffffff",color:"#e8edf2",fontFamily:"'DM Sans',system-ui,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Syne:wght@700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}.input-field{width:100%;padding:13px 16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#e8edf2;font-size:14px;outline:none;transition:border-color .2s;font-family:inherit}.input-field:focus{border-color:rgba(0,180,216,.4)}`}</style>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <a href="/" style={{display:"inline-block",fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,color:"#fff",textDecoration:"none",marginBottom:8}}>
            <span style={{color:"#00B4D8"}}>Concepción</span> Tecnología
          </a>
          <div style={{display:"inline-block",padding:"4px 14px",background:"rgba(0,180,216,.1)",border:"1px solid rgba(0,180,216,.3)",borderRadius:20,fontSize:12,fontWeight:600,color:"#00B4D8"}}>
            📦 Precio Mayorista
          </div>
          <p style={{color:"#445",fontSize:14,marginTop:12,lineHeight:1.5}}>Registrate para ver los precios mayoristas y hacer tus pedidos.</p>
        </div>
        <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.08)",borderRadius:18,padding:28}}>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {[["Nombre completo","text","name","Tu nombre"],["Teléfono","tel","phone","3865 xxxxxx"],["Email","email","email","tu@email.com"]].map(([label,type,key,ph])=>(
              <div key={key}>
                <label style={{fontSize:11,color:"#445",display:"block",marginBottom:5,fontWeight:600}}>{(label as string).toUpperCase()}</label>
                <input type={type as string} className="input-field" placeholder={ph as string}
                  value={(regForm as Record<string,string>)[key as string]}
                  onChange={e=>setRegForm(f=>({...f,[key as string]:e.target.value}))}
                  onKeyDown={e=>e.key==="Enter"&&handleRegister()}/>
              </div>
            ))}
          </div>
          {regError && <p style={{color:"#ef4444",fontSize:12,marginTop:10}}>{regError}</p>}
          <button onClick={handleRegister} disabled={regLoading} style={{width:"100%",marginTop:20,padding:14,background:"rgba(0,180,216,.15)",border:"1px solid rgba(0,180,216,.4)",borderRadius:10,color:"#00B4D8",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:regLoading?.6:1}}>
            {regLoading?"Registrando...":"Acceder a precios mayoristas →"}
          </button>
          <a href="/" style={{display:"block",textAlign:"center",marginTop:12,fontSize:12,color:"#445",textDecoration:"none"}}>← Volver a tienda minorista</a>
        </div>
      </div>
    </div>
  );
 const downloadCatalogoPDF = (catName: string, prods: any[]) => {
  const lines = prods.map((p:any) =>
    `${p.name}\n   Precio mayorista: $${Number(p.price_wholesale).toLocaleString("es-AR")} | Stock: ${p.stock_quantity??0} u.`
  ).join("\n\n");

  const txt =
`══════════════════════════════════════
     CONCEPCIÓN TECNOLOGÍA
  Independencia 450, Concepción, Tucumán
  WhatsApp: 3865630488
  L-V 9-12 y 16-20hs · Sáb 9-15hs
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
const MayoristaCategorySection = ({ catName, prods, categories, cart, addToCart, fmt, GENERIC }: {
  catName:string; prods:any[]; categories:any[]; cart:any[]; addToCart:(p:any)=>void; fmt:(n:number)=>string; GENERIC:string;
}) => {
  const [visibleCount, setVisibleCount] = useState(6);
  const visible = prods.slice(0, visibleCount);
  const hasMore = visibleCount < prods.length;
  const hasLess = visibleCount > 6;

  return (
    <section style={{marginBottom:40}}>
      {catName && (
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,color:"#000000"}}>
<h2 className="section-title" style={{color:"#000000"}}>{categories.find((c:any)=>c.name===catName)?.icon} {catName}</h2>          
          <button
            onClick={()=>downloadCatalogoPDF(catName, prods)}
            style={{padding:"7px 14px",borderRadius:8,background:"rgba(59,130,246,.1)",border:"1px solid rgba(59,130,246,.3)",color:"#3b82f6",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap"}}>
            {"📄 Descargar catálogo"}
          </button>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:14}}>
        {visible.map(p=>{
          const inCart = cart.find((i:any)=>i.id===p.id);
          return (
            <div key={p.id} style={{background:"rgba(255,255,255,.03)",border:`1px solid ${inCart?"rgba(0,180,216,.3)":"rgba(255,255,255,.07)"}`,borderRadius:14,overflow:"hidden",transition:"all .25s"}}>
              <div style={{height:150,overflow:"hidden",background:"#111"}}>
                <img src={p.image_url||GENERIC} alt={p.name} style={{width:"100%",height:"100%",objectFit:"cover"}} loading="lazy"/>
              </div>
              <div style={{padding:"12px 13px"}}>
                <p style={{fontSize:13,fontWeight:600,color:"#dde",lineHeight:1.3,marginBottom:4}}>{p.name}</p>
                {p.description&&<p style={{fontSize:11,color:"#445",lineHeight:1.4,marginBottom:8}}>{p.description}</p>}
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <p style={{fontSize:19,fontWeight:800,color:"#3b82f6"}}>{fmt(Number(p.price_wholesale))}</p>
                  <p style={{fontSize:11,color:"#334",textDecoration:"line-through"}}>{fmt(Number(p.price_retail))}</p>
                </div>
                <button onClick={()=>addToCart(p)} style={{width:"100%",padding:9,borderRadius:9,background:"rgba(59,130,246,.12)",border:"1px solid rgba(59,130,246,.3)",color:"#3b82f6",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                  {inCart?`✓ En carrito (${inCart.qty})`:"+ Agregar"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:12}}>
        {hasMore&&(
          <button onClick={()=>setVisibleCount(v=>Math.min(v+6, prods.length))}
            style={{padding:"8px 20px",borderRadius:8,background:"rgba(59,130,246,.08)",border:"1px solid rgba(59,130,246,.25)",color:"#3b82f6",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
            {`▼ Ver más (${prods.length - visibleCount} restantes)`}
          </button>
        )}
        {hasLess&&(
          <button onClick={()=>setVisibleCount(6)}
            style={{padding:"8px 20px",borderRadius:8,background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.25)",color:"#ef4444",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
            {"▲ Ver menos"}
          </button>
        )}
      </div>
    </section>
  );
};
  return (
    <div style={{minHeight:"100vh",background:"#ffffff",color:"#e8edf2",fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Syne:wght@700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}.input-field{width:100%;padding:13px 16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#e8edf2;font-size:14px;outline:none;font-family:inherit}.scroll-x{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none}.pill-btn{padding:7px 16px;border-radius:100px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);color:#778;cursor:pointer;font-size:13px;font-weight:500;white-space:nowrap;font-family:inherit;transition:all .2s}.pill-btn:hover,.pill-btn.active{border-color:rgba(0,180,216,.5);color:#00B4D8;background:rgba(0,180,216,.08)}.section-title{font-family:'Syne',sans-serif;font-size:17px;color:#fff;margin-bottom:14px;display:flex;align-items:center;gap:8px}.section-title::after{content:'';flex:1;height:1px;background:linear-gradient(to right,rgba(0,180,216,.2),transparent)}.drawer{position:fixed;inset:0;z-index:100;display:flex;justify-content:flex-end}.drawer-panel{position:relative;z-index:1;background:#0d1117;border-left:1px solid rgba(0,180,216,.15);width:100%;max-width:440px;height:100vh;overflow-y:auto;padding:24px;animation:slideIn .25s ease}@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}.overlay{position:absolute;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px)}.modal{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.8);backdrop-filter:blur(8px)}.modal-box{background:#0d1117;border:1px solid rgba(0,180,216,.2);border-radius:20px;padding:28px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto}`}</style>

      <header style={{position:"sticky",top:0,zIndex:10,borderBottom:"1px solid rgba(255,255,255,.06)",background:"rgba(8,12,16,.95)",backdropFilter:"blur(10px)",padding:"14px 20px"}}>
        <div style={{maxWidth:1200,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
          <div>
            <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(15px,3vw,20px)",fontWeight:800,color:"#fff"}}>
              <span style={{color:"#00B4D8"}}>Concepción</span> Tecnología
              <span style={{marginLeft:10,padding:"3px 10px",background:"rgba(0,180,216,.1)",border:"1px solid rgba(0,180,216,.3)",borderRadius:20,fontSize:11,color:"#00B4D8"}}>MAYORISTA</span>
            </h1>
            <p style={{fontSize:11,color:"#445",marginTop:2}}>Bienvenido, {regForm.name}</p>
          </div>
          <div style={{display:"flex",gap:8}}>
            <a href="/" style={{padding:"7px 14px",borderRadius:8,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",color:"#445",fontSize:12,fontWeight:600,textDecoration:"none"}}>← Minorista</a>
            {cartCount>0 && <button onClick={()=>setCartOpen(true)} style={{padding:"7px 16px",borderRadius:8,background:"#00B4D8",color:"#080c10",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🛒 {cartCount}</button>}
          </div>
        </div>
      </header>

      <main style={{maxWidth:1200,margin:"0 auto",padding:"24px 20px 100px"}}>
        <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
          <div style={{position:"relative",flex:1,minWidth:220}}>
            <span style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",fontSize:15}}>🔍</span>
            <input className="input-field" style={{paddingLeft:40}} placeholder="Buscar producto..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <select value={sort} onChange={e=>setSort(e.target.value as "default"|"asc"|"desc")} style={{padding:"12px 14px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,color:"#1a1a1a",fontSize:13,outline:"none",fontFamily:"inherit"}}>
            <option value="default">Ordenar</option>
            <option value="asc">Precio ↑</option>
            <option value="desc">Precio ↓</option>
          </select>
        </div>

        <div className="scroll-x" style={{marginBottom:18}}>
          <button className={`pill-btn ${!activeCat?"active":""}`} onClick={()=>setActiveCat(null)}>✦ Todos</button>
          {categories.map(c=>(
            <button key={c.id} className={`pill-btn ${activeCat===c.slug?"active":""}`} onClick={()=>setActiveCat(activeCat===c.slug?null:c.slug)}>
              {c.icon} {c.name}
            </button>
          ))}
        </div>
{Object.entries(grouped).map(([catName,prods])=>(
  <MayoristaCategorySection
    key={catName}
    catName={catName}
    prods={prods}
    categories={categories}
    cart={cart}
    addToCart={addToCart}
    fmt={fmt}
    GENERIC={GENERIC}
  />
))}
      </main>

      {cartCount>0 && !cartOpen && (
        <button onClick={()=>setCartOpen(true)} style={{position:"fixed",bottom:24,right:24,zIndex:50,background:"#3b82f6",color:"#fff",border:"none",borderRadius:50,padding:"13px 22px",fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 24px rgba(59,130,246,.4)",display:"flex",alignItems:"center",gap:8,fontFamily:"inherit"}}>
          🛒 Carrito <span style={{background:"rgba(255,255,255,.2)",borderRadius:20,padding:"1px 9px",fontSize:12}}>{cartCount}</span>
        </button>
      )}
      {cartOpen && (
        <div className="drawer">
          <div className="overlay" onClick={()=>setCartOpen(false)}/>
          <div className="drawer-panel">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:19,fontWeight:700}}>Carrito Mayorista</h2>
              <button onClick={()=>setCartOpen(false)} style={{background:"none",border:"none",color:"#556",fontSize:22,cursor:"pointer"}}>✕</button>
            </div>
            {cart.map(item=>(
              <div key={item.id} style={{display:"flex",gap:10,alignItems:"center",padding:10,background:"rgba(255,255,255,.03)",borderRadius:10,border:"1px solid rgba(255,255,255,.06)",marginBottom:8}}>
                <img src={item.image_url||GENERIC} style={{width:44,height:44,objectFit:"cover",borderRadius:7,flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:12,fontWeight:600,color:"#dde",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</p>
                  <p style={{fontSize:13,color:"#3b82f6",fontWeight:700}}>{fmt(Number(item.price_wholesale)*item.qty)}</p>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <button onClick={()=>updateQty(item.id,-1)} style={{width:26,height:26,borderRadius:"50%",border:"1px solid rgba(59,130,246,.3)",background:"rgba(59,130,246,.08)",color:"#3b82f6",fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                  <span style={{fontSize:13,fontWeight:600,minWidth:14,textAlign:"center"}}>{item.qty}</span>
                  <button onClick={()=>updateQty(item.id,1)} style={{width:26,height:26,borderRadius:"50%",border:"1px solid rgba(59,130,246,.3)",background:"rgba(59,130,246,.08)",color:"#3b82f6",fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                </div>
              </div>
            ))}
            <div style={{padding:"12px 0",borderTop:"1px solid rgba(255,255,255,.07)",marginBottom:14,display:"flex",justifyContent:"space-between"}}>
              <span style={{color:"#556",fontSize:14}}>Total mayorista</span>
              <span style={{fontSize:21,fontWeight:800,color:"#3b82f6"}}>{fmt(cartTotal)}</span>
            </div>
            <button onClick={()=>{setCartOpen(false);setCheckoutOpen(true)}} style={{width:"100%",padding:13,borderRadius:10,background:"rgba(59,130,246,.12)",border:"1px solid rgba(59,130,246,.3)",color:"#3b82f6",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              Finalizar pedido →
            </button>
          </div>
        </div>
        
      )}
      {/* BOTÓN SUBIR */}
<button onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}
  style={{position:"fixed",bottom:cartCount>0?80:20,right:20,zIndex:9000,width:42,height:42,borderRadius:"50%",background:"rgba(59,130,246,.15)",border:"1px solid rgba(59,130,246,.4)",color:"#3b82f6",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 12px rgba(59,130,246,.2)",fontFamily:"inherit"}}>
  ↑
</button>

      {checkoutOpen && !orderDone && (
        <div className="modal">
          <div className="modal-box">
            <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:19,fontWeight:700,marginBottom:4}}>Pedido Mayorista</h2>
            <p style={{fontSize:13,color:"#445",marginBottom:18}}>Completá los datos de entrega</p>
            <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:16}}>
              <div><label style={{fontSize:11,color:"#445",display:"block",marginBottom:5,fontWeight:600}}>NOMBRE</label>
                <input className="input-field" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
              <div><label style={{fontSize:11,color:"#445",display:"block",marginBottom:5,fontWeight:600}}>TELÉFONO</label>
                <input className="input-field" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/></div>
              <div>
                <label style={{fontSize:11,color:"#445",display:"block",marginBottom:5,fontWeight:600}}>ENTREGA</label>
                <div style={{display:"flex",gap:8}}>
                  {[["pickup","🏪 Retiro"],["delivery","🚗 Envío"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setForm(f=>({...f,delivery:v}))} style={{flex:1,padding:"9px 6px",borderRadius:8,border:`1px solid ${form.delivery===v?"#3b82f6":"rgba(255,255,255,.1)"}`,background:form.delivery===v?"rgba(59,130,246,.1)":"rgba(255,255,255,.03)",color:form.delivery===v?"#3b82f6":"#445",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>{l}</button>
                  ))}
                </div>
              </div>
              {form.delivery==="delivery" && (
                <div><label style={{fontSize:11,color:"#445",display:"block",marginBottom:5,fontWeight:600}}>DIRECCIÓN</label>
                  <input className="input-field" placeholder="Calle, número, barrio" value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))}/></div>
              )}
            </div>
            <div style={{padding:"11px 13px",background:"rgba(59,130,246,.06)",borderRadius:10,border:"1px solid rgba(59,130,246,.15)",marginBottom:14}}>
              <p style={{fontSize:11,color:"#445",marginBottom:2}}>ALIAS DE PAGO</p>
              <p style={{fontSize:14,fontWeight:700,color:"#3b82f6"}}>{ALIAS}</p>
            </div>
            <p style={{fontSize:13,color:"#556",textAlign:"center",marginBottom:14}}>Total: <strong style={{color:"#3b82f6"}}>{fmt(cartTotal)}</strong> (Mayorista)</p>
            <button onClick={handleOrder} disabled={!form.name||!form.phone} style={{width:"100%",padding:14,background:"#25D366",border:"none",borderRadius:12,color:"white",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:(!form.name||!form.phone)?.5:1}}>
              💬 Enviar pedido por WhatsApp
            </button>
          </div>
        </div>
      )}

      {orderDone && (
        <div className="modal">
          <div className="modal-box" style={{textAlign:"center"}}>
            <div style={{fontSize:56,marginBottom:12}}>✅</div>
            <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,marginBottom:10}}>¡Pedido mayorista enviado!</h2>
            <p style={{color:"#556",fontSize:14,lineHeight:1.6,marginBottom:22}}>En breve nos comunicamos para coordinar la entrega. ¡Gracias!</p>
            <button onClick={()=>{setOrderDone(false);setCheckoutOpen(false);setCart([]);setForm({name:regForm.name,phone:regForm.phone,delivery:"pickup",address:""})}}
              style={{width:"100%",padding:12,borderRadius:10,background:"rgba(59,130,246,.12)",border:"1px solid rgba(59,130,246,.3)",color:"#3b82f6",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              Seguir comprando
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
