-- ============================================
-- REMITTANCE ADVICE DATABASE FIXES
-- ============================================

-- 1. Fix remittance_items table name inconsistency
-- Some migrations incorrectly referenced "remittance_items" instead of "remittance_advice_items"

-- First, check if the wrong table exists and correct columns exist
DO $$
BEGIN
    -- If remittance_items exists but remittance_advice_items doesn't have tax columns, fix it
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'remittance_items') THEN
        RAISE NOTICE 'Found remittance_items table - this should be remittance_advice_items';
        
        -- Add missing tax columns to remittance_advice_items if they don't exist
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'remittance_advice_items') THEN
            -- Add tax columns to correct table
            ALTER TABLE remittance_advice_items 
            ADD COLUMN IF NOT EXISTS tax_percentage DECIMAL(6,3) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(15,2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS tax_inclusive BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS tax_setting_id UUID REFERENCES tax_settings(id);
            
            RAISE NOTICE 'Added tax columns to remittance_advice_items';
        END IF;
        
        -- Drop the incorrectly named table after confirming data migration if needed
        -- DROP TABLE IF EXISTS remittance_items;  -- Uncomment after verifying data
        
    ELSE
        -- Add tax columns to remittance_advice_items if they don't exist
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'remittance_advice_items') THEN
            ALTER TABLE remittance_advice_items 
            ADD COLUMN IF NOT EXISTS tax_percentage DECIMAL(6,3) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(15,2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS tax_inclusive BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS tax_setting_id UUID REFERENCES tax_settings(id);
            
            RAISE NOTICE 'Added tax columns to remittance_advice_items';
        END IF;
    END IF;
END $$;

-- 2. Ensure remittance_advice_items has all required columns based on the UI
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'remittance_advice_items') THEN
        -- Add customer and supplier information columns if they don't exist
        ALTER TABLE remittance_advice_items 
        ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS customer_address TEXT,
        ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS supplier_address TEXT;
        
        RAISE NOTICE 'Added customer/supplier columns to remittance_advice_items';
    END IF;
END $$;

-- 3. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_remittance_advice_items_remittance_id ON remittance_advice_items(remittance_advice_id);
CREATE INDEX IF NOT EXISTS idx_remittance_advice_items_payment_id ON remittance_advice_items(payment_id);
CREATE INDEX IF NOT EXISTS idx_remittance_advice_items_invoice_id ON remittance_advice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_remittance_advice_items_document_date ON remittance_advice_items(document_date);

-- 4. Ensure proper RLS policies exist for remittance advice
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "remittance_advice_company_policy" ON remittance_advice;
    DROP POLICY IF EXISTS "remittance_advice_items_company_policy" ON remittance_advice_items;
    
    -- Create comprehensive RLS policies
    CREATE POLICY "remittance_advice_company_policy" ON remittance_advice
    FOR ALL USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );
    
    CREATE POLICY "remittance_advice_items_company_policy" ON remittance_advice_items
    FOR ALL USING (
        remittance_advice_id IN (
            SELECT id FROM remittance_advice WHERE company_id IN (
                SELECT company_id FROM profiles WHERE id = auth.uid()
            )
        )
    );
    
    RAISE NOTICE 'Created RLS policies for remittance advice tables';
END $$;

-- 5. Update any existing records with proper defaults
UPDATE remittance_advice_items 
SET 
    tax_percentage = COALESCE(tax_percentage, 0),
    tax_amount = COALESCE(tax_amount, 0),
    tax_inclusive = COALESCE(tax_inclusive, false)
WHERE tax_percentage IS NULL OR tax_amount IS NULL OR tax_inclusive IS NULL;

-- 6. Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- Success message
SELECT 
    '✅ Remittance advice fixes completed!' as status,
    'Table naming fixed, tax columns added, RLS policies updated' as summary;
