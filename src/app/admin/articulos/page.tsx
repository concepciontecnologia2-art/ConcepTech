"use client";
// ARTÍCULOS
// • Sin acceso de administrador: consulta de precios y stock.
// • "Modificar artículos" pide usuario y contraseña de un administrador.
// • F12 → artículo nuevo (si está bloqueado, primero pide la clave y después abre el formulario).
import { useState, useEffect } from "react";
import TiendaPanel from "@/components/admin/TiendaPanel";
import ArticulosConsulta from "@/components/admin/ArticulosConsulta";
import { useIsAdmin, AdminUnlock } from "@/components/admin/session";

export default function ArticulosPage() {
  const isAdmin = useIsAdmin();
  const [asking, setAsking] = useState(false);
  const [openNew, setOpenNew] = useState(false);

  // F12 con la sección bloqueada: pedir la clave y, al entrar, abrir "Agregar producto"
  useEffect(() => {
    if (isAdmin) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "F12") return;
      e.preventDefault();
      setOpenNew(true); setAsking(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAdmin]);

  if (isAdmin) return <TiendaPanel tab="products" openNew={openNew} />;
  if (asking) return <AdminUnlock section="Modificar artículos" onCancel={() => { setAsking(false); setOpenNew(false); }} />;
  return <ArticulosConsulta onEdit={() => setAsking(true)} />;
}
