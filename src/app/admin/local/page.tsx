import { redirect } from "next/navigation";
// El resumen del día ahora está dentro de Caja; el inicio es /admin
export default function LocalPage() { redirect("/admin"); }
