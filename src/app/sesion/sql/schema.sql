-- ═══════════════════════════════════════════════════════════════
-- CONCEPCIÓN TECNOLOGÍA — Schema completo
-- Pegar en Neon → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  slug       VARCHAR(100) NOT NULL UNIQUE,
  icon       VARCHAR(10)  NOT NULL DEFAULT '📦',
  sort_order INT          NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subcategories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) NOT NULL,
  category_id INT          NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  sort_order  INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(slug, category_id)
);

CREATE TABLE IF NOT EXISTS products (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(255)  NOT NULL,
  description      TEXT,
  category_id      INT           NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  subcategory_id   INT           REFERENCES subcategories(id) ON DELETE SET NULL,
  price_retail     NUMERIC(12,2) NOT NULL,
  price_wholesale  NUMERIC(12,2) NOT NULL,
  available        BOOLEAN       NOT NULL DEFAULT TRUE,
  featured         BOOLEAN       NOT NULL DEFAULT FALSE,
  is_offer         BOOLEAN       NOT NULL DEFAULT FALSE,
  is_new           BOOLEAN       NOT NULL DEFAULT FALSE,
  stock_level      VARCHAR(10)   NOT NULL DEFAULT 'alto' CHECK (stock_level IN ('alto','medio','bajo')),
  image_url        TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wholesale_customers (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  phone      VARCHAR(50)  NOT NULL,
  email      VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id            SERIAL PRIMARY KEY,
  customer_name VARCHAR(255)  NOT NULL,
  phone         VARCHAR(50)   NOT NULL,
  email         VARCHAR(255),
  sale_type     VARCHAR(20)   NOT NULL CHECK (sale_type IN ('retail','wholesale')),
  delivery_type VARCHAR(20)   NOT NULL CHECK (delivery_type IN ('pickup','delivery')),
  address       TEXT,
  items         JSONB         NOT NULL,
  total         NUMERIC(12,2) NOT NULL,
  status        VARCHAR(20)   NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','confirmed','completed','cancelled')),
  paid          BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated
  BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated
  BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Índices
CREATE INDEX IF NOT EXISTS idx_products_category    ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_products_available   ON products(available);
CREATE INDEX IF NOT EXISTS idx_products_featured    ON products(featured);
CREATE INDEX IF NOT EXISTS idx_products_offer       ON products(is_offer);
CREATE INDEX IF NOT EXISTS idx_orders_status        ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_paid          ON orders(paid);
CREATE INDEX IF NOT EXISTS idx_orders_created       ON orders(created_at DESC);

-- ─── CATEGORÍAS Y SUBCATEGORÍAS INICIALES ────────────────────────
INSERT INTO categories (name, slug, icon, sort_order) VALUES
  ('Smartphones',        'smartphones',      '📱', 1),
  ('Auriculares',        'auriculares',      '🎧', 2),
  ('Fundas y Templados', 'fundas',           '🛡️', 3),
  ('Cargadores',         'cargadores',       '⚡', 4),
  ('Tablets',            'tablets',          '📟', 5),
  ('Accesorios PC',      'accesorios-pc',    '🖱️', 6),
  ('Smart TV y Video',   'smart-tv',         '📺', 7),
  ('Smartwatches',       'smartwatches',     '⌚', 8),
  ('Parlantes',          'parlantes',        '🔊', 9),
  ('Gaming',             'gaming',           '🎮', 10),
  ('Iluminación',        'iluminacion',      '💡', 11),
  ('Otros',              'otros',            '📦', 12)
ON CONFLICT DO NOTHING;

INSERT INTO subcategories (name, slug, category_id, sort_order)
SELECT sub.name, sub.slug, c.id, sub.ord
FROM (VALUES
  ('Samsung',     'samsung',     'Smartphones',  1),
  ('Motorola',    'motorola',    'Smartphones',  2),
  ('Xiaomi',      'xiaomi',      'Smartphones',  3),
  ('iPhone',      'iphone',      'Smartphones',  4),
  ('Over-ear',    'over-ear',    'Auriculares',  1),
  ('In-ear',      'in-ear',      'Auriculares',  2),
  ('Gaming',      'gaming-aur',  'Auriculares',  3),
  ('Fundas',      'fundas-sub',  'Fundas y Templados', 1),
  ('Templados',   'templados',   'Fundas y Templados', 2),
  ('Cables',      'cables',      'Cargadores',   1),
  ('Cargadores',  'cargadores-s','Cargadores',   2),
  ('Powerbanks',  'powerbanks',  'Cargadores',   3),
  ('Mouse',       'mouse',       'Accesorios PC',1),
  ('Teclados',    'teclados',    'Accesorios PC',2),
  ('Webcams',     'webcams',     'Accesorios PC',3),
  ('PS5',         'ps5',         'Gaming',       1),
  ('Xbox',        'xbox',        'Gaming',       2),
  ('PC Gaming',   'pc-gaming',   'Gaming',       3)
) AS sub(name, slug, cat_name, ord)
JOIN categories c ON c.name = sub.cat_name
ON CONFLICT DO NOTHING;