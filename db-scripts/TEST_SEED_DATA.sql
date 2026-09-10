CREATE EXTENSION IF NOT EXISTS pgcrypto;
BEGIN;

-- Ensure tax_setting_id columns exist for seed compatibility
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS tax_setting_id UUID REFERENCES tax_settings(id);
ALTER TABLE proforma_items ADD COLUMN IF NOT EXISTS tax_setting_id UUID REFERENCES tax_settings(id);
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS tax_setting_id UUID REFERENCES tax_settings(id);

DO $$
DECLARE
  v_company_id uuid;
  v_customer_id uuid;
  v_supplier_id uuid;
  v_category_id uuid;
  v_product_id uuid;
  v_tax_id uuid;
  v_quotation_id uuid;
  v_proforma_id uuid;
  v_invoice_id uuid;
  v_delivery_id uuid;
  v_payment_id uuid;
  v_credit_id uuid;
  v_lpo_id uuid;
BEGIN
  -- Ensure a company exists
  SELECT id INTO v_company_id FROM companies LIMIT 1;
  IF v_company_id IS NULL THEN
    INSERT INTO companies(name, email, currency)
    VALUES ('Medplus Africa', 'info@medplusafrica.com', 'KES')
    RETURNING id INTO v_company_id;
  END IF;

  -- Core master data
  INSERT INTO customers(company_id, customer_code, name, email)
  VALUES (v_company_id, 'CUST-TEST-001', 'Test Customer', 'customer@example.com')
  RETURNING id INTO v_customer_id;

  INSERT INTO customers(company_id, customer_code, name, email)
  VALUES (v_company_id, 'SUP-TEST-001', 'Test Supplier', 'supplier@example.com')
  RETURNING id INTO v_supplier_id;

  INSERT INTO product_categories(company_id, name)
  VALUES (v_company_id, 'Test Category') RETURNING id INTO v_category_id;

  INSERT INTO products(company_id, category_id, product_code, name, unit_of_measure, selling_price, stock_quantity)
  VALUES (v_company_id, v_category_id, 'PRD-TEST-001', 'Test Product', 'pcs', 100, 10)
  RETURNING id INTO v_product_id;

  INSERT INTO tax_settings(company_id, name, rate, is_default)
  VALUES (v_company_id, 'VAT 16%', 16, true) RETURNING id INTO v_tax_id;

  -- Quotation + item
  INSERT INTO quotations(company_id, customer_id, quotation_number, quotation_date, valid_until, subtotal, tax_amount, total_amount, status)
  VALUES (v_company_id, v_customer_id, generate_quotation_number(v_company_id), CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days', 100, 16, 116, 'draft')
  RETURNING id INTO v_quotation_id;

  INSERT INTO quotation_items(quotation_id, product_id, description, quantity, unit_price, tax_percentage, tax_amount, line_total, tax_setting_id)
  VALUES (v_quotation_id, v_product_id, 'Test quoted item', 1, 100, 16, 16, 116, v_tax_id);

  -- Proforma + item
  INSERT INTO proforma_invoices(company_id, customer_id, proforma_number, proforma_date, valid_until, subtotal, tax_amount, total_amount, status)
  VALUES (v_company_id, v_customer_id, generate_proforma_number(v_company_id), CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days', 100, 16, 116, 'draft')
  RETURNING id INTO v_proforma_id;

  INSERT INTO proforma_items(proforma_id, product_id, description, quantity, unit_price, tax_percentage, tax_amount, line_total, tax_setting_id)
  VALUES (v_proforma_id, v_product_id, 'Test proforma item', 1, 100, 16, 16, 116, v_tax_id);

  -- Invoice + item
  INSERT INTO invoices(company_id, customer_id, quotation_id, invoice_number, invoice_date, due_date, lpo_number, subtotal, tax_amount, total_amount, paid_amount, balance_due, status)
  VALUES (v_company_id, v_customer_id, v_quotation_id, generate_invoice_number(v_company_id), CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days', 'TEST-LPO-001', 100, 16, 116, 0, 116, 'draft')
  RETURNING id INTO v_invoice_id;

  INSERT INTO invoice_items(invoice_id, product_id, description, quantity, unit_price, tax_percentage, tax_amount, line_total, tax_setting_id)
  VALUES (v_invoice_id, v_product_id, 'Test invoice item', 1, 100, 16, 16, 116, v_tax_id);

  -- Delivery note + item
  INSERT INTO delivery_notes(company_id, customer_id, invoice_id, delivery_number, delivery_date, delivery_address, status, delivered_by, received_by)
  VALUES (v_company_id, v_customer_id, v_invoice_id, generate_delivery_number(v_company_id), CURRENT_DATE, 'Test Address', 'draft', 'Warehouse', 'Client')
  RETURNING id INTO v_delivery_id;

  INSERT INTO delivery_note_items(delivery_note_id, product_id, description, quantity_ordered, quantity_delivered, unit_price)
  VALUES (v_delivery_id, v_product_id, 'Delivered item', 1, 1, 100);

  -- Payment + allocation
  INSERT INTO payments(company_id, customer_id, payment_number, payment_date, amount, payment_method, reference_number, notes)
  VALUES (v_company_id, v_customer_id, generate_payment_number(v_company_id), CURRENT_DATE, 116, 'bank_transfer', 'REF-TEST-001', 'Test payment')
  RETURNING id INTO v_payment_id;

  INSERT INTO payment_allocations(payment_id, invoice_id, amount_allocated)
  VALUES (v_payment_id, v_invoice_id, 116);

  UPDATE invoices SET paid_amount = 116, balance_due = 0, status = 'paid' WHERE id = v_invoice_id;

  -- Credit note + item + allocation (not applied)
  INSERT INTO credit_notes(company_id, customer_id, invoice_id, credit_note_number, credit_note_date, status, subtotal, tax_amount, total_amount, applied_amount, balance, affects_inventory, reason)
  VALUES (v_company_id, v_customer_id, v_invoice_id, generate_credit_note_number(v_company_id), CURRENT_DATE, 'draft', 10, 0, 10, 0, 10, false, 'Test credit')
  RETURNING id INTO v_credit_id;

  INSERT INTO credit_note_items(credit_note_id, product_id, description, quantity, unit_price, tax_percentage, tax_amount, line_total)
  VALUES (v_credit_id, v_product_id, 'Test credit item', 1, 10, 0, 0, 10);

  INSERT INTO credit_note_allocations(credit_note_id, invoice_id, allocated_amount)
  VALUES (v_credit_id, v_invoice_id, 0);

  -- LPO + item
  INSERT INTO lpos(company_id, supplier_id, lpo_number, lpo_date, status, subtotal, tax_amount, total_amount, delivery_address, contact_person, contact_phone)
  VALUES (v_company_id, v_supplier_id, generate_lpo_number(v_company_id), CURRENT_DATE, 'draft', 200, 32, 232, 'Test Delivery Address', 'John Doe', '0700000000')
  RETURNING id INTO v_lpo_id;

  INSERT INTO lpo_items(lpo_id, product_id, description, quantity, unit_price, tax_rate, tax_amount, line_total)
  VALUES (v_lpo_id, v_product_id, 'Test LPO item', 2, 100, 16, 32, 232);

  -- Remittance + item
  INSERT INTO remittance_advice(company_id, customer_id, advice_number, advice_date, total_payment, status, notes)
  VALUES (v_company_id, v_customer_id, generate_remittance_number(v_company_id), CURRENT_DATE, 116, 'draft', 'Test remittance')
  RETURNING id INTO v_credit_id;

  INSERT INTO remittance_advice_items(remittance_advice_id, payment_id, invoice_id, document_date, document_number, document_type, invoice_amount, credit_amount, payment_amount)
  VALUES (v_credit_id, v_payment_id, v_invoice_id, CURRENT_DATE, (SELECT invoice_number FROM invoices WHERE id = v_invoice_id), 'invoice', 116, 0, 116);

  -- Stock movement
  INSERT INTO stock_movements(company_id, product_id, movement_type, reference_type, reference_id, quantity, cost_per_unit, notes)
  VALUES (v_company_id, v_product_id, 'IN', 'RESTOCK', v_lpo_id, 5, 80, 'Initial stock for testing');
END $$;

COMMIT;
