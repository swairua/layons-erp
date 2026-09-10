-- Fix stock column naming inconsistencies
-- This ensures products table uses stock_quantity instead of current_stock

-- Check if current_stock exists and stock_quantity doesn't exist
DO $$
BEGIN
    -- If current_stock exists but stock_quantity doesn't, rename it
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'current_stock'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'stock_quantity'
    ) THEN
        ALTER TABLE products RENAME COLUMN current_stock TO stock_quantity;
        RAISE NOTICE 'Renamed current_stock to stock_quantity';
    END IF;

    -- If minimum_stock exists but minimum_stock_level doesn't, rename it
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'minimum_stock'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'minimum_stock_level'
    ) THEN
        ALTER TABLE products RENAME COLUMN minimum_stock TO minimum_stock_level;
        RAISE NOTICE 'Renamed minimum_stock to minimum_stock_level';
    END IF;

    -- If maximum_stock exists but maximum_stock_level doesn't, rename it
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'maximum_stock'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'maximum_stock_level'
    ) THEN
        ALTER TABLE products RENAME COLUMN maximum_stock TO maximum_stock_level;
        RAISE NOTICE 'Renamed maximum_stock to maximum_stock_level';
    END IF;

    -- If reorder_level exists but reorder_point doesn't, rename it
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'reorder_level'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'reorder_point'
    ) THEN
        ALTER TABLE products RENAME COLUMN reorder_level TO reorder_point;
        RAISE NOTICE 'Renamed reorder_level to reorder_point';
    END IF;
END $$;

-- Add missing columns if they don't exist
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS minimum_stock_level INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS maximum_stock_level INTEGER,
ADD COLUMN IF NOT EXISTS reorder_point INTEGER DEFAULT 0;

-- Update any NULL values to defaults
UPDATE products 
SET stock_quantity = COALESCE(stock_quantity, 0),
    minimum_stock_level = COALESCE(minimum_stock_level, 0),
    reorder_point = COALESCE(reorder_point, 0);

-- Verify the fix worked
SELECT 
    'Stock column standardization complete' as status,
    table_name, 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'products' 
    AND column_name IN ('stock_quantity', 'minimum_stock_level', 'maximum_stock_level', 'reorder_point')
ORDER BY column_name;
