-- =============================================
-- Fix stock_movements table column mismatch
-- =============================================
-- 
-- ISSUE: Application code uses 'cost_per_unit' but database schema has 'unit_cost'
-- ERROR: Could not find the 'cost_per_unit' column of 'stock_movements' in the schema cache
--
-- SOLUTION: Add cost_per_unit column and sync with existing unit_cost data
-- =============================================

-- 1. Add the missing cost_per_unit column
ALTER TABLE stock_movements 
ADD COLUMN IF NOT EXISTS cost_per_unit DECIMAL(15,2);

-- 2. Copy existing unit_cost data to cost_per_unit (for backward compatibility)
UPDATE stock_movements 
SET cost_per_unit = unit_cost 
WHERE unit_cost IS NOT NULL AND cost_per_unit IS NULL;

-- 3. Create a trigger to keep both columns in sync going forward
-- (This ensures either column can be updated and both stay consistent)
CREATE OR REPLACE FUNCTION sync_stock_movement_costs()
RETURNS TRIGGER AS $$
BEGIN
    -- If cost_per_unit is updated, sync to unit_cost
    IF NEW.cost_per_unit IS DISTINCT FROM OLD.cost_per_unit THEN
        NEW.unit_cost := NEW.cost_per_unit;
    END IF;
    
    -- If unit_cost is updated, sync to cost_per_unit
    IF NEW.unit_cost IS DISTINCT FROM OLD.unit_cost THEN
        NEW.cost_per_unit := NEW.unit_cost;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT and UPDATE operations
DROP TRIGGER IF EXISTS trigger_sync_stock_movement_costs ON stock_movements;
CREATE TRIGGER trigger_sync_stock_movement_costs
    BEFORE INSERT OR UPDATE ON stock_movements
    FOR EACH ROW
    EXECUTE FUNCTION sync_stock_movement_costs();

-- 4. Add index for cost_per_unit for performance
CREATE INDEX IF NOT EXISTS idx_stock_movements_cost_per_unit ON stock_movements(cost_per_unit);

-- 5. Verify the fix by checking column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'stock_movements' 
  AND column_name IN ('unit_cost', 'cost_per_unit')
ORDER BY column_name;

-- Success message
SELECT 'Stock movements cost_per_unit column added successfully!' as status;
