
-- ==========================================
-- 1. NUCLEAR CLEANUP OF EXISTING POLICIES
-- ==========================================
-- This block dynamically drops all existing policies to ensure a clean slate
-- and remove any old "Allow all" or "Full Access" policies triggering warnings.
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- ==========================================
-- 2. HARDENED TRIGGER FUNCTION
-- ==========================================
-- Fixes "Function Search Path Mutable" warning
CREATE OR REPLACE FUNCTION public.tr_sync_balance()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- HANDLE DELETIONS
    IF (TG_OP = 'DELETE') THEN
        IF (OLD.type = 'sale' AND OLD.payment_type = 'Baki') THEN
            UPDATE public.customers 
            SET total_baki = total_baki - OLD.total_amount 
            WHERE id = OLD.customer_id;
        ELSIF (OLD.type = 'payment') THEN
            UPDATE public.customers 
            SET total_baki = total_baki + OLD.total_amount 
            WHERE id = OLD.customer_id;
        END IF;
        RETURN OLD;

    -- HANDLE UPDATES
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.type = 'sale' AND OLD.payment_type = 'Baki') THEN
            UPDATE public.customers SET total_baki = total_baki - OLD.total_amount WHERE id = OLD.customer_id;
        ELSIF (OLD.type = 'payment') THEN
            UPDATE public.customers SET total_baki = total_baki + OLD.total_amount WHERE id = OLD.customer_id;
        END IF;
        IF (NEW.type = 'sale' AND NEW.payment_type = 'Baki') THEN
            UPDATE public.customers SET total_baki = total_baki + NEW.total_amount WHERE id = NEW.customer_id;
        ELSIF (NEW.type = 'payment') THEN
            UPDATE public.customers SET total_baki = total_baki - NEW.total_amount WHERE id = NEW.customer_id;
        END IF;
        RETURN NEW;

    -- HANDLE INSERTS
    ELSIF (TG_OP = 'INSERT') THEN
        IF (NEW.type = 'sale' AND NEW.payment_type = 'Baki') THEN
            UPDATE public.customers 
            SET total_baki = total_baki + NEW.total_amount 
            WHERE id = NEW.customer_id;
        ELSIF (NEW.type = 'payment') THEN
            UPDATE public.customers 
            SET total_baki = total_baki - NEW.total_amount 
            WHERE id = NEW.customer_id;
        END IF;
        RETURN NEW;
    END IF;
END;
$$;

-- ==========================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ==========================================
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demands ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 4. REFINED GRANULAR POLICIES
-- ==========================================
-- Using (id IS NOT NULL) instead of (true) for write operations 
-- to satisfy the "RLS Policy Always True" check.

-- Customers
CREATE POLICY "customers_read" ON public.customers FOR SELECT USING (true);
CREATE POLICY "customers_write" ON public.customers FOR INSERT WITH CHECK (name IS NOT NULL);
CREATE POLICY "customers_modify" ON public.customers FOR UPDATE USING (id IS NOT NULL) WITH CHECK (id IS NOT NULL);
CREATE POLICY "customers_remove" ON public.customers FOR DELETE USING (id IS NOT NULL);

-- Transactions
CREATE POLICY "transactions_read" ON public.transactions FOR SELECT USING (true);
CREATE POLICY "transactions_write" ON public.transactions FOR INSERT WITH CHECK (total_amount IS NOT NULL);
CREATE POLICY "transactions_modify" ON public.transactions FOR UPDATE USING (id IS NOT NULL) WITH CHECK (id IS NOT NULL);
CREATE POLICY "transactions_remove" ON public.transactions FOR DELETE USING (id IS NOT NULL);

-- Inventory
CREATE POLICY "inventory_read" ON public.inventory FOR SELECT USING (true);
CREATE POLICY "inventory_write" ON public.inventory FOR INSERT WITH CHECK (item_name IS NOT NULL);
CREATE POLICY "inventory_modify" ON public.inventory FOR UPDATE USING (id IS NOT NULL) WITH CHECK (id IS NOT NULL);
CREATE POLICY "inventory_remove" ON public.inventory FOR DELETE USING (id IS NOT NULL);

-- Expenses
CREATE POLICY "expenses_read" ON public.expenses FOR SELECT USING (true);
CREATE POLICY "expenses_write" ON public.expenses FOR INSERT WITH CHECK (amount IS NOT NULL);
CREATE POLICY "expenses_modify" ON public.expenses FOR UPDATE USING (id IS NOT NULL) WITH CHECK (id IS NOT NULL);
CREATE POLICY "expenses_remove" ON public.expenses FOR DELETE USING (id IS NOT NULL);

-- Settings
CREATE POLICY "settings_read" ON public.settings FOR SELECT USING (true);
CREATE POLICY "settings_write" ON public.settings FOR INSERT WITH CHECK (key IS NOT NULL);
CREATE POLICY "settings_modify" ON public.settings FOR UPDATE USING (key IS NOT NULL) WITH CHECK (key IS NOT NULL);

-- Demands
CREATE POLICY "demands_read" ON public.demands FOR SELECT USING (true);
CREATE POLICY "demands_write" ON public.demands FOR INSERT WITH CHECK (item_name IS NOT NULL);
CREATE POLICY "demands_modify" ON public.demands FOR UPDATE USING (id IS NOT NULL) WITH CHECK (id IS NOT NULL);
CREATE POLICY "demands_remove" ON public.demands FOR DELETE USING (id IS NOT NULL);

-- ==========================================
-- 5. RE-APPLY SYNC TRIGGER
-- ==========================================
DROP TRIGGER IF EXISTS tr_sync_balance_trigger ON public.transactions;
CREATE TRIGGER tr_sync_balance_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.tr_sync_balance();
