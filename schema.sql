-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  barcode text UNIQUE,
  category_id uuid REFERENCES categories(id),
  price numeric(10,2) NOT NULL DEFAULT 0,
  cost numeric(10,2) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'unidad',
  requires_prescription boolean DEFAULT false,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Inventory
CREATE TABLE IF NOT EXISTS inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) UNIQUE NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 0,
  min_stock numeric(10,2) DEFAULT 0,
  lot_number text,
  expiry_date date,
  updated_at timestamptz DEFAULT now()
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  address text,
  document_number text,
  credit_limit numeric(10,2) DEFAULT 0,
  current_balance numeric(10,2) DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Sales
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id),
  total numeric(10,2) NOT NULL DEFAULT 0,
  discount numeric(10,2) DEFAULT 0,
  tax numeric(10,2) DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'efectivo',
  payment_status text NOT NULL DEFAULT 'pagado',
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Sale Items
CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES sales(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES products(id) NOT NULL,
  quantity numeric(10,2) NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  discount numeric(10,2) DEFAULT 0,
  subtotal numeric(10,2) NOT NULL
);

-- Inventory Movements
CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) NOT NULL,
  type text NOT NULL,
  quantity numeric(10,2) NOT NULL,
  reason text,
  reference_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Customer Payments
CREATE TABLE IF NOT EXISTS customer_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) NOT NULL,
  amount numeric(10,2) NOT NULL,
  payment_method text DEFAULT 'efectivo',
  reference text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS and allow all for now (anon access)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_categories" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_inventory" ON inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_customers" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_sales" ON sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_sale_items" ON sale_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_inv_movements" ON inventory_movements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_cust_payments" ON customer_payments FOR ALL USING (true) WITH CHECK (true);
