"use client";
// Bloquea el zoom en todo el sistema:
// • Celular: pellizcar (iPhone ignora user-scalable=no, por eso se frena con JS) y doble toque
// • Compu: Ctrl + rueda del mouse, pellizco del touchpad y Ctrl + / Ctrl - / Ctrl 0
// (El zoom desde el menú del navegador no se puede bloquear desde una página.)
import { useEffect } from "react";

export default function NoZoom() {
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    const onTouchMove = (e: TouchEvent) => { if (e.touches.length > 1) e.preventDefault(); };
    let lastTouch = 0;
    const onTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      // Doble toque rápido = zoom en iPhone; se frena salvo en campos de texto
      const t = e.target as HTMLElement | null;
      if (now - lastTouch < 300 && !t?.closest("input, textarea, select, [contenteditable]")) e.preventDefault();
      lastTouch = now;
    };
    const onWheel = (e: WheelEvent) => { if (e.ctrlKey || e.metaKey) e.preventDefault(); };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "0", "Add", "Subtract"].includes(e.key)) e.preventDefault();
    };
    const opts: AddEventListenerOptions = { passive: false };
    document.addEventListener("gesturestart", stop, opts);
    document.addEventListener("gesturechange", stop, opts);
    document.addEventListener("gestureend", stop, opts);
    document.addEventListener("touchmove", onTouchMove, opts);
    document.addEventListener("touchend", onTouchEnd, opts);
    window.addEventListener("wheel", onWheel, opts);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("gesturestart", stop);
      document.removeEventListener("gesturechange", stop);
      document.removeEventListener("gestureend", stop);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  return null;
}
