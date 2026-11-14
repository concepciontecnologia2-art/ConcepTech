-- ═══════════════════════════════════════════════════════════════════
-- 04 · Usuarios con permisos, vendedor en cada venta, costo para la
--      contabilidad, ciudad del cliente y datos del ticket.
-- Se puede correr más de una vez sin romper nada.
-- ═══════════════════════════════════════════════════════════════════

-- Usuarios del sistema (además del administrador principal del .env)
--   admin    → ve y hace todo
--   vendedor → vende, consulta artículos y carga clientes/proveedores
CREATE TABLE IF NOT EXISTS app_users (
  id             SERIAL PRIMARY KEY,
  username       VARCHAR(40)  NOT NULL UNIQUE,
  display_name   VARCHAR(80)  NOT NULL,
  password_hash  TEXT         NOT NULL,
  role           VARCHAR(10)  NOT NULL DEFAULT 'vendedor' CHECK (role IN ('admin', 'vendedor')),
  active         BOOLEAN      NOT NULL DEFAULT TRUE,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Quién hizo cada venta (para "ventas por vendedor")
ALTER TABLE sales ADD COLUMN IF NOT EXISTS seller_name VARCHAR(80);

-- Costo de cada producto en el momento de la venta (para calcular la ganancia)
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12,2);

-- Ciudad del cliente (Concepción, Aguilares, ...)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS city VARCHAR(80);

-- Datos del ticket (80 mm)
INSERT INTO business_settings (key, value) VALUES
  ('ticket_phone', '3865 630488')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
WHERE business_settings.value IS NULL OR business_settings.value = '';

-- Índices para los reportes de contabilidad
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales (created_at);
CREATE INDEX IF NOT EXISTS idx_cash_movements_created_at ON cash_movements (created_at);
