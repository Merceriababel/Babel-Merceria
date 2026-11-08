-- Esquema de Babel Mercería (PostgreSQL). Equivale a las migraciones de Alembic.
-- Podés pegarlo en el editor SQL de Neon / Supabase.

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(200) NOT NULL,
  rol VARCHAR(20) NOT NULL CHECK (rol IN ('admin', 'empleado')),
  activo BOOLEAN NOT NULL DEFAULT TRUE
);
-- Solo dos usuarios: uno por rol
CREATE UNIQUE INDEX users_un_usuario_por_rol ON users (rol);

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(40) NOT NULL UNIQUE,
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT,
  category_id INTEGER REFERENCES categories(id),
  unidad VARCHAR(2) NOT NULL DEFAULT 'u' CHECK (unidad IN ('m', 'kg', 'u')),
  precio_compra NUMERIC(12,2) NOT NULL DEFAULT 0,
  precio_venta NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_minimo NUMERIC(12,2) NOT NULL DEFAULT 0,
  imagen_url VARCHAR(500),
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE variants (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  color VARCHAR(60) NOT NULL DEFAULT 'Único',
  codigo_color VARCHAR(20),
  imagen_url VARCHAR(500),
  stock_actual NUMERIC(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX variants_product_idx ON variants (product_id);

CREATE TABLE suppliers (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  telefono VARCHAR(40),
  email VARCHAR(150),
  direccion VARCHAR(200)
);

CREATE TABLE purchases (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  notas VARCHAR(300)
);

CREATE TABLE purchase_items (
  id SERIAL PRIMARY KEY,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id),
  variant_id INTEGER NOT NULL REFERENCES variants(id),
  cantidad NUMERIC(12,2) NOT NULL,
  costo_unit NUMERIC(12,2) NOT NULL
);

CREATE TABLE sales (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  metodo_pago VARCHAR(20) NOT NULL CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia')),
  estado VARCHAR(20) NOT NULL CHECK (estado IN ('pendiente', 'aprobada', 'cancelada')),
  nro_operacion VARCHAR(60),
  observaciones VARCHAR(300),
  total NUMERIC(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX sales_fecha_idx ON sales (fecha);

CREATE TABLE sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  variant_id INTEGER NOT NULL REFERENCES variants(id),
  cantidad NUMERIC(12,2) NOT NULL,
  precio_unit NUMERIC(12,2) NOT NULL,
  costo_unit NUMERIC(12,2) NOT NULL
);

CREATE TABLE stock_movements (
  id SERIAL PRIMARY KEY,
  variant_id INTEGER NOT NULL REFERENCES variants(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  tipo VARCHAR(20) NOT NULL,
  cantidad NUMERIC(12,2) NOT NULL,
  motivo VARCHAR(200) NOT NULL DEFAULT '',
  costo_unit NUMERIC(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX stock_movements_fecha_idx ON stock_movements (fecha);
