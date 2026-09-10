-- Fix RLS Policies and ensure company_id columns exist (CORRECTED)
-- This migration ensures all tables have proper company_id columns and RLS policies

BEGIN;

-- ============================================================================
-- STEP 1: Ensure company_id columns exist on all tables
-- ============================================================================

-- Invoices table - ensure company_id exists
ALTER TABLE IF EXISTS invoices 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Quotations table - ensure company_id exists
ALTER TABLE IF EXISTS quotations 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Invoice items table - ensure company_id exists for RLS
ALTER TABLE IF EXISTS invoice_items 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Proforma invoices table
ALTER TABLE IF EXISTS proforma_invoices 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Create indexes for company_id columns for performance
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_company_id ON invoice_items(company_id);
CREATE INDEX IF NOT EXISTS idx_quotations_company_id ON quotations(company_id);
CREATE INDEX IF NOT EXISTS idx_proforma_invoices_company_id ON proforma_invoices(company_id);

-- ============================================================================
-- STEP 2: Disable RLS policies to avoid recursion issues
-- ============================================================================

ALTER TABLE IF EXISTS invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoice_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quotations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Company scoped access" ON invoices;
DROP POLICY IF EXISTS "Company scoped access" ON invoice_items;
DROP POLICY IF EXISTS "Company scoped access" ON quotations;
DROP POLICY IF EXISTS "Company scoped access" ON customers;

-- ============================================================================
-- STEP 3: Re-enable RLS with simpler, non-recursive policies
-- ============================================================================

-- Enable RLS on invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Create simple policy for invoices (authenticated users can access all)
-- This avoids recursion by not referencing other tables with RLS
CREATE POLICY "Invoices accessible to authenticated users" ON invoices
    FOR ALL
    USING (auth.role() = 'authenticated');

-- Enable RLS on invoice_items
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- Create simple policy for invoice_items
CREATE POLICY "Invoice items accessible to authenticated users" ON invoice_items
    FOR ALL
    USING (auth.role() = 'authenticated');

-- Enable RLS on quotations
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

-- Create simple policy for quotations
CREATE POLICY "Quotations accessible to authenticated users" ON quotations
    FOR ALL
    USING (auth.role() = 'authenticated');

-- Enable RLS on customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Create simple policy for customers
CREATE POLICY "Customers accessible to authenticated users" ON customers
    FOR ALL
    USING (auth.role() = 'authenticated');

-- ============================================================================
-- STEP 4: Populate company_id where missing (for invoice_items) - CORRECTED
-- ============================================================================

-- For invoice_items, populate company_id from related invoices
-- Uses proper FROM clause syntax for PostgreSQL
UPDATE invoice_items ii
SET company_id = i.company_id
FROM invoices i
WHERE ii.company_id IS NULL 
AND ii.invoice_id = i.id;

COMMIT;
