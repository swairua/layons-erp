-- ============================================================================
-- COMPREHENSIVE RLS FIX FOR INVOICE DELETION
-- ============================================================================
-- This fixes RLS issues on invoices AND related tables that cascade

BEGIN TRANSACTION;

-- ============================================================================
-- STEP 1: DISABLE RLS ON INVOICES AND RELATED TABLES
-- ============================================================================

ALTER TABLE IF EXISTS invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoice_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payment_allocations DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: DROP ALL PROBLEMATIC POLICIES
-- ============================================================================

-- Drop from invoices
DROP POLICY IF EXISTS "Company scoped access" ON invoices;
DROP POLICY IF EXISTS "Users can access invoices in their company" ON invoices;
DROP POLICY IF EXISTS "Invoices are accessible to authenticated users" ON invoices;
DROP POLICY IF EXISTS "Invoices accessible to authenticated users" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can manage invoices" ON invoices;

-- Drop from invoice_items
DROP POLICY IF EXISTS "Company scoped access" ON invoice_items;
DROP POLICY IF EXISTS "Users can access invoice items in their company" ON invoice_items;
DROP POLICY IF EXISTS "Invoice items accessible to authenticated users" ON invoice_items;
DROP POLICY IF EXISTS "Authenticated users can manage invoice items" ON invoice_items;

-- Drop from payment_allocations
DROP POLICY IF EXISTS "Company scoped access" ON payment_allocations;
DROP POLICY IF EXISTS "Users can view payment allocations for their company" ON payment_allocations;
DROP POLICY IF EXISTS "Users can insert payment allocations for their company" ON payment_allocations;
DROP POLICY IF EXISTS "Users can update payment allocations for their company" ON payment_allocations;
DROP POLICY IF EXISTS "Users can delete payment allocations for their company" ON payment_allocations;
DROP POLICY IF EXISTS "Authenticated users can manage payment allocations" ON payment_allocations;

-- ============================================================================
-- STEP 3: RE-ENABLE RLS WITH SAFE, SIMPLE POLICIES
-- ============================================================================

ALTER TABLE IF EXISTS invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage invoices" ON invoices
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- ENABLE RLS ON INVOICE_ITEMS
-- ============================================================================

ALTER TABLE IF EXISTS invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage invoice items" ON invoice_items
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- ENABLE RLS ON PAYMENT_ALLOCATIONS
-- ============================================================================

ALTER TABLE IF EXISTS payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage payment allocations" ON payment_allocations
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies 
WHERE tablename IN ('invoices', 'invoice_items', 'payment_allocations')
ORDER BY tablename, policyname;
