-- Create the main company (required for all forms to work)
INSERT INTO companies (id, name, registration_number, tax_number, email, phone, address, city, country, currency) 
VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    'Biolegend Scientific Ltd',
    'C.001/2024',
    'P051234567A',
    'admin@biolegendscientific.co.ke',
    '+254 700 000 000',
    'P.O BOX 12345 - 00100, Nairobi',
    'Nairobi',
    'Kenya',
    'KES'
) ON CONFLICT (id) DO NOTHING;

-- Create basic product categories
INSERT INTO product_categories (company_id, name, description) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'Scientific Equipment', 'Laboratory and scientific equipment'),
('550e8400-e29b-41d4-a716-446655440000', 'Laboratory Supplies', 'Laboratory testing supplies and reagents'),
('550e8400-e29b-41d4-a716-446655440000', 'Research Tools', 'Research and analysis tools')
ON CONFLICT DO NOTHING;

-- Create a few sample customers
INSERT INTO customers (company_id, customer_code, name, email, phone, address, city, country, credit_limit, payment_terms) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'CUST001', 'University of Nairobi', 'procurement@uonbi.ac.ke', '+254 720 123456', 'P.O Box 30197, Nairobi', 'Nairobi', 'Kenya', 500000, 30),
('550e8400-e29b-41d4-a716-446655440000', 'CUST002', 'Kenya Medical Research Institute', 'supplies@kemri.org', '+254 733 654321', 'P.O Box 54840, Nairobi', 'Nairobi', 'Kenya', 1000000, 45),
('550e8400-e29b-41d4-a716-446655440000', 'CUST003', 'Aga Khan University Hospital', 'procurement@aku.edu', '+254 711 222333', 'P.O Box 30270, Nairobi', 'Nairobi', 'Kenya', 750000, 30)
ON CONFLICT DO NOTHING;

-- Create some sample products
INSERT INTO products (company_id, category_id, product_code, name, description, unit_of_measure, cost_price, selling_price, stock_quantity, minimum_stock_level) VALUES
('550e8400-e29b-41d4-a716-446655440000', (SELECT id FROM product_categories WHERE name = 'Scientific Equipment' AND company_id = '550e8400-e29b-41d4-a716-446655440000' LIMIT 1), 'PRD001', 'Digital Microscope', 'High-resolution digital microscope for research', 'Unit', 45000.00, 55000.00, 5, 2),
('550e8400-e29b-41d4-a716-446655440000', (SELECT id FROM product_categories WHERE name = 'Laboratory Supplies' AND company_id = '550e8400-e29b-41d4-a716-446655440000' LIMIT 1), 'PRD002', 'Petri Dishes (Pack of 100)', 'Sterile petri dishes for bacterial culture', 'Pack', 800.00, 1200.00, 50, 20),
('550e8400-e29b-41d4-a716-446655440000', (SELECT id FROM product_categories WHERE name = 'Research Tools' AND company_id = '550e8400-e29b-41d4-a716-446655440000' LIMIT 1), 'PRD003', 'Laboratory Pipettes Set', 'Precision pipettes for accurate measurements', 'Set', 3500.00, 4500.00, 15, 5)
ON CONFLICT DO NOTHING;

-- Create basic tax settings
INSERT INTO tax_settings (company_id, name, rate, is_active, is_default) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'VAT 16%', 16.0, true, true),
('550e8400-e29b-41d4-a716-446655440000', 'Zero Rated', 0.0, true, false)
ON CONFLICT DO NOTHING;
