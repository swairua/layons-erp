-- Add default_terms_and_conditions column to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS default_terms_and_conditions TEXT;

-- Add comment for clarity
COMMENT ON COLUMN companies.default_terms_and_conditions IS 'Default terms and conditions for invoices created by this company';
