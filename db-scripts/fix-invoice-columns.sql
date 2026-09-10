-- Fix missing columns in invoices table
-- This adds paid_amount, balance_due and other missing columns

-- Check current invoice table structure
SELECT 
    'Current invoices table columns' as status,
    table_name, 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'invoices' 
ORDER BY ordinal_position;

-- Add missing columns to invoices table
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS balance_due DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS lpo_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS affects_inventory BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- Update existing records with default values
UPDATE invoices 
SET paid_amount = COALESCE(paid_amount, 0),
    balance_due = COALESCE(balance_due, total_amount),
    affects_inventory = COALESCE(affects_inventory, true);

-- Update balance_due to be total_amount - paid_amount for existing records
UPDATE invoices 
SET balance_due = COALESCE(total_amount, 0) - COALESCE(paid_amount, 0);

-- Verify the fix worked
SELECT 
    'Invoice columns added successfully' as status,
    table_name, 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'invoices' 
    AND column_name IN ('paid_amount', 'balance_due', 'lpo_number', 'affects_inventory', 'created_by')
ORDER BY column_name;

-- Show table counts to confirm table exists
SELECT 
    'invoices' as table_name, 
    COUNT(*) as record_count 
FROM invoices;
