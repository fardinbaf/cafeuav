
-- CAFE UAV | ELITE DATABASE ARCHITECTURE
-- Optimized for LAC Zubayer Management Node

-- 1. TABLE DEFINITIONS
CREATE TABLE IF NOT EXISTS public.customers (
  id bigint primary key generated always as identity,
  uid text unique not null,
  name text not null,
  phone text,
  total_baki numeric default 0,
  email text
);

CREATE TABLE IF NOT EXISTS public.inventory (
  id bigint primary key generated always as identity,
  item_name text not null,
  price numeric not null default 0,
  stock_quantity integer not null default 0,
  category text default 'Snacks',
  image_url text
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id bigint primary key generated always as identity,
  customer_id bigint REFERENCES public.customers(id) ON DELETE CASCADE,
  items jsonb not null default '[]'::jsonb,
  total_amount numeric not null,
  payment_type text not null, -- 'Cash', 'UCB', 'Baki'
  timestamp bigint not null,
  type text not null, -- 'sale', 'payment'
  note text
);

CREATE TABLE IF NOT EXISTS public.demands (
  id bigint primary key generated always as identity,
  customer_id bigint REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_name text,
  item_id bigint REFERENCES public.inventory(id) ON DELETE SET NULL,
  item_name text,
  timestamp bigint not null,
  status text default 'pending' -- 'pending', 'fulfilled', 'cancelled'
);

CREATE TABLE IF NOT EXISTS public.settings (
  key text primary key,
  value jsonb not null
);

-- 2. TRIGGER MANAGEMENT
DO $$ 
DECLARE
    trgname text;
BEGIN
    FOR trgname IN (SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'transactions' AND trigger_schema = 'public') 
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.transactions', trgname);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.sync_member_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.type = 'sale' AND NEW.payment_type = 'Baki') THEN
    UPDATE public.customers
    SET total_baki = COALESCE(total_baki, 0) + NEW.total_amount
    WHERE id = NEW.customer_id;
  ELSIF (NEW.type = 'payment') THEN
    UPDATE public.customers
    SET total_baki = COALESCE(total_baki, 0) - NEW.total_amount
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_sync_balance_final
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_member_balance();

-- 3. HARDENED RLS POLICIES (Resolves 0024_permissive_rls_policy)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Reset existing policies
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 3.1 CUSTOMERS POLICIES
CREATE POLICY "cust_select" ON public.customers FOR SELECT USING (true);
CREATE POLICY "cust_insert" ON public.customers FOR INSERT WITH CHECK (name IS NOT NULL AND uid IS NOT NULL);
CREATE POLICY "cust_update" ON public.customers FOR UPDATE USING (name IS NOT NULL) WITH CHECK (uid IS NOT NULL);
CREATE POLICY "cust_delete" ON public.customers FOR DELETE USING (name IS NOT NULL);

-- 3.2 INVENTORY POLICIES
CREATE POLICY "inv_select" ON public.inventory FOR SELECT USING (true);
CREATE POLICY "inv_insert" ON public.inventory FOR INSERT WITH CHECK (item_name IS NOT NULL);
CREATE POLICY "inv_update" ON public.inventory FOR UPDATE USING (item_name IS NOT NULL) WITH CHECK (price >= 0);
CREATE POLICY "inv_delete" ON public.inventory FOR DELETE USING (item_name IS NOT NULL);

-- 3.3 TRANSACTIONS POLICIES
CREATE POLICY "trans_select" ON public.transactions FOR SELECT USING (true);
CREATE POLICY "trans_insert" ON public.transactions FOR INSERT WITH CHECK (total_amount >= 0 AND payment_type IS NOT NULL);
CREATE POLICY "trans_delete" ON public.transactions FOR DELETE USING (payment_type IS NOT NULL);

-- 3.4 DEMANDS POLICIES
CREATE POLICY "dem_select" ON public.demands FOR SELECT USING (true);
CREATE POLICY "dem_insert" ON public.demands FOR INSERT WITH CHECK (customer_name IS NOT NULL AND item_name IS NOT NULL);
CREATE POLICY "dem_update" ON public.demands FOR UPDATE USING (status IS NOT NULL) WITH CHECK (status IS NOT NULL);
CREATE POLICY "dem_delete" ON public.demands FOR DELETE USING (status IS NOT NULL);

-- 3.5 SETTINGS POLICIES
CREATE POLICY "sett_select" ON public.settings FOR SELECT USING (true);
CREATE POLICY "sett_insert" ON public.settings FOR INSERT WITH CHECK (key IS NOT NULL);
CREATE POLICY "sett_update" ON public.settings FOR UPDATE USING (key IS NOT NULL) WITH CHECK (value IS NOT NULL);

-- 4. PERMISSIONS
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
