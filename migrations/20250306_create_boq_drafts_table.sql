-- ============================================================================
-- Migration: Create boq_drafts table for work-in-progress BOQs
-- ============================================================================
-- This table stores unsaved/in-progress BOQs that are being edited by users.
-- It maintains a separate draft state from finalized BOQs in the boqs table.
-- 
-- Key features:
-- - One draft per user per company (enforced by UNIQUE constraint)
-- - Auto-updated timestamp for last modification
-- - Mirrors the structure of the boqs table for easy migration to final state

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS boq_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  number VARCHAR(100),
  boq_date DATE,
  due_date DATE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  client_address TEXT,
  client_city TEXT,
  client_country TEXT,
  contractor TEXT,
  project_title TEXT,
  currency VARCHAR(3) DEFAULT 'KES',
  subtotal NUMERIC(15,2) DEFAULT 0,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  total_amount NUMERIC(15,2) DEFAULT 0,
  data JSONB,
  terms_and_conditions TEXT,
  show_calculated_values_in_terms BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_autosaved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_boq_drafts_user_company ON boq_drafts(user_id, company_id);
CREATE INDEX IF NOT EXISTS idx_boq_drafts_updated ON boq_drafts(updated_at);
CREATE INDEX IF NOT EXISTS idx_boq_drafts_company ON boq_drafts(company_id);

-- Enable RLS for boq_drafts table
ALTER TABLE boq_drafts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see and edit their own drafts
CREATE POLICY IF NOT EXISTS "Users can view their own drafts"
  ON boq_drafts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can create drafts for their company"
  ON boq_drafts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own drafts"
  ON boq_drafts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own drafts"
  ON boq_drafts
  FOR DELETE
  USING (auth.uid() = user_id);

COMMIT;

-- Verification
SELECT 
  'BOQ Drafts Table Created' as status,
  COUNT(*) as draft_count
FROM boq_drafts;
