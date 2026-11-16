"use client";
// PEDIDO SAPHIRUS — /admin/pedido-saphirus (Proveedores → Pedido Saphirus, solo el dueño).
// El layout pide la clave del dueño antes de mostrar esta pantalla.
import SaphirusPedido from "@/components/admin/SaphirusPedido";

export default function PedidoSaphirusPage() {
  return <SaphirusPedido />;
}