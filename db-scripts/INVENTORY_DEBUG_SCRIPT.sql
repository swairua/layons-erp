-- ============================================
-- INVENTORY/PRODUCTS DEBUG SCRIPT
-- ============================================
-- This script helps debug why inventory items aren't loading

-- Step 1: Check if products table exists and has data
SELECT 'PRODUCTS TABLE ANALYSIS' as check_type;

-- Check if products table exists
SELECT 
    'Products table exists' as check,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') 
         THEN 'YES' 
         ELSE 'NO' 
    END as result;

-- Count total products
SELECT 
    'Total products count' as check,
    COUNT(*) as result
FROM products;

-- Count products by company
SELECT 
    'Products by company' as check,
    company_id,
    COUNT(*) as product_count
FROM products
GROUP BY company_id
ORDER BY product_count DESC;

-- Check product structure
SELECT 
    'Product columns' as check,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'products'
ORDER BY ordinal_position;

-- Step 2: Check sample products data
SELECT 'SAMPLE PRODUCTS DATA' as check_type;

SELECT 
    id,
    company_id,
    name,
    product_code,
    stock_quantity,
    selling_price,
    unit_price,
    is_active,
    category_id
FROM products 
ORDER BY created_at DESC 
LIMIT 10;

-- Step 3: Check companies table
SELECT 'COMPANIES TABLE ANALYSIS' as check_type;

SELECT 
    'Total companies' as check,
    COUNT(*) as result
FROM companies;

SELECT 
    id,
    name,
    created_at
FROM companies
ORDER BY created_at DESC
LIMIT 5;

-- Step 4: Check product categories
SELECT 'PRODUCT CATEGORIES ANALYSIS' as check_type;

-- Check if product_categories table exists
SELECT 
    'Product categories table exists' as check,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_categories') 
         THEN 'YES' 
         ELSE 'NO' 
    END as result;

-- Count categories
SELECT 
    'Total categories count' as check,
    COUNT(*) as result
FROM product_categories;

-- Sample categories
SELECT 
    id,
    company_id,
    name,
    is_active
FROM product_categories
ORDER BY created_at DESC
LIMIT 10;

-- Step 5: Check products with categories relationship
SELECT 'PRODUCTS WITH CATEGORIES' as check_type;

SELECT 
    p.id,
    p.name as product_name,
    p.product_code,
    p.stock_quantity,
    p.selling_price,
    p.category_id,
    pc.name as category_name,
    p.is_active as product_active,
    pc.is_active as category_active
FROM products p
LEFT JOIN product_categories pc ON p.category_id = pc.id
WHERE p.is_active = true
ORDER BY p.created_at DESC
LIMIT 15;

-- Step 6: Check for specific issues
SELECT 'POTENTIAL ISSUES CHECK' as check_type;

-- Products without prices
SELECT 
    'Products without selling_price' as issue,
    COUNT(*) as count
FROM products 
WHERE (selling_price IS NULL OR selling_price = 0) 
  AND is_active = true;

-- Products without stock
SELECT 
    'Products with zero stock' as issue,
    COUNT(*) as count
FROM products 
WHERE (stock_quantity IS NULL OR stock_quantity = 0) 
  AND is_active = true;

-- Inactive products
SELECT 
    'Inactive products' as issue,
    COUNT(*) as count
FROM products 
WHERE is_active = false;

-- Products without company
SELECT 
    'Products without company_id' as issue,
    COUNT(*) as count
FROM products 
WHERE company_id IS NULL;

-- Step 7: Check foreign key constraints on products
SELECT 'FOREIGN KEY CONSTRAINTS' as check_type;

SELECT 
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
  AND tc.table_name = 'products'
ORDER BY tc.constraint_name;

SELECT '✅ INVENTORY DEBUG COMPLETE!' as result;
