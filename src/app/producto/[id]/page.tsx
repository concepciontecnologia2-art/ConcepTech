"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

const fmt = (n:number) => new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(n);
const WA = process.env.NEXT_PUBLIC_WHATSAPP!;

export default function ProductoPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(()=>{
    fetch(`/api/products/${id}`)
      .then(r=>r.json())
      .then(p=>{ setProduct(p); setLoading(false); })
      .catch(()=>setLoading(false));
  },[id]);

const [images, setImages] = useState<string[]>([]);
const [currentImg, setCurrentImg] = useState(0);

useEffect(()=>{
  if (!product) return;
  fetch(`/api/products/${id}/images`)
    .then(r=>r.json())
    .then(imgs=>{
      const urls = [product.image_url, ...imgs.map((i:any)=>i.image_url)].filter(Boolean);
      setImages(urls);
    });
},[product]);


  const handleWsp = () => {
    if (!product) return;
    const msg = encodeURIComponent(`Hola! Me interesa este producto:\n\n*${product.name}*\nPrecio: ${fmt(Number(product.price_retail))}\nCantidad: ${qty}\n\n¿Tienen stock disponible?`);
    window.open(`https://wa.me/${WA}?text=${msg}`,"_blank");
  };

  const GENERIC = "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&q=80";

  if (loading) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"sans-serif",color:"#666"}}>
      Cargando...
    </div>
  );

  if (!product) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"sans-serif",color:"#666"}}>
      <div style={{textAlign:"center"}}>
        <p style={{fontSize:48,marginBottom:16}}>😕</p>
        <p style={{fontSize:18,fontWeight:600,marginBottom:8}}>Producto no encontrado</p>
        <a href="/" style={{color:"#00B4D8",textDecoration:"none",fontSize:14}}>← Volver a la tienda</a>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#ffffff",fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Syne:wght@700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}`}</style>

      {/* HEADER */}
      <header style={{position:"sticky",top:0,zIndex:50,background:"#ffffff",borderBottom:"1px solid #e5e7eb",padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <a href="/" style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,color:"#1a1a1a",textDecoration:"none"}}>
          <span style={{color:"#00B4D8"}}>Concepción</span> Tecnología
        </a>
        <a href="/" style={{padding:"7px 14px",borderRadius:8,background:"#f3f4f6",border:"1px solid #e5e7eb",color:"#444",fontSize:12,fontWeight:600,textDecoration:"none"}}>
          ← Volver
        </a>
      </header>

      <main style={{maxWidth:600,margin:"0 auto",padding:"32px 20px"}}>
        {/* IMAGEN */}
        <div style={{borderRadius:16,overflow:"hidden",background:"#f8f8f8",marginBottom:24,position:"relative",aspectRatio:"1"}}>
  <img src={images[currentImg]||product.image_url||GENERIC} alt={product.name}
    style={{width:"100%",height:"100%",objectFit:"contain"}}/>
  {images.length>1&&(
    <>
      <button onClick={()=>setCurrentImg(i=>i===0?images.length-1:i-1)}
        style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",width:32,height:32,borderRadius:"50%",background:"rgba(0,0,0,.5)",border:"none",color:"#fff",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
      <button onClick={()=>setCurrentImg(i=>i===images.length-1?0:i+1)}
        style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",width:32,height:32,borderRadius:"50%",background:"rgba(0,0,0,.5)",border:"none",color:"#fff",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
      <div style={{position:"absolute",bottom:8,left:"50%",transform:"translateX(-50%)",display:"flex",gap:6}}>
        {images.map((_,i)=>(
          <button key={i} onClick={()=>setCurrentImg(i)}
            style={{width:i===currentImg?18:6,height:6,borderRadius:10,background:i===currentImg?"#00B4D8":"rgba(255,255,255,.5)",border:"none",cursor:"pointer",padding:0,transition:"all .3s"}}/>
        ))}
      </div>
    </>
  )}
</div>

{/* MINIATURAS */}
{images.length>1&&(
  <div style={{display:"flex",gap:8,marginBottom:24,overflowX:"auto"}}>
    {images.map((url,i)=>(
      <img key={i} src={url} onClick={()=>setCurrentImg(i)}
        style={{width:60,height:60,borderRadius:8,objectFit:"cover",cursor:"pointer",border:`2px solid ${i===currentImg?"#00B4D8":"#e5e7eb"}`,flexShrink:0}}/>
    ))}
  </div>
)}

        {/* INFO */}
        <div style={{marginBottom:8,display:"flex",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:12,color:"#666",background:"#f3f4f6",padding:"3px 10px",borderRadius:20}}>
            {product.category_icon} {product.category_name}
          </span>
          {product.is_offer&&<span style={{fontSize:12,color:"#ef4444",background:"rgba(239,68,68,.1)",padding:"3px 10px",borderRadius:20,fontWeight:600}}>OFERTA</span>}
          {product.is_new&&<span style={{fontSize:12,color:"#00B4D8",background:"rgba(0,180,216,.1)",padding:"3px 10px",borderRadius:20,fontWeight:600}}>NUEVO</span>}
        </div>

        <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(18px,4vw,24px)",fontWeight:800,color:"#1a1a1a",marginBottom:8,lineHeight:1.3}}>
          {product.name}
        </h1>

        {product.description&&(
          <p style={{fontSize:14,color:"#666",lineHeight:1.6,marginBottom:16}}>{product.description}</p>
        )}

        <p style={{fontSize:32,fontWeight:800,color:"#00B4D8",fontFamily:"'Syne',sans-serif",marginBottom:4}}>
          {fmt(Number(product.price_retail))}
        </p>

        <p style={{fontSize:13,fontWeight:700,marginBottom:12,color:
  Number(product.stock_quantity)===0?"#ef4444":
  Number(product.stock_quantity)<=3?"#ef4444":
  Number(product.stock_quantity)<=10?"#f59e0b":"#10b981"}}>
  {Number(product.stock_quantity)===0?"🔴 Sin stock":
   Number(product.stock_quantity)<=3?`🔴 Últimas ${product.stock_quantity} unidades`:
   Number(product.stock_quantity)<=10?`🟡 ${product.stock_quantity} unidades disponibles`:
   `🟢 ${product.stock_quantity} unidades disponibles`}
</p>

        {/* CANTIDAD */}
        {Number(product.stock_quantity)>0&&(
  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
    <label style={{fontSize:12,color:"#666",fontWeight:600}}>CANTIDAD:</label>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <button onClick={()=>setQty(q=>Math.max(1,q-1))}
        style={{width:32,height:32,borderRadius:"50%",border:"1px solid #e5e7eb",background:"#f3f4f6",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
      <input type="number" min="1" value={qty}
        onChange={e=>setQty(Math.max(1,Number(e.target.value)))}
        style={{width:52,textAlign:"center",border:"1px solid #e5e7eb",borderRadius:8,fontSize:16,fontWeight:700,padding:"4px 0",fontFamily:"inherit",color:"#1a1a1a",outline:"none"}}/>
      <button onClick={()=>setQty(q=>q+1)}
        style={{width:32,height:32,borderRadius:"50%",border:"1px solid #e5e7eb",background:"#f3f4f6",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
    </div>
  </div>
)}
        {/* BOTONES */}
<div style={{display:"flex",flexDirection:"column",gap:10}}>
  {Number(product.stock_quantity)>0&&(
    <a href={`/?agregarId=${product.id}&qty=${qty}`}
      style={{width:"100%",padding:14,background:"#00B4D8",border:"none",borderRadius:12,color:"white",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8,textDecoration:"none"}}>
      🛒 Agregar al carrito
    </a>
  )}
  <button onClick={handleWsp}
    style={{width:"100%",padding:14,background:"#25D366",border:"none",borderRadius:12,color:"white",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
    💬 Consultar por WhatsApp
  </button>
  <a href="/"
    style={{width:"100%",padding:14,background:"rgba(0,180,216,.1)",border:"1px solid rgba(0,180,216,.3)",borderRadius:12,color:"#00B4D8",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8,textDecoration:"none"}}>
    ← Ver todos los productos
  </a>
</div>
        {/* COMPARTIR */}
        <div style={{marginTop:24,padding:"16px",background:"#f9fafb",borderRadius:12,border:"1px solid #e5e7eb"}}>
          <p style={{fontSize:12,color:"#666",fontWeight:600,marginBottom:10}}>COMPARTIR PRODUCTO</p>
          <div style={{display:"flex",gap:8}}>
            {[
              ["WhatsApp","#25D366",`https://wa.me/?text=${encodeURIComponent(`🛒 ${product.name} — ${fmt(Number(product.price_retail))}\n${window?.location?.href||""}`)}`],
              ["Facebook","#1877F2",`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(typeof window!=="undefined"?window.location.href:"")}`],
            ].map(([label,color,href])=>(
              <a key={label as string} href={href as string} target="_blank"
                style={{flex:1,padding:"8px",borderRadius:8,background:color as string,color:"#fff",fontSize:12,fontWeight:600,textDecoration:"none",textAlign:"center"}}>
                {label}
              </a>
            ))}
            <button onClick={()=>{navigator.clipboard.writeText(window.location.href).then(()=>alert("✅ Link copiado!"));}}
              style={{flex:1,padding:"8px",borderRadius:8,background:"#f3f4f6",border:"1px solid #e5e7eb",color:"#444",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              📋 Copiar link
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}