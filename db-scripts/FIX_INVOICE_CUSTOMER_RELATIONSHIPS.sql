-- ============================================
-- FIX INVOICE-CUSTOMER RELATIONSHIP ISSUES
-- ============================================

-- Step 1: Check all foreign key constraints involving invoices and customers
SELECT 
    'INVOICE-CUSTOMER FOREIGN KEYS' as type,
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS references_table,
    ccu.column_name AS references_column
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND ((tc.table_name = 'invoices' AND ccu.table_name = 'customers')
       OR (tc.table_name = 'customers' AND ccu.table_name = 'invoices'))
ORDER BY tc.table_name, tc.constraint_name;

-- Step 2: Check what columns exist in invoices table
SELECT 
    'INVOICES TABLE COLUMNS' as type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'invoices' 
  AND (column_name LIKE '%customer%' OR column_name LIKE '%cust_%')
ORDER BY column_name;

-- Step 3: Drop ALL foreign key constraints between invoices and customers
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    -- Drop constraints between invoices and customers
    FOR constraint_record IN 
        SELECT tc.constraint_name, tc.table_name
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND ((tc.table_name = 'invoices' AND ccu.table_name = 'customers')
               OR (tc.table_name = 'customers' AND ccu.table_name = 'invoices'))
    LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', 
                      constraint_record.table_name, 
                      constraint_record.constraint_name);
        RAISE NOTICE 'Dropped constraint: %.%', constraint_record.table_name, constraint_record.constraint_name;
    END LOOP;
END $$;

-- Step 4: Add ONLY ONE clean foreign key constraint
DO $$
BEGIN
    -- Only add if customer_id column exists in invoices table
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'customer_id') THEN
        -- Add single clean foreign key constraint
        ALTER TABLE invoices 
        ADD CONSTRAINT fk_invoices_customer_id 
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
        
        RAISE NOTICE '✅ Added single foreign key constraint: invoices.customer_id -> customers.id';
    ELSE
        RAISE NOTICE 'ℹ️ No customer_id column found in invoices table';
    END IF;
END $$;

-- Step 5: Create index for performance
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);

-- Step 6: Verify the final state - should show ONLY ONE relationship
SELECT 
    'FINAL VERIFICATION - SHOULD BE ONLY ONE' as type,
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS references_table,
    ccu.column_name AS references_column
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND ((tc.table_name = 'invoices' AND ccu.table_name = 'customers')
       OR (tc.table_name = 'customers' AND ccu.table_name = 'invoices'))
ORDER BY tc.table_name, tc.constraint_name;

-- Step 7: Refresh schema cache
NOTIFY pgrst, 'reload schema';

SELECT '✅ INVOICE-CUSTOMER RELATIONSHIPS CLEANED UP!' as result,
       'Should now have exactly one foreign key relationship' as details;
