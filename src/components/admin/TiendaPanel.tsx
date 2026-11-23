"use client";
// TIENDA PANEL — Artículos (lista + editar/agregar), Sin foto, Pedidos web y Resumen de la tienda.
import { useState, useEffect, useCallback, useRef } from "react";
import { uploadProductImage } from "@/lib/uploadImage";
import { toWhatsApp } from "@/lib/phone";
import { useRouter } from "next/navigation";

const fmt = (n:number) => new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(n);
const fmtDate = (s:string) => new Date(s).toLocaleDateString("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});

const STATUS:Record<string,{label:string;color:string;bg:string}> = {
  pending:  {label:"Pendiente", color:"#b45309",bg:"#fef3c7"},
  confirmed:{label:"Confirmado",color:"#1d4ed8",bg:"#dbeafe"},
  completed:{label:"Completado",color:"#047857",bg:"#d1fae5"},
  cancelled:{label:"Cancelado", color:"#b91c1c",bg:"#fee2e2"},
};

// Stock: el nivel se calcula solo a partir de la cantidad
const qtyOf = (p:any) => Number(p?.stock_quantity ?? 0) || 0;
const levelOf = (q:number) => q > 10 ? "alto" : q > 3 ? "medio" : "bajo";
const stockTag = (q:number) =>
  q <= 0  ? {label:"Sin stock", color:"#b91c1c", bg:"#fee2e2"} :
  q <= 3  ? {label:"Bajo",      color:"#c2410c", bg:"#ffedd5"} :
  q <= 10 ? {label:"Medio",     color:"#a16207", bg:"#fef9c3"} :
            {label:"Alto",      color:"#047857", bg:"#d1fae5"};

export type Tab = "dashboard"|"orders"|"products"|"sinfoto";

type ProdFilter = "all"|"sinstock"|"bajo"|"sinfoto"|"ocultos";
type OrdFilter  = "all"|"pending"|"confirmed"|"completed"|"cancelled"|"unpaid";

const EMPTY_FORM = {
  id:null as number|null, name:"", description:"", sku:"", category_id:"", supplier_id:"",
  cost_price:"", price_retail:"", price_wholesale:"", pct_retail:"", pct_wholesale:"",
  stock_quantity:"", available:true, featured:false, is_offer:false, is_new:false, image_url:"",
  extra_urls:[] as string[],   // fotos extra del artículo NUEVO (se guardan al crearlo)
};
type Form = typeof EMPTY_FORM;

// Imagen de reemplazo cuando la foto guardada no carga (link roto)
const NO_IMG = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44"><rect width="44" height="44" fill="#f3f4f6"/><path d="M14 16h4l2-3h4l2 3h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V18a2 2 0 0 1 2-2z" fill="none" stroke="#c4c8cf" stroke-width="1.6"/><circle cx="22" cy="23" r="3.5" fill="none" stroke="#c4c8cf" stroke-width="1.6"/><path d="M10 34 34 10" stroke="#e5a3a3" stroke-width="1.6"/></svg>');


export default function TiendaPanel({ tab, openNew = false }: { tab: Tab; openNew?: boolean }) {
  const router = useRouter();
  const [orders, setOrders]         = useState<any[]>([]);
  // Artículos: solo los que se ven en pantalla (se piden de a 10 a la base, no el catálogo entero)
  const [products, setProducts]     = useState<any[]>([]);
  const [prodTotal, setProdTotal]   = useState(0);
  const [prodCounts, setProdCounts] = useState<Record<string, number>>({});
  const [prodLoading, setProdLoading] = useState(false);
  const [qDeb, setQDeb]             = useState("");   // búsqueda "asentada" (espera a que termines de escribir)
  const [dash, setDash]             = useState<{ low:any[]; lowTotal:number; counts:Record<string, number> }>({ low:[], lowTotal:0, counts:{} });
  const listReq = useRef(0);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<number|null>(null);
  const [ordFilter, setOrdFilter]   = useState<OrdFilter>("all");
  const [ordSearch, setOrdSearch]   = useState("");
  const [catFilter, setCatFilter]   = useState("all");
  const [prodFilter, setProdFilter] = useState<ProdFilter>("all");
  const [searchProd, setSearchProd] = useState("");
  const [showAdjust, setShowAdjust] = useState(false);
  const [form, setForm]             = useState<Form|null>(null);
  const [saving, setSaving]         = useState(false);
  const [uploadingId, setUploadingId] = useState<number|null>(null);
  const [extraImages, setExtraImages] = useState<any[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [importing, setImporting]   = useState(false);
  const [suppliersList, setSuppliersList] = useState<any[]>([]);
  const PAGE = tab==="sinfoto" ? 12 : 10;   // de a cuántos se muestran

  useEffect(()=>{ if(tab==="products") fetch("/api/crm/suppliers",{credentials:"include"}).then(r=>r.ok?r.json():[]).then(d=>Array.isArray(d)&&setSuppliersList(d)).catch(()=>{}); },[tab]);

  // Filtro que viene por la URL (ej: /admin/articulos?f=bajo desde el Resumen)
  useEffect(()=>{
    try {
      const f = new URLSearchParams(window.location.search).get("f");
      if (f && ["sinstock","bajo","sinfoto","ocultos"].includes(f)) setProdFilter(f as ProdFilter);
    } catch {}
  },[]);

  // Precio = costo + % de ganancia (redondeado a $10)
  const priceFrom = (cost:string, pct:string) => {
    const c = Number(cost), p = Number(pct);
    if (!(c > 0) || pct === "" || isNaN(p)) return "";
    return String(Math.round(c * (1 + p / 100) / 10) * 10);
  };
  const pctFrom = (cost:string, price:string) => {
    const c = Number(cost), v = Number(price);
    if (!(c > 0) || !(v > 0)) return "";
    return String(Math.round((v / c - 1) * 1000) / 10);
  };

  // Artículo nuevo: arranca con 135 % de ganancia minorista y 30 % mayorista;
  // a medida que se escribe el costo, los precios se calculan solos.
  const openNewForm = useCallback(()=>{
    setExtraImages([]);
    setForm({ ...EMPTY_FORM, pct_retail:"135", pct_wholesale:"30" });
  },[]);

  const openEditForm = (p:any) => {
    const s = (v:any) => v === null || v === undefined ? "" : String(Number(v) || v);
    const cost = p.cost_price ? String(Number(p.cost_price)) : "";
    const retail = s(p.price_retail), wholesale = s(p.price_wholesale);
    setForm({
      id:p.id, name:p.name||"", description:p.description||"", sku:p.sku||"",
      category_id: p.category_id ? String(p.category_id) : "", supplier_id: p.supplier_id ? String(p.supplier_id) : "",
      cost_price:cost, price_retail:retail, price_wholesale:wholesale,
      pct_retail:pctFrom(cost,retail), pct_wholesale:pctFrom(cost,wholesale),
      stock_quantity:String(qtyOf(p)), available:!!p.available, featured:!!p.featured, is_offer:!!p.is_offer, is_new:!!p.is_new,
      image_url:p.image_url||"", extra_urls:[],
    });
    loadExtraImages(p.id);
  };

  // Abrir "nuevo artículo" si se llegó con F12 desde la pantalla bloqueada
  useEffect(()=>{ if (openNew && tab==="products") openNewForm(); },[openNew, tab, openNewForm]);

  // Atajos: F12 = artículo nuevo · Esc = cerrar la ventana
  useEffect(()=>{
    if(tab!=="products" && tab!=="sinfoto") return;
    const onKey=(e:KeyboardEvent)=>{
      if(e.key==="F12"){ e.preventDefault(); if(!form && tab==="products") openNewForm(); }
      if(e.key==="Escape" && form) setForm(null);
    };
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[tab,form,openNewForm]);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders",{credentials:"include"});
      if(res.ok) { const d = await res.json(); setOrders(Array.isArray(d)?d:[]); }
    } catch {}
  }, []);

  // Espera 350 ms después de la última letra antes de buscar (no consulta por cada tecla)
  useEffect(()=>{ const t = setTimeout(()=>setQDeb(searchProd.trim()), 350); return ()=>clearTimeout(t); },[searchProd]);

  const fetchList = useCallback(async (offset:number) => {
    const my = ++listReq.current;
    const sp = new URLSearchParams({ offset:String(offset), limit:String(PAGE) });
    if (qDeb) sp.set("q", qDeb);
    if (tab==="sinfoto") { sp.set("f","sinfoto"); sp.set("sort","stockdesc"); }
    else { if (catFilter!=="all") sp.set("cat", catFilter); if (prodFilter!=="all") sp.set("f", prodFilter); }
    setProdLoading(true);
    try {
      const res = await fetch(`/api/products/lista?${sp}`,{credentials:"include",cache:"no-store"});
      const d = await res.json().catch(()=>null);
      if (my !== listReq.current || !res.ok || !d) return;   // llegó tarde (ya se pidió otra cosa)
      setProducts(prev => offset ? [...prev, ...d.items] : d.items);
      setProdTotal(d.total); setProdCounts(d.counts||{});
    } catch {} finally { if (my === listReq.current) setProdLoading(false); }
  }, [qDeb, tab, catFilter, prodFilter, PAGE]);
  const fetchProducts = useCallback(() => fetchList(0), [fetchList]);
  useEffect(()=>{ if (tab==="products" || tab==="sinfoto") fetchList(0); },[tab, fetchList]);

  // Resumen: solo los 8 con menos stock y los contadores
  const fetchDash = useCallback(async () => {
    try {
      const res = await fetch("/api/products/lista?f=bajo&sort=stock&limit=8",{credentials:"include",cache:"no-store"});
      if (res.ok) { const d = await res.json(); setDash({ low:d.items, lowTotal:d.total, counts:d.counts||{} }); }
    } catch {}
  }, []);

  // Catálogo completo: SOLO al exportar o importar Excel
  const fetchAll = async ():Promise<any[]> => {
    const res = await fetch("/api/products",{credentials:"include"});
    const d = await res.json().catch(()=>null);
    if (!res.ok || !Array.isArray(d)) throw new Error("No se pudo leer el catálogo");
    return d;
  };

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/categories",{credentials:"include"});
      if(res.ok) { const d = await res.json(); setCategories(Array.isArray(d)?d:[]); }
    } catch {}
  }, []);

  // Cada pestaña pide solo lo que muestra
  useEffect(() => {
    let isMounted = true;
    const jobs = tab==="dashboard" ? [fetchOrders(), fetchDash()] : tab==="orders" ? [fetchOrders()] : [];
    Promise.all(jobs).finally(() => { if (isMounted) setLoading(false); });
    return () => { isMounted = false; };
  }, [tab, fetchOrders, fetchDash]);

  useEffect(() => {
    if ((tab === "products" || showAdjust || form) && categories.length === 0) fetchCategories();
  }, [tab, categories.length, fetchCategories, form, showAdjust]);

  const patchOrder = async(id:number,data:any)=>{
    const res = await fetch(`/api/orders/${id}`,{method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
    if(!res.ok){ const d = await res.json().catch(()=>({})); alert(d.error||"No se pudo actualizar el pedido"); return; }
    setOrders(prev=>prev.map(o=>o.id===id?{...o,...data}:o));
    window.dispatchEvent(new Event("admin:refresh-badges"));
  };

  const patchProduct = async(id:number,data:any)=>{
    const res = await fetch(`/api/products/${id}`,{method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
    if(!res.ok){ const d = await res.json().catch(()=>({})); alert(d.error||"No se pudo guardar el cambio"); return false; }
    setProducts(prev=>prev.map(p=>p.id===id?{...p,...data}:p));
    window.dispatchEvent(new Event("admin:refresh-badges"));   // ej: "Sin foto" baja al subir una foto
    return true;
  };

  const saveStock = (p:any, raw:string) => {
    const qty = Math.max(0, Math.floor(Number(raw) || 0));
    if (qty === qtyOf(p)) return;
    patchProduct(p.id,{ stock_quantity: qty, stock_level: levelOf(qty), available: qty > 0 });
  };

  // Foto PRINCIPAL: sube y guarda en el momento
  const setMainPhoto = async(id:number, file:File)=>{
    setUploadingId(id);
    try {
      const url = await uploadProductImage(file);
      if (await patchProduct(id,{image_url:url}))
        setForm(f=>f&&f.id===id?{...f,image_url:url}:f);
    } catch(e:any){ alert(e.message||"No se pudo subir la foto"); }
    finally { setUploadingId(null); }
  };

  // Foto del artículo NUEVO (todavía no tiene id): se guarda junto con el resto
  const uploadNewPhoto = async(file:File)=>{
    setUploadingId(-1);
    try { const url = await uploadProductImage(file); setForm(f=>f?{...f,image_url:url}:f); }
    catch(err:any){ alert(err.message||"No se pudo subir la foto"); }
    finally { setUploadingId(null); }
  };

  const saveForm = async()=>{
    if(!form || saving) return;
    if(!form.name.trim()) return alert("Falta el nombre del artículo");
    if(!form.category_id) return alert("Elegí una categoría");
    if(!(Number(form.price_retail) > 0) || !(Number(form.price_wholesale) > 0)) return alert("Completá el precio minorista y el mayorista");
    const qty = Math.max(0, Math.floor(Number(form.stock_quantity) || 0));
    const payload = {
      name: form.name.trim(), description: form.description, sku: form.sku.trim(),
      category_id: Number(form.category_id), supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
      cost_price: Number(form.cost_price) > 0 ? Number(form.cost_price) : null,
      price_retail: Number(form.price_retail), price_wholesale: Number(form.price_wholesale),
      stock_quantity: qty, stock_level: levelOf(qty),
      available: qty > 0 ? form.available : false,
      featured: form.featured, is_offer: form.is_offer, is_new: form.is_new, image_url: form.image_url,
    };
    const cat = categories.find((c:any)=>c.id===payload.category_id);
    setSaving(true);
    try {
      if (form.id) {
        const res = await fetch(`/api/products/${form.id}`,{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
        const d = await res.json().catch(()=>({}));
        if(!res.ok){ alert(d.error||"No se pudo guardar el artículo"); return; }
        const sup = suppliersList.find((x:any)=>x.id===payload.supplier_id);
        setProducts(prev=>prev.map(p=>p.id===form.id?{...p,...payload,category_name:cat?.name||p.category_name,supplier_name:sup?.name||null}:p));
      } else {
        const res = await fetch("/api/products",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
        const p = await res.json().catch(()=>({}));
        if(!res.ok){ alert(p.error||"No se pudo guardar el artículo"); return; }
        for (const url of form.extra_urls) {
          await fetch(`/api/products/${p.id}/images`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({image_url:url})}).catch(()=>{});
        }
        fetchList(0);   // recarga la lista para que aparezca en su lugar
      }
      setForm(null);
    } finally { setSaving(false); }
  };

  const deleteProduct = async(id:number)=>{
    if(!confirm("¿Eliminar este artículo? No se puede deshacer.")) return false;
    const res = await fetch(`/api/products/${id}`,{method:"DELETE",credentials:"include"});
    if(!res.ok){ alert("No se pudo eliminar (puede tener ventas asociadas). Podés ocultarlo de la tienda."); return false; }
    setProducts(prev=>prev.filter(p=>p.id!==id));
    setProdTotal(t=>Math.max(0,t-1));
    return true;
  };

  const loadExtraImages = async(productId:number)=>{
    setLoadingImages(true);
    const res = await fetch(`/api/products/${productId}/images`,{credentials:"include"});
    const imgs = res.ok ? await res.json().catch(()=>[]) : [];
    setExtraImages(Array.isArray(imgs)?imgs:[]);
    setLoadingImages(false);
  };

  // Más fotos: se pueden elegir varias a la vez. Si todavía no hay foto principal,
  // la primera pasa a ser la principal. En un artículo nuevo quedan en espera y se
  // guardan al crearlo; en uno existente se guardan al instante.
  const addExtraPhotos = async(files:File[])=>{
    if(!form || !files.length) return;
    const id = form.id;
    let hasMain = !!form.image_url;
    setLoadingImages(true);
    let failed = 0;
    for (const file of files) {
      try {
        const url = await uploadProductImage(file);
        if (!hasMain) {
          hasMain = true;
          if (id) { if (await patchProduct(id,{image_url:url})) setForm(f=>f&&f.id===id?{...f,image_url:url}:f); }
          else setForm(f=>f?{...f,image_url:url}:f);
          continue;
        }
        if (id) {
          const res = await fetch(`/api/products/${id}/images`,{
            method:"POST",credentials:"include",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({image_url:url})
          });
          if(!res.ok) throw new Error();
          const img = await res.json();
          setExtraImages(prev=>[...prev,img]);
        } else {
          setForm(f=>f?{...f,extra_urls:[...f.extra_urls,url]}:f);
        }
      } catch { failed++; }
    }
    setLoadingImages(false);
    if (failed) alert(failed===1?"Una foto no se pudo subir.":`${failed} fotos no se pudieron subir.`);
  };

  const deleteExtraPhoto = async(productId:number, imageId:number)=>{
    await fetch(`/api/products/${productId}/images`,{
      method:"DELETE",credentials:"include",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({image_id:imageId})
    });
    setExtraImages(prev=>prev.filter(i=>i.id!==imageId));
  };

  const exportExcel = async () => {
    const XLSX = require("xlsx");
    let all:any[] = [];
    try { all = await fetchAll(); } catch(e:any) { alert(e.message); return; }
    const data = all.map((p:any)=>({
      CODIGO:   "",
      DETALLE:   p.name,
      FAMILIA:   p.category_name||"",
      PROVEEDOR: "",
      MARCA:     "",
      "P.COSTO": "",
      "P.VENTA": Number(p.price_wholesale),
      IVA:       21,
      "P.LISTA2": Number(p.price_retail),
      "P.LISTA3": "",
      "P.MAYOR":  Number(p.price_wholesale),
      STOCK:     p.stock_quantity??0,
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

 const limpiarNombre = (s:string) => {
  const nombre = s.toString().trim().toUpperCase();
  if (/^[XYZW]/i.test(nombre)) return "IGNORE_PRODUCT";
  return nombre.replace(/\s+/g, " ").trim();
};

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
    if (nombre.includes("PERFUME")) return "Perfumería";
    if (nombre.includes("LINTERNA")) return "Iluminación";
    if (nombre.includes("FOCO")) return "Iluminación";
    if (nombre.includes("MOUSE")) return "Computación y Gamer";
    if (nombre.includes("TECLADO")) return "Computación y Gamer";
    if (nombre.includes("ANAFE")) return "Electro-Hogar";
    if (nombre.includes("VENTILADOR")) return "Electro-Hogar";
    return "Varios";
  };

  // Construir mapa de productos existentes
  const prodMap = new Map<string, any>();
  let catalogo:any[] = [];
  try { catalogo = await fetchAll(); } catch(e:any) { alert(e.message); setImporting(false); return; }
  catalogo.forEach((p:any) => {
    const n = limpiarNombre(p.name);
    if (n !== "IGNORE_PRODUCT") prodMap.set(n, p);
  });

  const updates: any[] = [];
  const creates: any[] = [];

  for (const row of rows) {
    const rawNombre = (row.DETALLE || row.NOMBRE || "").toString();
    const nombre = limpiarNombre(rawNombre);

    // Ignorar productos con prefijos repetidos
    if (!nombre || nombre === "IGNORE_PRODUCT") continue;

    const precioMin = Number(row["P.LISTA2"] || row.PRECIO_MINORISTA || 0);
    const precioMay = Number(row["P.VENTA"]  || row.PRECIO_MAYORISTA || 0);
    const stock     = Number(row.STOCK ?? row.stock ?? 0);
    const familia   = (row.FAMILIA || row.CATEGORIA || "").toString().trim().toUpperCase();

    const prod = prodMap.get(nombre);

    if (prod) {
      updates.push({
        id:              prod.id,
        price_retail:    precioMin > 0 ? precioMin : prod.price_retail,
        price_wholesale: precioMay > 0 ? precioMay : prod.price_wholesale,
        stock_quantity:  stock,
        stock_level:     stock > 10 ? "alto" : stock > 3 ? "medio" : "bajo",
        available:       stock > 0,
      });
    } else {
      const catName = inferirCategoria(nombre, familia);
      const cat = categories.find((c:any)=>c.name===catName) || categories.find((c:any)=>c.name==="Varios");
      if (!cat) continue;
      creates.push({
        name:            nombre,
        category_id:     cat.id,
        price_retail:    precioMin,
        price_wholesale: precioMay,
        stock_quantity:  stock,
        stock_level:     stock > 10 ? "alto" : stock > 3 ? "medio" : "bajo",
        available:       stock > 0,
      });
    }
  }

  // Enviar en lotes de 500
  const LOTE = 500;
  let updated = 0; let created = 0; let err = 0;

  for (let i = 0; i < updates.length; i += LOTE) {
    const lote = updates.slice(i, i + LOTE);
    const res = await fetch("/api/products/batch", {
      method:"POST", credentials:"include",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ updates: lote, creates: [] })
    });
    if (res.ok) { const d = await res.json(); updated += d.updated; err += d.err; }
    else err += lote.length;
  }

  for (let i = 0; i < creates.length; i += LOTE) {
    const lote = creates.slice(i, i + LOTE);
    const res = await fetch("/api/products/batch", {
      method:"POST", credentials:"include",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ updates: [], creates: lote })
    });
    if (res.ok) { const d = await res.json(); created += d.created; err += d.err; }
    else err += lote.length;
  }

  fetchProducts();
  setImporting(false);
  alert(`${updated} actualizados, ${created} creados${err>0?`, ${err} con error`:""}`);
};
  const downloadFact = (order:any) => {
    const lines = order.items?.map((i:any)=>`  - ${i.qty}x ${i.name}: ${fmt(i.qty*i.price)}`).join("\n")||"";
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
  Estado de pago: ${order.paid?"PAGADO":"PENDIENTE"}
══════════════════════════════════════
  Gracias por su compra`;
    const blob = new Blob([txt],{type:"text/plain;charset=utf-8"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `factura-${String(order.id).padStart(6,"0")}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };


  const sendFactWsp = (o:any) => {
    const lines = o.items?.map((i:any)=>`- ${i.qty}x ${i.name}: ${fmt(i.qty*i.price)}`).join("\n")||"";
    const msg = encodeURIComponent(`*Factura Concepción Tecnología*\n\nCliente: ${o.customer_name}\nEntrega: ${o.delivery_type==="pickup"?"Retira en local":`Envío a: ${o.address}`}\n\n${lines}\n\n*Total: ${fmt(Number(o.total))}*\nEstado: ${STATUS[o.status]?.label}`);
    const num = toWhatsApp(String(o.phone||""));
    window.open(num ? `https://wa.me/${num}?text=${msg}` : `https://wa.me/?text=${msg}`,"_blank");
  };

  // ── Números ─────────────────────────────────────────────
  const totalPaid    = orders.filter(o=>o.paid).reduce((s,o)=>s+Number(o.total),0);
  const totalPending = orders.filter(o=>!o.paid&&o.status!=="cancelled").reduce((s,o)=>s+Number(o.total),0);
  const pendingCount = orders.filter(o=>o.status==="pending").length;
  const lowStock     = dash.low;
  // En "Sin foto", el que ya tiene foto se saca de la lista al instante
  const shownProds   = tab==="sinfoto" ? products.filter((p:any)=>!p.image_url) : products;
  const hasMoreProds = products.length < prodTotal;
  const catNames = categories.map((c:any)=>c.name).filter(Boolean).sort() as string[];
  const searching = prodLoading || searchProd.trim() !== qDeb;

  const PROD_FILTERS: [ProdFilter,string][] = [
    ["all","Todos"],
    ["sinstock","Sin stock"],
    ["bajo","Stock bajo (1 a 3)"],
    ["sinfoto","Sin foto"],
    ["ocultos","Ocultos en la web"],
  ];

  const ORD_FILTERS: [OrdFilter,string,(o:any)=>boolean][] = [
    ["all","Todos",()=>true],
    ["pending","Pendientes",o=>o.status==="pending"],
    ["confirmed","Confirmados",o=>o.status==="confirmed"],
    ["unpaid","Sin pagar",o=>!o.paid&&o.status!=="cancelled"],
    ["completed","Completados",o=>o.status==="completed"],
    ["cancelled","Cancelados",o=>o.status==="cancelled"],
  ];
  const oq = ordSearch.trim().toLowerCase();
  const ordersShown = orders
    .filter(ORD_FILTERS.find(f=>f[0]===ordFilter)![2])
    .filter((o:any)=>!oq || String(o.customer_name||"").toLowerCase().includes(oq) || String(o.phone||"").includes(oq) || String(o.id)===oq.replace("#",""));

  if(loading) return <p style={{color:"#666",padding:20}}>Cargando...</p>;

  const Pill = ({c,bg,children}:{c:string;bg:string;children:any}) => <span className="tp-pill" style={{color:c,background:bg}}>{children}</span>;
  const PaidPill = ({o}:{o:any}) => o.paid ? <Pill c="#047857" bg="#d1fae5">Pagado</Pill> : <Pill c="#b45309" bg="#fef3c7">Sin pagar</Pill>;
  const Thumb = ({p,size=44}:{p:any;size?:number}) => p.image_url
    ? <img src={p.image_url} alt="" className="tp-img" style={{width:size,height:size}} onError={e=>{const el=e.currentTarget as HTMLImageElement; el.onerror=null; el.src=NO_IMG;}}/>
    : <span className="tp-noimg" style={{width:size,height:size}}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
      </span>;

  // ── Formulario: campo de precio con % de ganancia ───────
  const setF = (patch:Partial<Form>) => setForm(f=>f?{...f,...patch}:f);
  const marginTxt = (price:string) => {
    const c = Number(form?.cost_price), v = Number(price);
    if (!(c>0) || !(v>0)) return "";
    return `Ganás ${fmt(v-c)}`;
  };

  return (
    <div className="tienda">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <main className="admin-content">
        <div className="admin-inner">

        {/* ═════════ RESUMEN DE LA TIENDA ═════════ */}
        {tab==="dashboard"&&(
          <div>
            <div className="tp-head">
              <div>
                <h2 className="tp-title">Resumen de la tienda</h2>
                <p className="tp-sub">Pedidos de la web y artículos que necesitan atención</p>
              </div>
            </div>
            <div className="tp-kpis">
              <div className="tp-kpi"><span>Cobrado</span><b style={{color:"#047857"}}>{fmt(totalPaid)}</b><small>pedidos marcados como pagados</small></div>
              <div className="tp-kpi"><span>Por cobrar</span><b style={{color:"#b45309"}}>{fmt(totalPending)}</b><small>{orders.filter(o=>!o.paid&&o.status!=="cancelled").length} pedidos sin pagar</small></div>
              <button className="tp-kpi link" onClick={()=>{router.push("/admin/pedidos");}}><span>Pedidos sin confirmar</span><b style={{color:"#1d4ed8"}}>{pendingCount}</b><small>de {orders.length} pedidos en total →</small></button>
              <button className="tp-kpi link" onClick={()=>router.push("/admin/articulos?f=sinstock")}><span>Sin stock</span><b style={{color:"#b91c1c"}}>{dash.counts.sinstock ?? "–"}</b><small>{dash.counts.sinfoto ?? 0} artículos sin foto</small></button>
            </div>

            <div className="tp-dash">
              <section className="tp-card">
                <div className="tp-card-h">
                  <h3>Últimos pedidos</h3>
                  <button className="tp-btn sm" onClick={()=>router.push("/admin/pedidos")}>Ver todos</button>
                </div>
                {orders.length===0&&<p className="tp-empty">Todavía no hay pedidos.</p>}
                {orders.slice(0,6).map((o:any)=>(
                  <button key={o.id} className="tp-mini" onClick={()=>router.push("/admin/pedidos")}>
                    <span className="tp-mini-main">
                      <b>{o.customer_name}</b>
                      <small>#{o.id} · {fmtDate(o.created_at)} · {o.items?.length||0} {(o.items?.length||0)===1?"producto":"productos"}</small>
                    </span>
                    <span className="tp-mini-tags">
                      <Pill c={STATUS[o.status]?.color} bg={STATUS[o.status]?.bg}>{STATUS[o.status]?.label}</Pill>
                      <PaidPill o={o}/>
                    </span>
                    <b className="tp-mini-total">{fmt(Number(o.total))}</b>
                  </button>
                ))}
              </section>

              <section className="tp-card">
                <div className="tp-card-h">
                  <h3>Stock bajo <span className="tp-count red">{dash.lowTotal}</span></h3>
                  <button className="tp-btn sm" onClick={()=>router.push("/admin/articulos?f=bajo")}>Ver en Artículos</button>
                </div>
                {lowStock.length===0&&<p className="tp-empty">No hay artículos con stock bajo.</p>}
                {lowStock.slice(0,8).map((p:any)=>{ const t=stockTag(qtyOf(p)); return (
                  <div key={p.id} className="tp-low">
                    <span className="tp-low-name"><b>{p.name}</b><small>{p.category_name}</small></span>
                    <Pill c={t.color} bg={t.bg}>{qtyOf(p)} u.</Pill>
                  </div>
                );})}
                {dash.lowTotal>8&&<p className="tp-more">y {dash.lowTotal-8} más…</p>}
              </section>
            </div>
          </div>
        )}

        {/* ═════════ PEDIDOS WEB ═════════ */}
        {tab==="orders"&&(
          <div>
            <div className="tp-head">
              <div>
                <h2 className="tp-title">Pedidos web</h2>
                <p className="tp-sub">{orders.length} pedidos · {pendingCount} sin confirmar · {fmt(totalPending)} por cobrar</p>
              </div>
              <button className="tp-btn" onClick={fetchOrders}>↻ Actualizar</button>
            </div>

            <div className="tp-filters">
              <input className="tp-search" value={ordSearch} onChange={e=>setOrdSearch(e.target.value)} placeholder="Buscar por cliente, teléfono o #pedido…"/>
              <div className="tp-chips">
                {ORD_FILTERS.map(([k,l,t])=>(
                  <button key={k} className={`tp-chip${ordFilter===k?" on":""}`} onClick={()=>setOrdFilter(k)}>
                    {l} <em>{orders.filter(t).length}</em>
                  </button>
                ))}
              </div>
            </div>

            <div className="tp-card flush">
              <div className="tp-orow tp-ohead">
                <span>Pedido</span><span>Cliente</span><span>Entrega</span><span className="r">Total</span><span>Estado</span><span/>
              </div>
              {ordersShown.length===0&&<p className="tp-empty pad">No hay pedidos con ese filtro.</p>}
              {ordersShown.map((o:any)=>{
                const open = expandedOrder===o.id;
                return (
                  <div key={o.id} className={`tp-oitem${open?" open":""}`}>
                    <button className="tp-orow" onClick={()=>setExpandedOrder(open?null:o.id)}>
                      <span className="tp-oid"><b>#{o.id}</b><small>{fmtDate(o.created_at)}</small></span>
                      <span className="tp-ocli"><b>{o.customer_name}</b><small>{o.phone}</small></span>
                      <span className="tp-odel">{o.delivery_type==="pickup"?"Retira en local":"Envío"}<small>{o.sale_type==="retail"?"Minorista":"Mayorista"} · {o.items?.length||0} prod.</small></span>
                      <b className="tp-ototal r">{fmt(Number(o.total))}</b>
                      <span className="tp-otags"><Pill c={STATUS[o.status]?.color} bg={STATUS[o.status]?.bg}>{STATUS[o.status]?.label}</Pill><PaidPill o={o}/></span>
                      <span className="tp-chev">{open?"▴":"▾"}</span>
                    </button>
                    {open&&(
                      <div className="tp-odetail">
                        <div className="tp-oitems">
                          <div className="tp-oline head"><span>Cant.</span><span>Producto</span><span className="r">P. unit.</span><span className="r">Subtotal</span></div>
                          {o.items?.map((it:any,i:number)=>(
                            <div key={i} className="tp-oline">
                              <b>{Number(it.qty)||0}</b><span>{it.name||"Artículo"}</span><span className="r">{fmt(Number(it.price)||0)}</span><b className="r">{fmt((Number(it.qty)||0)*(Number(it.price)||0))}</b>
                            </div>
                          ))}
                          <div className="tp-oline total"><span/><span>Total</span><span/><b className="r">{fmt(Number(o.total))}</b></div>
                          {o.address&&<p className="tp-oaddr">📍 Envío a: {o.address}</p>}
                        </div>
                        <div className="tp-oside">
                          <div>
                            <p className="tp-lbl">Estado del pedido</p>
                            <div className="tp-seg">
                              {["pending","confirmed","completed","cancelled"].map(s=>(
                                <button key={s} className={o.status===s?"on":""} style={o.status===s?{background:STATUS[s].bg,color:STATUS[s].color,borderColor:STATUS[s].color+"55"}:undefined}
                                  onClick={()=>patchOrder(o.id,{status:s})}>{STATUS[s].label}</button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="tp-lbl">Pago</p>
                            <button className={`tp-btn ${o.paid?"":"green"}`} style={{width:"100%"}} onClick={()=>patchOrder(o.id,{paid:!o.paid})}>
                              {o.paid?"Pagado ✓ · marcar sin pagar":"Marcar como pagado"}
                            </button>
                          </div>
                          <div className="tp-oacts">
                            <button className="tp-btn wa" onClick={()=>sendFactWsp(o)}>Enviar por WhatsApp</button>
                            <button className="tp-btn" onClick={()=>downloadFact(o)}>Descargar comprobante</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═════════ ARTÍCULOS ═════════ */}
        {tab==="products"&&(
          <div>
            <div className="tp-head">
              <div>
                <h2 className="tp-title">Artículos</h2>
                <p className="tp-sub">{catFilter==="all"&&!qDeb ? <>{prodCounts.all ?? "…"} artículos · {prodCounts.visibles ?? 0} visibles en la web · {prodCounts.sinstock ?? 0} sin stock</> : <>{prodCounts.all ?? 0} artículos con esa búsqueda</>}</p>
              </div>
              <div className="tp-actions">
                <button className={`tp-btn${showAdjust?" on":""}`} onClick={()=>setShowAdjust(v=>!v)}>% Ajustar precios</button>
                <button className="tp-btn" onClick={exportExcel}>Exportar</button>
                <label className="tp-btn" style={{cursor:importing?"default":"pointer"}}>
                  {importing?"Importando...":"Importar"}
                  <input type="file" accept=".xlsx,.xls" style={{display:"none"}} disabled={importing}
                    onChange={e=>{const f=e.target.files?.[0]; if(f) importExcel(f); e.target.value="";}}/>
                </label>
                <button className="tp-btn primary" onClick={openNewForm} title="Atajo: F12">+ Nuevo artículo <kbd>F12</kbd></button>
              </div>
            </div>

            {showAdjust&&(
              <PriceAdjuster
                categories={categories}
                onAdjust={async(target,pct)=>{
                  const res = await fetch("/api/products/ajustar",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({...target,pct})});
                  const d = await res.json().catch(()=>({}));
                  if(!res.ok){ alert(d.error||"No se pudieron ajustar los precios"); return; }
                  await fetchProducts();
                  alert(d.updated ? `Precios actualizados ${pct>0?"+":""}${pct}% en ${d.updated} ${d.updated===1?"artículo":"artículos"}` : "No había artículos para ajustar");
                }}
              />
            )}

            <div className="tp-filters">
              <div className="tp-frow">
                <input className="tp-search" value={searchProd} onChange={e=>setSearchProd(e.target.value)} placeholder="Buscar por nombre o código…"/>
                <select className="tp-select" value={catFilter} onChange={e=>setCatFilter(e.target.value)}>
                  <option value="all">Todas las categorías</option>
                  {catNames.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="tp-chips">
                {PROD_FILTERS.map(([k,l])=>(
                  <button key={k} className={`tp-chip${prodFilter===k?" on":""}`} onClick={()=>setProdFilter(k)}>
                    {l} <em>{prodCounts[k] ?? ""}</em>
                  </button>
                ))}
              </div>
            </div>

            <div className="tp-card flush">
              <div className="tp-prow tp-phead">
                <span/><span>Artículo</span><span className="r">Minorista</span><span className="r">Mayorista</span><span className="c">Stock</span><span className="c">En la web</span><span/>
              </div>
              {shownProds.map((p:any)=>{
                const qn = qtyOf(p), t = stockTag(qn);
                return (
                  <div key={p.id} className={`tp-prow${p.available?"":" off"}`}>
                    <label className="tp-pthumb" title={p.image_url?"Cambiar foto":"Subir foto"}>
                      {uploadingId===p.id ? <span className="tp-noimg" style={{width:44,height:44,fontSize:10}}>…</span> : <Thumb p={p}/>}
                      <input type="file" accept="image/*" style={{display:"none"}} disabled={uploadingId===p.id}
                        onChange={e=>{ const f=e.target.files?.[0]; e.target.value=""; if(f) setMainPhoto(p.id,f); }}/>
                    </label>
                    <button className="tp-pname" onClick={()=>openEditForm(p)}>
                      <b>{p.name}</b>
                      <small>{[p.sku && `Cód. ${p.sku}`, p.category_name, p.supplier_name].filter(Boolean).join(" · ")}</small>
                    </button>
                    <span className="tp-price r"><small className="m">Minorista</small>{fmt(Number(p.price_retail))}</span>
                    <span className="tp-price r wh"><small className="m">Mayorista</small>{fmt(Number(p.price_wholesale))}</span>
                    <span className="tp-stock c">
                      <input key={`${p.id}-${qn}`} type="number" min="0" defaultValue={qn} inputMode="numeric"
                        onKeyDown={e=>{ if(e.key==="Enter") (e.target as HTMLInputElement).blur(); }}
                        onBlur={e=>saveStock(p,e.target.value)} aria-label="Stock"/>
                      <span className="tp-dot" style={{background:t.color}} title={t.label}/>
                    </span>
                    <span className="c tp-web">
                      <button className={`tp-toggle${p.available?" on":""}`} title={p.available?"Visible en la tienda web":"Oculto en la tienda web"}
                        onClick={()=>patchProduct(p.id,{available:!p.available})}><i/></button>
                    </span>
                    <span className="tp-pacts">
                      <button className="tp-btn sm" onClick={()=>openEditForm(p)}>Editar</button>
                    </span>
                  </div>
                );
              })}
              {!searching&&products.length===0&&<p className="tp-empty pad">No hay artículos que coincidan.</p>}
              {searching&&products.length===0&&<p className="tp-empty pad">Buscando…</p>}
            </div>
            <ListFooter shown={products.length} total={prodTotal} loading={prodLoading} more={hasMoreProds} step={PAGE} onMore={()=>fetchList(products.length)} />
          </div>
        )}

        {/* ═════════ SIN FOTO ═════════ */}
        {tab==="sinfoto"&&(
          <div>
            <div className="tp-head">
              <div>
                <h2 className="tp-title">Sin foto</h2>
                <p className="tp-sub">{qDeb ? `${prodTotal} sin foto con esa búsqueda` : `${prodTotal} artículos sin imagen`} · tocá uno para subirle la foto</p>
              </div>
            </div>
            <div className="tp-filters">
              <input className="tp-search" value={searchProd} onChange={e=>setSearchProd(e.target.value)} placeholder="Buscar por nombre o código…"/>
            </div>
            {!searching&&prodTotal===0&&<p className="tp-empty">{qDeb ? "No hay artículos sin foto con esa búsqueda." : "Todos los artículos tienen foto. 🎉"}</p>}
            <div className="tp-sfgrid">
              {shownProds.map((p:any)=>{ const t = stockTag(qtyOf(p)); return (
                <label key={p.id} className="tp-sf">
                  <span className="tp-sf-drop">
                    {uploadingId===p.id ? "Subiendo…" : <>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      Subir foto</>}
                  </span>
                  <b>{p.name}</b>
                  <span className="tp-sf-meta">{p.category_name} <Pill c={t.color} bg={t.bg}>{qtyOf(p)} u.</Pill></span>
                  <input type="file" accept="image/*" style={{display:"none"}} disabled={uploadingId===p.id}
                    onChange={e=>{ const f=e.target.files?.[0]; e.target.value=""; if(f) setMainPhoto(p.id,f); }}/>
                </label>
              );})}
            </div>
            <ListFooter shown={products.length} total={prodTotal} loading={prodLoading} more={hasMoreProds} step={PAGE} onMore={()=>fetchList(products.length)} />
          </div>
        )}

        </div>

        {/* BOTÓN SUBIR */}
        <button className="tp-top" onClick={()=>window.scrollTo({top:0,behavior:"smooth"})} aria-label="Volver arriba">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
        </button>

        {/* ═════════ VENTANA: EDITAR / NUEVO ARTÍCULO ═════════ */}
        {form&&(
          <div className="tp-mo" onMouseDown={e=>{ if(e.target===e.currentTarget) setForm(null); }}>
            <form className="tp-mb" onSubmit={e=>{e.preventDefault(); saveForm();}}>
              <div className="tp-mh">
                <div>
                  <h3>{form.id?"Editar artículo":"Nuevo artículo"}</h3>
                  {form.id&&<small>#{form.id}{form.sku?` · Cód. ${form.sku}`:""}</small>}
                </div>
                <button type="button" className="tp-x" onClick={()=>setForm(null)} aria-label="Cerrar">×</button>
              </div>

              <div className="tp-mbody">
                {/* Columna de fotos */}
                <aside className="tp-photos">
                  <p className="tp-lbl">Foto principal</p>
                  <label className="tp-mainph">
                    {form.image_url
                      ? <img src={form.image_url} alt=""/>
                      : <span className="tp-mainph-empty">
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                          <span className="d-only">Tocá para subir</span>
                        </span>}
                    <span className="tp-mainph-btn">{uploadingId===(form.id??-1)?"Subiendo…":form.image_url?"Cambiar foto":"Subir foto"}</span>
                    <input type="file" accept="image/*" style={{display:"none"}} disabled={uploadingId===(form.id??-1)}
                      onChange={e=>{ const f=e.target.files?.[0]; e.target.value=""; if(!f) return; if(form.id) setMainPhoto(form.id,f); else uploadNewPhoto(f); }}/>
                  </label>
                  {form.id ? <p className="tp-hint">La foto se guarda al instante.</p> : <p className="tp-hint">Se guarda junto con el artículo.</p>}

                  <p className="tp-lbl" style={{marginTop:14}}>Más fotos</p>
                  <div className="tp-extras">
                    {(form.id ? extraImages : form.extra_urls.map((u,i)=>({id:i,image_url:u}))).map((img:any)=>(
                      <div key={img.id} className="tp-extra">
                        <img src={img.image_url} alt=""/>
                        <button type="button" aria-label="Quitar foto"
                          onClick={()=>form.id ? deleteExtraPhoto(form.id, img.id) : setForm(f=>f?{...f,extra_urls:f.extra_urls.filter((_,i)=>i!==img.id)}:f)}>×</button>
                      </div>
                    ))}
                    <label className={`tp-extra add${loadingImages?" busy":""}`} title="Agregar fotos (podés elegir varias)">
                      {loadingImages ? "…" : "+"}
                      <input type="file" accept="image/*" multiple style={{display:"none"}} disabled={loadingImages}
                        onChange={e=>{ const fs=Array.from(e.target.files||[]); e.target.value=""; addExtraPhotos(fs); }}/>
                    </label>
                  </div>
                  <p className="tp-hint">Podés elegir varias fotos a la vez.</p>
                </aside>

                {/* Columna de datos */}
                <div className="tp-fields">
                  <fieldset>
                    <legend>Datos</legend>
                    <label className="tp-f full">Nombre *
                      <input autoFocus={!form.id} value={form.name} onChange={e=>setF({name:e.target.value})}/>
                    </label>
                    <label className="tp-f m-full">Categoría *
                      <select value={form.category_id} onChange={e=>setF({category_id:e.target.value})}>
                        <option value="">Elegir…</option>
                        {categories.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </label>
                    <label className="tp-f m-full">Proveedor
                      <select value={form.supplier_id} onChange={e=>setF({supplier_id:e.target.value})}>
                        <option value="">Sin proveedor</option>
                        {suppliersList.map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                    </label>
                    <label className="tp-f">Código / SKU
                      <input value={form.sku} onChange={e=>setF({sku:e.target.value})} placeholder="Opcional"/>
                    </label>
                    <label className="tp-f">Stock (unidades)
                      <input type="number" min="0" inputMode="numeric" value={form.stock_quantity} placeholder="0" onChange={e=>setF({stock_quantity:e.target.value})}/>
                    </label>
                  </fieldset>

                  <fieldset className="tp-prices">
                    <legend>Precios</legend>
                    <label className="tp-f tp-costbox"><span>Costo <span className="opt">(lo que te cuesta)</span></span>
                      <span className="tp-money"><i>$</i><input type="number" min="0" inputMode="decimal" value={form.cost_price} placeholder="0"
                        onChange={e=>{const c=e.target.value; setForm(f=>f?{...f,cost_price:c,
                          price_retail: priceFrom(c,f.pct_retail) || f.price_retail,
                          price_wholesale: priceFrom(c,f.pct_wholesale) || f.price_wholesale}:f);}}/></span>
                    </label>
                    {([["Minorista","retail"],["Mayorista","wholesale"]] as const).map(([lbl,k])=>{
                      const pk = `pct_${k}` as "pct_retail"|"pct_wholesale", vk = `price_${k}` as "price_retail"|"price_wholesale";
                      return (
                        <div key={k} className="tp-pricebox">
                          <span className="tp-pricebox-h">{lbl} *</span>
                          <div className="tp-pricebox-row">
                            <span className="tp-money pct"><input type="number" inputMode="decimal" value={form[pk]} placeholder="%" title="% de ganancia sobre el costo"
                              onChange={e=>{const v=e.target.value; setForm(f=>f?{...f,[pk]:v,[vk]:priceFrom(f.cost_price,v)||f[vk]}:f);}}/><i>%</i></span>
                            <span className="tp-money big"><i>$</i><input type="number" min="0" inputMode="decimal" value={form[vk]} placeholder="0"
                              onChange={e=>{const v=e.target.value; setForm(f=>f?{...f,[vk]:v,[pk]:pctFrom(f.cost_price,v)||f[pk]}:f);}}/></span>
                          </div>
                          <small>{marginTxt(form[vk]) || "Con el costo cargado, el % calcula el precio solo"}</small>
                        </div>
                      );
                    })}
                  </fieldset>

                  <fieldset>
                    <legend>Tienda web</legend>
                    <label className="tp-f full"><span>Descripción <span className="opt">(se ve en la página del producto)</span></span>
                      <textarea rows={2} value={form.description} onChange={e=>setF({description:e.target.value})}/>
                    </label>
                    <div className="tp-switches">
                      {([["available","Visible en la web"],["featured","Destacado"],["is_offer","Oferta"],["is_new","Novedad"]] as const).map(([k,l])=>(
                        <label key={k} className={`tp-sw${form[k]?" on":""}`}>
                          <input type="checkbox" checked={!!form[k]} onChange={e=>setF({[k]:e.target.checked} as any)}/>{l}
                        </label>
                      ))}
                    </div>
                    {Number(form.stock_quantity||0)<=0&&<p className="tp-hint">Sin stock: no se muestra en la tienda hasta que cargues unidades.</p>}
                  </fieldset>
                </div>
              </div>

              <div className="tp-mf">
                {form.id
                  ? <button type="button" className="tp-del" onClick={async()=>{ if(await deleteProduct(form.id!)) setForm(null); }}><span className="d-only">Eliminar artículo</span><span className="m-only">Eliminar</span></button>
                  : <span className="tp-hint d-only">Enter para guardar · Esc para cerrar</span>}
                <div style={{display:"flex",gap:8}}>
                  <button type="button" className="tp-btn" onClick={()=>setForm(null)}>Cancelar</button>
                  <button type="submit" className="tp-btn primary" disabled={saving}>{saving?"Guardando…":form.id?"Guardar cambios":"Crear artículo"}</button>
                </div>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

const CSS = `
.tienda{color:#1a1a1a}
.admin-content{min-width:0;overflow-x:clip}
.admin-inner{max-width:1180px;margin:0 auto}
.tienda button,.tienda label{font-family:inherit}
.tp-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.tp-title{font-size:22px;font-weight:700;margin:0}
.tp-sub{color:#6b7280;font-size:13px;margin-top:2px}
.tp-actions{display:flex;gap:8px;flex-wrap:wrap}
.tp-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 14px;border-radius:9px;border:1px solid #e5e7eb;background:#fff;color:#374151;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .15s,border-color .15s}
.tp-btn:hover:not(:disabled){background:#f9fafb;border-color:#d1d5db}
.tp-btn.sm{padding:6px 11px;font-size:12px}
.tp-btn.on{background:#ecfeff;border-color:#67e8f9;color:#0e7490}
.tp-btn.primary{background:#0891b2;border-color:#0891b2;color:#fff}
.tp-btn.primary:hover:not(:disabled){background:#0e7490;border-color:#0e7490}
.tp-btn.primary:disabled{opacity:.6}
.tp-btn.green{background:#ecfdf5;border-color:#6ee7b7;color:#047857}
.tp-btn.wa{background:#22c55e;border-color:#22c55e;color:#fff}
.tp-btn.wa:hover{background:#16a34a!important}
.tp-btn kbd{font:600 10px/1 inherit;background:rgba(255,255,255,.22);padding:3px 5px;border-radius:4px}
.tp-pill{display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
.tp-card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:16px 18px}
.tp-card.flush{padding:0;overflow:hidden}
.tp-card-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px}
.tp-card-h h3{font-size:15px;font-weight:700;margin:0;display:flex;align-items:center;gap:8px}
.tp-count{font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:#f3f4f6;color:#374151}
.tp-count.red{background:#fee2e2;color:#b91c1c}
.tp-empty{color:#6b7280;font-size:13px}
.tp-empty.pad{padding:18px}
.tp-more{font-size:12px;color:#6b7280;margin-top:6px;text-align:center}
.tp-hint{font-size:11.5px;color:#6b7280;margin-top:6px}
.tp-lbl{font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}
.r{text-align:right}.c{text-align:center}
.m-only{display:none}

/* Filtros */
.tp-filters{display:grid;gap:10px;margin-bottom:12px}
.tp-frow{display:flex;gap:8px;flex-wrap:wrap}
.tp-search{flex:1 1 260px;min-width:0;padding:10px 12px;border:1px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;font-family:inherit;background:#fff;color:#1a1a1a}
.tp-search:focus,.tp-select:focus{border-color:#67e8f9;box-shadow:0 0 0 3px rgba(8,145,178,.12)}
.tp-select{padding:10px 12px;border:1px solid #e5e7eb;border-radius:10px;font-size:13px;background:#fff;color:#1a1a1a;outline:none;font-family:inherit;min-width:200px;cursor:pointer}
.tp-chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}
.tp-chips::-webkit-scrollbar{display:none}
.tp-chip{flex-shrink:0;padding:6px 12px;border-radius:999px;border:1px solid #e5e7eb;background:#fff;color:#4b5563;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap}
.tp-chip em{font-style:normal;font-size:11px;color:#9ca3af;margin-left:3px}
.tp-chip.on{background:#0891b2;border-color:#0891b2;color:#fff}
.tp-chip.on em{color:#cffafe}

/* Lista de artículos */
.tp-prow{display:grid;grid-template-columns:44px minmax(0,1fr) 110px 110px 104px 76px 82px;align-items:center;gap:12px;padding:8px 14px;border-top:1px solid #f1f3f5}
.tp-prow:hover{background:#fafbfc}
.tp-prow.off .tp-pname b{color:#9ca3af}
.tp-phead{border-top:none;background:#f9fafb;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;padding:9px 14px}
.tp-phead:hover{background:#f9fafb}
.tp-pthumb{cursor:pointer;display:block;line-height:0;border-radius:9px}
.tp-pthumb:hover{outline:2px solid #67e8f9;outline-offset:1px}
.tp-img{border-radius:9px;object-fit:cover;background:#f3f4f6;display:block}
.tp-noimg{display:inline-flex;align-items:center;justify-content:center;border-radius:9px;background:#f3f4f6;color:#9ca3af;border:1px dashed #d1d5db}
.tp-pname{all:unset;cursor:pointer;min-width:0;display:flex;flex-direction:column;gap:2px}
.tp-pname b{font-size:13.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tp-pname small{font-size:11.5px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tp-pname:hover b{color:#0e7490;text-decoration:underline}
.tp-price{font-size:14px;font-weight:700;color:#0e7490;font-variant-numeric:tabular-nums}
.tp-price.wh{color:#1d4ed8;font-weight:600}
.tp-price .m{display:none}
.tp-stock{display:inline-flex;align-items:center;justify-content:center;gap:6px}
.tp-stock input{width:64px;padding:6px 8px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;text-align:center;font-family:inherit;outline:none;color:#1a1a1a;font-weight:600}
.tp-stock input:focus{border-color:#67e8f9;box-shadow:0 0 0 3px rgba(8,145,178,.12)}
.tp-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.tp-toggle{width:38px;height:22px;border-radius:999px;border:none;background:#d1d5db;position:relative;cursor:pointer;transition:background .2s;padding:0}
.tp-toggle i{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2);transition:left .2s}
.tp-toggle.on{background:#10b981}
.tp-toggle.on i{left:19px}
.tp-pacts{display:flex;justify-content:flex-end}
.tp-foot{display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:10px}
.tp-foot>span{font-size:12px;color:#6b7280}
.tp-loadmore:disabled{opacity:.6;cursor:default}
.tp-loadmore{width:100%;margin-top:10px;padding:11px;border-radius:10px;border:1px dashed #a5f3fc;background:#f0fdff;color:#0e7490;font-size:13px;font-weight:600;cursor:pointer}

/* Pedidos */
.tp-orow{all:unset;box-sizing:border-box;width:100%;display:grid;grid-template-columns:92px minmax(0,1.3fr) minmax(0,1fr) 110px 190px 20px;gap:12px;align-items:center;padding:11px 16px;cursor:pointer}
.tp-ohead{cursor:default;background:#f9fafb;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;padding:9px 16px}
.tp-oitem{border-top:1px solid #f1f3f5}
.tp-oitem:hover>.tp-orow{background:#fafbfc}
.tp-oitem.open{background:#fbfeff}
.tp-oitem.open>.tp-orow{background:#ecfeff}
.tp-oid,.tp-ocli,.tp-odel{display:flex;flex-direction:column;gap:1px;min-width:0;font-size:13px}
.tp-oid b,.tp-ocli b{font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tp-oid small,.tp-ocli small,.tp-odel small{font-size:11.5px;color:#6b7280}
.tp-ototal{font-size:15px;color:#0e7490;font-variant-numeric:tabular-nums}
.tp-otags{display:flex;gap:5px;flex-wrap:wrap}
.tp-chev{color:#9ca3af;font-size:12px;text-align:center}
.tp-odetail{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:18px;padding:6px 16px 16px}
.tp-oitems{align-self:start;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:6px 12px}
.tp-oline{display:grid;grid-template-columns:44px minmax(0,1fr) 90px 100px;gap:10px;padding:7px 0;border-top:1px dashed #eef0f2;font-size:13px;align-items:center}
.tp-oline.head{border-top:none;font-size:10.5px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.04em}
.tp-oline b:first-child{color:#0e7490}
.tp-oline.total{border-top:1px solid #e5e7eb;font-weight:700;font-size:14px}
.tp-oaddr{font-size:12.5px;color:#4b5563;padding:8px 0 4px;border-top:1px dashed #eef0f2}
.tp-oside{display:grid;gap:14px;align-content:start}
.tp-seg{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.tp-seg button{padding:8px;border-radius:9px;border:1px solid #e5e7eb;background:#fff;color:#4b5563;font-size:12.5px;font-weight:600;cursor:pointer}
.tp-seg button.on{font-weight:700}
.tp-oacts{display:grid;gap:6px}

/* Resumen */
.tp-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}
.tp-kpi{all:unset;box-sizing:border-box;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:4px}
.tp-kpi span{font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.04em}
.tp-kpi b{font-size:24px;font-weight:700;font-variant-numeric:tabular-nums}
.tp-kpi small{font-size:12px;color:#6b7280}
.tp-kpi.link{cursor:pointer}
.tp-kpi.link:hover{border-color:#67e8f9}
.tp-dash{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:14px;align-items:start}
.tp-mini{all:unset;box-sizing:border-box;width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto 96px;gap:10px;align-items:center;padding:10px 4px;border-top:1px solid #f1f3f5;cursor:pointer}
.tp-mini:hover{background:#fafbfc}
.tp-mini-main{display:flex;flex-direction:column;min-width:0}
.tp-mini-main b{font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tp-mini-main small{font-size:11.5px;color:#6b7280}
.tp-mini-tags{display:flex;gap:4px}
.tp-mini-total{text-align:right;color:#0e7490;font-size:14px}
.tp-low{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 2px;border-top:1px solid #f1f3f5}
.tp-low-name{display:flex;flex-direction:column;min-width:0}
.tp-low-name b{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tp-low-name small{font-size:11px;color:#6b7280}

/* Sin foto */
.tp-sfgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}
.tp-sf{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:6px;cursor:pointer;transition:border-color .15s,box-shadow .15s}
.tp-sf:hover{border-color:#67e8f9;box-shadow:0 4px 14px rgba(8,145,178,.1)}
.tp-sf-drop{aspect-ratio:4/3;border:2px dashed #d1d5db;border-radius:10px;background:#f9fafb;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:#6b7280;font-size:12.5px;font-weight:600}
.tp-sf:hover .tp-sf-drop{border-color:#22d3ee;color:#0e7490;background:#ecfeff}
.tp-sf b{font-size:13px;font-weight:600;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.tp-sf-meta{display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:11.5px;color:#6b7280}

.tp-top{position:fixed;bottom:20px;right:20px;z-index:90;width:42px;height:42px;border-radius:50%;background:#fff;border:1px solid #d1d5db;color:#0891b2;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.1)}

/* Ventana editar / nuevo */
.tp-mo{position:fixed;inset:0;z-index:200;background:rgba(15,23,42,.5);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:16px}
.tp-mb{background:#fff;color:#1a1a1a;border-radius:18px;width:min(920px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.25)}
.tp-mh{display:flex;justify-content:space-between;align-items:center;padding:16px 22px;border-bottom:1px solid #eef0f2}
.tp-mh h3{font-size:18px;font-weight:700;margin:0}
.tp-mh small{font-size:12px;color:#6b7280}
.tp-x{width:34px;height:34px;border-radius:50%;border:none;background:#f3f4f6;color:#4b5563;font-size:22px;line-height:1;cursor:pointer}
.tp-mbody{display:grid;grid-template-columns:220px minmax(0,1fr);gap:22px;padding:18px 22px;overflow-y:auto;min-height:0}
.tp-photos{min-width:0}
.tp-mainph{display:block;position:relative;aspect-ratio:1;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;background:#f9fafb;cursor:pointer}
.tp-mainph img{width:100%;height:100%;object-fit:cover;display:block}
.tp-mainph-empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:#9ca3af;font-size:12px;font-weight:600;border:2px dashed #d1d5db;border-radius:14px}
.tp-mainph-btn{position:absolute;left:8px;right:8px;bottom:8px;text-align:center;padding:7px;border-radius:9px;background:rgba(255,255,255,.94);color:#047857;font-size:12.5px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.12)}
.tp-mainph:hover .tp-mainph-btn{background:#ecfdf5}
.tp-extras{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.tp-extra{position:relative;aspect-ratio:1;border-radius:8px;overflow:visible}
.tp-extra img{width:100%;height:100%;object-fit:cover;border-radius:8px;display:block}
.tp-extra button{position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;border:2px solid #fff;background:#ef4444;color:#fff;font-size:13px;line-height:1;cursor:pointer;padding:0}
.tp-extra.add{border:2px dashed #d1d5db;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:22px;cursor:pointer;border-radius:8px}
.tp-extra.add:hover{border-color:#22d3ee;color:#0e7490}
.tp-extra.add.busy{cursor:wait;opacity:.6}
.tp-fields{display:grid;gap:14px;min-width:0}
.tp-fields fieldset{border:1px solid #eef0f2;border-radius:14px;padding:12px 14px 14px;margin:0;display:grid;grid-template-columns:1fr 1fr;gap:10px 12px;min-width:0}
.tp-fields legend{font-size:11px;font-weight:700;color:#0e7490;text-transform:uppercase;letter-spacing:.05em;padding:0 6px}
.tp-f{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600;color:#374151;min-width:0}
.tp-f.full{grid-column:1/-1}
.tp-f .opt{font-weight:500;color:#9ca3af}
.tp-f input,.tp-f select,.tp-f textarea,.tp-money input{width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid #e5e7eb;border-radius:9px;font-size:14px;font-family:inherit;color:#1a1a1a;background:#fff;outline:none;font-weight:500}
.tp-f textarea{resize:vertical;min-height:44px}
.tp-f input:focus,.tp-f select:focus,.tp-f textarea:focus,.tp-money input:focus{border-color:#22d3ee;box-shadow:0 0 0 3px rgba(8,145,178,.12)}
.tp-money{position:relative;display:block}
.tp-money i{position:absolute;top:50%;transform:translateY(-50%);left:11px;font-style:normal;color:#9ca3af;font-size:13px;pointer-events:none}
.tp-money input{padding-left:24px}
.tp-money.pct{width:84px;flex-shrink:0}
.tp-money.pct input{padding-left:10px;padding-right:24px}
.tp-money.pct i{left:auto;right:10px}
.tp-money.big{flex:1;min-width:0}
.tp-money.big input{font-size:16px;font-weight:700}
.tp-fields fieldset.tp-prices{grid-template-columns:minmax(0,.8fr) minmax(0,1fr) minmax(0,1fr);align-items:stretch}
.tp-costbox{border-radius:12px;background:#f9fafb;padding:10px;justify-content:flex-start}
.tp-pricebox{border-radius:12px;background:#f9fafb;padding:10px;display:flex;flex-direction:column;gap:6px;min-width:0}
.tp-pricebox-h{font-size:12px;font-weight:700;color:#374151}
.tp-pricebox-row{display:flex;gap:6px}
.tp-pricebox small{font-size:11px;color:#6b7280;min-height:14px}
.tp-switches{grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap}
.tp-sw{display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border-radius:999px;border:1px solid #e5e7eb;font-size:13px;font-weight:600;color:#4b5563;cursor:pointer;user-select:none}
.tp-sw input{accent-color:#0891b2;width:15px;height:15px;margin:0}
.tp-sw.on{background:#ecfeff;border-color:#67e8f9;color:#0e7490}
.tp-fields .tp-hint{grid-column:1/-1;margin:0}
.tp-mf{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 22px;border-top:1px solid #eef0f2;background:#fafbfc}
.tp-mf .tp-btn{padding:10px 18px;font-size:14px}
.tp-del{border:none;background:none;color:#dc2626;font-size:13px;font-weight:600;cursor:pointer;padding:8px 4px}
.tp-del:hover{text-decoration:underline}

/* ── Tablet / celular ── */
@media(max-width:1000px){
  .tp-orow{grid-template-columns:80px minmax(0,1fr) 100px 170px 16px}
  .tp-odel,.tp-ohead span:nth-child(3){display:none}
  .tp-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
  .tp-dash{grid-template-columns:minmax(0,1fr)}
}
@media(max-width:760px){
  .tp-title{font-size:20px}
  .tp-actions{width:100%}
  .tp-actions .tp-btn{flex:1 1 auto}
  .tp-actions .tp-btn.primary{flex-basis:100%}
  .tp-select{min-width:0;flex:1 1 100%}
  .tp-phead,.tp-ohead{display:none}
  .tp-prow{grid-template-columns:52px minmax(0,1fr) auto;grid-template-areas:"img name name" "img ret wh" "stk stk web";gap:6px 10px;padding:12px}
  .tp-pthumb{grid-area:img}.tp-pthumb .tp-img,.tp-pthumb .tp-noimg{width:52px!important;height:52px!important}
  .tp-pname{grid-area:name}
  .tp-pname b{white-space:normal}
  .tp-price{grid-area:ret;text-align:left;font-size:14px}
  .tp-price.wh{grid-area:wh;text-align:right}
  .tp-price .m{display:block;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase}
  .tp-stock{grid-area:stk;justify-content:flex-start}
  .tp-stock::before{content:"Stock";font-size:12px;color:#6b7280;font-weight:600}
  .tp-web{grid-area:web;display:flex;align-items:center;justify-content:flex-end;gap:6px}
  .tp-web::before{content:"En la web";font-size:12px;color:#6b7280;font-weight:600}
  .tp-pacts{display:none}
  .tp-orow{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"cli total" "tags id";gap:4px 10px;padding:12px 14px}
  .tp-ocli{grid-area:cli}.tp-ototal{grid-area:total}.tp-otags{grid-area:tags}.tp-oid{grid-area:id;text-align:right;flex-direction:row;gap:6px;justify-content:flex-end;align-items:center}
  .tp-chev{display:none}
  .tp-odetail{grid-template-columns:minmax(0,1fr);padding:4px 12px 14px}
  .tp-oline{grid-template-columns:34px minmax(0,1fr) 84px}
  .tp-oline>:nth-child(3){display:none}
  .tp-mini{grid-template-columns:minmax(0,1fr) 90px}
  .tp-mini-tags{display:none}
  .tp-mo{padding:0;align-items:flex-end}
  .tp-mb{border-radius:18px 18px 0 0;max-height:94vh}
  .tp-mh{padding:14px 16px}
  .tp-mbody{grid-template-columns:minmax(0,1fr);padding:14px 16px;gap:14px}
  .tp-photos{display:grid;grid-template-columns:110px minmax(0,1fr);gap:4px 12px;align-items:start}
  .tp-photos>.tp-lbl:first-child{grid-column:1/-1}
  .tp-photos>.tp-hint,.tp-photos>.tp-lbl:not(:first-child),.tp-photos>.tp-extras{grid-column:2}
  .tp-mainph{grid-row:2/span 3}
  .tp-mainph-btn{font-size:11px;padding:5px}
  .tp-fields fieldset{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .tp-fields fieldset.tp-prices{grid-template-columns:minmax(0,1fr)}
  .tp-f.m-full{grid-column:1/-1}
  .d-only{display:none}.m-only{display:inline}
  .tp-mf{padding:10px 16px}
  .tp-mf .tp-btn{padding:10px 14px}
}
`;

// Pie de las listas paginadas: "Mostrando 10 de 296 · Mostrar 10 más"
function ListFooter({ shown, total, loading, more, step, onMore }: { shown:number; total:number; loading:boolean; more:boolean; step:number; onMore:()=>void }) {
  if (!total) return null;
  return (
    <div className="tp-foot">
      <span>Mostrando {shown} de {total}</span>
      {more && <button className="tp-loadmore" onClick={onMore} disabled={loading}>{loading ? "Cargando…" : `Mostrar ${Math.min(step, total - shown)} más`}</button>}
    </div>
  );
}

type AdjustTarget = { category_id?: number; supplier_id?: number; product_id?: number };
function PriceAdjuster({ categories, onAdjust }: { categories:any[]; onAdjust:(target:AdjustTarget,pct:number)=>Promise<void> }) {
  const [mode, setMode]         = useState<"category"|"supplier"|"product">("category");
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supId, setSupId]       = useState("");
  useEffect(()=>{ fetch("/api/crm/suppliers",{credentials:"include"}).then(r=>r.ok?r.json():[]).then(d=>Array.isArray(d)&&setSuppliers(d)).catch(()=>{}); },[]);
  const [catId, setCatId]       = useState("all");
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState<number|null>(null);
  const [pct, setPct]           = useState("");
  const [loading, setLoading]   = useState(false);

  // Buscar producto: espera a que termines de escribir y trae 8 de la base
  const [filtered, setFiltered] = useState<any[]>([]);
  useEffect(()=>{
    const term = search.trim();
    if (mode!=="product" || !term || selected) { setFiltered([]); return; }
    let vivo = true;
    const t = setTimeout(()=>{
      fetch(`/api/products/lista?limit=8&q=${encodeURIComponent(term)}`,{credentials:"include"})
        .then(r=>r.ok?r.json():null).then(d=>{ if(vivo && d) setFiltered(d.items); }).catch(()=>{});
    }, 350);
    return ()=>{ vivo=false; clearTimeout(t); };
  },[search, mode, selected]);

  const handle = async() => {
    const n = Number(pct);
    if (!pct||isNaN(n)||n===0) { alert("Ingresá un porcentaje válido"); return; }
    let target: AdjustTarget = {};
    let label = "";
    if (mode==="category") {
      if (catId!=="all") target = { category_id: Number(catId) };
      label = catId==="all" ? "TODOS los artículos" : `la categoría ${categories.find((c:any)=>c.id===Number(catId))?.name}`;
    } else if (mode==="supplier") {
      if (!supId) { alert("Elegí un proveedor"); return; }
      const sup = suppliers.find((x:any)=>String(x.id)===supId);
      if (!sup?.products) { alert("Ese proveedor no tiene productos asignados"); return; }
      target = { supplier_id: Number(supId) };
      label = `los ${sup.products} productos de ${sup.name}`;
    } else {
      if (!selected) { alert("Seleccioná un producto"); return; }
      target = { product_id: selected };
      label = search;
    }
    if (!confirm(`¿Ajustar precios ${n>0?"+":""}${n}% en ${label}?`)) return;
    setLoading(true);
    await onAdjust(target, n);
    setPct(""); setSearch(""); setSelected(null);
    setLoading(false);
  };

  return (
    <div style={{padding:"14px 16px",background:"#ffffff",border:"1px solid #e5e7eb",borderRadius:12,marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
        <span style={{fontSize:13,fontWeight:700,color:"#1a1a1a"}}>Ajustar precios por porcentaje</span>
        <div style={{display:"flex",gap:6}}>
          {[["category","Por categoría"],["supplier","Por proveedor"],["product","Por producto"]].map(([m,l])=>(
            <button key={m} onClick={()=>setMode(m as "category"|"supplier"|"product")}
              style={{padding:"6px 12px",borderRadius:7,border:`1px solid ${mode===m?"rgba(0,180,216,.5)":"#e5e7eb"}`,background:mode===m?"rgba(0,180,216,.12)":"#ffffff",color:mode===m?"#00B4D8":"#666",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div style={{display:"flex",gap:10,alignItems:"flex-start",flexWrap:"wrap"}}>
        {mode==="category" ? (
          <select value={catId} onChange={e=>setCatId(e.target.value)}
            style={{padding:"8px 10px",background:"#ffffff",border:"1px solid #e5e7eb",borderRadius:7,color:"#1a1a1a",fontSize:13,outline:"none",fontFamily:"inherit",minWidth:200}}>
            <option value="all">Todas las categorías</option>
            {categories.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        ) : mode==="supplier" ? (
          <select value={supId} onChange={e=>setSupId(e.target.value)}
            style={{padding:"8px 10px",background:"#ffffff",border:"1px solid #e5e7eb",borderRadius:7,color:"#1a1a1a",fontSize:13,outline:"none",fontFamily:"inherit",minWidth:220}}>
            <option value="">Elegí un proveedor…</option>
            {suppliers.map((x:any)=>{
              const n = Number(x.products) || 0;
              return <option key={x.id} value={x.id}>{x.name} ({n} {n===1?"producto":"productos"})</option>;
            })}
          </select>
        ) : (
          <div style={{position:"relative",minWidth:240,flex:"1 1 240px",maxWidth:380}}>
            <input value={search} onChange={e=>{setSearch(e.target.value);setSelected(null);}}
              placeholder="Buscar producto..."
              style={{width:"100%",padding:"8px 10px",background:"#ffffff",border:"1px solid #e5e7eb",borderRadius:7,color:"#1a1a1a",fontSize:13,outline:"none",fontFamily:"inherit"}}/>
            {search&&!selected&&filtered.length>0&&(
              <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#ffffff",border:"1px solid #e5e7eb",borderRadius:8,zIndex:50,maxHeight:200,overflowY:"auto",boxShadow:"0 4px 12px rgba(0,0,0,.1)"}}>
                {filtered.map((p:any)=>(
                  <div key={p.id} onClick={()=>{setSelected(p.id);setSearch(p.name);}}
                    style={{padding:"8px 12px",cursor:"pointer",fontSize:13,color:"#1a1a1a",borderBottom:"1px solid #f3f4f6"}}
                    onMouseEnter={e=>{e.currentTarget.style.background="#f9fafb"}}
                    onMouseLeave={e=>{e.currentTarget.style.background="#ffffff"}}>
                    {p.name} - <span style={{color:"#00B4D8"}}>${Number(p.price_retail).toLocaleString("es-AR")}</span>
                  </div>
                ))}
              </div>
            )}
            {selected&&<p style={{fontSize:11,color:"#00B4D8",marginTop:3}}>Producto seleccionado</p>}
          </div>
        )}
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <input type="number" value={pct} onChange={e=>setPct(e.target.value)} placeholder="Ej: 10 o -5"
            style={{width:110,padding:"8px 10px",background:"#ffffff",border:"1px solid #e5e7eb",borderRadius:7,color:"#1a1a1a",fontSize:13,outline:"none",fontFamily:"inherit"}}/>
          <span style={{fontSize:12,color:"#666"}}>%</span>
        </div>
        <button onClick={handle} disabled={loading}
          style={{padding:"8px 16px",borderRadius:7,background:"#00B4D8",border:"none",color:"#ffffff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",opacity:loading?.6:1}}>
          {loading?"Aplicando...":"Aplicar"}
        </button>
      </div>
      <p style={{fontSize:11,color:"#666",marginTop:8}}>Positivo sube el precio, negativo lo baja. Ej: 10 sube 10%, -5 baja 5%.</p>
    </div>
  );
}
