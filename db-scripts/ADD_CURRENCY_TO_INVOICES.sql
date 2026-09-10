-- Migration: Add currency column to invoices table
-- Purpose: Support currency preservation when converting BOQ to Invoice
-- Date: 2024

BEGIN;

-- Add currency column to invoices table if it doesn't exist
ALTER TABLE IF EXISTS invoices 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'KES';

-- Add currency column to quotations table if it doesn't exist (for consistency)
ALTER TABLE IF EXISTS quotations 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'KES';

-- Add currency column to proforma_invoices table if it doesn't exist
ALTER TABLE IF EXISTS proforma_invoices 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'KES';

-- Create index on currency for faster queries (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_invoices_currency ON invoices(currency);
CREATE INDEX IF NOT EXISTS idx_quotations_currency ON quotations(currency);

-- Add currency to boqs table if it doesn't exist (should already be there but ensure it)
ALTER TABLE IF EXISTS boqs 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'KES';

COMMIT;
