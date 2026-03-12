-- Migration: Standardize show_calculated_values_in_terms column naming
-- Purpose: Align with snake_case convention and fix camelCase mismatch in boqs table
-- Issue: EditBOQModal reads show_calculated_values_in_terms but migration created showCalculatedValuesInTerms

BEGIN;

-- Add the correct snake_case column if it doesn't exist
ALTER TABLE IF EXISTS boqs 
ADD COLUMN IF NOT EXISTS show_calculated_values_in_terms BOOLEAN DEFAULT false;

-- If showCalculatedValuesInTerms exists and has data, copy it to the new column
-- Only copy if the new column is still all false/null
UPDATE boqs 
SET show_calculated_values_in_terms = "showCalculatedValuesInTerms"
WHERE "showCalculatedValuesInTerms" IS NOT NULL 
  AND show_calculated_values_in_terms IS NULL;

-- Drop the old camelCase column if it exists (keep this commented for safety)
-- ALTER TABLE IF EXISTS boqs DROP COLUMN IF EXISTS "showCalculatedValuesInTerms";

-- Create index for the new column
CREATE INDEX IF NOT EXISTS idx_boqs_show_calculated_values_in_terms ON boqs(show_calculated_values_in_terms);

-- Verify consistency with invoices table
-- Note: Invoices table also has the camelCase column but it's not used in the same way
ALTER TABLE IF EXISTS invoices 
ADD COLUMN IF NOT EXISTS show_calculated_values_in_terms BOOLEAN DEFAULT true;

-- Sync data from camelCase to snake_case in invoices if needed
UPDATE invoices 
SET show_calculated_values_in_terms = COALESCE("showCalculatedValuesInTerms", true)
WHERE show_calculated_values_in_terms IS NULL;

COMMIT;

-- Run this query to verify the columns exist and data is correct:
-- SELECT id, show_calculated_values_in_terms, "showCalculatedValuesInTerms" FROM boqs LIMIT 1;
