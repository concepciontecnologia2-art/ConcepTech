import { redirect } from "next/navigation";
// La carga por foto ahora es la sección Compras
export default function CargaStockPage() { redirect("/admin/compras"); }
