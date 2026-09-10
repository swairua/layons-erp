-- ============================================
-- CHECK AND FIX PRODUCT-CATEGORY RELATIONSHIPS
-- ============================================

-- Step 1: Check all foreign key constraints that involve products and categories
SELECT 
    'ALL PRODUCT-CATEGORY FOREIGN KEYS' as type,
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
  AND ((tc.table_name = 'products' AND ccu.table_name = 'product_categories')
       OR (tc.table_name = 'product_categories' AND ccu.table_name = 'products'))
ORDER BY tc.table_name, tc.constraint_name;

-- Step 2: Check what columns exist in products table
SELECT 
    'PRODUCTS TABLE COLUMNS' as type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'products' 
ORDER BY column_name;

-- Step 3: Check what columns exist in product_categories table
SELECT 
    'PRODUCT_CATEGORIES TABLE COLUMNS' as type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'product_categories' 
ORDER BY column_name;

-- Step 4: Drop ALL foreign key constraints between products and product_categories
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    -- Drop constraints from products to product_categories
    FOR constraint_record IN 
        SELECT tc.constraint_name, tc.table_name
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND ((tc.table_name = 'products' AND ccu.table_name = 'product_categories')
               OR (tc.table_name = 'product_categories' AND ccu.table_name = 'products'))
    LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', 
                      constraint_record.table_name, 
                      constraint_record.constraint_name);
        RAISE NOTICE 'Dropped constraint: %.%', constraint_record.table_name, constraint_record.constraint_name;
    END LOOP;
END $$;

-- Step 5: Add ONLY ONE clean foreign key constraint
DO $$
BEGIN
    -- Only add if category_id column exists in products table
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'category_id') THEN
        -- Add single clean foreign key constraint
        ALTER TABLE products 
        ADD CONSTRAINT fk_products_category_id 
        FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL;
        
        RAISE NOTICE '✅ Added single foreign key constraint: products.category_id -> product_categories.id';
    ELSE
        RAISE NOTICE 'ℹ️ No category_id column found in products table';
    END IF;
END $$;

-- Step 6: Create index for performance
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

-- Step 7: Verify the final state - should show ONLY ONE relationship
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
  AND ((tc.table_name = 'products' AND ccu.table_name = 'product_categories')
       OR (tc.table_name = 'product_categories' AND ccu.table_name = 'products'))
ORDER BY tc.table_name, tc.constraint_name;

-- Step 8: Refresh schema cache
NOTIFY pgrst, 'reload schema';

SELECT '✅ RELATIONSHIPS CLEANED UP!' as result,
       'Should now have exactly one foreign key relationship' as details;
