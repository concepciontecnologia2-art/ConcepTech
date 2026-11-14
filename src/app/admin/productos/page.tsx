import { redirect } from "next/navigation";
// Los productos ahora están en la sección Artículos
export default function ProductosPage() { redirect("/admin/articulos"); }
