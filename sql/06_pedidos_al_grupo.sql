-- ═══════════════════════════════════════════════════════════════════
-- 06 · Pedidos al grupo de WhatsApp
-- Ahora los pedidos se mandan a un grupo del negocio (no a cada proveedor),
-- así que se pueden pedir también productos que no tienen proveedor asignado.
-- Correr una sola vez (primero en la rama "pruebas" de Neon, después en producción).
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE supplier_orders ALTER COLUMN supplier_id DROP NOT NULL;
