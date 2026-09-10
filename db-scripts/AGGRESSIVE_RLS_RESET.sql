-- ============================================================================
-- AGGRESSIVE RLS RESET - FORCE COMPLETE DISABLE
-- ============================================================================
-- This forcefully removes ALL RLS from ALL tables in the database

BEGIN TRANSACTION;

-- Drop ALL policies on ALL tables
DO $$ 
DECLARE 
  record RECORD;
BEGIN 
  FOR record IN (
    SELECT policyname, tablename 
    FROM pg_policies 
    WHERE schemaname = 'public'
  )
  LOOP
    EXECUTE 'DROP POLICY "' || record.policyname || '" ON ' || record.tablename;
  END LOOP;
END $$;

-- Disable RLS on ALL tables in the database
DO $$
DECLARE
  table_record RECORD;
BEGIN
  FOR table_record IN (
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  )
  LOOP
    EXECUTE 'ALTER TABLE ' || table_record.tablename || ' DISABLE ROW LEVEL SECURITY';
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION - Should show 0 policies and all RLS disabled
-- ============================================================================

-- Count remaining policies
SELECT COUNT(*) as remaining_policies FROM pg_policies WHERE schemaname = 'public';

-- Show RLS status on key tables
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('invoices', 'invoice_items', 'payments', 'profiles', 'customers')
ORDER BY tablename;
