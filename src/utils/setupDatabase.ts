import { supabase } from '@/integrations/supabase/client';

const CORE_TABLES = ['profiles', 'companies', 'customers', 'products', 'quotations', 'invoices'];

// Essential database tables creation script
const DATABASE_SETUP_SQL = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types first
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'accountant', 'stock_manager', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'inactive', 'pending');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Companies table (Multi-company support)
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    registration_number VARCHAR(100),
    tax_number VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Kenya',
    logo_url TEXT,
    currency VARCHAR(3) DEFAULT 'KES',
    fiscal_year_start INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Profiles table that extends Supabase auth.users
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role user_role DEFAULT 'user',
    status user_status DEFAULT 'pending',
    phone TEXT,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    department TEXT,
    position TEXT,
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    invited_at TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User permissions table for granular permissions
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    permission_name TEXT NOT NULL,
    granted BOOLEAN DEFAULT TRUE,
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, permission_name)
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    customer_code VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Kenya',
    tax_number VARCHAR(100),
    credit_limit DECIMAL(15,2) DEFAULT 0,
    payment_terms INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product categories
CREATE TABLE IF NOT EXISTS product_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES product_categories(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products/Inventory table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    category_id UUID REFERENCES product_categories(id),
    product_code VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    unit_of_measure VARCHAR(50) DEFAULT 'pcs',
    cost_price DECIMAL(15,2) DEFAULT 0,
    selling_price DECIMAL(15,2) DEFAULT 0,
    stock_quantity INTEGER DEFAULT 0,
    minimum_stock_level INTEGER DEFAULT 0,
    maximum_stock INTEGER,
    reorder_level INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quotations table
CREATE TABLE IF NOT EXISTS quotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    quotation_number VARCHAR(100) UNIQUE NOT NULL,
    quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until DATE,
    subtotal DECIMAL(15,2) DEFAULT 0,
    tax_percentage DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'draft',
    notes TEXT,
    terms_and_conditions TEXT,
    created_by UUID REFERENCES auth.users(id),
    currency VARCHAR(3) DEFAULT 'KES',
    exchange_rate DECIMAL(15,6) DEFAULT 1,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quotation items
CREATE TABLE IF NOT EXISTS quotation_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    tax_percentage DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    line_total DECIMAL(15,2) NOT NULL DEFAULT 0,
    section_name TEXT,
    section_labor_cost DECIMAL(15,2) DEFAULT 0,
    unit_of_measure TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoices table  
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    quotation_id UUID REFERENCES quotations(id),
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    subtotal DECIMAL(15,2) DEFAULT 0,
    tax_percentage DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,
    amount_paid DECIMAL(15,2) DEFAULT 0,
    amount_due DECIMAL(15,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'draft',
    notes TEXT,
    terms_and_conditions TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoice items
CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    tax_percentage DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    line_total DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_name ON user_permissions(permission_name);
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_products_company_id ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_quotations_company_id ON quotations(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);
`;

// Function to handle new user signup trigger
const USER_SIGNUP_FUNCTION = `
-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
`;

// Function to set up database
export async function setupDatabase() {
  const results = {
    success: false,
    steps: [] as Array<{ step: string; success: boolean; error?: string }>,
    tablesCreated: [] as string[],
    errors: [] as string[]
  };

  try {
    console.log('🚀 Starting database setup...');
    
    // Step 1: Create main tables
    console.log('📋 Creating database tables...');
    try {
      // Note: Since we can't execute DDL directly through Supabase client,
      // we'll provide the SQL for manual execution and check if tables exist

      console.log('⚠️ Manual SQL execution required. Tables must be created via Supabase Dashboard.');
      console.log('SQL to execute:');
      console.log(DATABASE_SETUP_SQL);

      // Check if tables already exist instead of creating them
      const tablesExist = await checkExistingTables();

      if (tablesExist === CORE_TABLES.length) {
        results.steps.push({ step: 'Tables already exist', success: true });
        results.tablesCreated.push('companies', 'profiles', 'user_permissions', 'customers', 'products', 'quotations', 'invoices');
      } else {
        results.steps.push({
          step: 'Tables need manual creation',
          success: false,
          error: 'Tables must be created via Supabase Dashboard SQL Editor'
        });
        results.errors.push('Tables must be created manually via Supabase Dashboard');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to check tables:', errorMessage);
      results.steps.push({ step: 'Check tables', success: false, error: errorMessage });
      results.errors.push(`Table check failed: ${errorMessage}`);
    }

    // Step 2: Set up user signup trigger
    console.log('🔧 Setting up user signup trigger...');
    try {
      const { error: triggerError } = await supabase.rpc('exec_sql', { 
        sql: USER_SIGNUP_FUNCTION 
      });
      
      if (triggerError) {
        throw triggerError;
      }
      
      results.steps.push({ step: 'Setup user signup trigger', success: true });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn('⚠️ Trigger setup failed (non-critical):', errorMessage);
      results.steps.push({ step: 'Setup user signup trigger', success: false, error: errorMessage });
    }

    // Step 3: Verify tables exist
    console.log('🔍 Verifying table creation...');
    const tablesToCheck = CORE_TABLES;
    let tablesExist = 0;
    
    for (const table of tablesToCheck) {
      try {
        const { error } = await supabase.from(table).select('id').limit(1);
        if (!error) {
          tablesExist++;
        }
      } catch (err) {
        console.warn(`Table ${table} verification failed:`, err);
      }
    }
    
    results.steps.push({ 
      step: `Verify tables (${tablesExist}/${tablesToCheck.length} working)`, 
      success: tablesExist === tablesToCheck.length
    });

    results.success = tablesExist === tablesToCheck.length;
    
    if (results.success) {
      console.log(`✅ Database setup completed! ${tablesExist}/${tablesToCheck.length} tables verified.`);
    } else {
      console.log(`⚠️ Database setup partially completed. ${tablesExist}/${tablesToCheck.length} tables verified.`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Database setup failed:', errorMessage);
    results.errors.push(`Setup failed: ${errorMessage}`);
    results.steps.push({ step: 'Database setup', success: false, error: errorMessage });
  }

  return results;
}

// Helper function to check existing tables
async function checkExistingTables() {
  const tables = CORE_TABLES;
  let existingCount = 0;

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('id').limit(1);
      if (!error) {
        existingCount++;
      }
    } catch (err) {
      // Table doesn't exist
    }
  }

  return existingCount;
}

// Check if profiles table exists
export async function checkProfilesTable() {
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    return { exists: !error, error: error?.message };
  } catch (error) {
    return {
      exists: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Get database setup status
export async function getDatabaseStatus() {
  const tables = ['profiles', 'companies', 'customers', 'products', 'quotations', 'invoices'];
  const status = {
    tablesChecked: 0,
    tablesWorking: 0,
    tables: {} as Record<string, boolean>,
    ready: false
  };

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('id').limit(1);
      status.tables[table] = !error;
      status.tablesChecked++;
      if (!error) {
        status.tablesWorking++;
      }
    } catch (err) {
      status.tables[table] = false;
      status.tablesChecked++;
    }
  }

  status.ready = status.tablesWorking === status.tablesChecked;
  return status;
}
