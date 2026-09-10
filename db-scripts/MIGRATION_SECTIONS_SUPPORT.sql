-- Migration: Add section support to quotation_items and invoice_items tables
-- This migration adds section_name and section_labor_cost columns to support
-- structured quotations and invoices with sections containing items and labor costs

-- Add section columns to quotation_items if they don't exist
ALTER TABLE quotation_items
ADD COLUMN IF NOT EXISTS section_name TEXT DEFAULT 'General Items',
ADD COLUMN IF NOT EXISTS section_labor_cost DECIMAL(15,2) DEFAULT 0;

-- Add section columns to invoice_items if they don't exist
ALTER TABLE invoice_items
ADD COLUMN IF NOT EXISTS section_name TEXT DEFAULT 'General Items',
ADD COLUMN IF NOT EXISTS section_labor_cost DECIMAL(15,2) DEFAULT 0;

-- Create index on section_name for better performance when grouping
CREATE INDEX IF NOT EXISTS idx_quotation_items_section_name 
ON quotation_items(quotation_id, section_name);

CREATE INDEX IF NOT EXISTS idx_invoice_items_section_name 
ON invoice_items(invoice_id, section_name);

-- Add comment for documentation
COMMENT ON COLUMN quotation_items.section_name IS 'Name of the section this item belongs to (e.g., "Ground Floor", "Materials")';
COMMENT ON COLUMN quotation_items.section_labor_cost IS 'Labor cost for the section (shared across all items in that section)';
COMMENT ON COLUMN invoice_items.section_name IS 'Name of the section this item belongs to (e.g., "Ground Floor", "Materials")';
COMMENT ON COLUMN invoice_items.section_labor_cost IS 'Labor cost for the section (shared across all items in that section)';
