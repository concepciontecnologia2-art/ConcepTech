"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const fmt = (n:number) => new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(n);
const fmtDate = (s:string) => new Date(s).toLocaleDateString("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});

type Order = { id:number; customer_name:string; phone:string; email:string|null; sale_type:string; delivery_type:string; address:string|null; items:{name:string;qty:number;price:number}[]; total:number; status:string; paid:boolean; created_at:string; };
type Product = { id:number; name:string; description:string; category_name:string; category_id:number; subcategory_id:number|null; price_retail:number; price_wholesale:number; available:boolean; featured:boolean; is_offer:boolean; is_new:boolean; stock_level:string; image_url:string|null; };
type Category = { id:number; name:string; icon:string };

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

function generatePDF(order: Order) {
  const lines = order.items.map(i=>`  • ${i.qty}x ${i.name}: ${fmt(i.qty*i.price)}`).join("\n");
  const content = `CONCEPCIÓN TECNOLOGÍA\nIndependencia 450, Concepción, Tucumán\n${"─".repeat(40)}\nFACTURA #${order.id}\nFecha: ${fmtDate(order.created_at)}\n${"─".repeat(40)}\nCliente: ${order.customer_name}\nTeléfono: ${order.phone}${order.email?"\nEmail: "+order.email:""}\nEntrega: ${order.delivery_type==="pickup"?"Retira en local":"Envío a: "+order.address}\nTipo: ${order.sale_type==="retail"?"Minorista":"Mayorista"}\n${"─".repeat(40)}\nDETALLE:\n${lines}\n${"─".repeat(40)}\nTOTAL: ${fmt(Number(order.total))}\nEstado pago: ${order.paid?"PAGADO ✓":"PENDIENTE"}\n${"─".repeat(40)}\n¡Gracias por su compra!`;
  const blob = new Blob([content],{type:"text/plain;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=`factura-${order.id}.txt`; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminPanel() {
  const router = useRouter();
  const [tab, setTab] = useState<"dashboard"|"orders"|"products">("dashboard");
  const [orders, setOrders]     = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]   = useState(true);
  const [orderFilter, setOrderFilter] = useState("all");
  const [catFilter, setCatFilter]     = useState("all");
  const [expandedOrder, setExpandedOrder] = useState<number|null>(null);
  const [editingProduct, setEditingProduct] = useState<Product|null>(null);

  useEffect(()=>{
    Promise.all([
      fetch("/api/orders").then(r=>r.json()),
      fetch("/api/products").then(r=>r.json()),
      fetch("/api/categories").then(r=>r.json()),
    ]).then(([o,p,c])=>{ setOrders(o); setProducts(p); setCategories(c); setLoading(false); });
  },[]);

  const logout = async()=>{ await fetch("/api/auth/login",{method:"DELETE"}); router.refresh(); };
  const patchOrder = async(id:number,data:Record<string,unknown>)=>{
    await fetch(`/api/orders/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
    setOrders(prev=>prev.map(o=>o.id===id?{...o,...data}:o));
  };
  const patchProduct = async(id:number,data:Record<string,unknown>)=>{
    await fetch(`/api/products/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
    setProducts(prev=>prev.map(p=>p.id===id?{...p,...data}:p));
  };
  const saveProduct = async()=>{
    if(!editingProduct)return;
    await fetch(`/api/products/${editingProduct.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(editingProduct)});
    setProducts(prev=>prev.map(p=>p.id===editingProduct.id?editingProduct:p));
    setEditingProduct(null);
  };
  const deleteProduct = async(id:number)=>{
    if(!confirm("¿Eliminar este producto?"))return;
    await fetch(`/api/products/${id}`,{method:"DELETE"});
    setProducts(prev=>prev.filter(p=>p.id!==id));
  };

  const totalPaid    = orders.filter(o=>o.paid).reduce((s,o)=>s+Number(o.total),0);
  const totalPending = orders.filter(o=>!o.paid&&o.status!=="cancelled").reduce((s,o)=>s+Number(o.total),0);
  const pendingCount = orders.filter(o=>o.status==="pending").length;
  const filteredOrders   = orderFilter==="all"?orders:orders.filter(o=>o.status===orderFilter);
  const filteredProducts = catFilter==="all"?products:products.filter(p=>p.category_name===catFilter);
  const uniqueCats = [...new Set(products.map(p=>p.category_name))];

  const navStyle = (active:boolean) => ({display:"flex" as const,alignItems:"center" as const,gap:10,padding:"10px 14px",borderRadius:10,border:"none" as const,background:active?"rgba(0,180,216,.1)":"transparent",color:active?"#00B4D8":"#445",cursor:"pointer" as const,fontSize:13,fontWeight:500 as const,fontFamily:"inherit",width:"100%",textAlign:"left" as const,borderLeft:`2px solid ${active?"#00B4D8":"transparent"}`,transition:"all .15s"});
  const cardStyle = {background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:14,padding:"18px 20px"};
  const btnStyle = (v:string) => ({padding:"7px 13px",borderRadius:7,bd:"none",fontSize:12,fontWeight:600 as const,cursor:"pointer" as const,fontFamily:"inherit",...(v==="cyan"?{background:"rgba(0,180,216,.12)",color:"#00B4D8",border:"1px solid rgba(0,180,216,.25)"}:v==="red"?{background:"rgba(239,68,68,.1)",color:"#ef4444",border:"1px solid rgba(239,68,68,.2)"}:v==="green"?{background:"rgba(16,185,129,.1)",color:"#10b981",border:"1px solid rgba(16,185,129,.2)"}:v==="amber"?{background:"rgba(245,158,11,.1)",color:"#f59e0b",border:"1px solid rgba(245,158,11,.2)"}:{background:"rgba(255,255,255,.06)",color:"#778",border:"1px solid rgba(255,255,255,.1)"})});
  const inputStyle = {padding:"10px 13px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,color:"#e8edf2",fontSize:13,fontFamily:"inherit",outline:"none",width:"100%"};

  if(loading) return <div style={{minHeight:"100vh",background:"#060a0f",display:"flex",alignItems:"center",justifyContent:"center",color:"#445",fontFamily:"inherit"}}>Cargando...</div>;

  return (
    <div style={{minHeight:"100vh",background:"#060a0f",color:"#e8edf2",fontFamily:"'DM Sans',system-ui,sans-serif",display:"flex"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Syne:wght@700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0d1117}::-webkit-scrollbar-thumb{background:#1a2535;border-radius:4px}table{width:100%;border-collapse:collapse}th{text-align:left;font-size:11px;color:#334;font-weight:600;letter-spacing:.06em;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.05)}td{padding:11px 14px;border-bottom:1px solid rgba(255,255,255,.04);font-size:13px;vertical-align:middle}tr:last-child td{border-bottom:none}tr:hover td{background:rgba(255,255,255,.015)}.pill{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600}.modal-ov{position:fixed;inset:0;background:rgba(0,0,0,.8);backdrop-filter:blur(6px);z-index:100;display:flex;align-items:center;justify-content:center;padding:20px}.modal-bx{background:#0d1117;border:1px solid rgba(0,180,216,.2);border-radius:18px;padding:26px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto}select{padding:7px 11px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#e8edf2;font-size:12px;outline:none;cursor:pointer;font-family:inherit}select option{background:#0d1117}.toggle-track{width:36px;height:20px;border-radius:10px;border:none;cursor:pointer;position:relative;transition:background .2s}.toggle-thumb{position:absolute;width:14px;height:14px;background:white;border-radius:50%;top:3px;transition:left .2s}`}</style>

      {/* SIDEBAR */}
      <nav style={{width:200,background:"rgba(255,255,255,.02)",borderRight:"1px solid rgba(255,255,255,.06)",padding:"22px 12px",display:"flex",flexDirection:"column",gap:4,flexShrink:0}}>
        <div style={{marginBottom:22,paddingLeft:14}}>
          <p style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:800,color:"#fff"}}><span style={{color:"#00B4D8"}}>Conc.</span> Tech</p>
          <p style={{fontSize:10,color:"#223",marginTop:2,letterSpacing:".06em"}}>PANEL ADMIN</p>
        </div>
        {([["dashboard","◈","Dashboard"],["orders","📋","Pedidos"],["products","📦","Productos"]] as const).map(([id,icon,label])=>(
          <button key={id} style={navStyle(tab===id)} onClick={()=>setTab(id)}>
            <span>{icon}</span>{label}
            {id==="orders"&&pendingCount>0&&<span style={{marginLeft:"auto",background:"#f59e0b",color:"#080c10",borderRadius:20,padding:"1px 7px",fontSize:10,fontWeight:800}}>{pendingCount}</span>}
          </button>
        ))}
        <div style={{flex:1}}/>
        <button style={navStyle(false)} onClick={logout}><span>⇤</span>Cerrar sesión</button>
      </nav>

      <main style={{flex:1,padding:"26px 24px",overflowY:"auto",maxHeight:"100vh"}}>

        {/* DASHBOARD */}
        {tab==="dashboard" && (
          <div>
            <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,marginBottom:4}}>Dashboard</h2>
            <p style={{color:"#334",fontSize:13,marginBottom:22}}>Resumen del negocio</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:24}}>
              {[
                {label:"Cobrado",      value:fmt(totalPaid),    icon:"💰",color:"#10b981"},
                {label:"Por cobrar",   value:fmt(totalPending), icon:"⏳",color:"#f59e0b"},
                {label:"Sin confirmar",value:pendingCount,      icon:"📬",color:"#3b82f6"},
                {label:"Total pedidos",value:orders.length,     icon:"📋",color:"#a78bfa"},
              ].map((m,i)=>(
                <div key={i} style={{...cardStyle}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><p style={{fontSize:11,color:"#334",fontWeight:600}}>{m.label.toUpperCase()}</p><span style={{fontSize:16}}>{m.icon}</span></div>
                  <p style={{fontSize:22,fontWeight:800,color:m.color,fontFamily:"'Syne',sans-serif"}}>{m.value}</p>
                </div>
              ))}
            </div>
            <div style={cardStyle}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <h3 style={{fontSize:14,fontWeight:600}}>Últimos pedidos</h3>
                <button style={btnStyle("cyan")} onClick={()=>setTab("orders")}>Ver todos →</button>
              </div>
              <table>
                <thead><tr><th>CLIENTE</th><th>TOTAL</th><th>ESTADO</th><th>PAGO</th><th>FECHA</th></tr></thead>
                <tbody>{orders.slice(0,5).map(o=>(
                  <tr key={o.id}>
                    <td><p style={{fontWeight:500}}>{o.customer_name}</p><p style={{fontSize:11,color:"#334"}}>{o.phone}</p></td>
                    <td style={{color:"#00B4D8",fontWeight:700}}>{fmt(Number(o.total))}</td>
                    <td><span className="pill" style={{background:STATUS[o.status]?.bg,color:STATUS[o.status]?.color}}>{STATUS[o.status]?.label}</span></td>
                    <td><span className="pill" style={{background:o.paid?"rgba(16,185,129,.12)":"rgba(245,158,11,.12)",color:o.paid?"#10b981":"#f59e0b"}}>{o.paid?"Pagado":"Pendiente"}</span></td>
                    <td style={{color:"#334",fontSize:12}}>{fmtDate(o.created_at)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {products.filter(p=>p.stock_level==="bajo").length>0 && (
              <div style={{...cardStyle,marginTop:14}}>
                <h3 style={{fontSize:14,fontWeight:600,marginBottom:12}}>🔴 Stock bajo</h3>
                {products.filter(p=>p.stock_level==="bajo").map(p=>(
                  <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"rgba(239,68,68,.05)",border:"1px solid rgba(239,68,68,.15)",borderRadius:9,marginBottom:8}}>
                    <div style={{flex:1}}><p style={{fontSize:13,fontWeight:500}}>{p.name}</p><p style={{fontSize:11,color:"#556"}}>{p.category_name}</p></div>
                    <span style={{color:"#ef4444",fontWeight:700,fontSize:12,padding:"2px 8px",background:"rgba(239,68,68,.15)",borderRadius:6}}>STOCK BAJO</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PEDIDOS */}
        {tab==="orders" && (
          <div>
            <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,marginBottom:4}}>Pedidos</h2>
            <p style={{color:"#334",fontSize:13,marginBottom:18}}>{orders.length} pedidos</p>
            <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
              {["all","pending","confirmed","completed","cancelled"].map(f=>(
                <button key={f} onClick={()=>setOrderFilter(f)} style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${orderFilter===f?"rgba(0,180,216,.4)":"rgba(255,255,255,.08)"}`,background:orderFilter===f?"rgba(0,180,216,.1)":"rgba(255,255,255,.02)",color:orderFilter===f?"#00B4D8":"#445",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                  {f==="all"?`Todos (${orders.length})`:`${STATUS[f]?.label} (${orders.filter(o=>o.status===f).length})`}
                </button>
              ))}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {filteredOrders.map(order=>(
                <div key={order.id} style={cardStyle}>
                  <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",cursor:"pointer"}} onClick={()=>setExpandedOrder(expandedOrder===order.id?null:order.id)}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                        <p style={{fontWeight:600,fontSize:14}}>{order.customer_name}</p>
                        <span className="pill" style={{background:STATUS[order.status]?.bg,color:STATUS[order.status]?.color}}>{STATUS[order.status]?.label}</span>
                        <span className="pill" style={{background:order.paid?"rgba(16,185,129,.12)":"rgba(245,158,11,.12)",color:order.paid?"#10b981":"#f59e0b"}}>{order.paid?"💰 Pagado":"⏳ Sin pagar"}</span>
                      </div>
                      <p style={{fontSize:12,color:"#445"}}>📞 {order.phone} · {order.delivery_type==="pickup"?"🏪 Retira":"🚗 Envío"} · {order.sale_type==="retail"?"Minorista":"Mayorista"}</p>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <p style={{fontSize:20,fontWeight:800,color:"#00B4D8"}}>{fmt(Number(order.total))}</p>
                      <p style={{fontSize:11,color:"#334"}}>{fmtDate(order.created_at)}</p>
                    </div>
                  </div>
                  {expandedOrder===order.id && (
                    <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid rgba(255,255,255,.06)"}} onClick={e=>e.stopPropagation()}>
                      <div style={{marginBottom:12}}>
                        {order.items.map((item,i)=>(
                          <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,.04)",fontSize:13}}>
                            <span>{item.qty}× {item.name}</span>
                            <span style={{color:"#00B4D8"}}>{fmt(item.qty*item.price)}</span>
                          </div>
                        ))}
                      </div>
                      {order.address && <p style={{fontSize:12,color:"#556",marginBottom:12}}>📍 {order.address}</p>}
                      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
                        <span style={{fontSize:11,color:"#334",alignSelf:"center",fontWeight:600}}>ESTADO:</span>
                        {["pending","confirmed","completed","cancelled"].map(s=>(
                          <button key={s} style={{...btnStyle(s==="completed"?"green":s==="cancelled"?"red":s==="confirmed"?"cyan":"amber"),opacity:order.status===s?1:.55}} onClick={()=>patchOrder(order.id,{status:s})}>
                            {STATUS[s].label}
                          </button>
                        ))}
                      </div>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        <button style={btnStyle(order.paid?"amber":"green")} onClick={()=>patchOrder(order.id,{paid:!order.paid})}>
                          {order.paid?"Marcar sin pagar":"✓ Marcar como pagado"}
                        </button>
                        <button style={btnStyle("default")} onClick={()=>generatePDF(order)}>
                          📄 Descargar factura
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PRODUCTOS */}
        {tab==="products" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18,flexWrap:"wrap",gap:12}}>
              <div>
                <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,marginBottom:4}}>Productos</h2>
                <p style={{color:"#334",fontSize:13}}>{products.length} productos · {products.filter(p=>p.available).length} disponibles</p>
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:14,overflowX:"auto",paddingBottom:4,scrollbarWidth:"none"}}>
              {["all",...uniqueCats].map(c=>(
                <button key={c} onClick={()=>setCatFilter(c)} style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${catFilter===c?"rgba(0,180,216,.4)":"rgba(255,255,255,.08)"}`,background:catFilter===c?"rgba(0,180,216,.1)":"rgba(255,255,255,.02)",color:catFilter===c?"#00B4D8":"#445",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                  {c==="all"?"Todos":c}
                </button>
              ))}
            </div>
            <div style={cardStyle}>
              <table>
                <thead><tr><th>PRODUCTO</th><th>CATEGORÍA</th><th>MINORISTA</th><th>MAYORISTA</th><th>STOCK</th><th>DISP.</th><th>OFERTA</th><th>ACCIONES</th></tr></thead>
                <tbody>{filteredProducts.map(p=>(
                  <tr key={p.id}>
                    <td>
                      <div style={{display:"flex",alignItems:"center",gap:9}}>
                        <img src={p.image_url||"https://images.unsplash.com/photo-1518770660439-4636190af475?w=60&q=60"} style={{width:34,height:34,borderRadius:7,objectFit:"cover",flexShrink:0}}/>
                        <p style={{fontWeight:500,fontSize:13}}>{p.name}</p>
                      </div>
                    </td>
                    <td style={{color:"#445",fontSize:12}}>{p.category_name}</td>
                    <td style={{color:"#00B4D8",fontWeight:600}}>{fmt(Number(p.price_retail))}</td>
                    <td style={{color:"#3b82f6",fontWeight:600}}>{fmt(Number(p.price_wholesale))}</td>
                    <td>
                      <select value={p.stock_level} onChange={e=>patchProduct(p.id,{stock_level:e.target.value})}
                        style={{padding:"4px 8px",background:STOCK[p.stock_level]?.bg,border:`1px solid ${STOCK[p.stock_level]?.color}40`,borderRadius:6,color:STOCK[p.stock_level]?.color,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                        <option value="alto">🟢 Alto</option>
                        <option value="medio">🟡 Medio</option>
                        <option value="bajo">🔴 Bajo</option>
                      </select>
                    </td>
                    <td>
                      <button className="toggle-track" style={{background:p.available?"rgba(16,185,129,.6)":"rgba(255,255,255,.1)"}} onClick={()=>patchProduct(p.id,{available:!p.available})}>
                        <div className="toggle-thumb" style={{left:p.available?19:3}}/>
                      </button>
                    </td>
                    <td>
                      <button className="toggle-track" style={{background:p.is_offer?"rgba(239,68,68,.6)":"rgba(255,255,255,.1)"}} onClick={()=>patchProduct(p.id,{is_offer:!p.is_offer})}>
                        <div className="toggle-thumb" style={{left:p.is_offer?19:3}}/>
                      </button>
                    </td>
                    <td>
                      <div style={{display:"flex",gap:6}}>
                        <button style={btnStyle("cyan")} onClick={()=>setEditingProduct({...p})}>Editar</button>
                        <button style={btnStyle("red")} onClick={()=>deleteProduct(p.id)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL EDITAR */}
      {editingProduct && (
        <div className="modal-ov" onClick={()=>setEditingProduct(null)}>
          <div className="modal-bx" onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <h3 style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:700}}>Editar producto</h3>
              <button onClick={()=>setEditingProduct(null)} style={{background:"none",border:"none",color:"#445",fontSize:20,cursor:"pointer"}}>✕</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {([["Nombre","name","text"],["Descripción","description","text"],["Precio minorista","price_retail","number"],["Precio mayorista","price_wholesale","number"],["URL imagen","image_url","text"]] as [string,keyof Product,string][]).map(([label,key,type])=>(
                <div key={key}>
                  <label style={{fontSize:11,color:"#445",display:"block",marginBottom:5,fontWeight:600}}>{label.toUpperCase()}</label>
                  <input type={type} style={inputStyle} value={(editingProduct[key] as string|number)??""} onChange={e=>setEditingProduct(p=>({...p!,[key]:type==="number"?Number(e.target.value):e.target.value}))}/>
                </div>
              ))}
              <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                {([["available","Disponible"],["featured","Destacado"],["is_offer","Oferta"],["is_new","Novedad"]] as [keyof Product,string][]).map(([key,label])=>(
                  <label key={key} style={{display:"flex",alignItems:"center",gap:7,fontSize:13,cursor:"pointer"}}>
                    <input type="checkbox" checked={editingProduct[key] as boolean} onChange={e=>setEditingProduct(p=>({...p!,[key]:e.target.checked}))}/>
                    {label}
                  </label>
                ))}
              </div>
              <div>
                <label style={{fontSize:11,color:"#445",display:"block",marginBottom:5,fontWeight:600}}>NIVEL DE STOCK</label>
                <select value={editingProduct.stock_level} onChange={e=>setEditingProduct(p=>({...p!,stock_level:e.target.value}))} style={{...inputStyle,width:"100%"}}>
                  <option value="alto">🟢 Alto</option>
                  <option value="medio">🟡 Medio</option>
                  <option value="bajo">🔴 Bajo</option>
                </select>
              </div>
              <div style={{display:"flex",gap:10,marginTop:4}}>
                <button style={{...btnStyle("cyan"),flex:1,padding:12}} onClick={saveProduct}>Guardar cambios</button>
                <button style={{...btnStyle("default"),padding:"12px 16px"}} onClick={()=>setEditingProduct(null)}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
