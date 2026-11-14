import { redirect } from "next/navigation";
// Los tickets se imprimen desde Ventas (al cobrar o desde "Ventas de hoy")
export default function TicketsPage() { redirect("/admin/ventas?vista=ventas"); }
