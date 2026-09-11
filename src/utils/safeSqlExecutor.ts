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
BEGIN TRANSACTION;

-- Re-enable RLS on all tables
DO $$
DECLARE
  tbl TEXT;
  table_list TEXT[] := ARRAY[
    'invoices', 'invoice_items', 'customers', 'quotations', 'quotation_items',
    'payments', 'payment_allocations', 'boqs', 'credit_notes', 'credit_note_items',
    'credit_note_allocations', 'proforma_invoices', 'proforma_items',
    'lpos', 'lpo_items', 'stock_movements', 'cash_receipts',
    'delivery_notes', 'delivery_note_items', 'products', 'tax_settings',
    'units', 'remittance_advice', 'remittance_advice_items',
    'user_permissions', 'profiles', 'product_categories', 'companies', 'users', 'suppliers'
  ];
BEGIN
  FOREACH tbl IN ARRAY table_list
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = tbl AND schemaname = 'public') THEN
      EXECUTE format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;
END $$;

-- Create safe, non-recursive policies on all tables
DO $$
DECLARE
  tbl TEXT;
  policy_name TEXT;
  table_list TEXT[] := ARRAY[
    'invoices', 'invoice_items', 'customers', 'quotations', 'quotation_items',
    'payments', 'payment_allocations', 'boqs', 'credit_notes', 'credit_note_items',
    'credit_note_allocations', 'proforma_invoices', 'proforma_items',
    'lpos', 'lpo_items', 'stock_movements', 'cash_receipts',
    'delivery_notes', 'delivery_note_items', 'products', 'tax_settings',
    'units', 'remittance_advice', 'remittance_advice_items',
    'user_permissions', 'profiles', 'product_categories', 'companies', 'users', 'suppliers'
  ];
BEGIN
  FOREACH tbl IN ARRAY table_list
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = tbl AND schemaname = 'public') THEN
      policy_name := tbl || '_authenticated_access';
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        policy_name, tbl
      );
    END IF;
  END LOOP;
END $$;

COMMIT;

SELECT 'RLS re-enabled with safe policies on all tables' as status;
`;
}

/**
 * Get SQL to completely disable RLS (temporary solution if safe policies fail)
 */
export function getCompleteRLSDisableSQL(): string {
  return `
-- ============================================================================
-- COMPLETE RLS RESET - Disable all policies, then re-enable with safe ones
-- ============================================================================

BEGIN TRANSACTION;

-- Disable RLS on all tables
DO $$
DECLARE
  tbl TEXT;
  table_list TEXT[] := ARRAY[
    'invoices', 'invoice_items', 'customers', 'quotations', 'quotation_items',
    'payments', 'payment_allocations', 'boqs', 'credit_notes', 'credit_note_items',
    'credit_note_allocations', 'proforma_invoices', 'proforma_items',
    'lpos', 'lpo_items', 'stock_movements', 'cash_receipts',
    'delivery_notes', 'delivery_note_items', 'products', 'tax_settings',
    'units', 'remittance_advice', 'remittance_advice_items',
    'user_permissions', 'profiles', 'product_categories', 'companies', 'users', 'suppliers'
  ];
BEGIN
  FOREACH tbl IN ARRAY table_list
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = tbl AND schemaname = 'public') THEN
      EXECUTE format('ALTER TABLE IF EXISTS %I DISABLE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;
END $$;

-- Drop ALL policies
DO $$
DECLARE
  policy_record RECORD;
  tbl TEXT;
  table_list TEXT[] := ARRAY[
    'invoices', 'invoice_items', 'customers', 'quotations', 'quotation_items',
    'payments', 'payment_allocations', 'boqs', 'credit_notes', 'credit_note_items',
    'credit_note_allocations', 'proforma_invoices', 'proforma_items',
    'lpos', 'lpo_items', 'stock_movements', 'cash_receipts',
    'delivery_notes', 'delivery_note_items', 'products', 'tax_settings',
    'units', 'remittance_advice', 'remittance_advice_items',
    'user_permissions', 'profiles', 'product_categories', 'companies', 'users', 'suppliers'
  ];
BEGIN
  FOREACH tbl IN ARRAY table_list
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = tbl AND schemaname = 'public') THEN
      FOR policy_record IN
        EXECUTE format('SELECT policyname FROM pg_policies WHERE tablename = %L AND schemaname = ''public''', tbl)
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_record.policyname, tbl);
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- Re-enable RLS with safe policies
DO $$
DECLARE
  tbl TEXT;
  policy_name TEXT;
  table_list TEXT[] := ARRAY[
    'invoices', 'invoice_items', 'customers', 'quotations', 'quotation_items',
    'payments', 'payment_allocations', 'boqs', 'credit_notes', 'credit_note_items',
    'credit_note_allocations', 'proforma_invoices', 'proforma_items',
    'lpos', 'lpo_items', 'stock_movements', 'cash_receipts',
    'delivery_notes', 'delivery_note_items', 'products', 'tax_settings',
    'units', 'remittance_advice', 'remittance_advice_items',
    'user_permissions', 'profiles', 'product_categories', 'companies', 'users', 'suppliers'
  ];
BEGIN
  FOREACH tbl IN ARRAY table_list
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = tbl AND schemaname = 'public') THEN
      EXECUTE format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY', tbl);
      policy_name := tbl || '_authenticated_access';
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        policy_name, tbl
      );
    END IF;
  END LOOP;
END $$;

COMMIT;

SELECT 'All RLS policies reset with safe, non-recursive policies' as status;
`;
}
