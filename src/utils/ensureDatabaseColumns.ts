import { supabase } from '@/integrations/supabase/client';

/**
 * Ensures quantity columns are DECIMAL(10,3) instead of INTEGER
 * This allows line items to support fractional quantities (e.g., 9.5 units)
 * Fixes BOQ to Invoice conversion issue with decimal quantities
 */
export const ensureQuantityColumnsAreDecimal = async () => {
  try {
    const sql = `
      -- Fix invoice items quantity type
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='invoice_items' AND column_name='quantity' AND data_type='integer') THEN
          ALTER TABLE invoice_items
          ALTER COLUMN quantity SET DATA TYPE DECIMAL(10,3) USING quantity::DECIMAL(10,3);
          RAISE NOTICE 'Fixed invoice_items.quantity type to DECIMAL(10,3)';
        END IF;
      END $$;

      -- Fix quotation items quantity type
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='quotation_items' AND column_name='quantity' AND data_type='integer') THEN
          ALTER TABLE quotation_items
          ALTER COLUMN quantity SET DATA TYPE DECIMAL(10,3) USING quantity::DECIMAL(10,3);
          RAISE NOTICE 'Fixed quotation_items.quantity type to DECIMAL(10,3)';
        END IF;
      END $$;

      -- Fix proforma items quantity type if table exists
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='proforma_items' AND column_name='quantity' AND data_type='integer') THEN
          ALTER TABLE proforma_items
          ALTER COLUMN quantity SET DATA TYPE DECIMAL(10,3) USING quantity::DECIMAL(10,3);
          RAISE NOTICE 'Fixed proforma_items.quantity type to DECIMAL(10,3)';
        END IF;
      END $$;
    `;

    // Try using the exec_sql RPC function if available
    try {
      const { error } = await supabase.rpc('exec_sql', {
        sql_string: sql
      });

      if (error) {
        console.warn('Could not fix quantity column types via exec_sql:', error);
        return false;
      }

      console.log('✓ Quantity columns fixed to DECIMAL(10,3)');
      return true;
    } catch (rpcError) {
      console.warn('exec_sql RPC not available, skipping quantity type fix:', rpcError);
      return false;
    }
  } catch (error) {
    console.warn('Failed to ensure quantity columns are DECIMAL:', error);
    return false;
  }
};

/**
 * Ensures that header_image and stamp_image columns exist in the companies table
 * This handles the case where migrations haven't been applied yet
 */
export const ensureCompanyImageColumns = async () => {
  try {
    const sql = `
      -- Add header_image and stamp_image columns to companies table if they don't exist
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS header_image TEXT;
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS stamp_image TEXT;
    `;

    // Try using the exec_sql RPC function
    try {
      const { error } = await supabase.rpc('exec_sql', {
        sql_string: sql
      });

      if (error) {
        // If exec_sql RPC doesn't work, log but don't fail
        console.warn('Could not add company image columns via exec_sql:', error);
        // Return true anyway - columns might already exist
        return true;
      }

      console.log('✓ Company image columns are available');
      return true;
    } catch (rpcError) {
      // RPC function doesn't exist or failed - this is OK, columns might already exist
      console.warn('exec_sql RPC not available:', rpcError);
      return true;
    }
  } catch (error) {
    console.warn('Failed to ensure company image columns exist:', error);
    // Return true to allow app to continue
    return true;
  }
};

/**
 * Gracefully selects from companies, handling missing columns
 */
export const selectCompaniesWithFallback = async () => {
  try {
    // First, try to ensure the columns exist
    await ensureCompanyImageColumns();

    // Then try the full select
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching companies:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in selectCompaniesWithFallback:', error);
    throw error;
  }
};
