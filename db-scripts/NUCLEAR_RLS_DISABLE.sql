-- ============================================================================
-- EMERGENCY FIX: DISABLE ALL RLS COMPLETELY
-- ============================================================================
-- This completely disables RLS on all tables to allow operations
-- Run this if the previous fix didn't work

BEGIN TRANSACTION;

-- Disable RLS on all tables that might be preventing delete operations
ALTER TABLE IF EXISTS invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoice_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payment_allocations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles DISABLE ROW LEVEL SECURITY;

-- Drop ALL policies (not just the problematic ones)
-- This ensures no old policies are interfering
DO $$ 
DECLARE 
  policy_record RECORD;
BEGIN 
  FOR policy_record IN
    SELECT policyname, tablename 
    FROM pg_policies 
    WHERE schemaname = 'public'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON ' || policy_record.tablename;
  END LOOP;
END $$;

COMMIT;

-- Verify RLS is disabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('invoices', 'invoice_items', 'payment_allocations')
AND schemaname = 'public'
ORDER BY tablename;
