-- Add contractor signature and phone columns to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contractor_signature TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contractor_phone TEXT;

-- Add comments for clarity
COMMENT ON COLUMN companies.contractor_signature IS 'Authorized person signature name (e.g., KELVIN MURIITHI) for PDF documents';
COMMENT ON COLUMN companies.contractor_phone IS 'Contractor phone number for PDF documents (e.g., +254720717463)';
