-- Add currency column to quotations table if it doesn't exist
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'KES',
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(15,6) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15,2) DEFAULT 0;

ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS section_name TEXT,
  ADD COLUMN IF NOT EXISTS section_labor_cost NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_of_measure TEXT;

COMMENT ON COLUMN public.quotations.currency IS 'Currency code: KES, USD, EUR, GBP, etc.';

NOTIFY pgrst, 'reload schema';
