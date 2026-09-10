-- Migration: Add showCalculatedValuesInTerms column to invoices and boqs tables
-- Purpose: Allow users to control whether calculated values are displayed in payment terms
-- Date: 2024

BEGIN;

-- Add showCalculatedValuesInTerms column to invoices table if it doesn't exist
ALTER TABLE IF EXISTS invoices 
ADD COLUMN IF NOT EXISTS showCalculatedValuesInTerms BOOLEAN DEFAULT true;

-- Add showCalculatedValuesInTerms column to boqs table if it doesn't exist
ALTER TABLE IF EXISTS boqs 
ADD COLUMN IF NOT EXISTS showCalculatedValuesInTerms BOOLEAN DEFAULT true;

-- Create index for faster queries (optional)
CREATE INDEX IF NOT EXISTS idx_invoices_show_calculated_values ON invoices(showCalculatedValuesInTerms);
CREATE INDEX IF NOT EXISTS idx_boqs_show_calculated_values ON boqs(showCalculatedValuesInTerms);

COMMIT;
