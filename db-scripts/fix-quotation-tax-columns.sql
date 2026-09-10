-- URGENT FIX: Add missing tax columns to quotation_items and invoice_items
-- This fixes the "could not find the tax_amount column" error in quotation creation

-- First, verify current schema
SELECT 
    'Current schema check' as status,
    table_name, 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('quotation_items', 'invoice_items') 
    AND column_name LIKE '%tax%'
ORDER BY table_name, column_name;

-- Add missing tax columns to quotation_items
ALTER TABLE quotation_items 
ADD COLUMN IF NOT EXISTS tax_percentage DECIMAL(6,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_inclusive BOOLEAN DEFAULT false;

-- Add missing tax columns to invoice_items  
ALTER TABLE invoice_items
ADD COLUMN IF NOT EXISTS tax_percentage DECIMAL(6,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_inclusive BOOLEAN DEFAULT false;

-- Also add to proforma_items if table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='proforma_items') THEN
        ALTER TABLE proforma_items
        ADD COLUMN IF NOT EXISTS tax_percentage DECIMAL(6,3) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tax_inclusive BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Update any existing records with NULL values
UPDATE quotation_items 
SET tax_percentage = COALESCE(tax_percentage, 0),
    tax_amount = COALESCE(tax_amount, 0),
    tax_inclusive = COALESCE(tax_inclusive, false);

UPDATE invoice_items 
SET tax_percentage = COALESCE(tax_percentage, 0),
    tax_amount = COALESCE(tax_amount, 0),
    tax_inclusive = COALESCE(tax_inclusive, false);

-- Verify the fix worked
SELECT 
    'VERIFICATION: Tax columns added successfully' as status,
    table_name, 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('quotation_items', 'invoice_items') 
    AND column_name IN ('tax_amount', 'tax_percentage', 'tax_inclusive')
ORDER BY table_name, column_name;

-- Show table counts to confirm tables exist
SELECT 
    'quotation_items' as table_name, 
    COUNT(*) as record_count 
FROM quotation_items
UNION ALL
SELECT 
    'invoice_items' as table_name, 
    COUNT(*) as record_count 
FROM invoice_items;
