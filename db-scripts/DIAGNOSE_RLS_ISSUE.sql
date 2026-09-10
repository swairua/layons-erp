-- ============================================================================
-- DIAGNOSTIC QUERIES - RUN THESE FIRST TO CHECK YOUR DATABASE STATE
-- ============================================================================

-- 1. CHECK IF company_id COLUMN EXISTS IN INVOICES TABLE
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'invoices'
ORDER BY ordinal_position;

-- 2. CHECK ALL RLS POLICIES ON INVOICES TABLE
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'invoices'
ORDER BY policyname;

-- 3. CHECK ALL RLS POLICIES ON INVOICE_ITEMS TABLE
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'invoice_items'
ORDER BY policyname;

-- 4. CHECK RLS STATUS ON THESE TABLES
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('invoices', 'invoice_items', 'payment_allocations', 'profiles')
ORDER BY tablename;

-- 5. CHECK FOR TRIGGERS ON INVOICES TABLE
SELECT 
  trigger_schema,
  trigger_name,
  event_manipulation,
  event_object_schema,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'invoices';

-- 6. COUNT HOW MANY INVOICES EXIST
SELECT COUNT(*) as total_invoices FROM invoices;

-- 7. CHECK IF ANY INVOICES HAVE NULL company_id
SELECT COUNT(*) as null_company_id_count FROM invoices WHERE company_id IS NULL;
