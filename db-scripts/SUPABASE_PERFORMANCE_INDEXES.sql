-- ===================================================================
-- CRITICAL PERFORMANCE INDEXES FOR BOQ & LCL SYSTEMS
-- ===================================================================
-- 
-- INSTRUCTIONS:
-- 1. Open your Supabase Dashboard
-- 2. Navigate to SQL Editor
-- 3. Create a new query
-- 4. Copy and paste THIS ENTIRE FILE
-- 5. Click "Run"
-- 6. Refresh the app
--
-- These indexes solve the performance issues where:
-- - BOQ modal creation takes >1 minute
-- - LCL template loading is slow
-- - Generating next BOQ number scans entire table
--
-- ===================================================================

-- BOQs table indexes - enables efficient company-based BOQ lookup and sorting
-- Improves: generateNextBOQNumber() query, BOQ listing, BOQ creation
CREATE INDEX IF NOT EXISTS idx_boqs_company_id_created_at 
  ON boqs(company_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_boqs_company_id_number 
  ON boqs(company_id, number)
  WHERE deleted_at IS NULL;

-- LCL BOQs table indexes - same as BOQs for consistency and performance
-- Improves: LCL BOQ number generation, LCL BOQ listing, LCL template performance
CREATE INDEX IF NOT EXISTS idx_lcl_boqs_company_id_created_at 
  ON lcl_boqs(company_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_lcl_boqs_company_id_number 
  ON lcl_boqs(company_id, number)
  WHERE deleted_at IS NULL;

-- LCL Template Items hierarchy index - enables efficient structure navigation
-- Improves: LCL template hierarchy queries, item lookup
CREATE INDEX IF NOT EXISTS idx_lcl_template_items_structure_section_item
  ON lcl_template_items(structure_id, section_id, item_number)
  WHERE deleted_at IS NULL;

-- Customers and Units indexes for complementary performance
-- Improves: Customer/unit dropdown loading in BOQ modals
CREATE INDEX IF NOT EXISTS idx_customers_company_id_created_at
  ON customers(company_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_units_company_id_created_at
  ON units(company_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- ===================================================================
-- Expected Performance Improvements:
-- ===================================================================
-- Before: BOQ modal open/number generation = 40-60+ seconds (full table scan)
-- After:  BOQ modal open/number generation = 5-15 seconds (indexed lookup)
--
-- Before: LCL template load = 30-60+ seconds
-- After:  LCL template load = 10-20 seconds
--
-- These improvements compound with more BOQs (100-1000+ BOQs)
-- ===================================================================
