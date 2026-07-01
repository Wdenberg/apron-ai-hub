
-- ==== ENUMS ====
CREATE TYPE public.app_role AS ENUM ('owner', 'admin');
CREATE TYPE public.order_status AS ENUM ('recebido', 'preparo', 'pronto', 'entregue', 'cancelado');
CREATE TYPE public.order_type AS ENUM ('reserva', 'presencial');
CREATE TYPE public.payment_method AS ENUM ('pix', 'cartao', 'dinheiro', 'nao_definido');
CREATE TYPE public.subscription_status AS ENUM ('trial', 'active', 'past_due', 'blocked', 'canceled');

-- ==== updated_at helper ====
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ==== profiles ====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  whatsapp TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_self_all" ON public.profiles FOR ALL TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==== user_roles ====
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_self_read" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- ==== auto-create profile + owner role on signup ====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==== stores ====
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  cover_url TEXT,
  whatsapp TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_open BOOLEAN NOT NULL DEFAULT true,
  subscription_status subscription_status NOT NULL DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX stores_owner_idx ON public.stores(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT SELECT ON public.stores TO anon;
GRANT ALL ON public.stores TO service_role;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stores_owner_all" ON public.stores FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "stores_public_read" ON public.stores FOR SELECT TO anon
  USING (true);
CREATE TRIGGER stores_updated_at BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==== products ====
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  photo_url TEXT,
  category TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX products_store_idx ON public.products(store_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT ON public.products TO anon;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_owner_all" ON public.products FOR ALL TO authenticated
  USING (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));
CREATE POLICY "products_public_read" ON public.products FOR SELECT TO anon
  USING (active = true);
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==== orders ====
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_number INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  customer_whatsapp TEXT,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status order_status NOT NULL DEFAULT 'recebido',
  type order_type NOT NULL DEFAULT 'reserva',
  payment payment_method NOT NULL DEFAULT 'nao_definido',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, order_number)
);
CREATE INDEX orders_store_idx ON public.orders(store_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT SELECT, INSERT ON public.orders TO anon;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_owner_all" ON public.orders FOR ALL TO authenticated
  USING (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));
CREATE POLICY "orders_public_insert" ON public.orders FOR INSERT TO anon
  WITH CHECK (true);
CREATE POLICY "orders_public_read_own" ON public.orders FOR SELECT TO anon
  USING (true);
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- next order number per store
CREATE OR REPLACE FUNCTION public.next_order_number(_store UUID)
RETURNS INTEGER LANGUAGE sql AS $$
  SELECT COALESCE(MAX(order_number), 0) + 1 FROM public.orders WHERE store_id = _store;
$$;

CREATE OR REPLACE FUNCTION public.assign_order_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = 0 THEN
    NEW.order_number := public.next_order_number(NEW.store_id);
  END IF;
  RETURN NEW;
END; $$;
ALTER TABLE public.orders ALTER COLUMN order_number DROP NOT NULL;
CREATE TRIGGER orders_assign_number BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.assign_order_number();

-- ==== order_items ====
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX order_items_order_idx ON public.order_items(order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT SELECT, INSERT ON public.order_items TO anon;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_owner_all" ON public.order_items FOR ALL TO authenticated
  USING (order_id IN (SELECT o.id FROM public.orders o JOIN public.stores s ON s.id = o.store_id WHERE s.owner_id = auth.uid()))
  WITH CHECK (order_id IN (SELECT o.id FROM public.orders o JOIN public.stores s ON s.id = o.store_id WHERE s.owner_id = auth.uid()));
CREATE POLICY "order_items_public_insert" ON public.order_items FOR INSERT TO anon
  WITH CHECK (true);
CREATE POLICY "order_items_public_read" ON public.order_items FOR SELECT TO anon
  USING (true);

-- decrement stock and update order total on item insert
CREATE OR REPLACE FUNCTION public.after_order_item_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.products
    SET stock = GREATEST(stock - NEW.quantity, 0),
        active = CASE WHEN stock - NEW.quantity <= 0 THEN false ELSE active END
    WHERE id = NEW.product_id;
  UPDATE public.orders
    SET total = total + (NEW.quantity * NEW.unit_price)
    WHERE id = NEW.order_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER order_items_after_insert AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.after_order_item_insert();

-- ==== customers ====
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  whatsapp TEXT NOT NULL,
  name TEXT NOT NULL,
  total_orders INTEGER NOT NULL DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, whatsapp)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_owner_all" ON public.customers FOR ALL TO authenticated
  USING (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

-- upsert customer on order creation (reserva only, and only if whatsapp present)
CREATE OR REPLACE FUNCTION public.upsert_customer_on_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.type = 'reserva' AND NEW.customer_whatsapp IS NOT NULL AND NEW.customer_whatsapp <> '' THEN
    INSERT INTO public.customers (store_id, whatsapp, name, total_orders, last_order_at)
    VALUES (NEW.store_id, NEW.customer_whatsapp, NEW.customer_name, 1, now())
    ON CONFLICT (store_id, whatsapp) DO UPDATE
      SET total_orders = public.customers.total_orders + 1,
          last_order_at = now(),
          name = EXCLUDED.name;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER orders_upsert_customer AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.upsert_customer_on_order();
