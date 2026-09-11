ALTER TABLE IF EXISTS public.quotations
  ADD COLUMN IF NOT EXISTS display_as_percentage BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE IF EXISTS public.invoices
  ADD COLUMN IF NOT EXISTS display_as_percentage BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE IF EXISTS public.proforma_invoices
  ADD COLUMN IF NOT EXISTS display_as_percentage BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.quotations SET display_as_percentage = FALSE WHERE display_as_percentage IS NULL;
UPDATE public.invoices SET display_as_percentage = FALSE WHERE display_as_percentage IS NULL;
UPDATE public.proforma_invoices SET display_as_percentage = FALSE WHERE display_as_percentage IS NULL;

ALTER TABLE IF EXISTS public.quotations ALTER COLUMN display_as_percentage SET NOT NULL;
ALTER TABLE IF EXISTS public.invoices ALTER COLUMN display_as_percentage SET NOT NULL;
ALTER TABLE IF EXISTS public.proforma_invoices ALTER COLUMN display_as_percentage SET NOT NULL;

NOTIFY pgrst, 'reload schema';
