import { redirect } from "next/navigation";
// Clientes y proveedores ahora son dos secciones separadas
export default async function CrmPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  redirect(sp.tab === "proveedores" ? "/admin/proveedores" : "/admin/clientes");
}
