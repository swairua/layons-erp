-- Add display_as_percentage field to quotations table
ALTER TABLE IF EXISTS quotations 
ADD COLUMN IF NOT EXISTS display_as_percentage BOOLEAN DEFAULT FALSE;

-- Add display_as_percentage field to invoices table
ALTER TABLE IF EXISTS invoices 
ADD COLUMN IF NOT EXISTS display_as_percentage BOOLEAN DEFAULT FALSE;

-- Add display_as_percentage field to proforma_invoices table
ALTER TABLE IF EXISTS proforma_invoices 
ADD COLUMN IF NOT EXISTS display_as_percentage BOOLEAN DEFAULT FALSE;
