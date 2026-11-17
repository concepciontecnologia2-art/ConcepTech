"use client";
// AYUDA — /admin/ayuda. Guía de uso del sistema, atajos de teclado y preguntas frecuentes.
// Para cambiar un texto, editá el arreglo GUIA de abajo (no hace falta tocar nada más).
import { useMemo, useState } from "react";
import Link from "next/link";

// Contacto de soporte (dejar vacío para ocultar el botón). Formato: 549 + código de área + número, sin 0 ni 15.
const SOPORTE_WHATSAPP = "";
const SOPORTE_NOMBRE = "Soporte técnico";

type Tema = { q: string; pasos: string[]; nota?: string };
type Seccion = { id: string; titulo: string; href?: string; color: string; intro: string; acceso?: string; temas: Tema[] };

const GUIA: Seccion[] = [
  {
    id: "inicio", titulo: "Primeros pasos", color: "#0891b2",
    intro: "Cómo está organizado el sistema y cómo funcionan los accesos.",
    temas: [
      { q: "¿Cómo me muevo por el sistema?", pasos: [
        "Arriba está el menú con todas las secciones. En el celular se desliza de costado.",
        "En la pantalla de inicio (la casita) cada sección tiene un número: tocando ese número en el teclado entrás directo (1 = Ventas, 2 = Caja, etc.).",
        "Algunas secciones tienen pestañas debajo del menú (por ejemplo Tienda web → Pedidos web / Resumen de la tienda).",
      ]},
      { q: "¿Qué significan los candados?", pasos: [
        "Sin candado: cualquier usuario puede entrar (Ventas, Clientes, Proveedores, Saphirus).",
        "Candado + \"Administrador\": pide usuario y contraseña de un administrador (Tienda web, Compras y modificar Artículos).",
        "Candado + \"Solo el dueño\": pide el usuario y contraseña del dueño (Caja, Contabilidad, Usuarios).",
        "Al salir de esa sección se vuelve a bloquear sola. También podés tocar \"Bloquear\" arriba a la derecha.",
      ]},
      { q: "Los números de colores en el menú", pasos: [
        "Avisan cosas pendientes: pedidos web sin confirmar, artículos para reponer, artículos sin foto.",
        "Se actualizan solos cada tanto.",
      ]},
    ],
  },
  {
    id: "ventas", titulo: "Ventas", href: "/admin/ventas", color: "#0891b2",
    intro: "Vender en el mostrador, cobrar y mandar el ticket.",
    temas: [
      { q: "Hacer una venta", pasos: [
        "Escribí el nombre o código del artículo en el buscador. Con las flechas ↑ ↓ elegís y con Enter lo agregás.",
        "Por defecto se usa el precio Mayorista. Si es venta al público, cambiá a Minorista arriba del carrito.",
        "Ajustá cantidades con + y −. El carrito muestra precio unitario y total de cada renglón.",
        "Elegí la forma de pago (efectivo o transferencia). En efectivo podés cargar el \"Efectivo recibido\" y te calcula el vuelto.",
      ]},
      { q: "Cobrar y mandar el ticket por WhatsApp", pasos: [
        "Tocá el botón verde \"Cobrar y enviar ticket por WhatsApp\" (o F2, o Ctrl + Enter).",
        "Escribí el número del cliente o elegí uno de los recientes / de la lista de clientes.",
        "Se abre WhatsApp con el ticket listo para mandar. Con el botón PDF mandás el comprobante como archivo.",
        "Si no querés mandar nada, usá \"Cobrar sin enviar\". La casilla \"Imprimir\" imprime el ticket en la ticketera.",
      ], nota: "Los números que usás quedan guardados para la próxima vez." },
      { q: "Asignar un cliente a la venta", pasos: [
        "En \"Cliente\" buscá por nombre, DNI o teléfono.",
        "Si no existe, tocá \"Crear\" y cargá nombre, teléfono y dirección sin salir de la venta.",
        "Si no elegís ninguno, el ticket sale como \"Consumidor final\".",
      ]},
      { q: "Ver las ventas del día y anular una", pasos: [
        "En la pestaña de ventas del día tenés el resumen: cantidad, total, efectivo, transferencias y anuladas.",
        "Tocá una venta para ver el detalle. Desde ahí podés reimprimir o reenviar el ticket.",
        "Para anular una venta, entrá a Caja → Ventas del turno (pide la clave del dueño).",
      ]},
    ],
  },
  {
    id: "caja", titulo: "Caja", href: "/admin/caja", color: "#059669", acceso: "Solo el dueño",
    intro: "Abrir y cerrar la caja, ver el resumen del día y registrar ingresos o retiros.",
    temas: [
      { q: "Abrir la caja", pasos: [
        "Al empezar el día, entrá a Caja y poné con cuánto efectivo arrancás.",
        "Mientras la caja está abierta, todas las ventas del mostrador se suman a ese turno.",
      ]},
      { q: "Ingresos y retiros de efectivo", pasos: [
        "Caja → Ingresos / retiros. Registrá cuando sacás plata (pago a un proveedor, gastos) o cuando ponés.",
        "Escribí siempre un motivo: después aparece en Contabilidad.",
      ]},
      { q: "Cerrar la caja", pasos: [
        "Tocá \"Cerrar caja\" y contá el efectivo que hay.",
        "El sistema compara lo contado con lo esperado y muestra la diferencia.",
        "El cierre queda guardado en Contabilidad → Cierres de caja.",
      ]},
    ],
  },
  {
    id: "articulos", titulo: "Artículos", href: "/admin/articulos", color: "#d97706", acceso: "Modificar: Administrador",
    intro: "Precios, stock, fotos y visibilidad en la tienda web.",
    temas: [
      { q: "Consultar precios y stock", pasos: [
        "Cualquier usuario puede buscar artículos y ver precios y stock.",
        "Para modificar, tocá \"Modificar\" e ingresá con un administrador.",
      ]},
      { q: "Crear un artículo nuevo", pasos: [
        "Tocá \"+ Nuevo artículo\" o la tecla F12 (en notebooks puede ser Fn + F12).",
        "Cargá nombre, categoría, costo y el % de ganancia: el precio se calcula solo (redondeado a $10).",
        "Podés subir la foto en el mismo momento. Enter guarda, Esc cierra.",
      ]},
      { q: "Editar un artículo", pasos: [
        "Tocá el nombre o \"Editar\". Se abre la ficha con fotos a la izquierda y datos a la derecha.",
        "Ahí cambiás categoría, proveedor, código, precios, stock, descripción y si se ve en la web.",
        "Para cambiar solo el stock, escribilo directo en la lista y apretá Enter.",
      ]},
      { q: "Fotos", pasos: [
        "Tocando la miniatura en la lista subís o cambiás la foto principal al instante.",
        "Dentro de Editar podés agregar fotos extra.",
        "En la pestaña \"Sin foto\" están todos los que faltan: tocás la tarjeta y subís.",
      ], nota: "Las fotos del iPhone en formato HEIC no se aceptan: sacá captura o cambiá la cámara a \"Más compatible\"." },
      { q: "Aumentar precios en bloque", pasos: [
        "Tocá \"% Ajustar precios\", elegí la categoría (o todas) y el porcentaje.",
        "Se aplica a minorista y mayorista a la vez.",
      ]},
      { q: "Filtros útiles", pasos: [
        "Sin stock, Stock bajo (1 a 3), Sin foto y Ocultos en la web.",
        "También podés exportar el listado a Excel o importar cambios desde un Excel.",
      ]},
    ],
  },
  {
    id: "clientes", titulo: "Clientes", href: "/admin/clientes", color: "#7c3aed",
    intro: "Fichas de clientes con su historial de compras.",
    temas: [
      { q: "Buscar y ver un cliente", pasos: [
        "Buscá por nombre, DNI o teléfono (la tecla / pone el cursor en el buscador).",
        "En la ficha ves datos de contacto, compras anteriores y cuánto gastó.",
      ]},
      { q: "Cargar o editar un cliente", pasos: [
        "Desde Clientes, o directamente al hacer una venta (\"Crear\" en el campo Cliente).",
        "Cuando mandás un ticket por WhatsApp a un número nuevo con nombre, el cliente se crea solo.",
      ]},
    ],
  },
  {
    id: "proveedores", titulo: "Proveedores", href: "/admin/proveedores", color: "#4f46e5",
    intro: "Contactos de proveedores y pedidos de reposición al grupo de WhatsApp.",
    temas: [
      { q: "Armar un pedido de reposición", pasos: [
        "Entrá a Proveedores → Pedidos a proveedores. Aparecen los artículos con poco stock agrupados por proveedor.",
        "Seleccioná los artículos y ajustá cantidades. La selección se mantiene aunque cambies de pantalla.",
        "Tocá \"Ver mensaje y enviar al grupo\", revisá el texto (se puede editar) y \"Enviar al grupo\".",
        "WhatsApp se abre con el mensaje: elegí el grupo y mandalo. El texto también queda copiado.",
      ]},
      { q: "Seguir los pedidos enviados", pasos: [
        "Abajo están los pedidos enviados con su detalle.",
        "Cuando llega la mercadería, tocá \"✓ Llegó\". Si no se va a hacer, \"Cancelar\".",
        "\"Reenviar al grupo\" vuelve a mandar el mismo pedido.",
      ]},
    ],
  },
  {
    id: "saphirus", titulo: "Saphirus", href: "/admin/pedido-saphirus", color: "#db2777",
    intro: "Pedido de aromas Saphirus (textiles, difusores, aerosoles).",
    temas: [
      { q: "Hacer el pedido", pasos: [
        "Buscá el aroma y sumá cantidades con + y −. \"Solo para reponer\" muestra los que tienen poco stock.",
        "\"Agregar todos los que hay que reponer\" carga de una todos los que faltan.",
        "Si un aroma no está cargado, escribilo en \"Renglón libre\".",
        "Agregá una nota si hace falta (ej: \"si no hay Vainilla, mandar Coco\") y tocá \"Enviar al grupo\".",
      ]},
    ],
  },
  {
    id: "tienda", titulo: "Tienda web", href: "/admin/pedidos", color: "#0284c7", acceso: "Administrador",
    intro: "Pedidos que entran desde la página (minorista y mayorista).",
    temas: [
      { q: "Atender un pedido web", pasos: [
        "Pedidos web muestra todos los pedidos. Filtrá por Pendientes, Sin pagar, etc.",
        "Tocá un pedido para ver el detalle con precios.",
        "Cambiá el estado: Pendiente → Confirmado → Completado (o Cancelado).",
        "Cuando te paguen, tocá \"Marcar como pagado\".",
        "\"Enviar por WhatsApp\" le manda el comprobante al cliente.",
      ]},
      { q: "Resumen de la tienda", pasos: [
        "Muestra lo cobrado, lo que falta cobrar, los últimos pedidos y los artículos con stock bajo.",
      ]},
      { q: "¿Qué artículos se ven en la página?", pasos: [
        "Solo los que tienen \"En la web\" activado y stock mayor a cero.",
        "Los cambios de precio o stock pueden tardar hasta 2 minutos en verse en la página.",
      ]},
    ],
  },
  {
    id: "compras", titulo: "Compras", href: "/admin/compras", color: "#0d9488", acceso: "Administrador",
    intro: "Cargar facturas de proveedores con una foto y actualizar stock y precios.",
    temas: [
      { q: "Cargar una factura por foto", pasos: [
        "Sacale una foto a la factura (bien derecha y con buena luz) y subila.",
        "El sistema lee los renglones y los relaciona con tus artículos. Revisá cada renglón.",
        "Los que no existen se crean solos con su nombre y la categoría que eligió el sistema (\"✨ elegida por la IA\"). Podés cambiarla.",
        "Elegí cómo actualizar los precios y tocá \"Confirmar compra y sumar stock\".",
      ]},
      { q: "Lista de precios del proveedor", pasos: [
        "En la pestaña \"Lista de precios\" subís la lista (foto o Excel) y actualiza costos y precios de venta en bloque.",
      ]},
      { q: "Historial", pasos: ["Todas las compras confirmadas quedan en \"Historial\" con su detalle."] },
    ],
  },
  {
    id: "contabilidad", titulo: "Contabilidad", href: "/admin/contabilidad", color: "#db2777", acceso: "Solo el dueño",
    intro: "Ganancias, gastos, capital en mercadería y cierres de caja.",
    temas: [
      { q: "¿Qué muestra?", pasos: [
        "Ventas, costo de lo vendido y ganancia por período.",
        "Gastos, retiros e ingresos de caja con su motivo.",
        "Capital total: cuánto vale el stock al costo, a precio minorista y a precio mayorista.",
        "Todos los cierres de caja con la diferencia entre lo esperado y lo contado.",
      ]},
      { q: "Descargar una copia de mis datos", pasos: [
        "Tocá \"⬇ Descargar copia de mis datos\" debajo del título.",
        "Baja un Excel con artículos, clientes, proveedores, ventas, pedidos web, caja y compras.",
        "Además, el sistema hace solo una copia completa todas las noches y guarda el último mes.",
      ]},
    ],
  },
  {
    id: "usuarios", titulo: "Usuarios", href: "/admin/usuarios", color: "#475569", acceso: "Solo el dueño",
    intro: "Quién puede usar el sistema y con qué permisos.",
    temas: [
      { q: "Crear un usuario", pasos: [
        "Tocá \"Nuevo usuario\", poné nombre, usuario y contraseña.",
        "Vendedor: vende, consulta y arma pedidos. Administrador: además modifica artículos, tienda web y compras.",
        "Para que alguien deje de entrar, desactivalo (no se borra el historial de sus ventas).",
      ]},
    ],
  },
];

const ATAJOS: [string, string][] = [
  ["1 … 9", "En el inicio: entrar a la sección con ese número"],
  ["↑ ↓ + Enter", "Ventas: elegir y agregar el artículo buscado"],
  ["F2  ó  Ctrl + Enter", "Ventas: cobrar y enviar ticket"],
  ["Esc", "Limpiar la búsqueda / cerrar una ventana"],
  ["F12  (Fn + F12 en notebook)", "Artículos: crear artículo nuevo"],
  ["Enter", "Artículos: guardar el stock escrito en la lista o la ficha abierta"],
  ["/", "Clientes: ir al buscador"],
];

const FAQ: Tema[] = [
  { q: "No me deja entrar a una sección", pasos: ["Fijate si tiene candado: necesita usuario de administrador o del dueño. Pedile a quien corresponda que la desbloquee."] },
  { q: "Cambié un precio y en la página sigue el anterior", pasos: ["La página se actualiza cada 2 minutos. Esperá un momento y recargá."] },
  { q: "La impresora de tickets no imprime", pasos: [
    "Revisá que esté encendida, con papel y elegida como impresora predeterminada.",
    "Mientras tanto, mandá el ticket por WhatsApp o en PDF: es el mismo comprobante.",
  ]},
  { q: "La foto no se sube", pasos: ["Probá con otra foto en JPG o PNG. Las fotos HEIC del iPhone no se aceptan. Si sigue fallando, revisá la conexión a internet."] },
  { q: "Se cortó internet en medio de una venta", pasos: ["Cuando vuelva, revisá en Ventas del día si la venta quedó registrada antes de cobrarla de nuevo."] },
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function AyudaPage() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const nq = norm(q.trim());

  const secciones = useMemo(() => {
    if (!nq) return GUIA;
    return GUIA.map((s) => ({
      ...s,
      temas: norm(s.titulo).includes(nq) ? s.temas : s.temas.filter((t) => norm(t.q + " " + t.pasos.join(" ") + " " + (t.nota || "")).includes(nq)),
    })).filter((s) => s.temas.length);
  }, [nq]);

  const faq = nq ? FAQ.filter((t) => norm(t.q + " " + t.pasos.join(" ")).includes(nq)) : FAQ;
  const total = secciones.reduce((n, s) => n + s.temas.length, 0) + faq.length;

  return (
    <div className="ay">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ay-head">
        <div>
          <h1>Ayuda</h1>
          <p>Guía de uso del sistema, atajos de teclado y preguntas frecuentes.</p>
        </div>
        {SOPORTE_WHATSAPP && (
          <a className="ay-wa" href={`https://wa.me/${SOPORTE_WHATSAPP}?text=${encodeURIComponent("Hola, necesito ayuda con el sistema de Concepción Tecnología: ")}`} target="_blank" rel="noreferrer">
            Escribir a {SOPORTE_NOMBRE}
          </a>
        )}
      </div>

      <input className="ay-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="¿Qué necesitás hacer? Ej: anular venta, foto, ticket…" autoFocus />

      {!nq && (
        <nav className="ay-index">
          {GUIA.map((s) => (
            <a key={s.id} href={`#${s.id}`} style={{ ["--c" as string]: s.color } as React.CSSProperties}>
              <i />{s.titulo}
            </a>
          ))}
          <a href="#atajos" style={{ ["--c" as string]: "#334155" } as React.CSSProperties}><i />Atajos</a>
          <a href="#faq" style={{ ["--c" as string]: "#334155" } as React.CSSProperties}><i />Preguntas frecuentes</a>
        </nav>
      )}

      {nq && total === 0 && <p className="ay-empty">No encontramos nada con “{q}”. Probá con otra palabra.</p>}

      <div className="ay-grid">
        <div className="ay-main">
          {secciones.map((s) => (
            <section key={s.id} id={s.id} className="ay-sec" style={{ ["--c" as string]: s.color } as React.CSSProperties}>
              <div className="ay-sec-h">
                <div>
                  <h2>{s.titulo}</h2>
                  <p>{s.intro}</p>
                </div>
                <div className="ay-sec-r">
                  {s.acceso && <span className="ay-lock">🔒 {s.acceso}</span>}
                  {s.href && <Link href={s.href} className="ay-go">Ir →</Link>}
                </div>
              </div>
              {s.temas.map((t) => {
                const key = s.id + t.q, isOpen = !!nq || open === key;
                return (
                  <div key={key} className={`ay-t${isOpen ? " open" : ""}`}>
                    <button onClick={() => setOpen(isOpen && !nq ? null : key)}>
                      <span>{t.q}</span><em>{isOpen ? "−" : "+"}</em>
                    </button>
                    {isOpen && (
                      <div className="ay-body">
                        <ol>{t.pasos.map((p, i) => <li key={i}>{p}</li>)}</ol>
                        {t.nota && <p className="ay-nota">💡 {t.nota}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          ))}
        </div>

        <aside className="ay-side">
          {(!nq || ATAJOS.some(([k, d]) => norm(k + d).includes(nq))) && (
            <section id="atajos" className="ay-card">
              <h3>Atajos de teclado</h3>
              {ATAJOS.filter(([k, d]) => !nq || norm(k + d).includes(nq)).map(([k, d]) => (
                <div key={k} className="ay-kb"><kbd>{k}</kbd><span>{d}</span></div>
              ))}
            </section>
          )}
          {faq.length > 0 && (
            <section id="faq" className="ay-card">
              <h3>Preguntas frecuentes</h3>
              {faq.map((t) => (
                <details key={t.q} open={!!nq}>
                  <summary>{t.q}</summary>
                  {t.pasos.map((p, i) => <p key={i}>{p}</p>)}
                </details>
              ))}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

const CSS = `
.ay{color:#1a1a1a;max-width:1180px;margin:0 auto}
.ay-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.ay-head h1{font-size:22px;font-weight:700;margin:0}
.ay-head p{font-size:13px;color:#6b7280;margin-top:2px}
.ay-wa{padding:10px 16px;border-radius:10px;background:#22c55e;color:#fff;font-size:13px;font-weight:700;text-decoration:none}
.ay-search{width:100%;box-sizing:border-box;padding:13px 16px;border:1px solid #e5e7eb;border-radius:12px;font-size:15px;font-family:inherit;outline:none;background:#fff;color:#1a1a1a;margin-bottom:12px}
.ay-search:focus{border-color:#67e8f9;box-shadow:0 0 0 3px rgba(8,145,178,.12)}
.ay-index{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px}
.ay-index a{display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border-radius:999px;background:#fff;border:1px solid #e5e7eb;color:#374151;font-size:12.5px;font-weight:600;text-decoration:none}
.ay-index a:hover{border-color:var(--c)}
.ay-index i{width:8px;height:8px;border-radius:50%;background:var(--c)}
.ay-empty{color:#6b7280;font-size:14px;padding:20px 0}
.ay-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start}
.ay-main{display:grid;gap:12px}
.ay-sec{background:#fff;border:1px solid #e5e7eb;border-left:4px solid var(--c);border-radius:14px;padding:14px 16px;scroll-margin-top:120px}
.ay-sec-h{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:8px}
.ay-sec-h h2{font-size:17px;font-weight:700;margin:0}
.ay-sec-h p{font-size:12.5px;color:#6b7280;margin-top:2px}
.ay-sec-r{display:flex;gap:6px;align-items:center;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end}
.ay-lock{font-size:11px;font-weight:600;color:#6b7280;background:#f3f4f6;padding:3px 8px;border-radius:999px;white-space:nowrap}
.ay-go{font-size:12px;font-weight:700;color:var(--c);text-decoration:none;padding:4px 10px;border-radius:8px;border:1px solid #e5e7eb;white-space:nowrap}
.ay-go:hover{border-color:var(--c)}
.ay-t{border-top:1px solid #f1f3f5}
.ay-t button{all:unset;box-sizing:border-box;width:100%;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 2px;cursor:pointer;font-size:14px;font-weight:600;color:#1f2937}
.ay-t button:hover span{color:var(--c)}
.ay-t em{font-style:normal;font-size:18px;color:#9ca3af;width:20px;text-align:center}
.ay-body{padding:0 2px 12px}
.ay-body ol{margin:0;padding-left:20px;display:grid;gap:6px}
.ay-body li{font-size:13.5px;line-height:1.5;color:#374151}
.ay-body li::marker{color:var(--c);font-weight:700}
.ay-nota{margin-top:10px;font-size:12.5px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;padding:8px 10px;border-radius:9px}
.ay-side{display:grid;gap:12px;position:sticky;top:120px}
.ay-card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:14px 16px;scroll-margin-top:120px}
.ay-card h3{font-size:15px;font-weight:700;margin:0 0 8px}
.ay-kb{display:flex;flex-direction:column;gap:3px;padding:8px 0;border-top:1px solid #f1f3f5}
.ay-kb kbd{align-self:flex-start;font:700 11.5px/1 ui-monospace,monospace;background:#f3f4f6;border:1px solid #e5e7eb;border-bottom-width:2px;padding:4px 7px;border-radius:6px;color:#1f2937}
.ay-kb span{font-size:12.5px;color:#4b5563}
.ay-card details{border-top:1px solid #f1f3f5;padding:9px 0}
.ay-card summary{cursor:pointer;font-size:13.5px;font-weight:600;color:#1f2937}
.ay-card details p{font-size:13px;color:#4b5563;line-height:1.5;margin-top:6px}
@media(max-width:900px){
  .ay-grid{grid-template-columns:minmax(0,1fr)}
  .ay-side{position:static}
  .ay-index{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
  .ay-index a{flex-shrink:0}
}
`;
