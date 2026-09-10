-- Migration: Add tax support to line item tables
-- Run this in your Supabase SQL editor to add the missing tax_amount columns

-- Check if columns already exist before adding them
DO $$ 
BEGIN
    -- Add tax_percentage to quotation_items if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='quotation_items' AND column_name='tax_percentage') THEN
        ALTER TABLE quotation_items ADD COLUMN tax_percentage DECIMAL(6,3) DEFAULT 0;
    END IF;
    
    -- Add tax_amount to quotation_items if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='quotation_items' AND column_name='tax_amount') THEN
        ALTER TABLE quotation_items ADD COLUMN tax_amount DECIMAL(15,2) DEFAULT 0;
    END IF;
    
    -- Add tax_inclusive to quotation_items if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='quotation_items' AND column_name='tax_inclusive') THEN
        ALTER TABLE quotation_items ADD COLUMN tax_inclusive BOOLEAN DEFAULT false;
    END IF;
    
    -- Add tax_percentage to invoice_items if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='invoice_items' AND column_name='tax_percentage') THEN
        ALTER TABLE invoice_items ADD COLUMN tax_percentage DECIMAL(6,3) DEFAULT 0;
    END IF;
    
    -- Add tax_amount to invoice_items if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='invoice_items' AND column_name='tax_amount') THEN
        ALTER TABLE invoice_items ADD COLUMN tax_amount DECIMAL(15,2) DEFAULT 0;
    END IF;
    
    -- Add tax_inclusive to invoice_items if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='invoice_items' AND column_name='tax_inclusive') THEN
        ALTER TABLE invoice_items ADD COLUMN tax_inclusive BOOLEAN DEFAULT false;
    END IF;
    
    -- Add tax_percentage to proforma_items if it doesn't exist (if table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='proforma_items') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='proforma_items' AND column_name='tax_percentage') THEN
            ALTER TABLE proforma_items ADD COLUMN tax_percentage DECIMAL(6,3) DEFAULT 0;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='proforma_items' AND column_name='tax_amount') THEN
            ALTER TABLE proforma_items ADD COLUMN tax_amount DECIMAL(15,2) DEFAULT 0;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='proforma_items' AND column_name='tax_inclusive') THEN
            ALTER TABLE proforma_items ADD COLUMN tax_inclusive BOOLEAN DEFAULT false;
        END IF;
    END IF;
    
    -- Add tax_percentage to remittance_items if it doesn't exist (if table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='remittance_items') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='remittance_items' AND column_name='tax_percentage') THEN
            ALTER TABLE remittance_items ADD COLUMN tax_percentage DECIMAL(6,3) DEFAULT 0;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='remittance_items' AND column_name='tax_amount') THEN
            ALTER TABLE remittance_items ADD COLUMN tax_amount DECIMAL(15,2) DEFAULT 0;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='remittance_items' AND column_name='tax_inclusive') THEN
            ALTER TABLE remittance_items ADD COLUMN tax_inclusive BOOLEAN DEFAULT false;
        END IF;
    END IF;
END $$;

-- Update existing records to ensure data consistency (only if columns exist and are null)
UPDATE quotation_items 
SET tax_percentage = 0, tax_amount = 0, tax_inclusive = false 
WHERE tax_percentage IS NULL OR tax_amount IS NULL OR tax_inclusive IS NULL;

UPDATE invoice_items 
SET tax_percentage = 0, tax_amount = 0, tax_inclusive = false 
WHERE tax_percentage IS NULL OR tax_amount IS NULL OR tax_inclusive IS NULL;

-- Update proforma_items if table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='proforma_items') THEN
        UPDATE proforma_items 
        SET tax_percentage = 0, tax_amount = 0, tax_inclusive = false 
        WHERE tax_percentage IS NULL OR tax_amount IS NULL OR tax_inclusive IS NULL;
    END IF;
END $$;

-- Update remittance_items if table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='remittance_items') THEN
        UPDATE remittance_items 
        SET tax_percentage = 0, tax_amount = 0, tax_inclusive = false 
        WHERE tax_percentage IS NULL OR tax_amount IS NULL OR tax_inclusive IS NULL;
    END IF;
END $$;

-- Show confirmation that migration completed
SELECT 'Tax columns migration completed successfully!' as status;
