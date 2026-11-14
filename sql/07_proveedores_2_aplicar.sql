-- ═══════════════════════════════════════════════════════════════════
-- 07 · PROVEEDORES ↔ ARTÍCULOS — PASO 2: APLICAR
-- Requiere haber corrido 07_proveedores_1_preparar.sql (y revisado lo que mostró).
-- 1) Crea los proveedores que no existan (sin WhatsApp: se completa en Proveedores)
-- 2) Asigna el proveedor a cada artículo encontrado (aplicar = TRUE).
--    No pisa artículos que ya tengan otro proveedor real (solo los vacíos o de "[Prueba]").
-- 3) Borra la tabla auxiliar.
-- Todo o nada: si algo falla, no se cambia nada.
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

INSERT INTO suppliers (name, active, notes)
SELECT DISTINCT i.proveedor, TRUE, 'Cargado desde los Excel de proveedores'
FROM import_proveedores i
WHERE NOT EXISTS (SELECT 1 FROM suppliers s WHERE lower(trim(s.name)) = lower(i.proveedor));

UPDATE products p
SET supplier_id = s.id, updated_at = NOW()
FROM import_proveedores i
JOIN suppliers s ON lower(trim(s.name)) = lower(i.proveedor)
WHERE i.product_id = p.id AND i.aplicar
  AND (p.supplier_id IS NULL
       OR p.supplier_id IN (SELECT id FROM suppliers WHERE name LIKE '[Prueba]%'));

-- Resultado: artículos por proveedor
SELECT s.name AS proveedor, COUNT(p.id) AS articulos
FROM suppliers s LEFT JOIN products p ON p.supplier_id = s.id
WHERE s.name IN ('BABAJI', 'BOLTZ', 'ELCELU', 'FULL M', 'IBEK', 'JORGITO', 'KCELL', 'KING', 'OESTE', 'ONLY', 'PABLO D', 'ROYALCELL', 'SAPHIRUS', 'TTT', 'UNDERTECH', 'VARIOS', 'VISHNU')
GROUP BY s.name ORDER BY s.name;

DROP TABLE import_proveedores;
COMMIT;
