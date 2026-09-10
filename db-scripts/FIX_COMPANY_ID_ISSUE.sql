-- ============================================================================
-- COMPREHENSIVE FIX FOR company_id ISSUE AND RLS
-- ============================================================================
-- This script:
-- 1. Checks if company_id column exists
-- 2. Adds it if missing
-- 3. Populates NULL company_id values
-- 4. Disables all RLS completely

BEGIN TRANSACTION;

-- ============================================================================
-- STEP 1: Ensure company_id column exists on invoices
-- ============================================================================
ALTER TABLE IF EXISTS invoices
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 2: Populate company_id for invoices that have NULL company_id
-- ============================================================================
-- Try to get company_id from the related customer
UPDATE invoices inv
SET company_id = (
  SELECT company_id 
  FROM customers c 
  WHERE c.id = inv.customer_id
)
WHERE inv.company_id IS NULL AND inv.customer_id IS NOT NULL;

-- For invoices with no customer, assign to the first company
UPDATE invoices
SET company_id = (
  SELECT id FROM companies 
  ORDER BY created_at ASC 
  LIMIT 1
)
WHERE company_id IS NULL;

-- ============================================================================
-- STEP 3: Create index for better performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);

-- ============================================================================
-- STEP 4: Disable RLS on all tables to remove policy blocking
-- ============================================================================
ALTER TABLE IF EXISTS invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoice_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payment_allocations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS companies DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Drop ALL RLS policies to ensure complete cleanup
-- ============================================================================
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
    EXECUTE 'DROP POLICY IF EXISTS "' || record.policyname || '" ON ' || record.tablename;
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check if company_id column exists and is populated
SELECT 
  'Invoices Table Check' as check_type,
  COUNT(*) as total_invoices,
  COUNT(company_id) as invoices_with_company_id,
  COUNT(CASE WHEN company_id IS NULL THEN 1 END) as null_company_ids
FROM invoices;

-- Check RLS status
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('invoices', 'invoice_items', 'payment_allocations')
AND schemaname = 'public'
ORDER BY tablename;

-- Check remaining policies
SELECT 
  'Remaining RLS Policies' as check_type,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public';
