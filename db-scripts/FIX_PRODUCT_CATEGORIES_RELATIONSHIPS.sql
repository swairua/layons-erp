-- ============================================
-- FIX PRODUCT CATEGORIES RELATIONSHIP ISSUE
-- ============================================
-- This script fixes the "more than one relationship was found" error
-- by cleaning up duplicate foreign key constraints

-- Step 1: Check current foreign key relationships
SELECT 
    'CURRENT FOREIGN KEY RELATIONSHIPS' as check_type,
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
  AND (tc.table_name = 'products' AND ccu.table_name = 'product_categories')
ORDER BY tc.table_name, tc.constraint_name;

-- Step 2: Drop all existing foreign key constraints between products and product_categories
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    -- Get all foreign key constraints from products to product_categories
    FOR constraint_record IN 
        SELECT tc.constraint_name
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name = 'products' 
          AND ccu.table_name = 'product_categories'
    LOOP
        EXECUTE format('ALTER TABLE products DROP CONSTRAINT IF EXISTS %I', constraint_record.constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_record.constraint_name;
    END LOOP;
END $$;

-- Step 3: Check what columns exist in products table that could reference categories
SELECT 
    'PRODUCTS TABLE COLUMNS ANALYSIS' as check_type,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'products' 
  AND (column_name LIKE '%category%' OR column_name LIKE '%cat_%')
ORDER BY column_name;

-- Step 4: Add single, clean foreign key constraint
-- Only add if category_id column exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'category_id') THEN
        -- Add single clean foreign key constraint
        ALTER TABLE products 
        ADD CONSTRAINT fk_products_category_id 
        FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL;
        
        RAISE NOTICE '✅ Added clean foreign key constraint: products.category_id -> product_categories.id';
    ELSE
        RAISE NOTICE 'ℹ️ No category_id column found in products table';
    END IF;
END $$;

-- Step 5: Verify the fix
SELECT 
    'VERIFICATION - FINAL FOREIGN KEY RELATIONSHIPS' as check_type,
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
  AND (tc.table_name = 'products' AND ccu.table_name = 'product_categories')
ORDER BY tc.table_name, tc.constraint_name;

-- Step 6: Create index for performance
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

-- Step 7: Refresh schema cache
NOTIFY pgrst, 'reload schema';

SELECT '✅ PRODUCT CATEGORIES RELATIONSHIP FIXED!' as result,
       'Should now have only one clean foreign key relationship' as details;
