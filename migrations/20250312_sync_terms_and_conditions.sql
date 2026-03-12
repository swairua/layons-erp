-- Migration: Sync terms_and_conditions between top-level and nested fields
-- Purpose: Ensure data consistency between boqs.terms_and_conditions and boqs.data->>'terms_and_conditions'
-- Strategy: Use top-level as source of truth, fallback to nested if top-level is null

-- Step 1: For BOQs where top-level is NULL but nested has content, update top-level from nested
UPDATE boqs
SET terms_and_conditions = data->>'terms_and_conditions'
WHERE terms_and_conditions IS NULL 
  AND data IS NOT NULL 
  AND data->>'terms_and_conditions' IS NOT NULL
  AND TRIM(data->>'terms_and_conditions') != '';

-- Step 2: For BOQs where nested is NULL or differs from top-level, sync nested from top-level
UPDATE boqs
SET data = jsonb_set(
  COALESCE(data, '{}'),
  '{terms_and_conditions}',
  to_jsonb(terms_and_conditions)
)
WHERE terms_and_conditions IS NOT NULL 
  AND TRIM(terms_and_conditions) != ''
  AND (
    data IS NULL 
    OR data->>'terms_and_conditions' IS NULL 
    OR data->>'terms_and_conditions' != terms_and_conditions
  );

-- Step 3: For BOQs where both are NULL, ensure they stay consistent
-- This is safe since NULL = NULL is consistent

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
