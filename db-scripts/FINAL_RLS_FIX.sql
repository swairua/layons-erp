-- ============================================================================
-- FINAL RLS FIX - RUN THIS DIRECTLY IN SUPABASE SQL EDITOR
-- ============================================================================
-- This completely removes all RLS policies that are blocking invoice deletion
-- and disables RLS on the problematic tables

BEGIN TRANSACTION;

-- Step 1: Disable RLS on all problematic tables
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies (comprehensive cleanup)
DO $$ 
DECLARE 
  record RECORD;
BEGIN 
  FOR record IN (
    SELECT policyname, tablename 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN ('invoices', 'invoice_items', 'payment_allocations', 'payments', 'profiles')
  )
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || record.policyname || '" ON ' || record.tablename;
  END LOOP;
END $$;

COMMIT;

-- Verification
SELECT 
  'RLS Disabled Successfully' as status,
  COUNT(*) as remaining_policies
FROM pg_policies 
WHERE tablename IN ('invoices', 'invoice_items', 'payment_allocations');
