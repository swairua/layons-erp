-- MedPlus Africa Business Management System
-- Comprehensive Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies table (Multi-company support)
CREATE TABLE companies (
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
    fiscal_year_start INTEGER DEFAULT 1, -- January = 1
    default_terms_and_conditions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User roles enum
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'accountant', 'stock_manager', 'sales', 'viewer');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'viewer',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customers table
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    customer_code VARCHAR(50) UNIQUE NOT NULL,
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
    payment_terms INTEGER DEFAULT 30, -- days
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Suppliers table
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    supplier_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Kenya',
    tax_number VARCHAR(100),
    payment_terms INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product categories
CREATE TABLE product_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES product_categories(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products/Inventory table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    category_id UUID REFERENCES product_categories(id),
    product_code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    unit_of_measure VARCHAR(50) DEFAULT 'Each',
    cost_price DECIMAL(15,2) DEFAULT 0,
    selling_price DECIMAL(15,2) NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    minimum_stock_level INTEGER DEFAULT 0,
    maximum_stock_level INTEGER,
    reorder_point INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    track_inventory BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document status enum
CREATE TYPE document_status AS ENUM ('draft', 'pending', 'approved', 'sent', 'paid', 'cancelled', 'overdue');

-- Document types enum
CREATE TYPE document_type AS ENUM ('quotation', 'invoice', 'proforma', 'delivery_note', 'credit_note', 'debit_note');

-- Quotations table
CREATE TABLE quotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    quotation_number VARCHAR(100) UNIQUE NOT NULL,
    quotation_date DATE NOT NULL,
    valid_until DATE,
    status document_status DEFAULT 'draft',
    subtotal DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'KES',
    terms_and_conditions TEXT,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quotation items
CREATE TABLE quotation_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    description TEXT NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    tax_percentage DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    tax_inclusive BOOLEAN DEFAULT FALSE,
    line_total DECIMAL(15,2) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    unit_of_measure VARCHAR(50),
    section_name VARCHAR(255),
    section_labor_cost DECIMAL(15,2) DEFAULT 0
);

-- Invoices table
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    quotation_id UUID REFERENCES quotations(id), -- Optional link to quotation
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status document_status DEFAULT 'draft',
    subtotal DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    balance_due DECIMAL(15,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'KES', -- Currency code: KES, USD, EUR, GBP
    terms_and_conditions TEXT,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoice items
CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    description TEXT NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    line_total DECIMAL(15,2) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    unit_of_measure VARCHAR(50)
);

-- Proforma invoices table
CREATE TABLE proforma_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    proforma_number VARCHAR(100) UNIQUE NOT NULL,
    proforma_date DATE NOT NULL,
    valid_until DATE,
    status document_status DEFAULT 'draft',
    subtotal DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,
    terms_and_conditions TEXT,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Proforma invoice items
CREATE TABLE proforma_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proforma_id UUID REFERENCES proforma_invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    description TEXT NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    line_total DECIMAL(15,2) NOT NULL,
    sort_order INTEGER DEFAULT 0
);

-- Delivery notes table
CREATE TABLE delivery_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id), -- Optional link to invoice
    delivery_number VARCHAR(100) UNIQUE NOT NULL,
    delivery_date DATE NOT NULL,
    status document_status DEFAULT 'draft',
    delivered_by VARCHAR(255),
    received_by VARCHAR(255),
    delivery_address TEXT,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Delivery note items
CREATE TABLE delivery_note_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_note_id UUID REFERENCES delivery_notes(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    description TEXT NOT NULL,
    quantity_ordered DECIMAL(10,3) NOT NULL,
    quantity_delivered DECIMAL(10,3) NOT NULL,
    unit_price DECIMAL(15,2),
    sort_order INTEGER DEFAULT 0
);

-- Payment methods enum
CREATE TYPE payment_method AS ENUM ('cash', 'cheque', 'bank_transfer', 'mobile_money', 'credit_card', 'other');

-- Payments table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    payment_number VARCHAR(100) UNIQUE NOT NULL,
    payment_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    payment_method payment_method NOT NULL,
    reference_number VARCHAR(255),
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment allocations (linking payments to invoices)
CREATE TABLE payment_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    amount_allocated DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Remittance advice table
CREATE TABLE remittance_advice (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    advice_number VARCHAR(100) UNIQUE NOT NULL,
    advice_date DATE NOT NULL,
    total_payment DECIMAL(15,2) NOT NULL,
    status document_status DEFAULT 'draft',
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Remittance advice items
CREATE TABLE remittance_advice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    remittance_advice_id UUID REFERENCES remittance_advice(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES payments(id),
    invoice_id UUID REFERENCES invoices(id),
    document_date DATE NOT NULL,
    document_number VARCHAR(255) NOT NULL,
    document_type document_type NOT NULL,
    invoice_amount DECIMAL(15,2),
    credit_amount DECIMAL(15,2),
    payment_amount DECIMAL(15,2) NOT NULL,
    sort_order INTEGER DEFAULT 0
);

-- Stock movements table
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    movement_type VARCHAR(50) NOT NULL, -- 'in', 'out', 'adjustment'
    quantity DECIMAL(10,3) NOT NULL,
    unit_cost DECIMAL(15,2),
    reference_type VARCHAR(50), -- 'invoice', 'delivery_note', 'adjustment', 'purchase'
    reference_id UUID,
    reference_number VARCHAR(255),
    movement_date DATE NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to relevant tables
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_quotations_updated_at BEFORE UPDATE ON quotations FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_proforma_invoices_updated_at BEFORE UPDATE ON proforma_invoices FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_delivery_notes_updated_at BEFORE UPDATE ON delivery_notes FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_remittance_advice_updated_at BEFORE UPDATE ON remittance_advice FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE proforma_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE proforma_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_note_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE remittance_advice ENABLE ROW LEVEL SECURITY;
ALTER TABLE remittance_advice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Sample data for MedPlus Africa
INSERT INTO companies (id, name, registration_number, tax_number, email, phone, address, city, country, logo_url) 
VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    'MedPlus Africa Limited',
    'C.52/2013',
    'A003 3456 F',
    'info@medplusafrica.com',
    '+254 713149223',
    'P.O BOX 45352 - 00100, Raquel Plaza, Ronga, Payroll No. 303950',
    'Nairobi',
    'Kenya',
    '/medplus-logo.png'
);

-- Insert sample user
INSERT INTO users (id, company_id, email, full_name, role) 
VALUES (
    '660e8400-e29b-41d4-a716-446655440000',
    '550e8400-e29b-41d4-a716-446655440000',
    'admin@medplusafrica.com',
    'Dr. Sarah Johnson',
    'admin'
);

-- Insert sample customers
INSERT INTO customers (company_id, customer_code, name, email, phone, address, city, country) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'CUST001', 'The Panari Hotel', 'procurement@panari.co.ke', '+254 720 123456', 'P.O Box, Nairobi', 'Nairobi', 'Kenya'),
('550e8400-e29b-41d4-a716-446655440000', 'CUST002', 'Ace Sports Limited', 'orders@acesports.co.ke', '+254 733 654321', 'High Street, Manchester', 'Manchester', 'UK'),
('550e8400-e29b-41d4-a716-446655440000', 'CUST003', 'Champion Sports', 'info@championsports.co.ke', '+254 0131 874428', 'Fairway, Leeds', 'Leeds', 'UK');

-- Insert sample product categories
INSERT INTO product_categories (company_id, name, description) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'Medical Equipment', 'Medical devices and equipment'),
('550e8400-e29b-41d4-a716-446655440000', 'Laboratory Supplies', 'Laboratory testing supplies and reagents'),
('550e8400-e29b-41d4-a716-446655440000', 'Protective Equipment', 'Personal protective equipment for medical use');

-- Insert sample products
INSERT INTO products (company_id, category_id, product_code, name, description, unit_of_measure, cost_price, selling_price, stock_quantity, minimum_stock_level) VALUES
('550e8400-e29b-41d4-a716-446655440000', (SELECT id FROM product_categories WHERE name = 'Medical Equipment' LIMIT 1), 'PRD001', 'Latex Rubber Gloves Bicolor Reusable XL', 'High-quality latex gloves for medical use', 'Pair', 400.00, 500.00, 24, 10),
('550e8400-e29b-41d4-a716-446655440000', (SELECT id FROM product_categories WHERE name = 'Laboratory Supplies' LIMIT 1), 'PRD002', 'Blood Test Kit Standard', 'Complete blood testing kit for laboratories', 'Kit', 1200.00, 1500.00, 15, 5),
('550e8400-e29b-41d4-a716-446655440000', (SELECT id FROM product_categories WHERE name = 'Protective Equipment' LIMIT 1), 'PRD003', 'N95 Respirator Mask', 'High-filtration respiratory protection', 'Box', 800.00, 1000.00, 50, 20);

-- Functions for auto-generating document numbers (format: XXXXMMYYYY)
CREATE OR REPLACE FUNCTION generate_quotation_number(company_uuid UUID)
RETURNS VARCHAR AS $$
DECLARE
    next_number INTEGER;
    year_part VARCHAR(4);
    month_part VARCHAR(2);
BEGIN
    year_part := EXTRACT(YEAR FROM CURRENT_DATE)::VARCHAR;
    month_part := LPAD(EXTRACT(MONTH FROM CURRENT_DATE)::VARCHAR, 2, '0');

    SELECT COALESCE(MAX(CAST(SUBSTRING(quotation_number FROM '^[0-9]{4}') AS INTEGER)), 0) + 1
    INTO next_number
    FROM (
        SELECT quotation_number FROM quotations WHERE company_id = company_uuid
        UNION ALL
        SELECT invoice_number FROM invoices WHERE company_id = company_uuid
    ) AS all_docs;

    RETURN LPAD(next_number::VARCHAR, 4, '0') || month_part || year_part;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_invoice_number(company_uuid UUID)
RETURNS VARCHAR AS $$
DECLARE
    next_number INTEGER;
    year_part VARCHAR(4);
BEGIN
    year_part := EXTRACT(YEAR FROM CURRENT_DATE)::VARCHAR;

    -- Extract the numeric part from existing invoices and quotations from CURRENT YEAR ONLY
    -- For format "INV-YYYY-XXX", extract the XXX part where YYYY matches current year
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(invoice_number FROM 'INV-[0-9]{4}-([0-9]{3})') AS INTEGER)
    ), 0) + 1
    INTO next_number
    FROM (
        SELECT invoice_number FROM invoices
        WHERE company_id = company_uuid
        AND invoice_number LIKE 'INV-' || year_part || '-%'
        UNION ALL
        SELECT quotation_number FROM quotations
        WHERE company_id = company_uuid
        AND quotation_number LIKE 'INV-' || year_part || '-%'
    ) AS all_docs;

    RETURN 'INV-' || year_part || '-' || LPAD(next_number::VARCHAR, 3, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_remittance_number(company_uuid UUID)
RETURNS VARCHAR AS $$
DECLARE
    next_number INTEGER;
    year_part VARCHAR(4);
BEGIN
    year_part := EXTRACT(YEAR FROM CURRENT_DATE)::VARCHAR;
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(advice_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO next_number
    FROM remittance_advice 
    WHERE company_id = company_uuid 
    AND advice_number LIKE 'RA-' || year_part || '-%';
    
    RETURN 'RA-' || year_part || '-' || LPAD(next_number::VARCHAR, 3, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_proforma_number(company_uuid UUID)
RETURNS VARCHAR AS $$
DECLARE
    next_number INTEGER;
    year_part VARCHAR(4);
BEGIN
    year_part := EXTRACT(YEAR FROM CURRENT_DATE)::VARCHAR;

    SELECT COALESCE(MAX(CAST(SUBSTRING(proforma_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO next_number
    FROM proforma_invoices
    WHERE company_id = company_uuid
    AND proforma_number LIKE 'PF-' || year_part || '-%';

    RETURN 'PF-' || year_part || '-' || LPAD(next_number::VARCHAR, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to update stock on invoice creation
CREATE OR REPLACE FUNCTION update_stock_on_invoice()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update stock when invoice status changes to 'sent' or 'paid'
    IF NEW.status IN ('sent', 'paid') AND (OLD.status IS NULL OR OLD.status NOT IN ('sent', 'paid')) THEN
        -- Decrease stock for each invoice item
        UPDATE products SET 
            stock_quantity = stock_quantity - ii.quantity,
            updated_at = NOW()
        FROM invoice_items ii 
        WHERE products.id = ii.product_id 
        AND ii.invoice_id = NEW.id;
        
        -- Create stock movement records
        INSERT INTO stock_movements (company_id, product_id, movement_type, quantity, reference_type, reference_id, reference_number, movement_date, created_by)
        SELECT 
            NEW.company_id,
            ii.product_id,
            'out',
            -ii.quantity,
            'invoice',
            NEW.id,
            NEW.invoice_number,
            NEW.invoice_date,
            NEW.created_by
        FROM invoice_items ii 
        WHERE ii.invoice_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stock_on_invoice
    AFTER UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_stock_on_invoice();
