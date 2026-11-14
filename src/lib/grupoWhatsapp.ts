// Enviar un mensaje al grupo de WhatsApp del negocio (se usa en la pantalla)
import { shareUrl } from "@/lib/reposicion";

/** Copia el mensaje y abre WhatsApp con el texto puesto para elegir el grupo.
 *  Tiene que llamarse directo desde el clic (si no, el navegador bloquea la ventana). */
export function sendToGroup(text: string) {
  try { navigator.clipboard?.writeText(text).catch(() => {}); } catch {}
  window.open(shareUrl(text), "_blank", "noopener");
}

export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    // Navegadores viejos / sin permiso
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy"); ta.remove(); return ok;
  }
}
