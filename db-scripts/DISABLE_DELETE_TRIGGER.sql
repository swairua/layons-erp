-- ============================================================================
-- DISABLE DELETE TRIGGERS - Remove the log_delete_trigger blocking deletes
-- ============================================================================
-- The log_delete_trigger function is checking for company_id and blocking deletes

BEGIN TRANSACTION;

-- Drop triggers that call log_delete_trigger on invoices table
DROP TRIGGER IF EXISTS log_invoice_delete ON invoices CASCADE;
DROP TRIGGER IF EXISTS invoice_delete_trigger ON invoices CASCADE;
DROP TRIGGER IF EXISTS log_delete_trigger ON invoices CASCADE;

-- Drop the function itself
DROP FUNCTION IF EXISTS log_delete_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.log_delete_trigger() CASCADE;

COMMIT;

-- Verify triggers are gone
SELECT 
  trigger_schema,
  trigger_name,
  event_object_table,
  event_manipulation
FROM information_schema.triggers
WHERE event_object_table = 'invoices'
AND event_manipulation = 'DELETE';
