import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fixed hook for fetching invoices with customer data
 * Uses separate queries to avoid relationship ambiguity
 * Supports server-side pagination, search, and fetchAll mode
 */
export const useInvoicesFixed = (
  companyId?: string,
  options?: { page?: number; pageSize?: number; search?: string; fetchAll?: boolean }
) => {
  const fetchAll = options?.fetchAll ?? true;
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 10;
  const search = options?.search ?? '';
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return useQuery({
    queryKey: ['invoices_fixed', companyId, fetchAll ? 'all' : page, pageSize, search],
    queryFn: async () => {
      if (!companyId) return { data: [], total: 0 };

      try {
        console.log('Fetching invoices for company:', companyId);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Authentication required: No active session');
        }

        // If searching by customer name, first find matching customer IDs
        let matchingCustomerIds: string[] | null = null;
        if (search) {
          const { data: matchedCustomers } = await supabase
            .from('customers')
            .select('id')
            .eq('company_id', companyId)
            .or(`name.ilike.%${search}%,email.ilike.%${search}%`);
          matchingCustomerIds = (matchedCustomers || []).map(c => c.id);
          // If no customers match, still try invoice_number search
        }

        // Step 1: Get invoices with pagination
        let query = supabase
          .from('invoices')
          .select(`
            id,
            customer_id,
            invoice_number,
            invoice_date,
            due_date,
            status,
            subtotal,
            tax_amount,
            total_amount,
            currency,
            paid_amount,
            balance_due,
            notes,
            terms_and_conditions,
            lpo_number,
            created_at,
            updated_at
          `, { count: fetchAll ? undefined : 'exact' })
          .eq('company_id', companyId)
          .order('created_at', { ascending: false });

        if (search) {
          if (matchingCustomerIds && matchingCustomerIds.length > 0) {
            query = query.or(`invoice_number.ilike.%${search}%,customer_id.in.(${matchingCustomerIds.join(',')})`);
          } else {
            query = query.ilike('invoice_number', `%${search}%`);
          }
        }

        if (!fetchAll) {
          query = query.range(from, to);
        }

        const { data: invoices, error: invoicesError, count } = await query;

        if (invoicesError) {
          throw new Error(`Failed to fetch invoices: ${invoicesError.message}`);
        }

        if (!invoices || invoices.length === 0) {
          return { data: [], total: count || 0 };
        }

        // Step 2: Get unique customer IDs
        const customerIds = [...new Set(invoices.map(invoice => invoice.customer_id).filter(id => id && typeof id === 'string' && id.length === 36))];

        // Step 3: Get customers
        const { data: customers } = customerIds.length > 0 ? await supabase
          .from('customers')
          .select('id, name, email, phone, address, city, country')
          .in('id', customerIds) : { data: [], error: null };

        const customerMap = new Map();
        (customers || []).forEach(customer => {
          customerMap.set(customer.id, customer);
        });

        // Step 4a: Get company details
        const { data: company } = await supabase
          .from('companies')
          .select('id, name, address, city, country, phone, email, tax_number')
          .eq('id', companyId)
          .single();

        // Step 5: Get invoice items for paginated invoices only
        const invoiceIds = invoices.map(inv => inv.id).filter(id => id && typeof id === 'string');

        let invoiceItems = [] as any[];
        try {
          if (invoiceIds.length > 0) {
            const { data, error } = await supabase
              .from('invoice_items')
              .select(`
                id, invoice_id, product_id, description, quantity, unit_price,
                discount_percentage, discount_before_vat, tax_percentage, tax_amount,
                tax_inclusive, line_total, sort_order, section_name, section_labor_cost,
                unit_of_measure, products(id, name, product_code, unit_of_measure)
              `)
              .in('invoice_id', invoiceIds);
            if (!error && data) invoiceItems = data;
          }
        } catch (err) {
          console.error('Error fetching invoice items (non-fatal):', err);
        }

        const itemsMap = new Map();
        (invoiceItems || []).forEach(item => {
          if (!itemsMap.has(item.invoice_id)) itemsMap.set(item.invoice_id, []);
          itemsMap.get(item.invoice_id).push(item);
        });

        // Step 6a: Fetch payment allocations
        let paymentAllocations = [] as any[];
        try {
          if (invoiceIds.length > 0) {
            const { data, error } = await supabase
              .from('payment_allocations')
              .select(`
                id, invoice_id, payment_id, amount_allocated,
                payments(id, payment_number, payment_date, amount, payment_method, reference_number)
              `)
              .in('invoice_id', invoiceIds);
            if (!error && data) paymentAllocations = data;
          }
        } catch (err) {
          console.error('Error fetching payment allocations (non-fatal):', err);
        }

        const allocationsMap = new Map();
        (paymentAllocations || []).forEach(alloc => {
          if (!allocationsMap.has(alloc.invoice_id)) allocationsMap.set(alloc.invoice_id, []);
          allocationsMap.get(alloc.invoice_id).push(alloc);
        });

        // Step 7: Combine data
        const enrichedInvoices = invoices.map(invoice => ({
          ...invoice,
          customers: customerMap.get(invoice.customer_id) || { name: 'Unknown Customer', email: null, phone: null },
          company: company || null,
          invoice_items: itemsMap.get(invoice.id) || [],
          payment_allocations: allocationsMap.get(invoice.id) || []
        }));

        return { data: enrichedInvoices, total: count || 0 };

      } catch (error) {
        console.error('Error in useInvoicesFixed:', error);
        throw error;
      }
    },
    enabled: !!companyId,
    staleTime: 30000,
    retry: 3,
    retryDelay: 1000,
  });
};

/**
 * Hook for fetching customer invoices (for a specific customer)
 */
export const useCustomerInvoicesFixed = (customerId?: string, companyId?: string) => {
  return useQuery({
    queryKey: ['customer_invoices_fixed', customerId, companyId],
    queryFn: async () => {
      if (!customerId) return [];

      try {
        console.log('Fetching invoices for customer:', customerId);

        // Get invoices for specific customer
        // Note: Use paid_amount and balance_due as per the database schema
        // Note: company_id column may not exist; filtering by company happens via customer relationship
        const { data: invoices, error: invoicesError } = await supabase
          .from('invoices')
          .select(`
            id,
            customer_id,
            invoice_number,
            invoice_date,
            due_date,
            status,
            subtotal,
            tax_amount,
            total_amount,
            currency,
            paid_amount,
            balance_due,
            notes,
            terms_and_conditions,
            lpo_number,
            created_at,
            updated_at
          `)
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false });

        if (invoicesError) {
          console.error('Error fetching customer invoices:', invoicesError);
          throw new Error(`Failed to fetch customer invoices: ${invoicesError.message}`);
        }

        if (!invoices || invoices.length === 0) {
          return [];
        }

        // Get customer data (including company_id to fetch company details)
        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .select('id, name, email, phone, address, city, country, company_id')
          .eq('id', customerId)
          .single();

        if (customerError) {
          console.error('Error fetching customer:', customerError);
        }

        // Get company details through customer relationship
        let company = null;
        if (customer && customer.company_id) {
          try {
            const { data: companyData, error: companyError } = await supabase
              .from('companies')
              .select('id, name, address, city, country, phone, email, tax_number')
              .eq('id', customer.company_id)
              .single();

            if (companyError) {
              console.error('Error fetching company (non-fatal):', companyError);
            } else {
              company = companyData;
            }
          } catch (err) {
            console.error('Error fetching company (non-fatal):', err);
          }
        }

        // Get invoice items
        const invoiceIds = invoices.map(inv => inv.id);

        async function queryInvoiceItemsWithRetry(attempts = 3, delayMs = 500) {
          for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
              const res = await supabase
                .from('invoice_items')
                .select(`
                  id,
                  invoice_id,
                  product_id,
                  description,
                  quantity,
                  unit_price,
                  discount_percentage,
                  discount_before_vat,
                  tax_percentage,
                  tax_amount,
                  tax_inclusive,
                  line_total,
                  sort_order,
                  section_name,
                  section_labor_cost,
                  unit_of_measure,
                  products(id, name, product_code, unit_of_measure)
                `)
                .in('invoice_id', invoiceIds);

              return res;
            } catch (err) {
              console.warn(`Attempt ${attempt} to fetch invoice_items failed:`, err);
              if (attempt < attempts) {
                await new Promise(r => setTimeout(r, delayMs * attempt));
                continue;
              }
              throw err;
            }
          }
          return { data: [], error: null };
        }

        let invoiceItems = [] as any[];
        try {
          if (invoiceIds.length > 0) {
            const { data, error } = await queryInvoiceItemsWithRetry(3, 500);
            if (error) {
              console.error('Error fetching invoice items:', (error as any)?.message || error);
            } else if (data) {
              invoiceItems = data;
            }
          }
        } catch (err) {
          console.error('Network error fetching invoice items after retries:', err);
        }

        // Group items by invoice
        const itemsMap = new Map();
        (invoiceItems || []).forEach(item => {
          if (!itemsMap.has(item.invoice_id)) {
            itemsMap.set(item.invoice_id, []);
          }
          itemsMap.get(item.invoice_id).push(item);
        });

        // Fetch payment allocations for each invoice
        let paymentAllocations = [] as any[];
        try {
          if (invoiceIds.length > 0) {
            const { data, error } = await supabase
              .from('payment_allocations')
              .select(`
                id,
                invoice_id,
                payment_id,
                amount_allocated,
                payments(
                  id,
                  payment_number,
                  payment_date,
                  amount,
                  payment_method,
                  reference_number
                )
              `)
              .in('invoice_id', invoiceIds);

            if (error) {
              console.error('Error fetching payment allocations (non-fatal):', (error as any)?.message || error);
            } else if (data) {
              paymentAllocations = data;
            }
          }
        } catch (err) {
          console.error('Unexpected error fetching payment allocations (non-fatal):', err);
        }

        // Group payment allocations by invoice_id
        const allocationsMap = new Map();
        (paymentAllocations || []).forEach(alloc => {
          if (!allocationsMap.has(alloc.invoice_id)) {
            allocationsMap.set(alloc.invoice_id, []);
          }
          allocationsMap.get(alloc.invoice_id).push(alloc);
        });

        // Combine data with enriched information
        const enrichedInvoices = invoices.map(invoice => ({
          ...invoice,
          customers: customer || {
            name: 'Unknown Customer',
            email: null,
            phone: null
          },
          company: company || null,
          invoice_items: itemsMap.get(invoice.id) || [],
          payment_allocations: allocationsMap.get(invoice.id) || []
        }));

        return enrichedInvoices;

      } catch (error) {
        console.error('Error in useCustomerInvoicesFixed:', error);
        throw error;
      }
    },
    enabled: !!customerId,
    staleTime: 30000,
  });
};
