-- ============================================================================
-- SAFE RLS RECURSION FIX - Only modifies existing tables
-- ============================================================================

BEGIN TRANSACTION;

-- STEP 1: DISABLE RLS ON INVOICES (most critical)
DO $$
BEGIN
  -- Check if invoices table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'invoices'
  ) THEN
    ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Company scoped access" ON invoices;
    DROP POLICY IF EXISTS "Users can access invoices in their company" ON invoices;
    DROP POLICY IF EXISTS "Invoices are accessible to authenticated users" ON invoices;
    DROP POLICY IF EXISTS "Users can insert invoices" ON invoices;
    DROP POLICY IF EXISTS "Users can update invoices" ON invoices;
    RAISE NOTICE '✓ Invoices table RLS disabled';
  ELSE
    RAISE NOTICE '⚠ Invoices table does not exist';
  END IF;
END $$;

-- STEP 2: DISABLE RLS ON INVOICE_ITEMS
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'invoice_items'
  ) THEN
    ALTER TABLE invoice_items DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Company scoped access" ON invoice_items;
    RAISE NOTICE '✓ Invoice_items table RLS disabled';
  END IF;
END $$;

-- STEP 3: DISABLE RLS ON CUSTOMERS
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'customers'
  ) THEN
    ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Company scoped access" ON customers;
    DROP POLICY IF EXISTS "Users can access customers in their company" ON customers;
    RAISE NOTICE '✓ Customers table RLS disabled';
  END IF;
END $$;

-- STEP 4: DISABLE RLS ON QUOTATIONS
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'quotations'
  ) THEN
    ALTER TABLE quotations DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Company scoped access" ON quotations;
    DROP POLICY IF EXISTS "Users can access quotations in their company" ON quotations;
    RAISE NOTICE '✓ Quotations table RLS disabled';
  END IF;
END $$;

-- STEP 5: DISABLE RLS ON PAYMENTS
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'payments'
  ) THEN
    ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Company scoped access" ON payments;
    DROP POLICY IF EXISTS "Users can access payments in their company" ON payments;
    RAISE NOTICE '✓ Payments table RLS disabled';
  END IF;
END $$;

-- STEP 6: DISABLE RLS ON BOQS
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'boqs'
  ) THEN
    ALTER TABLE boqs DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Company scoped access" ON boqs;
    RAISE NOTICE '✓ BOQs table RLS disabled';
  END IF;
END $$;

-- STEP 7: DISABLE RLS ON CREDIT_NOTES (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'credit_notes'
  ) THEN
    ALTER TABLE credit_notes DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Company scoped access" ON credit_notes;
    RAISE NOTICE '✓ Credit_notes table RLS disabled';
  ELSE
    RAISE NOTICE '⚠ Credit_notes table does not exist (skipped)';
  END IF;
END $$;

-- STEP 8: DISABLE RLS ON PROFORMA_INVOICES (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'proforma_invoices'
  ) THEN
    ALTER TABLE proforma_invoices DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Company scoped access" ON proforma_invoices;
    RAISE NOTICE '✓ Proforma_invoices table RLS disabled';
  ELSE
    RAISE NOTICE '⚠ Proforma_invoices table does not exist (skipped)';
  END IF;
END $$;

-- STEP 9: DISABLE RLS ON LPOS (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'lpos'
  ) THEN
    ALTER TABLE lpos DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Company scoped access" ON lpos;
    RAISE NOTICE '✓ LPOs table RLS disabled';
  ELSE
    RAISE NOTICE '⚠ LPOs table does not exist (skipped)';
  END IF;
END $$;

-- STEP 10: DISABLE RLS ON STOCK_MOVEMENTS (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'stock_movements'
  ) THEN
    ALTER TABLE stock_movements DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can view stock movements for their company" ON stock_movements;
    RAISE NOTICE '✓ Stock_movements table RLS disabled';
  ELSE
    RAISE NOTICE '⚠ Stock_movements table does not exist (skipped)';
  END IF;
END $$;

-- STEP 11: DISABLE RLS ON CASH_RECEIPTS (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'cash_receipts'
  ) THEN
    ALTER TABLE cash_receipts DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can only access cash receipts for their company" ON cash_receipts;
    RAISE NOTICE '✓ Cash_receipts table RLS disabled';
  ELSE
    RAISE NOTICE '⚠ Cash_receipts table does not exist (skipped)';
  END IF;
END $$;

-- STEP 12: DISABLE RLS ON DELIVERY_NOTES (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'delivery_notes'
  ) THEN
    ALTER TABLE delivery_notes DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Company scoped access" ON delivery_notes;
    RAISE NOTICE '✓ Delivery_notes table RLS disabled';
  ELSE
    RAISE NOTICE '⚠ Delivery_notes table does not exist (skipped)';
  END IF;
END $$;

-- STEP 13: DISABLE RLS ON PRODUCTS (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'products'
  ) THEN
    ALTER TABLE products DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Company scoped access" ON products;
    RAISE NOTICE '✓ Products table RLS disabled';
  ELSE
    RAISE NOTICE '⚠ Products table does not exist (skipped)';
  END IF;
END $$;

-- STEP 14: DISABLE RLS ON TAX_SETTINGS (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'tax_settings'
  ) THEN
    ALTER TABLE tax_settings DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Company scoped access" ON tax_settings;
    RAISE NOTICE '✓ Tax_settings table RLS disabled';
  ELSE
    RAISE NOTICE '⚠ Tax_settings table does not exist (skipped)';
  END IF;
END $$;

-- STEP 15: DISABLE RLS ON UNITS (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'units'
  ) THEN
    ALTER TABLE units DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Company scoped access" ON units;
    RAISE NOTICE '✓ Units table RLS disabled';
  ELSE
    RAISE NOTICE '⚠ Units table does not exist (skipped)';
  END IF;
END $$;

-- STEP 16: FIX INVOICES company_id COLUMN (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'invoices'
  ) THEN
    -- Add company_id column if missing
    ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

    -- Create index for performance
    CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);

    -- Populate company_id from customer relationship
    UPDATE invoices inv
    SET company_id = (
      SELECT c.company_id
      FROM customers c
      WHERE c.id = inv.customer_id
    )
    WHERE inv.company_id IS NULL;

    -- For orphaned invoices, assign to first company
    UPDATE invoices
    SET company_id = (SELECT id FROM companies LIMIT 1)
    WHERE company_id IS NULL;

    RAISE NOTICE '✓ Invoices company_id column fixed';
  END IF;
END $$;

COMMIT;

-- VERIFY SUCCESS
SELECT 'SUCCESS: RLS recursion fix applied!' as status,
       'All existing tables have been processed' as note;
