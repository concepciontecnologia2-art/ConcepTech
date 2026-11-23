-- ═══════════════════════════════════════════════════════════════════
-- 13 · FOTOS EXTRA DE LOS ARTÍCULOS ("Más fotos")
-- Crea la tabla donde se guardan las fotos adicionales de cada artículo
-- (la foto principal sigue en products.image_url).
-- Si la tabla ya existe, no hace nada. Se puede correr más de una vez.
-- Correr en Neon (rama main).
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS product_images (
  id          SERIAL PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS product_images_product_idx ON product_images (product_id, created_at);

-- Control: cuántas fotos extra hay cargadas
SELECT COUNT(*) AS "Fotos extra cargadas" FROM product_images;
