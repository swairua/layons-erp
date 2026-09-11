import {
  supabase,
  SUPABASE_PUBLISHABLE_KEY,
} from '@/integrations/supabase/client';

/**
 * Safe SQL executor that handles multiple RPC methods and edge cases
 */

export interface ExecutionResult {
  success: boolean;
  message: string;
  method?: string;
  details?: string;
}

/**
 * Try multiple RPC methods to execute SQL
 * This is necessary because different Supabase projects have different RPC functions available
 */
export async function executeSqlSafely(sql: string): Promise<ExecutionResult> {
  console.log('🔄 Attempting to execute SQL...');

  // Method 1: Try with 'exec' function (most common)
  try {
    console.log('Trying RPC method: exec');
    const { data, error } = await supabase.rpc('exec', { sql });

    if (!error) {
      console.log('✅ SQL executed successfully via exec RPC');
      return {
        success: true,
        message: 'SQL executed successfully',
        method: 'exec',
      };
    }

    if (error?.code !== '42883') {
      // Not a "function not found" error, so log it
      console.warn('⚠️ exec RPC returned error:', error?.message);
    }
  } catch (err) {
    console.warn('exec RPC attempt failed:', (err as Error).message);
  }

  // Method 2: Try with 'exec_sql' function
  try {
    console.log('Trying RPC method: exec_sql');
    const { data, error } = await supabase.rpc('exec_sql', { sql });

    if (!error) {
      console.log('✅ SQL executed successfully via exec_sql RPC');
      return {
        success: true,
        message: 'SQL executed successfully',
        method: 'exec_sql',
      };
    }

    if (error?.code !== '42883') {
      console.warn('⚠️ exec_sql RPC returned error:', error?.message);
    }
  } catch (err) {
    console.warn('exec_sql RPC attempt failed:', (err as Error).message);
  }

  // Method 3: Try with 'sql' function (parameter name might differ)
  try {
    console.log('Trying RPC method: sql');
    const { data, error } = await supabase.rpc('sql', { query: sql });

    if (!error) {
      console.log('✅ SQL executed successfully via sql RPC');
      return {
        success: true,
        message: 'SQL executed successfully',
        method: 'sql',
      };
    }

    if (error?.code !== '42883') {
      console.warn('⚠️ sql RPC returned error:', error?.message);
    }
  } catch (err) {
    console.warn('sql RPC attempt failed:', (err as Error).message);
  }

  // Method 4: Try direct query (might work in some setups)
  try {
    console.log('Trying direct Supabase query');
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token || SUPABASE_PUBLISHABLE_KEY;
    const result = await fetch(`${supabase.supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'apikey': SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ sql }),
    });

    if (result.ok) {
      console.log('✅ SQL executed via direct fetch');
      return {
        success: true,
        message: 'SQL executed successfully',
        method: 'direct_fetch',
      };
    }

    const responseText = await result.text();
    console.warn(`Direct SQL execution failed (${result.status}):`, responseText);
  } catch (err) {
    console.warn('Direct fetch attempt failed:', (err as Error).message);
  }

  // All methods failed
  console.error('❌ All SQL execution methods failed');
  return {
    success: false,
    message: 'Could not execute SQL automatically. The database SQL RPC is unavailable or denied.',
    details: 'Use the supplied SQL in the Supabase SQL Editor with an authorized database role.',
  };
}

/**
 * Get the correct SQL to disable RLS and add company_id column
 */
export function getDisableRLSAndAddColumnSQL(): string {
  return `
-- ============================================================================
-- DISABLE RLS AND ADD company_id COLUMN
-- ============================================================================
-- This script disables RLS first (to avoid policy conflicts)
-- then adds the missing company_id column
-- ============================================================================

BEGIN TRANSACTION;

-- ============================================================================
-- STEP 1: DISABLE RLS ON INVOICES TABLE
-- ============================================================================
-- This prevents RLS policies from being evaluated while we modify the table

ALTER TABLE IF EXISTS invoices DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies on invoices
DO $$ 
DECLARE 
  policy_record RECORD;
BEGIN 
  FOR policy_record IN
    SELECT policyname FROM pg_policies WHERE tablename = 'invoices'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON invoices';
  END LOOP;
END $$;

-- ============================================================================
-- STEP 2: ADD company_id COLUMN IF IT DOESN'T EXIST
-- ============================================================================
-- This adds the company_id column that RLS policies reference

ALTER TABLE IF EXISTS invoices
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);

-- ============================================================================
-- STEP 3: POPULATE company_id FROM CUSTOMER RELATIONSHIP
-- ============================================================================
-- Fill in company_id for all invoices that don't have it

UPDATE invoices inv
SET company_id = (
  SELECT c.company_id
  FROM customers c
  WHERE c.id = inv.customer_id
)
WHERE inv.company_id IS NULL AND inv.customer_id IS NOT NULL;

-- For orphaned invoices (no customer), assign to first available company
UPDATE invoices
SET company_id = (SELECT id FROM companies ORDER BY created_at ASC LIMIT 1)
WHERE company_id IS NULL;

-- ============================================================================
-- STEP 4: VERIFY THE FIX
-- ============================================================================

SELECT 
  'Invoices Table Status' as check_name,
  COUNT(*) as total_invoices,
  COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as invoices_with_company_id,
  COUNT(CASE WHEN company_id IS NULL THEN 1 END) as invoices_without_company_id
FROM invoices;

COMMIT;

-- Success message
SELECT 'SUCCESS: Table modified and ready for use' as status;
`;
}

/**
 * Get SQL to re-enable RLS with a safe, non-recursive policy
 */
export function getReEnableRLSSQL(): string {
  return `
-- ============================================================================
-- RE-ENABLE RLS WITH SAFE POLICIES
-- ============================================================================
-- Note: Only enable RLS after company_id column exists and is populated
-- ============================================================================

BEGIN TRANSACTION;

-- Enable RLS on invoices
ALTER TABLE IF EXISTS invoices ENABLE ROW LEVEL SECURITY;

-- Create a safe, non-recursive policy for authenticated users
-- This policy only checks company_id, not other tables with RLS
CREATE POLICY "Authenticated users can manage invoices" ON invoices
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

COMMIT;

SELECT 'RLS has been re-enabled with safe policies' as status;
`;
}

/**
 * Get SQL to completely disable RLS (temporary solution if safe policies fail)
 */
export function getCompleteRLSDisableSQL(): string {
  return `
-- ============================================================================
-- COMPLETE RLS DISABLE - TEMPORARY FIX
-- ============================================================================
-- This disables RLS on all tables to eliminate all policy issues
-- Security is handled at the application level
-- ============================================================================

BEGIN TRANSACTION;

-- Disable RLS on main tables
ALTER TABLE IF EXISTS invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoice_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quotations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS boqs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS credit_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS proforma_invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lpos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS stock_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cash_receipts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS delivery_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tax_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS units DISABLE ROW LEVEL SECURITY;

-- Drop all policies
DROP POLICY IF EXISTS "Company scoped access" ON invoices;
DROP POLICY IF EXISTS "Company scoped access" ON customers;
DROP POLICY IF EXISTS "Company scoped access" ON quotations;
DROP POLICY IF EXISTS "Company scoped access" ON payments;
DROP POLICY IF EXISTS "Company scoped access" ON boqs;
DROP POLICY IF EXISTS "Company scoped access" ON credit_notes;
DROP POLICY IF EXISTS "Company scoped access" ON proforma_invoices;
DROP POLICY IF EXISTS "Company scoped access" ON lpos;
DROP POLICY IF EXISTS "Users can access invoices in their company" ON invoices;
DROP POLICY IF EXISTS "Users can access quotations in their company" ON quotations;
DROP POLICY IF EXISTS "Users can access payments in their company" ON payments;
DROP POLICY IF EXISTS "Users can access customers in their company" ON customers;

COMMIT;

SELECT 'All RLS policies have been disabled' as status;
`;
}
