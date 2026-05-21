"use client";
import { useState, useEffect } from "react";

const fmt = (n:number) => new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(n);
const fmtDate = (s:string) => new Date(s).toLocaleDateString("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});

const STATUS:Record<string,{label:string;color:string;bg:string}> = {
  pending:  {label:"Pendiente", color:"#f59e0b",bg:"rgba(245,158,11,.12)"},
  confirmed:{label:"Confirmado",color:"#3b82f6",bg:"rgba(59,130,246,.12)"},
  completed:{label:"Completado",color:"#10b981",bg:"rgba(16,185,129,.12)"},
  cancelled:{label:"Cancelado", color:"#ef4444",bg:"rgba(239,68,68,.12)"},
};

const STOCK:Record<string,{color:string;bg:string}> = {
  alto: {color:"#10b981",bg:"rgba(16,185,129,.15)"},
  medio:{color:"#f59e0b",bg:"rgba(245,158,11,.15)"},
  bajo: {color:"#ef4444",bg:"rgba(239,68,68,.15)"},
};

function Login({ onLogin }: { onLogin: ()=>void }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr]   = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (!user||!pass) return;
    setLoading(true); setErr("");
    const res = await fetch("/api/auth/login",{
      method:"POST",
      credentials:"include",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({username:user,password:pass})
    });
    if (res.ok) { onLogin(); }
    else { setErr("Usuario o contraseña incorrectos"); setLoading(false); }
  };

  return (
    <div style={{minHeight:"100vh",background:"#ffffff",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',system-ui,sans-serif",padding:20}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Syne:wght@700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}@keyframes fl{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>
      <div style={{width:"100%",maxWidth:360}}>
        <div style={{textAlign:"center",marginBottom:28,animation:"fl 4s ease-in-out infinite"}}>
          <div style={{width:54,height:54,background:"rgba(0,180,216,.1)",border:"1px solid rgba(0,180,216,.3)",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",fontSize:22}}>🔐</div>
          <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:21,fontWeight:800,color:"#1a1a1a"}}><span style={{color:"#00B4D8"}}>Concepción</span> Tech</h1>
          <p style={{color:"#666",fontSize:12,marginTop:4}}>Panel admin — acceso restringido</p>
        </div>
        <div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:18,padding:26}}>
          <div style={{marginBottom:12}}>
            <label style={{fontSize:11,color:"#444",display:"block",marginBottom:5,fontWeight:600}}>USUARIO</label>
            <input type="text" value={user} onChange={e=>setUser(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} autoFocus
              style={{width:"100%",padding:"12px 14px",background:"#ffffff",border:"1px solid #e5e7eb",borderRadius:9,color:"#1a1a1a",fontSize:14,fontFamily:"inherit",outline:"none"}}/>
          </div>
          <div style={{marginBottom:err?10:16}}>
            <label style={{fontSize:11,color:"#444",display:"block",marginBottom:5,fontWeight:600}}>CONTRASEÑA</label>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}
              style={{width:"100%",padding:"12px 14px",background:"#ffffff",border:"1px solid #e5e7eb",borderRadius:9,color:"#1a1a1a",fontSize:14,fontFamily:"inherit",outline:"none",letterSpacing:".1em"}}/>
          </div>
          {err&&<p style={{color:"#ef4444",fontSize:12,marginBottom:12}}>{err}</p>}
          <button onClick={login} disabled={loading||!user||!pass}
            style={{width:"100%",padding:12,background:"rgba(0,180,216,.15)",border:"1px solid rgba(0,180,216,.4)",borderRadius:9,color:"#00B4D8",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:(loading||!user||!pass)?.6:1}}>
            {loading?"Verificando...":"INGRESAR →"}
          </button>
        </div>
        <p style={{textAlign:"center",fontSize:10,color:"#999",marginTop:14}}>URL no publicada. Solo el propietario tiene acceso.</p>
      </div>
    </div>
  );
}

function PriceAdjuster({ categories, products, onAdjust }: { categories:any[]; products:any[]; onAdjust:(ids:number[],pct:number)=>void }) {
  const [mode, setMode]         = useState<"category"|"product">("category");
  const [catId, setCatId]       = useState("all");
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState<number|null>(null);
  const [pct, setPct]           = useState("");
  const [loading, setLoading]   = useState(false);

  const filtered = (products||[]).filter((p:any)=>
    p.name.toLowerCase().includes(search.toLowerCase())
  ).slice(0,8);

  const handle = async() => {
    const n = Number(pct);
    if (!pct||isNaN(n)||n===0) { alert("Ingresá un porcentaje válido"); return; }
    let ids: number[] = [];
    let label = "";
    if (mode==="category") {
      ids = catId==="all" ? products.map((p:any)=>p.id) : products.filter((p:any)=>String(p.category_id)===catId).map((p:any)=>p.id);
      label = catId==="all" ? "todas las categorías" : categories.find((c:any)=>c.id===Number(catId))?.name;
    } else {
      if (!selected) { alert("Seleccioná un producto"); return; }
      ids = [selected];
      label = products.find((p:any)=>p.id===selected)?.name;
    }
    if (!confirm(`¿Ajustar precios ${n>0?"+":""}${n}% en ${label}?`)) return;
    setLoading(true);
    await onAdjust(ids, n);
    setPct(""); setSearch(""); setSelected(null);
    setLoading(false);
  };

  return (
    <div style={{padding:"14px 16px",background:"rgba(0,180,216,.06)",border:"1px solid rgba(0,180,216,.15)",borderRadius:10,marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
        <span style={{fontSize:12,fontWeight:600,color:"#00B4D8"}}>{"⚡ Ajustar precios por %"}</span>
        <div style={{display:"flex",gap:6}}>
          {[["category","Por categoría"],["product","Por producto"]].map(([m,l])=>(
            <button key={m} onClick={()=>setMode(m as "category"|"product")}
              style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${mode===m?"rgba(0,180,216,.5)":"#e5e7eb"}`,background:mode===m?"rgba(0,180,216,.12)":"#ffffff",color:mode===m?"#00B4D8":"#666",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div style={{display:"flex",gap:10,alignItems:"flex-start",flexWrap:"wrap"}}>
        {mode==="category" ? (
          <select value={catId} onChange={e=>setCatId(e.target.value)}
            style={{padding:"7px 10px",background:"#ffffff",border:"1px solid #e5e7eb",borderRadius:7,color:"#1a1a1a",fontSize:12,outline:"none",fontFamily:"inherit"}}>
            <option value="all">Todas las categorías</option>
            {categories.map((c:any)=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        ) : (
          <div style={{position:"relative",minWidth:220}}>
            <input value={search} onChange={e=>{setSearch(e.target.value);setSelected(null);}}
              placeholder="Buscar producto..."
              style={{width:"100%",padding:"7px 10px",background:"#ffffff",border:"1px solid #e5e7eb",borderRadius:7,color:"#1a1a1a",fontSize:12,outline:"none",fontFamily:"inherit"}}/>
            {search&&!selected&&filtered.length>0&&(
              <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#ffffff",border:"1px solid #e5e7eb",borderRadius:8,zIndex:50,maxHeight:200,overflowY:"auto",boxShadow:"0 4px 12px rgba(0,0,0,.1)"}}>
                {filtered.map((p:any)=>(
                  <div key={p.id} onClick={()=>{setSelected(p.id);setSearch(p.name);}}
                    style={{padding:"8px 12px",cursor:"pointer",fontSize:12,color:"#1a1a1a",borderBottom:"1px solid #f3f4f6"}}
                    onMouseEnter={e=>{e.currentTarget.style.background="#f9fafb"}}
                    onMouseLeave={e=>{e.currentTarget.style.background="#ffffff"}}>
                    {p.name} — <span style={{color:"#00B4D8"}}>${Number(p.price_retail).toLocaleString("es-AR")}</span>
                  </div>
                ))}
              </div>
            )}
            {selected&&<p style={{fontSize:10,color:"#00B4D8",marginTop:3}}>✓ Producto seleccionado</p>}
          </div>
        )}
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <input type="number" value={pct} onChange={e=>setPct(e.target.value)} placeholder="Ej: 10 o -5"
            style={{width:100,padding:"7px 10px",background:"#ffffff",border:"1px solid #e5e7eb",borderRadius:7,color:"#1a1a1a",fontSize:12,outline:"none",fontFamily:"inherit"}}/>
          <span style={{fontSize:11,color:"#666"}}>%</span>
        </div>
        <button onClick={handle} disabled={loading}
          style={{padding:"7px 14px",borderRadius:7,background:"rgba(0,180,216,.12)",border:"1px solid rgba(0,180,216,.25)",color:"#00B4D8",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",opacity:loading?.6:1}}>
          {loading?"Aplicando...":"Aplicar"}
        </button>
      </div>
      <p style={{fontSize:10,color:"#666",marginTop:8}}>{"Positivo sube precio, negativo baja. Ej: 10 sube 10%, -5 baja 5%"}</p>
    </div>
  );
}

function Panel({ onLogout }: { onLogout:()=>void }) {
  const [tab, setTab]               = useState<"dashboard"|"orders"|"products">("dashboard");
  const [orders, setOrders]         = useState<any[]>([]);
  const [products, setProducts]     = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [expandedOrder, setExpandedOrder]     = useState<number|null>(null);
  const [catFilter, setCatFilter]             = useState("all");
  const [searchProd, setSearchProd]           = useState("");
  const [editingProduct, setEditingProduct]   = useState<any|null>(null);
  const [addingProduct, setAddingProduct]     = useState(false);
  const [uploadingId, setUploadingId]         = useState<number|null>(null);
  const [extraImages, setExtraImages]         = useState<any[]>([]);
  const [loadingImages, setLoadingImages]     = useState(false);
  const [importing, setImporting]             = useState(false);
  const [newProduct, setNewProduct] = useState({
    name:"", description:"", category_id:"", price_retail:"", price_wholesale:"",
    stock_level:"alto", stock_quantity:0, available:true, featured:false, is_offer:false, is_new:false, image_url:""
  });

 useEffect(()=>{
  const loadData = () => {
    Promise.all([
      fetch("/api/orders",{credentials:"include"}).then(r=>r.ok?r.json():Promise.resolve([])).catch(()=>[]),
      fetch("/api/products",{credentials:"include"}).then(r=>r.ok?r.json():Promise.resolve([])).catch(()=>[]),
      fetch("/api/categories",{credentials:"include"}).then(r=>r.ok?r.json():Promise.resolve([])).catch(()=>[]),
    ]).then(([o,p,c])=>{
      if(Array.isArray(o)) setOrders(o);
      if(Array.isArray(p)) setProducts(p);
      if(Array.isArray(c)) setCategories(c);
      setLoading(false);
    }).catch(()=>setLoading(false));
  };

  const loadOrders = () => {
    fetch("/api/orders",{credentials:"include"}).then(r=>r.ok?r.json():[]).then(o=>{
      if(Array.isArray(o)) setOrders(o);
    }).catch(()=>{});
  };

  loadData();
  const intervalOrders   = setInterval(loadOrders, 30000);
  const intervalProducts = setInterval(loadData, 1800000);
  return ()=>{
    clearInterval(intervalOrders);
    clearInterval(intervalProducts);
  };
},[]);

  const patchOrder = async(id:number,data:any)=>{
    await fetch(`/api/orders/${id}`,{method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
    setOrders(prev=>prev.map(o=>o.id===id?{...o,...data}:o));
  };

  const patchProduct = async(id:number,data:any)=>{
    const res = await fetch(`/api/products/${id}`,{method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
    if(res.ok) setProducts(prev=>prev.map(p=>p.id===id?{...p,...data}:p));
  };

  const saveEditProduct = async()=>{
    if(!editingProduct) return;
    await fetch(`/api/products/${editingProduct.id}`,{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(editingProduct)});
    setProducts(prev=>prev.map(p=>p.id===editingProduct.id?editingProduct:p));
    setEditingProduct(null);
  };

  const saveNewProduct = async()=>{
    if(!newProduct.name||!newProduct.category_id||!newProduct.price_retail||!newProduct.price_wholesale){
      alert("Completá los campos obligatorios"); return;
    }
    const res = await fetch("/api/products",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      ...newProduct,
      category_id:Number(newProduct.category_id),
      price_retail:Number(newProduct.price_retail),
      price_wholesale:Number(newProduct.price_wholesale),
      stock_quantity:Number(newProduct.stock_quantity),
    })});
    const p = await res.json();
    const cat = categories.find((c:any)=>c.id===Number(newProduct.category_id));
    setProducts(prev=>[...prev,{...p,category_name:cat?.name||""}]);
    setAddingProduct(false);
    setNewProduct({name:"",description:"",category_id:"",price_retail:"",price_wholesale:"",stock_level:"alto",stock_quantity:0,available:true,featured:false,is_offer:false,is_new:false,image_url:""});
  };

  const deleteProduct = async(id:number)=>{
    if(!confirm("¿Eliminar este producto?")) return;
    await fetch(`/api/products/${id}`,{method:"DELETE",credentials:"include"});
    setProducts(prev=>prev.filter(p=>p.id!==id));
  };

  const uploadPhoto = async(id:number, file:File)=>{
  setUploadingId(id);
  const fd = new FormData();
  fd.append("file", file);
  try {
    const res = await fetch("/api/upload",{method:"POST",credentials:"include",body:fd});
    const json = await res.json();
    if (json.url) {
      await patchProduct(id,{image_url:json.url});
      setProducts(prev=>prev.map(p=>p.id===id?{...p,image_url:json.url}:p));
    }
  } catch(e){ alert("Error al subir la foto"); }
  setUploadingId(null);
};

  const loadExtraImages = async(productId:number)=>{
    setLoadingImages(true);
    const res = await fetch(`/api/products/${productId}/images`,{credentials:"include"});
    const imgs = await res.json();
    setExtraImages(Array.isArray(imgs)?imgs:[]);
    setLoadingImages(false);
  };

  const uploadExtraPhoto = async(productId:number, file:File)=>{
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload",{method:"POST",credentials:"include",body:fd});
    const json = await res.json();
    if (json.url) {
      await fetch(`/api/products/${productId}/images`,{
        method:"POST",credentials:"include",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({image_url:json.url})
      });
      await loadExtraImages(productId);
    }
  };

  const deleteExtraPhoto = async(productId:number, imageId:number)=>{
    await fetch(`/api/products/${productId}/images`,{
      method:"DELETE",credentials:"include",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({image_id:imageId})
    });
    setExtraImages(prev=>prev.filter(i=>i.id!==imageId));
  };

 const exportExcel = () => {
  const XLSX = require("xlsx");
  const data = products.map((p:any)=>({
    CODIGO:      "",
    DETALLE:     p.name,
    FAMILIA:     p.category_name||"",
    PROVEEDOR:   "",
    MARCA:       "",
    "P.COSTO":   "",
    "P.VENTA":   Number(p.price_wholesale),
    IVA:         21,
    "P.LISTA2":  Number(p.price_retail),
    "P.LISTA3":  "",
    "P.MAYOR":   Number(p.price_wholesale),
    STOCK:       p.stock_quantity??0,
    "STOCK MIN": "",
    "STOCK IDEAL": "",
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Productos");
  XLSX.writeFile(wb, `listado-${new Date().toLocaleDateString("es-AR").replace(/\//g,"-")}.xlsx`);
};
 const importExcel = async(file:File)=>{
  setImporting(true);
  const XLSX = require("xlsx");
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws) as any[];

  let updated = 0; let created = 0; let err = 0;

  const limpiarNombre = (s:string) =>
  s.toString().trim()
   .replace(/\s+/g, " ")
   .trim()
   .toUpperCase();
  const prodMap = new Map<string, any>();
  products.forEach((p:any) => prodMap.set(limpiarNombre(p.name), p));

  const familiaMap:Record<string,string> = {
    "AURICULARES":"Celulares y Accesorios","ACCESORIOS":"Celulares y Accesorios",
    "TPU FUNDAS Y VIDRIOS":"Celulares y Accesorios","CELULARES":"Celulares y Accesorios",
    "CABLES":"Cargadores","CARGADORES":"Cargadores",
    "COMPUTACION":"Computación y Gamer","JUEGOS":"Computación y Gamer","MEMORIA Y PENDRIVE":"Computación y Gamer",
    "HOGAR":"Electro-Hogar","ELECTRICIDAD":"Electro-Hogar",
    "LUCES":"Iluminación","PARLANTES":"Sonido",
    "PERFUMES":"Perfumería","SAPHIRUS":"Perfumería","SAHUMERIOS":"Perfumería",
    "MODULOS":"Repuestos","BATERIAS":"Repuestos","PLACA DE CARGA":"Repuestos",
    "PIN DE CARGA":"Repuestos","TAPA TRASERA":"Repuestos",
    "HERRAMIENTAS":"Varios","VARIOS":"Varios","BELLEZA":"Varios",
    "CALCULADORAS":"Varios","RELOJES":"Varios","PILAS":"Varios",
  };

  const inferirCategoria = (nombre:string, familia:string) => {
    if (familiaMap[familia]) return familiaMap[familia];
    if (nombre.includes("MODULO")) return "Repuestos";
    if (nombre.includes("BATERIA")) return "Repuestos";
    if (nombre.includes("PLACA DE CARGA")) return "Repuestos";
    if (nombre.includes("PIN DE CARGA")) return "Repuestos";
    if (nombre.includes("TAPA TRASERA")) return "Repuestos";
    if (nombre.includes("AURICULAR")) return "Celulares y Accesorios";
    if (nombre.includes("FUNDA")) return "Celulares y Accesorios";
    if (nombre.includes("VIDRIO")) return "Celulares y Accesorios";
    if (nombre.includes("CABLE")) return "Cargadores";
    if (nombre.includes("CARGADOR")) return "Cargadores";
    if (nombre.includes("CABEZAL")) return "Cargadores";
    if (nombre.includes("PARLANTE")) return "Sonido";
    if (nombre.includes("MICROFONO")) return "Sonido";
    if (nombre.includes("PERFUME")) return "Perfumería";
    if (nombre.includes("SAPHIRUS")) return "Perfumería";
    if (nombre.includes("SAHUMERIO")) return "Perfumería";
    if (nombre.includes("LUZ")) return "Iluminación";
    if (nombre.includes("FOCO")) return "Iluminación";
    if (nombre.includes("LINTERNA")) return "Iluminación";
    if (nombre.includes("LAMPARA")) return "Iluminación";
    if (nombre.includes("MOUSE")) return "Computación y Gamer";
    if (nombre.includes("TECLADO")) return "Computación y Gamer";
    if (nombre.includes("JOYSTICK")) return "Computación y Gamer";
    if (nombre.includes("CONSOLA")) return "Computación y Gamer";
    if (nombre.includes("ANAFE")) return "Electro-Hogar";
    if (nombre.includes("VENTILADOR")) return "Electro-Hogar";
    if (nombre.includes("BALANZA")) return "Electro-Hogar";
    if (nombre.includes("PILA")) return "Varios";
    if (nombre.includes("RELOJ")) return "Varios";
    if (nombre.includes("CANDADO")) return "Varios";
    return "Varios";
  };

  for (const row of rows) {
    const rawNombre = (row.DETALLE || row.NOMBRE || "").toString();
    const nombre = limpiarNombre(rawNombre);
    if (!nombre) continue;

    const precioMin = Number(row["P.LISTA2"] || row.PRECIO_MINORISTA || 0);
    const precioMay = Number(row["P.VENTA"]  || row.PRECIO_MAYORISTA || 0);
    const stock     = Number(row.STOCK ?? row.stock ?? 0);
    const familia   = (row.FAMILIA || row.CATEGORIA || "").toString().trim().toUpperCase();

    const prod = prodMap.get(nombre);

    if (prod) {
      try {
        await fetch(`/api/products/${prod.id}`,{
          method:"PATCH",
          credentials:"include",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            price_retail:    precioMin > 0 ? precioMin : prod.price_retail,
            price_wholesale: precioMay > 0 ? precioMay : prod.price_wholesale,
            stock_quantity:  stock,
            stock_level:     stock > 10 ? "alto" : stock > 3 ? "medio" : "bajo",
            available:       stock > 0,
          })
        });
        updated++;
      } catch(e){ err++; }
    } else {
      const catName = inferirCategoria(nombre, familia);
      const cat = categories.find((c:any)=>c.name===catName) || categories.find((c:any)=>c.name==="Varios");
if (!cat) { err++; continue; }
      try {
        const res = await fetch("/api/products",{
          method:"POST",
          credentials:"include",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            name:            nombre,
            description:     "",
            category_id:     cat.id,
            price_retail:    precioMin,
            price_wholesale: precioMay,
            stock_quantity:  stock,
            stock_level:     stock > 10 ? "alto" : stock > 3 ? "medio" : "bajo",
            available:       stock > 0,
            featured:        false,
            is_offer:        false,
            is_new:          false,
            image_url:       null,
          })
        });
        if (res.ok) {
          const newProd = await res.json();
          prodMap.set(nombre, newProd);
          created++;
        } else { err++; }
      } catch(e){ err++; }
    }
  }

  const updatedProds = await fetch("/api/products",{credentials:"include"}).then(r=>r.json());
  setProducts(Array.isArray(updatedProds)?updatedProds:[]);
  setImporting(false);
  alert(`✅ ${updated} actualizados · ✨ ${created} creados${err>0?` · ❌ ${err} errores`:""}`);
};
  const downloadFact = (order:any) => {
    const lines = order.items?.map((i:any)=>`  • ${i.qty}x ${i.name}: ${fmt(i.qty*i.price)}`).join("\n")||"";
    const txt =
`══════════════════════════════════════
     CONCEPCIÓN TECNOLOGÍA
  Independencia 450, Concepción, Tucumán
  L-V 9-12 y 16-20hs
══════════════════════════════════════
  FACTURA N° ${String(order.id).padStart(6,"0")}
  Fecha: ${fmtDate(order.created_at)}
══════════════════════════════════════
  CLIENTE
  Nombre: ${order.customer_name}
  Teléfono: ${order.phone}
  Entrega: ${order.delivery_type==="pickup"?"Retira en local":"Envío a: "+order.address}
  Tipo: ${order.sale_type==="retail"?"Minorista":"Mayorista"}
══════════════════════════════════════
  DETALLE
${lines}
══════════════════════════════════════
  TOTAL: ${fmt(Number(order.total))}
  Estado pago: ${order.paid?"✓ PAGADO":"⏳ PENDIENTE"}
══════════════════════════════════════
  ¡Gracias por su compra!`;
    const blob = new Blob([txt],{type:"text/plain;charset=utf-8"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `factura-${String(order.id).padStart(6,"0")}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const totalPaid    = orders.filter(o=>o.paid).reduce((s,o)=>s+Number(o.total),0);
  const totalPending = orders.filter(o=>!o.paid&&o.status!=="cancelled").reduce((s,o)=>s+Number(o.total),0);
  const pendingCount = orders.filter(o=>o.status==="pending").length;
  const uniqueCats   = [...new Set(products.map((p:any)=>p.category_name))];
  const filteredProds= products
    .filter((p:any)=>catFilter==="all"||p.category_name===catFilter)
    .filter((p:any)=>!searchProd||p.name.toLowerCase().includes(searchProd.toLowerCase()));

  const card = {background:"#ffffff",border:"1px solid #e5e7eb",borderRadius:13,padding:"16px 18px"};
  const btn = (v:string) => {
    const base = {padding:"6px 12px",borderRadius:7,fontSize:12,fontWeight:600 as const,cursor:"pointer" as const,fontFamily:"inherit"};
    if (v==="cyan")  return {...base,background:"rgba(0,180,216,.1)",  color:"#00B4D8",border:"1px solid rgba(0,180,216,.3)"};
    if (v==="red")   return {...base,background:"rgba(239,68,68,.1)",  color:"#ef4444",border:"1px solid rgba(239,68,68,.3)"};
    if (v==="green") return {...base,background:"rgba(16,185,129,.1)", color:"#10b981",border:"1px solid rgba(16,185,129,.3)"};
    if (v==="amber") return {...base,background:"rgba(245,158,11,.1)", color:"#f59e0b",border:"1px solid rgba(245,158,11,.3)"};
    return {...base,background:"#f3f4f6",color:"#444",border:"1px solid #e5e7eb"};
  };
  const inp = {width:"100%",padding:"10px 12px",background:"#ffffff",border:"1px solid #e5e7eb",borderRadius:8,color:"#1a1a1a",fontSize:13,fontFamily:"inherit",outline:"none"};

  if(loading) return <div style={{minHeight:"100vh",background:"#f2f4f7",display:"flex",alignItems:"center",justifyContent:"center",color:"#444",fontFamily:"inherit"}}>Cargando...</div>;

  return (
    <div style={{minHeight:"100vh",background:"#f2f4f7",color:"#1a1a1a",fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#f3f4f6}::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:4px}
        .pill{display:inline-block;padding:3px 9px;border-radius:6px;font-size:11px;font-weight:600}
        select{padding:6px 9px;background:#ffffff;border:1px solid #e5e7eb;border-radius:7px;color:#1a1a1a;font-size:12px;outline:none;cursor:pointer;font-family:inherit}
        select option{background:#ffffff;color:#1a1a1a}
        .mo{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center;padding:0}
        @media(min-width:640px){.mo{align-items:center;padding:16px}}
        .mb{background:#ffffff;border:1px solid #e5e7eb;border-radius:20px 20px 0 0;padding:24px;width:100%;max-width:480px;max-height:92vh;overflow-y:auto}
        @media(min-width:640px){.mb{border-radius:18px}}
        .toggle{width:34px;height:19px;border-radius:10px;border:none;cursor:pointer;position:relative;transition:background .2s;flex-shrink:0}
        .thumb{position:absolute;width:13px;height:13px;background:white;border-radius:50%;top:3px;transition:left .2s}
        .admin-nav{display:flex;background:#ffffff;border-bottom:1px solid #e5e7eb;padding:0 16px;position:sticky;top:0;z-index:50;overflow-x:auto;gap:0}
        .admin-nav::-webkit-scrollbar{display:none}
        .nav-btn{padding:14px 16px;background:none;border:none;border-bottom:2px solid transparent;color:#666;cursor:pointer;font-size:13px;font-weight:500;font-family:inherit;white-space:nowrap;transition:all .2s;display:flex;align-items:center;gap:6px}
        .nav-btn.active{color:#00B4D8;border-bottom-color:#00B4D8}
        .admin-content{padding:16px;max-width:100%;overflow-x:hidden}
        @media(min-width:768px){.admin-content{padding:24px}}
      `}</style>

      {/* TOPBAR */}
      <div style={{background:"#ffffff",borderBottom:"1px solid #e5e7eb",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <p style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:800,color:"#1a1a1a"}}><span style={{color:"#00B4D8"}}>Conc.</span> Tech <span style={{fontSize:11,color:"#999",fontWeight:400}}>Admin</span></p>
        <button onClick={onLogout} style={{padding:"6px 12px",borderRadius:7,background:"#f3f4f6",border:"1px solid #e5e7eb",color:"#444",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Salir</button>
      </div>

      {/* NAV TABS */}
      <div className="admin-nav">
        {([["dashboard","◈","Dashboard"],["orders","📋","Pedidos"],["products","📦","Productos"]] as const).map(([id,icon,label])=>(
          <button key={id} className={`nav-btn ${tab===id?"active":""}`} onClick={()=>setTab(id)}>
            {icon} {label}
            {id==="orders"&&pendingCount>0&&<span style={{background:"#f59e0b",color:"#fff",borderRadius:20,padding:"1px 6px",fontSize:10,fontWeight:800}}>{pendingCount}</span>}
          </button>
        ))}
      </div>

      <div className="admin-content">

        {/* DASHBOARD */}
        {tab==="dashboard"&&(
          <div>
            <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,marginBottom:16,color:"#1a1a1a"}}>Dashboard</h2>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:20}}>
              {[
                {label:"Cobrado",       value:fmt(totalPaid),    icon:"💰",color:"#10b981"},
                {label:"Por cobrar",    value:fmt(totalPending), icon:"⏳",color:"#f59e0b"},
                {label:"Sin confirmar", value:pendingCount,      icon:"📬",color:"#3b82f6"},
                {label:"Total pedidos", value:orders.length,     icon:"📋",color:"#a78bfa"},
              ].map((m,i)=>(
                <div key={i} style={card}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <p style={{fontSize:10,color:"#666",fontWeight:600}}>{m.label.toUpperCase()}</p>
                    <span>{m.icon}</span>
                  </div>
                  <p style={{fontSize:"clamp(16px,4vw,22px)",fontWeight:800,color:m.color,fontFamily:"'Syne',sans-serif"}}>{m.value}</p>
                </div>
              ))}
            </div>
            <div style={card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:13}}>
                <h3 style={{fontSize:14,fontWeight:600,color:"#1a1a1a"}}>Últimos pedidos</h3>
                <button style={btn("cyan")} onClick={()=>setTab("orders")}>Ver todos →</button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {orders.slice(0,5).map((o:any)=>(
                  <div key={o.id} style={{padding:"10px 12px",background:"#f9fafb",borderRadius:10,border:"1px solid #e5e7eb"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                      <p style={{fontWeight:600,color:"#1a1a1a",fontSize:13}}>{o.customer_name}</p>
                      <p style={{color:"#00B4D8",fontWeight:700,fontSize:14}}>{fmt(Number(o.total))}</p>
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                      <span className="pill" style={{background:STATUS[o.status]?.bg,color:STATUS[o.status]?.color}}>{STATUS[o.status]?.label}</span>
                      <span className="pill" style={{background:o.paid?"rgba(16,185,129,.12)":"rgba(245,158,11,.12)",color:o.paid?"#10b981":"#f59e0b"}}>{o.paid?"Pagado":"Pendiente"}</span>
                      <span style={{fontSize:11,color:"#666"}}>{fmtDate(o.created_at)}</span>
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      <button style={btn(o.status==="completed"?"green":"cyan")} onClick={()=>patchOrder(o.id,{status:"completed"})}>✓ Completado</button>
                      <button style={btn(o.paid?"amber":"green")} onClick={()=>patchOrder(o.id,{paid:!o.paid})}>{o.paid?"Sin pagar":"💰 Pagado"}</button>
                      <button style={btn("default")} onClick={()=>downloadFact(o)}>📄 Factura</button>
                      <button style={btn("default")} onClick={()=>{
                        const lines = o.items?.map((i:any)=>`• ${i.qty}x ${i.name}: ${fmt(i.qty*i.price)}`).join("\n")||"";
                        const msg = encodeURIComponent(`📄 *Factura Concepción Tecnología*\n\n👤 ${o.customer_name}\n📦 ${o.delivery_type==="pickup"?"Retira en local":`Envío a: ${o.address}`}\n\n${lines}\n\n*Total: ${fmt(Number(o.total))}*\n✅ Estado: ${STATUS[o.status]?.label}`);
                        window.open(`https://wa.me/549${o.phone}?text=${msg}`,"_blank");
                      }}>💬 Factura WSP</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {products.filter((p:any)=>p.stock_level==="bajo").length>0&&(
              <div style={{...card,marginTop:12}}>
                <h3 style={{fontSize:14,fontWeight:600,marginBottom:12,color:"#1a1a1a"}}>🔴 Stock bajo</h3>
                {products.filter((p:any)=>p.stock_level==="bajo").map((p:any)=>(
                  <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 11px",background:"rgba(239,68,68,.05)",border:"1px solid rgba(239,68,68,.15)",borderRadius:8,marginBottom:7}}>
                    <div style={{flex:1}}>
                      <p style={{fontSize:13,fontWeight:500,color:"#1a1a1a"}}>{p.name}</p>
                      <p style={{fontSize:11,color:"#666"}}>{p.category_name} · {p.stock_quantity??0} u.</p>
                    </div>
                    <span style={{color:"#ef4444",fontWeight:700,fontSize:11,padding:"2px 8px",background:"rgba(239,68,68,.15)",borderRadius:6}}>STOCK BAJO</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PEDIDOS */}
        {tab==="orders"&&(
          <div>
            <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,marginBottom:16,color:"#1a1a1a"}}>Pedidos</h2>
            <div style={{display:"flex",flexDirection:"column",gap:9}}>
              {orders.length===0&&<p style={{color:"#666",fontSize:14}}>No hay pedidos aún.</p>}
              {orders.map((order:any)=>(
                <div key={order.id} style={card}>
                  <div style={{cursor:"pointer"}} onClick={()=>setExpandedOrder(expandedOrder===order.id?null:order.id)}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                      <div>
                        <p style={{fontWeight:600,fontSize:14,color:"#1a1a1a",marginBottom:4}}>{order.customer_name}</p>
                        <p style={{fontSize:12,color:"#666"}}>{"📞 "}{order.phone}</p>
                        <p style={{fontSize:11,color:"#666"}}>{order.delivery_type==="pickup"?"🏪 Retira":"🚗 Envío"} · {order.sale_type==="retail"?"Minorista":"Mayorista"}</p>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <p style={{fontSize:18,fontWeight:800,color:"#00B4D8"}}>{fmt(Number(order.total))}</p>
                        <p style={{fontSize:10,color:"#666"}}>{fmtDate(order.created_at)}</p>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      <span className="pill" style={{background:STATUS[order.status]?.bg,color:STATUS[order.status]?.color}}>{STATUS[order.status]?.label}</span>
                      <span className="pill" style={{background:order.paid?"rgba(16,185,129,.12)":"rgba(245,158,11,.12)",color:order.paid?"#10b981":"#f59e0b"}}>{order.paid?"💰 Pagado":"⏳ Sin pagar"}</span>
                    </div>
                  </div>
                  {expandedOrder===order.id&&(
                    <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #e5e7eb"}} onClick={e=>e.stopPropagation()}>
                      {order.items?.map((item:any,i:number)=>(
                        <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #f3f4f6",fontSize:13}}>
                          <span style={{color:"#1a1a1a"}}>{item.qty}× {item.name}</span>
                          <span style={{color:"#00B4D8",fontWeight:600}}>{fmt(item.qty*item.price)}</span>
                        </div>
                      ))}
                      {order.address&&<p style={{fontSize:12,color:"#666",marginTop:9}}>{"📍 "}{order.address}</p>}
                      <div style={{marginTop:12}}>
                        <p style={{fontSize:11,color:"#666",fontWeight:600,marginBottom:8}}>CAMBIAR ESTADO:</p>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                          {["pending","confirmed","completed","cancelled"].map(s=>(
                            <button key={s} style={{...btn(s==="completed"?"green":s==="cancelled"?"red":s==="confirmed"?"cyan":"amber"),opacity:order.status===s?1:.5}}
                              onClick={()=>patchOrder(order.id,{status:s})}>
                              {STATUS[s].label}
                            </button>
                          ))}
                        </div>
                        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                          <button style={btn(order.paid?"amber":"green")} onClick={()=>patchOrder(order.id,{paid:!order.paid})}>
                            {order.paid?"Marcar sin pagar":"✓ Marcar pagado"}
                          </button>
                          <button style={btn("default")} onClick={()=>downloadFact(order)}>
                            {"📄 Factura"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PRODUCTOS */}
        {tab==="products"&&(
          <div>
            <PriceAdjuster
              categories={categories}
              products={products}
              onAdjust={async(ids,pct)=>{
                for (const id of ids) {
                  const p = products.find((p:any)=>p.id===id);
                  if(!p) continue;
                  const newRetail    = Math.round(Number(p.price_retail)    * (1+pct/100));
                  const newWholesale = Math.round(Number(p.price_wholesale) * (1+pct/100));
                  await fetch(`/api/products/${id}`,{method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({price_retail:newRetail,price_wholesale:newWholesale})});
                }
                const updated = await fetch("/api/products",{credentials:"include"}).then(r=>r.json());
                setProducts(Array.isArray(updated)?updated:[]);
                alert(`Precios actualizados ${pct>0?"+":""}${pct}%`);
              }}
            />
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
              <div>
                <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,color:"#1a1a1a"}}>Productos</h2>
                <p style={{color:"#666",fontSize:12}}>{products.length} productos · {products.filter((p:any)=>p.available).length} disponibles</p>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button style={{...btn("default"),padding:"9px 16px",fontSize:13}} onClick={exportExcel}>
                  📊 Exportar
                </button>
                <label style={{...btn("cyan"),padding:"9px 16px",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                  {importing?"⏳":"📥 Importar"}
                  <input type="file" accept=".xlsx,.xls" style={{display:"none"}}
                    onChange={e=>{const f=e.target.files?.[0]; if(f) importExcel(f); e.target.value="";}}
                    disabled={importing}/>
                </label>
                <button style={{...btn("green"),padding:"9px 16px",fontSize:13}} onClick={()=>setAddingProduct(true)}>+ Agregar</button>
              </div>
            </div>

            {/* BÚSQUEDA Y FILTROS */}
            <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
              <div style={{position:"relative",flex:1,minWidth:180}}>
                <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13}}>🔍</span>
                <input value={searchProd} onChange={e=>setSearchProd(e.target.value)} placeholder="Buscar producto..."
                  style={{width:"100%",padding:"8px 10px 8px 30px",background:"#ffffff",border:"1px solid #e5e7eb",borderRadius:8,fontSize:12,outline:"none",fontFamily:"inherit",color:"#1a1a1a"}}/>
              </div>
            </div>
            <div style={{display:"flex",gap:6,marginBottom:12,overflowX:"auto",paddingBottom:4}}>
              {["all",...uniqueCats].map(c=>(
                <button key={c as string} onClick={()=>setCatFilter(c as string)}
                  style={{padding:"5px 12px",borderRadius:7,border:`1px solid ${catFilter===c?"rgba(0,180,216,.4)":"#e5e7eb"}`,background:catFilter===c?"rgba(0,180,216,.1)":"#ffffff",color:catFilter===c?"#00B4D8":"#444",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0}}>
                  {c==="all"?"Todos":c as string}
                </button>
              ))}
            </div>

            {/* LISTA DE PRODUCTOS */}
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {filteredProds.map((p:any)=>(
                <div key={p.id} style={{...card,display:"flex",gap:10,alignItems:"center"}}>
                  {p.image_url&&<img src={p.image_url} style={{width:48,height:48,borderRadius:8,objectFit:"cover",flexShrink:0}}/>}
                  <div style={{flex:1,minWidth:0}}>
                    <select value={p.category_id} onChange={e=>patchProduct(p.id,{category_id:Number(e.target.value)})}
                      style={{fontSize:11,color:"#666",background:"transparent",border:"none",outline:"none",cursor:"pointer",fontFamily:"inherit",padding:0,marginTop:2}}>
                      {categories.map((c:any)=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                    </select>
                    <p style={{fontWeight:600,fontSize:12,color:"#1a1a1a",lineHeight:1.3,wordBreak:"break-word"}}>{p.name}</p>
                    <div style={{display:"flex",gap:8,marginTop:4,alignItems:"center",flexWrap:"wrap"}}>
                      <span style={{fontSize:12,fontWeight:700,color:"#00B4D8"}}>{fmt(Number(p.price_retail))}</span>
                      <span style={{fontSize:11,color:"#3b82f6"}}>{fmt(Number(p.price_wholesale))}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginTop:4}}>
                      <select value={p.stock_level} onChange={e=>patchProduct(p.id,{stock_level:e.target.value})}
                        style={{color:STOCK[p.stock_level]?.color,background:STOCK[p.stock_level]?.bg,border:`1px solid ${STOCK[p.stock_level]?.color}44`,fontWeight:700,fontSize:10,borderRadius:6,padding:"2px 6px"}}>
                        <option value="alto">🟢 Alto</option>
                        <option value="medio">🟡 Medio</option>
                        <option value="bajo">🔴 Bajo</option>
                      </select>
                      <span style={{fontSize:11,color:"#666",fontWeight:600}}>{p.stock_quantity??0} u.</span>
                      <input type="number" min="0" value={p.stock_quantity??0}
  onChange={e=>setProducts(prev=>prev.map(pp=>pp.id===p.id?{...pp,stock_quantity:Number(e.target.value)}:pp))}
    onBlur={e=>{
  const qty = Number(e.target.value);
  patchProduct(p.id,{
    stock_quantity: qty,
    stock_level: qty > 10 ? "alto" : qty > 3 ? "medio" : "bajo",
    available: qty > 0,
  });
}} 
 style={{width:52,padding:"2px 6px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:11,color:"#1a1a1a",fontFamily:"inherit",outline:"none"}}/>
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0,alignItems:"center"}}>
                    <button className="toggle" style={{background:p.available?"rgba(16,185,129,.6)":"#e5e7eb"}} onClick={()=>patchProduct(p.id,{available:!p.available})}>
                      <div className="thumb" style={{left:p.available?18:3}}/>
                    </button>
                    <label style={{...btn("green"),display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",minWidth:32,minHeight:28}}>
  <span>{uploadingId===p.id?"⏳":"📷"}</span>
  <input type="file" accept="image/*" style={{display:"none"}}
    onChange={async e=>{
      const f=e.target.files?.[0];
      if(!f) return;
      setUploadingId(p.id);
      const fd = new FormData();
      fd.append("file", f);
      try {
        const res = await fetch("/api/upload",{method:"POST",credentials:"include",body:fd});
        const json = await res.json();
        if (json.url) {
          await fetch(`/api/products/${p.id}`,{method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({image_url:json.url})});
          setProducts(prev=>prev.map(pp=>pp.id===p.id?{...pp,image_url:json.url}:pp));
        }
      } catch(e){ alert("Error al subir"); }
      setUploadingId(null);
      e.target.value="";
    }}/>
</label>
                    <button style={btn("cyan")} onClick={()=>{setEditingProduct({...p}); loadExtraImages(p.id);}}>✏️</button>
                    <button style={btn("red")} onClick={()=>deleteProduct(p.id)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* BOTÓN SUBIR */}
      <button onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}
        style={{position:"fixed",bottom:20,right:20,zIndex:9000,width:42,height:42,borderRadius:"50%",background:"rgba(0,180,216,.15)",border:"1px solid rgba(0,180,216,.4)",color:"#00B4D8",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>
        ↑
      </button>

      {/* MODAL EDITAR */}
      {editingProduct&&(
        <div className="mo" onClick={()=>setEditingProduct(null)}>
          <div className="mb" onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <h3 style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:700,color:"#1a1a1a"}}>Editar producto</h3>
              <button onClick={()=>setEditingProduct(null)} style={{background:"none",border:"none",color:"#666",fontSize:20,cursor:"pointer"}}>✕</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:11}}>

              {/* FOTOS ADICIONALES */}
              <div>
                <label style={{fontSize:11,color:"#444",display:"block",marginBottom:8,fontWeight:600}}>FOTOS ADICIONALES</label>
                {loadingImages ? (
                  <p style={{fontSize:12,color:"#666"}}>Cargando...</p>
                ) : (
                  <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:8}}>
                    {extraImages.map((img:any)=>(
                      <div key={img.id} style={{position:"relative",width:70,height:70}}>
                        <img src={img.image_url} style={{width:70,height:70,borderRadius:8,objectFit:"cover"}}/>
                        <button onClick={()=>deleteExtraPhoto(editingProduct.id, img.id)}
                          style={{position:"absolute",top:-6,right:-6,width:20,height:20,borderRadius:"50%",background:"#ef4444",border:"none",color:"#fff",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>
                          ✕
                        </button>
                      </div>
                    ))}
                    <label style={{width:70,height:70,borderRadius:8,border:"2px dashed #e5e7eb",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:24,color:"#999"}}>
                      +
                      <input type="file" accept="image/*" style={{display:"none"}}
                        onChange={e=>{const f=e.target.files?.[0]; if(f) uploadExtraPhoto(editingProduct.id,f); e.target.value="";}}/>
                    </label>
                  </div>
                )}
                <p style={{fontSize:10,color:"#999"}}>Tocá + para agregar más fotos al producto</p>
              </div>

              {/* CAMPOS */}
              {([["Nombre","name","text"],["Descripción","description","text"],["Precio minorista","price_retail","number"],["Precio mayorista","price_wholesale","number"],["Stock","stock_quantity","number"],["URL imagen","image_url","text"]] as [string,string,string][]).map(([label,key,type])=>(
                <div key={key}>
                  <label style={{fontSize:11,color:"#444",display:"block",marginBottom:4,fontWeight:600}}>{label.toUpperCase()}</label>
                  <input type={type} style={inp} value={(editingProduct[key]??"")} onChange={e=>setEditingProduct((p:any)=>({...p,[key]:type==="number"?Number(e.target.value):e.target.value}))}/>
                </div>
              ))}

              <div>
                <label style={{fontSize:11,color:"#444",display:"block",marginBottom:4,fontWeight:600}}>NIVEL STOCK</label>
                <select value={editingProduct.stock_level} onChange={e=>setEditingProduct((p:any)=>({...p,stock_level:e.target.value}))} style={{...inp,cursor:"pointer"}}>
                  <option value="alto">🟢 Alto</option><option value="medio">🟡 Medio</option><option value="bajo">🔴 Bajo</option>
                </select>
              </div>
              <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                {([["available","Disponible"],["featured","Destacado"],["is_offer","Oferta"],["is_new","Novedad"]] as [string,string][]).map(([key,label])=>(
                  <label key={key} style={{display:"flex",alignItems:"center",gap:6,fontSize:13,cursor:"pointer",color:"#1a1a1a"}}>
                    <input type="checkbox" checked={!!editingProduct[key]} onChange={e=>setEditingProduct((p:any)=>({...p,[key]:e.target.checked}))}/>{label}
                  </label>
                ))}
              </div>
              <div style={{display:"flex",gap:9,marginTop:4}}>
                <button style={{...btn("cyan"),flex:1,padding:11}} onClick={saveEditProduct}>Guardar</button>
                <button style={{...btn("default"),padding:"11px 14px"}} onClick={()=>setEditingProduct(null)}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AGREGAR */}
      {addingProduct&&(
        <div className="mo" onClick={()=>setAddingProduct(false)}>
          <div className="mb" onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <h3 style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:700,color:"#1a1a1a"}}>Agregar producto</h3>
              <button onClick={()=>setAddingProduct(false)} style={{background:"none",border:"none",color:"#666",fontSize:20,cursor:"pointer"}}>✕</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:11}}>
              <div><label style={{fontSize:11,color:"#444",display:"block",marginBottom:4,fontWeight:600}}>NOMBRE *</label><input style={inp} value={newProduct.name} onChange={e=>setNewProduct(p=>({...p,name:e.target.value}))}/></div>
              <div><label style={{fontSize:11,color:"#444",display:"block",marginBottom:4,fontWeight:600}}>DESCRIPCIÓN</label><input style={inp} value={newProduct.description} onChange={e=>setNewProduct(p=>({...p,description:e.target.value}))}/></div>
              <div>
                <label style={{fontSize:11,color:"#444",display:"block",marginBottom:4,fontWeight:600}}>CATEGORÍA *</label>
                <select style={{...inp,cursor:"pointer"}} value={newProduct.category_id} onChange={e=>setNewProduct(p=>({...p,category_id:e.target.value}))}>
                  <option value="">Seleccionar...</option>
                  {categories.map((c:any)=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
                <div><label style={{fontSize:11,color:"#444",display:"block",marginBottom:4,fontWeight:600}}>MINORISTA *</label><input type="number" style={inp} value={newProduct.price_retail} onChange={e=>setNewProduct(p=>({...p,price_retail:e.target.value}))}/></div>
                <div><label style={{fontSize:11,color:"#444",display:"block",marginBottom:4,fontWeight:600}}>MAYORISTA *</label><input type="number" style={inp} value={newProduct.price_wholesale} onChange={e=>setNewProduct(p=>({...p,price_wholesale:e.target.value}))}/></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
                <div>
                  <label style={{fontSize:11,color:"#444",display:"block",marginBottom:4,fontWeight:600}}>STOCK</label>
                  <input type="number" min="0" style={inp} value={newProduct.stock_quantity} onChange={e=>setNewProduct(p=>({...p,stock_quantity:Number(e.target.value)}))}/>
                </div>
                <div>
                  <label style={{fontSize:11,color:"#444",display:"block",marginBottom:4,fontWeight:600}}>NIVEL STOCK</label>
                  <select style={{...inp,cursor:"pointer"}} value={newProduct.stock_level} onChange={e=>setNewProduct(p=>({...p,stock_level:e.target.value}))}>
                    <option value="alto">🟢 Alto</option><option value="medio">🟡 Medio</option><option value="bajo">🔴 Bajo</option>
                  </select>
                </div>
              </div>
              <div><label style={{fontSize:11,color:"#444",display:"block",marginBottom:4,fontWeight:600}}>URL IMAGEN</label><input style={inp} placeholder="https://..." value={newProduct.image_url} onChange={e=>setNewProduct(p=>({...p,image_url:e.target.value}))}/></div>
              <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                {([["available","Disponible"],["featured","Destacado"],["is_offer","Oferta"],["is_new","Novedad"]] as [string,string][]).map(([key,label])=>(
                  <label key={key} style={{display:"flex",alignItems:"center",gap:6,fontSize:13,cursor:"pointer",color:"#1a1a1a"}}>
                    <input type="checkbox" checked={!!(newProduct as any)[key]} onChange={e=>setNewProduct(p=>({...p,[key]:e.target.checked}))}/>{label}
                  </label>
                ))}
              </div>
              <div style={{display:"flex",gap:9,marginTop:4}}>
                <button style={{...btn("green"),flex:1,padding:11}} onClick={saveNewProduct}>Guardar producto</button>
                <button style={{...btn("default"),padding:"11px 14px"}} onClick={()=>setAddingProduct(false)}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean|null>(null);

  useEffect(()=>{
    fetch("/api/auth/check",{credentials:"include"})
      .then(r=>r.json())
      .then(d=>setAuthed(!!d.ok))
      .catch(()=>setAuthed(false));
  },[]);

  const logout = async()=>{
    await fetch("/api/auth/login",{method:"DELETE",credentials:"include"});
    setAuthed(false);
  };

  if(authed===null) return <div style={{minHeight:"100vh",background:"#ffffff",display:"flex",alignItems:"center",justifyContent:"center",color:"#444",fontFamily:"sans-serif"}}>Cargando...</div>;
  return authed ? <Panel onLogout={logout}/> : <Login onLogin={()=>setAuthed(true)}/>;
}