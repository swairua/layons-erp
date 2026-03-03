-- Migration: Fix quantity column types from INTEGER to DECIMAL(10,3)
-- This allows line items to support fractional quantities (e.g., 9.5 units)

-- Invoice items table
ALTER TABLE IF EXISTS invoice_items
ALTER COLUMN quantity SET DATA TYPE DECIMAL(10,3) USING quantity::DECIMAL(10,3);

-- Quotation items table  
ALTER TABLE IF EXISTS quotation_items
ALTER COLUMN quantity SET DATA TYPE DECIMAL(10,3) USING quantity::DECIMAL(10,3);

-- Proforma items table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='proforma_items') THEN
    ALTER TABLE proforma_items
    ALTER COLUMN quantity SET DATA TYPE DECIMAL(10,3) USING quantity::DECIMAL(10,3);
  END IF;
END $$;

-- Delivery note items table
ALTER TABLE IF EXISTS delivery_note_items
ALTER COLUMN quantity_ordered SET DATA TYPE DECIMAL(10,3) USING quantity_ordered::DECIMAL(10,3);

ALTER TABLE IF EXISTS delivery_note_items
ALTER COLUMN quantity_delivered SET DATA TYPE DECIMAL(10,3) USING quantity_delivered::DECIMAL(10,3);

-- Credit note items table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='credit_note_items') THEN
    ALTER TABLE credit_note_items
    ALTER COLUMN quantity SET DATA TYPE DECIMAL(10,3) USING quantity::DECIMAL(10,3);
  END IF;
END $$;

-- Cash receipt items table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='cash_receipt_items') THEN
    ALTER TABLE cash_receipt_items
    ALTER COLUMN quantity SET DATA TYPE DECIMAL(10,3) USING quantity::DECIMAL(10,3);
  END IF;
END $$;

-- LPO items table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='lpo_items') THEN
    ALTER TABLE lpo_items
    ALTER COLUMN quantity SET DATA TYPE DECIMAL(10,3) USING quantity::DECIMAL(10,3);
  END IF;
END $$;
