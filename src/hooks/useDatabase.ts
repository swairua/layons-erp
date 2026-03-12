import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseErrorMessage } from '@/utils/errorHelpers';
import { RLSPolicyError } from '@/utils/RLSError';
import { ensureCompanyImageColumns, ensureQuantityColumnsAreDecimal } from '@/utils/ensureDatabaseColumns';

// Types
export interface Company {
  id: string;
  name: string;
  registration_number?: string;
  tax_number?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  currency?: string;
  logo_url?: string;
  header_image?: string;
  stamp_image?: string;
  fiscal_year_start?: number;
  tax_settings?: TaxSetting[];
  company_services?: string;
  default_terms_and_conditions?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TaxSetting {
  id: string;
  company_id: string;
  name: string;
  rate: number;
  is_active: boolean;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface StockMovement {
  id: string;
  company_id: string;
  product_id: string;
  movement_type: 'IN' | 'OUT' | 'ADJUSTMENT';
  reference_type: 'INVOICE' | 'DELIVERY_NOTE' | 'RESTOCK' | 'ADJUSTMENT';
  reference_id?: string;
  quantity: number;
  cost_per_unit?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Customer {
  id: string;
  company_id: string;
  customer_code: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  credit_limit?: number;
  payment_terms?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  company_id: string;
  category_id?: string;
  product_code: string;
  name: string;
  description?: string;
  unit_of_measure?: string;
  cost_price?: number;
  selling_price: number;
  stock_quantity?: number;
  minimum_stock_level?: number;
  maximum_stock_level?: number;
  reorder_point?: number;
  is_active?: boolean;
  track_inventory?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Invoice {
  id: string;
  company_id: string;
  customer_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  subtotal?: number;
  tax_amount?: number;
  total_amount?: number;
  paid_amount?: number;
  balance_due?: number;
  notes?: string;
  terms_and_conditions?: string;
  affects_inventory?: boolean;
  currency?: string; // Currency code: 'KES', 'USD', 'EUR', etc.
  created_at?: string;
  updated_at?: string;
}

export interface Payment {
  id: string;
  company_id: string;
  customer_id: string;
  payment_number: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RemittanceAdvice {
  id: string;
  company_id: string;
  customer_id: string;
  advice_number: string;
  advice_date: string;
  total_payment: number;
  status: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DeliveryNote {
  id: string;
  company_id: string;
  customer_id: string;
  invoice_id?: string;
  delivery_number: string; // Matches database schema
  delivery_note_number?: string; // For backward compatibility
  delivery_date: string;
  delivery_address: string;
  delivery_method: string;
  tracking_number?: string;
  carrier?: string;
  status: string;
  notes?: string;
  delivered_by?: string;
  received_by?: string;
  invoice_number?: string;
  created_at?: string;
  updated_at?: string;
  // Related data
  customers?: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
  };
  invoices?: {
    invoice_number: string;
    total_amount: number;
  };
  delivery_note_items?: DeliveryNoteItem[];
}

export interface DeliveryNoteItem {
  id: string;
  delivery_note_id: string;
  product_id?: string;
  description: string;
  quantity_ordered: number;
  quantity_delivered: number;
  unit_price?: number;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
  // Related data
  products?: {
    name: string;
    unit_of_measure?: string;
  };
}

export interface LPO {
  id: string;
  company_id: string;
  supplier_id: string;
  lpo_number: string;
  lpo_date: string;
  delivery_date?: string;
  status: 'draft' | 'sent' | 'approved' | 'received' | 'cancelled';
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  notes?: string;
  terms_and_conditions?: string;
  delivery_address?: string;
  contact_person?: string;
  contact_phone?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  // Related data
  suppliers?: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  lpo_items?: LPOItem[];
}

export interface LPOItem {
  id: string;
  lpo_id: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
  notes?: string;
  sort_order: number;
  // Related data
  products?: {
    name: string;
    product_code: string;
    unit_of_measure?: string;
  };
}

// Companies hooks
export const useCompanies = () => {
  return useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      // Ensure company image columns exist in the database
      // This handles the case where migrations haven't been applied yet
      try {
        await ensureCompanyImageColumns();
      } catch (err) {
        // If column ensure fails, continue anyway - the columns might already exist
        console.warn('Could not ensure company image columns, continuing...', err);
      }

      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Company[];
    },
  });
};

export const useCreateCompany = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (company: Omit<Company, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('companies')
        .insert([company])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });
};

export const useUpdateCompany = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...company }: Partial<Company> & { id: string }) => {
      const { data, error } = await supabase
        .from('companies')
        .update(company)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });
};

// Customers hooks
export const useCustomers = (companyId?: string) => {
  return useQuery({
    queryKey: ['customers', companyId],
    queryFn: async () => {
      let query = supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Customer[];
    },
  });
};

export const useCreateCustomer = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('customers')
        .insert([customer])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useUpdateCustomer = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...customer }: Partial<Customer> & { id: string }) => {
      const { data, error } = await supabase
        .from('customers')
        .update(customer)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useDeleteCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: string }) => {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

// Products hooks
export const useProducts = (companyId?: string) => {
  return useQuery({
    queryKey: ['products', companyId],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          *,
          product_categories(name)
        `)
        .order('created_at', { ascending: false });
      
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    },
  });
};

export const useCreateProduct = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('products')
        .insert([product])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...product }: Partial<Product> & { id: string }) => {
      const { data, error } = await supabase
        .from('products')
        .update(product)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

// Stock Movement hooks
export const useCreateStockMovement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (movement: Omit<StockMovement, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('stock_movements')
        .insert([movement])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

// Tax Settings hooks
export const useTaxSettings = (companyId?: string) => {
  return useQuery({
    queryKey: ['tax_settings', companyId],
    queryFn: async () => {
      let query = supabase
        .from('tax_settings')
        .select('*')
        .order('created_at', { ascending: false });

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as TaxSetting[];
    },
  });
};

export const useCreateTaxSetting = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taxSetting: Omit<TaxSetting, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('tax_settings')
        .insert([taxSetting])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax_settings'] });
    },
  });
};

export const useUpdateTaxSetting = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...taxSetting }: Partial<TaxSetting> & { id: string }) => {
      const { data, error } = await supabase
        .from('tax_settings')
        .update(taxSetting)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax_settings'] });
    },
  });
};

export const useDeleteTaxSetting = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tax_settings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax_settings'] });
    },
  });
};

// BOQs hooks
export const useBOQs = (companyId?: string) => {
  return useQuery({
    queryKey: ['boqs', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('boqs')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};

export const useCreateBOQ = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (boq: any) => {
      const { data, error } = await supabase
        .from('boqs')
        .insert([boq])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boqs'] });
    },
  });
};

export const useDeleteBOQ = () => {
  throw new Error('useDeleteBOQ is deprecated. Use useAuditedDeleteBOQ from useAuditedDeleteOperations instead.');
};

// Units hooks
export const useUnits = (companyId?: string) => {
  return useQuery({
    queryKey: ['units', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('company_id', companyId)
        .order('name', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
};

export const useCreateUnit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (unit: any) => {
      const { data, error } = await supabase
        .from('units')
        .insert([unit])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
    },
  });
};

export const useUpdateUnit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data, error } = await supabase.from('units').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
    }
  });
};

export const useDeleteUnit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('units').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
    }
  });
};

// Invoices hooks - Fixed to avoid relationship ambiguity
export const useInvoices = (companyId?: string) => {
  return useQuery({
    queryKey: ['invoices', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return [];

      try {
        // Step 1: Get invoices without embedded relationships
        let query = supabase
          .from('invoices')
          .select(`
            id,
            company_id,
            customer_id,
            invoice_number,
            invoice_date,
            due_date,
            status,
            subtotal,
            tax_amount,
            total_amount,
            paid_amount,
            balance_due,
            notes,
            terms_and_conditions,
            lpo_number,
            created_at,
            updated_at
          `)
          .eq('company_id', companyId)
          .order('created_at', { ascending: false });

        const { data: invoices, error: invoicesError } = await query;

        if (invoicesError) throw invoicesError;
        if (!invoices || invoices.length === 0) return [];

        // Step 2: Get customers separately (filter out invalid UUIDs)
        const customerIds = [...new Set(invoices.map(invoice => invoice.customer_id).filter(id => id && typeof id === 'string' && id.length === 36))];
        const { data: customers } = customerIds.length > 0 ? await supabase
          .from('customers')
          .select('id, name, email, phone, address, city, country')
          .in('id', customerIds) : { data: [] };

        // Step 3: Get invoice items separately (including product details for delivery notes)
        const invoiceIds = invoices.map(inv => inv.id);
        const { data: invoiceItems } = invoiceIds.length > 0 ? await supabase
          .from('invoice_items')
          .select(`
            id,
            invoice_id,
            product_id,
            description,
            quantity,
            unit_price,
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
          .in('invoice_id', invoiceIds) : { data: [], error: null };

        // Step 4: Create lookup maps
        const customerMap = new Map();
        (customers || []).forEach(customer => {
          customerMap.set(customer.id, customer);
        });

        const itemsMap = new Map();
        (invoiceItems || []).forEach(item => {
          if (!itemsMap.has(item.invoice_id)) {
            itemsMap.set(item.invoice_id, []);
          }
          itemsMap.get(item.invoice_id).push(item);
        });

        // Step 5: Combine data
        return invoices.map(invoice => ({
          ...invoice,
          customers: customerMap.get(invoice.customer_id) || {
            name: 'Unknown Customer',
            email: null,
            phone: null
          },
          invoice_items: itemsMap.get(invoice.id) || []
        }));

      } catch (error) {
        console.error('Error in useInvoices:', error);
        // Import parseErrorMessage at the top if not already imported
        const errorMessage = typeof error === 'string' ? error :
                            (error as any)?.message ||
                            'Failed to load invoices';
        throw new Error(errorMessage);
      }
    },
  });
};

export const useCustomerInvoices = (customerId?: string, companyId?: string) => {
  return useQuery({
    queryKey: ['customer_invoices', customerId, companyId],
    queryFn: async () => {
      if (!customerId) return [];

      try {
        // Get invoices without embedded relationships
        let query = supabase
          .from('invoices')
          .select(`
            id,
            company_id,
            customer_id,
            invoice_number,
            invoice_date,
            due_date,
            status,
            subtotal,
            tax_amount,
            total_amount,
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

        if (companyId) {
          query = query.eq('company_id', companyId);
        }

        const { data: invoices, error: invoicesError } = await query;

        if (invoicesError) throw invoicesError;
        if (!invoices || invoices.length === 0) return [];

        // Get invoice items separately
        const invoiceIds2 = invoices.map(inv => inv.id);
        const { data: invoiceItems } = invoiceIds2.length > 0 ? await supabase
          .from('invoice_items')
          .select(`
            id,
            invoice_id,
            product_id,
            description,
            quantity,
            unit_price,
            discount_before_vat,
            tax_percentage,
            tax_amount,
            tax_inclusive,
            line_total,
            sort_order,
            section_name,
            section_labor_cost,
            unit_of_measure
          `)
          .in('invoice_id', invoiceIds2) : { data: [], error: null };

        // Group items by invoice
        const itemsMap = new Map();
        (invoiceItems || []).forEach(item => {
          if (!itemsMap.has(item.invoice_id)) {
            itemsMap.set(item.invoice_id, []);
          }
          itemsMap.get(item.invoice_id).push(item);
        });

        // Combine data
        return invoices.map(invoice => ({
          ...invoice,
          invoice_items: itemsMap.get(invoice.id) || []
        }));

      } catch (error) {
        console.error('Error in useCustomerInvoices:', error);
        const errorMessage = typeof error === 'string' ? error :
                            (error as any)?.message ||
                            'Failed to load customer invoices';
        throw new Error(errorMessage);
      }
    },
    enabled: !!customerId,
  });
};

export const useCreateInvoice = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>) => {
      // Ensure created_by defaults to authenticated user
      const payload: any = { ...invoice };
      try {
        const { data: userData } = await supabase.auth.getUser();
        const authUserId = userData?.user?.id || null;
        if (authUserId) {
          payload.created_by = authUserId;
        } else if (typeof payload.created_by === 'undefined') {
          payload.created_by = null;
        }
      } catch {
        if (typeof payload.created_by === 'undefined') payload.created_by = null;
      }

      let dataRes; let errorRes: any;
      {
        const { data, error } = await supabase
          .from('invoices')
          .insert([payload])
          .select()
          .single();
        dataRes = data; errorRes = error as any;
      }
      if (errorRes && errorRes.code === '23503' && String(errorRes.message || '').includes('created_by')) {
        const retryPayload = { ...payload, created_by: null };
        const { data: retryData, error: retryError } = await supabase
          .from('invoices')
          .insert([retryPayload])
          .select()
          .single();
        dataRes = retryData; errorRes = retryError as any;
      }

      if (errorRes) throw errorRes;
      return dataRes;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
};

// Payments hooks
export const usePayments = (companyId?: string) => {
  return useQuery({
    queryKey: ['payments', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      try {
        // Step 1: Get payments without embedded relationships
        let query = supabase
          .from('payments')
          .select(`
            id,
            company_id,
            customer_id,
            payment_number,
            payment_date,
            amount,
            payment_method,
            reference_number,
            notes,
            created_at,
            updated_at
          `)
          .eq('company_id', companyId)
          .order('created_at', { ascending: false });

        const { data: payments, error: paymentsError } = await query;

        if (paymentsError) {
          console.error('Error fetching payments from Supabase:', paymentsError);
          throw paymentsError;
        }
        if (!payments || payments.length === 0) return [];

        // Step 2: Get customers separately (filter out invalid UUIDs)
        let customers: any[] = [];
        try {
          const customerIds = [...new Set(payments.map(payment => payment.customer_id).filter(id => id && typeof id === 'string' && id.length === 36))];
          if (customerIds.length > 0) {
            const { data, error } = await supabase
              .from('customers')
              .select('id, name, email, phone, address, city, country')
              .in('id', customerIds);
            if (!error && data) {
              customers = data;
            } else if (error) {
              console.warn('Could not fetch customers (non-fatal):', error.message);
            }
          }
        } catch (err) {
          console.warn('Error fetching customers:', err);
        }

        // Step 3: Get payment allocations separately
        let paymentAllocations: any[] = [];
        try {
          const paymentIds = payments.map(payment => payment.id);
          console.log('Fetching payment allocations for payment IDs:', paymentIds.length > 0 ? paymentIds.slice(0, 3) + '...' : 'none');

          const { data, error } = await supabase
            .from('payment_allocations')
            .select(`
              id,
              payment_id,
              invoice_id,
              allocated_amount
            `)
            .in('payment_id', paymentIds);

          if (!error && data) {
            console.log(`✅ Fetched ${data.length} payment allocations`);
            paymentAllocations = data;
          } else if (error) {
            console.warn('⚠️ Could not fetch payment allocations:', error.message);
          }
        } catch (err) {
          console.warn('Error fetching payment allocations:', err);
        }

        // Step 3b: Get invoice details separately to avoid RLS issues with relationships
        let invoiceMap = new Map();
        try {
          if (paymentAllocations.length > 0) {
            const allInvoiceIds = paymentAllocations.map(a => a.invoice_id);
            const nullInvoiceIds = allInvoiceIds.filter(id => !id);
            const validInvoiceIds = [...new Set(allInvoiceIds.filter(Boolean))];

            console.log('Payment allocations:', paymentAllocations);
            console.log('Raw invoice IDs from allocations:', allInvoiceIds);
            console.log('Null/missing invoice IDs:', nullInvoiceIds.length);
            console.log('Valid invoice IDs:', validInvoiceIds);
            console.log('Fetching invoice details for company:', companyId);
            console.log('Total valid invoice IDs to fetch:', validInvoiceIds.length);

            if (validInvoiceIds.length > 0) {
              // Try to fetch invoices by their IDs
              let { data: invoiceData, error: invoiceError } = await supabase
                .from('invoices')
                .select('id, invoice_number, total_amount, company_id')
                .in('id', validInvoiceIds);

              console.log('Invoice fetch result (specific IDs):', {
                success: !invoiceError,
                count: invoiceData?.length || 0,
                error: invoiceError?.message,
                companyId: companyId,
                requestedInvoiceIds: validInvoiceIds,
                fetchedInvoices: invoiceData
              });

              if (!invoiceError && invoiceData && invoiceData.length > 0) {
                console.log(`✅ Fetched ${invoiceData.length} invoice details via ID filter`);
                invoiceData.forEach(invoice => {
                  invoiceMap.set(invoice.id, invoice);
                });
              } else {
                console.warn('⚠️ Invoice ID filter returned no results, trying fallback approach...');

                // Fallback: Fetch all invoices for the company
                const { data: allInvoices, error: allInvoicesError } = await supabase
                  .from('invoices')
                  .select('id, invoice_number, total_amount, company_id')
                  .eq('company_id', companyId);

                console.log('Fallback invoice fetch result (all for company):', {
                  success: !allInvoicesError,
                  count: allInvoices?.length || 0,
                  error: allInvoicesError?.message,
                  companyId: companyId
                });

                if (!allInvoicesError && allInvoices) {
                  // Filter to only the ones we need
                  const matchedInvoices = allInvoices.filter(inv =>
                    validInvoiceIds.includes(inv.id)
                  );
                  console.log(`✅ Fallback matched ${matchedInvoices.length} invoices`);
                  matchedInvoices.forEach(invoice => {
                    invoiceMap.set(invoice.id, invoice);
                  });
                }
              }

              // Log which invoice IDs were not found
              const notFoundIds = validInvoiceIds.filter(id => !invoiceMap.has(id));
              if (notFoundIds.length > 0) {
                console.warn(`⚠️ ${notFoundIds.length} invoice(s) not found:`, notFoundIds);
              }
            } else {
              console.warn('⚠️ No valid invoice IDs to fetch (all are null or empty)');
            }
          }
        } catch (err) {
          console.warn('Error fetching invoice details:', err);
        }

        // Step 4: Create lookup maps
        const customerMap = new Map();
        (customers || []).forEach(customer => {
          customerMap.set(customer.id, customer);
        });

        const allocationsMap = new Map();
        (paymentAllocations || []).forEach(allocation => {
          if (!allocationsMap.has(allocation.payment_id)) {
            allocationsMap.set(allocation.payment_id, []);
          }
          const invoice = invoiceMap.get(allocation.invoice_id);
          console.log(`Allocation ${allocation.id}: invoice_id=${allocation.invoice_id}, found_invoice=${!!invoice}, invoice_number=${invoice?.invoice_number || 'N/A'}`);
          allocationsMap.get(allocation.payment_id).push({
            id: allocation.id,
            invoice_number: invoice?.invoice_number || 'N/A',
            allocated_amount: allocation.allocated_amount,
            invoice_total: invoice?.total_amount || 0
          });
        });

        // Step 5: Combine data
        return payments.map(payment => ({
          ...payment,
          customers: customerMap.get(payment.customer_id) || {
            name: 'Unknown Customer',
            email: null,
            phone: null
          },
          payment_allocations: allocationsMap.get(payment.id) || []
        }));

      } catch (error) {
        console.error('Error in usePayments:', error);

        let errorMessage = 'Failed to load payments';

        // Handle network/fetch errors
        if (error instanceof TypeError) {
          if ((error as any).message?.includes('Failed to fetch')) {
            errorMessage = 'Unable to connect to the server. Please check your internet connection and try again. If the problem persists, the Supabase service may be temporarily unavailable.';
          } else {
            errorMessage = `Network error: ${(error as any).message || 'Failed to fetch data'}`;
          }
        } else if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        } else if (error && typeof error === 'object') {
          errorMessage = (error as any)?.message || JSON.stringify(error);
        }

        throw new Error(errorMessage);
      }
    },
    enabled: !!companyId,
    retry: 3,
    retryDelay: 1000,
  });
};

export const useCustomerPayments = (customerId?: string, companyId?: string) => {
  return useQuery({
    queryKey: ['customer_payments', customerId, companyId],
    queryFn: async () => {
      if (!customerId) return [];

      let query = supabase
        .from('payments')
        .select(`
          *,
          payment_allocations(*, invoices(invoice_number, total_amount))
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });
};

export const useCreatePayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentData: Omit<Payment, 'id' | 'created_at' | 'updated_at'> & { invoice_id: string }) => {
      // Validate UUID fields before insert
      if (!paymentData.company_id || typeof paymentData.company_id !== 'string' || paymentData.company_id.length !== 36) {
        throw new Error('Invalid company ID. Please refresh and try again.');
      }
      if (paymentData.customer_id && (typeof paymentData.customer_id !== 'string' || paymentData.customer_id.length !== 36)) {
        throw new Error('Invalid customer ID. Please select a valid invoice.');
      }
      if (!paymentData.invoice_id || typeof paymentData.invoice_id !== 'string' || paymentData.invoice_id.length !== 36) {
        throw new Error('Invalid invoice ID. Please select a valid invoice.');
      }

      // Skip the database function call and use manual approach directly
      // The record_payment_with_allocation function doesn't exist, so we use fallback
      console.log('Using manual payment recording with allocation');

      // Manual approach (fallback method)
      {

        // Fallback: Manual payment recording with invoice updates
        const { invoice_id, ...paymentFields } = paymentData;

        // 1. Insert payment
        const { data: paymentResult, error: paymentError } = await supabase
          .from('payments')
          .insert([paymentFields])
          .select()
          .single();

        if (paymentError) throw paymentError;

        // 2. Create payment allocation with enhanced error handling
        let allocationError: any = null;
        let allocationCreated = false;

        try {
          // First check if payment_allocations table exists
          console.log('Checking if payment_allocations table exists...');
          const { error: tableCheckError } = await supabase
            .from('payment_allocations')
            .select('id')
            .limit(1);

          if (tableCheckError && tableCheckError.message?.includes('relation') && tableCheckError.message?.includes('does not exist')) {
            allocationError = new Error('payment_allocations table does not exist. Please run the table setup SQL.');
            console.error('RLS/Setup Error:', allocationError.message);
          } else {
            // Table exists, try to insert allocation
            console.log('Inserting allocation:', {
              payment_id: paymentResult.id,
              invoice_id: invoice_id,
              amount_allocated: paymentData.amount
            });

            const { data: insertedAllocation, error: insertError } = await supabase
              .from('payment_allocations')
              .insert([{
                payment_id: paymentResult.id,
                invoice_id: invoice_id,
                amount_allocated: paymentData.amount
              }])
              .select();

            if (insertError) {
              console.error('Allocation insert error:', insertError);
              allocationError = insertError;
            } else if (insertedAllocation && insertedAllocation.length > 0) {
              console.log('Allocation created successfully:', insertedAllocation[0]);
              allocationCreated = true;
            } else {
              console.warn('Allocation insert returned no data');
              allocationError = new Error('Allocation was not created - no response from server');
            }
          }
        } catch (err) {
          console.error('Exception during allocation creation:', err);
          allocationError = err;
        }

        if (allocationError) {
          console.error('❌ Failed to create allocation:', allocationError);
          console.error('Allocation error details:', JSON.stringify(allocationError, null, 2));
          console.error('Payment was recorded successfully, but allocation failed');
          console.error('Payment ID:', paymentResult.id);
          console.error('Invoice ID:', invoice_id);

          // If it's an RLS error, provide specific guidance
          if (allocationError?.message?.includes('row-level security') || allocationError?.message?.includes('permission denied')) {
            console.error('⚠️ RLS Error: User profile may not be linked to a company or RLS policies are blocking the insert');
          }
        } else if (allocationCreated) {
          console.log('✅ Allocation created and linked successfully');
        }

        // 3. Get current invoice data and update balances
        // Note: Use paid_amount and balance_due per database schema
        const { data: invoice, error: fetchError } = await supabase
          .from('invoices')
          .select('id, total_amount, paid_amount, balance_due, status')
          .eq('id', invoice_id)
          .single();

        if (!fetchError && invoice) {
          const newPaidAmount = (invoice.paid_amount || 0) + paymentData.amount;
          const newBalanceDue = Math.max(0, invoice.total_amount - newPaidAmount);
          let newStatus = invoice.status;

          if (newBalanceDue <= 0) {
            newStatus = 'paid';
          } else if (newPaidAmount > 0) {
            newStatus = 'partial';
          }

          const { error: invoiceError } = await supabase
            .from('invoices')
            .update({
              paid_amount: newPaidAmount,
              balance_due: newBalanceDue,
              status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', invoice_id);

          if (invoiceError) {
            console.error('Failed to update invoice balance:', invoiceError);
            // Continue anyway - payment and allocation were recorded
          }
        }

        const result = {
          success: true,
          payment_id: paymentResult.id,
          invoice_id: invoice_id,
          amount_allocated: paymentData.amount,
          allocation_created: allocationCreated,
          fallback_used: true,
          allocation_failed: !allocationCreated,
          allocation_error: allocationError ? {
            message: allocationError?.message || String(allocationError),
            code: (allocationError as any)?.code,
            details: (allocationError as any)?.details
          } : null
        };

        console.log('Payment creation result:', {
          success: result.success,
          payment_id: result.payment_id,
          allocation_created: result.allocation_created,
          allocation_failed: result.allocation_failed,
          invoice_id: result.invoice_id
        });

        return result;
      }
    },
    onSuccess: (result) => {
      // Invalidate multiple cache keys to refresh UI
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', result.invoice_id] });
      queryClient.invalidateQueries({ queryKey: ['customer_invoices'] });
    },
  });
};

// Delete payment hook
export const useDeletePayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentData: { paymentId: string; companyId: string }) => {
      const { paymentId, companyId } = paymentData;

      if (!paymentId || typeof paymentId !== 'string' || paymentId.length !== 36) {
        throw new Error('Invalid payment ID');
      }

      if (!companyId || typeof companyId !== 'string' || companyId.length !== 36) {
        throw new Error('Invalid company ID');
      }

      try {
        // Verify payment exists and belongs to this company before deletion
        console.log('Verifying payment exists:', paymentId);
        const { data: paymentExists, error: verifyError } = await supabase
          .from('payments')
          .select('id, company_id')
          .eq('id', paymentId)
          .eq('company_id', companyId)
          .single();

        if (verifyError) {
          const errorMsg = verifyError?.message || 'Unknown error';
          if (errorMsg.includes('No rows found')) {
            throw new Error('Payment not found or you do not have permission to delete it');
          }
          throw verifyError;
        }

        if (!paymentExists) {
          throw new Error('Payment not found. It may have been deleted already.');
        }
        // Step 1: Get payment allocations to reverse invoices
        console.log('Fetching allocations for payment:', paymentId);
        const { data: allocations, error: allocError } = await supabase
          .from('payment_allocations')
          .select('id, invoice_id, allocated_amount')
          .eq('payment_id', paymentId);

        if (allocError) {
          console.warn('Could not fetch allocations:', allocError);
          console.warn('Allocation fetch error message:', allocError?.message);
          console.warn('Allocation fetch error code:', allocError?.code);
        }

        const allocationsList = allocations || [];
        console.log(`Found ${allocationsList.length} allocation(s) for payment ${paymentId}`);

        // Step 2: Reverse invoice adjustments for each allocation
        if (allocationsList.length > 0) {
          for (const allocation of allocationsList) {
            try {
              // Fetch the invoice for this allocation
              const { data: invoice } = await supabase
                .from('invoices')
                .select('id, total_amount, paid_amount, balance_due, status')
                .eq('id', allocation.invoice_id)
                .single();

              if (invoice) {
                const reversedPaidAmount = Math.max(0, (invoice.paid_amount || 0) - (allocation.allocated_amount || 0));
                const reversedBalanceDue = invoice.total_amount - reversedPaidAmount;

                // Determine new invoice status
                let newStatus = 'draft';
                if (reversedBalanceDue <= 0) {
                  newStatus = 'paid';
                } else if (reversedPaidAmount > 0) {
                  newStatus = 'partial';
                }

                // Update invoice
                const { error: updateError } = await supabase
                  .from('invoices')
                  .update({
                    paid_amount: reversedPaidAmount,
                    balance_due: reversedBalanceDue,
                    status: newStatus,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', allocation.invoice_id);

                if (updateError) {
                  console.warn(`Could not update invoice ${allocation.invoice_id}:`, updateError.message);
                  console.warn(`Details - Invoice was: paid=${invoice.paid_amount}, balance=${invoice.balance_due}, status=${invoice.status}`);
                  console.warn(`Details - Attempted to reverse: paid=${reversedPaidAmount}, balance=${reversedBalanceDue}, status=${newStatus}`);
                  // Continue anyway - don't fail the entire delete
                } else {
                  console.log(`✅ Successfully reversed payment for invoice ${allocation.invoice_id}: ${reversedPaidAmount} → ${reversedBalanceDue} balance`);
                }
              }
            } catch (err) {
              console.warn(`Error processing allocation ${allocation.id}:`, err);
              // Continue to next allocation
            }
          }

          console.log(`Payment deletion: Processed ${allocationsList.length} invoice allocation(s)`);

          // Step 3: Delete payment allocations
          console.log('Deleting payment allocations for payment:', paymentId);
          const { error: deleteAllocError } = await supabase
            .from('payment_allocations')
            .delete()
            .eq('payment_id', paymentId);

          if (deleteAllocError) {
            console.error('Failed to delete payment allocations - Full error:', deleteAllocError);

            // Extract error message properly
            let errorMsg = 'Unknown error';
            if (deleteAllocError?.message) {
              errorMsg = deleteAllocError.message;
            } else if (deleteAllocError?.code) {
              errorMsg = `Error code: ${deleteAllocError.code}`;
            } else if (typeof deleteAllocError === 'string') {
              errorMsg = deleteAllocError;
            } else {
              try {
                errorMsg = JSON.stringify(deleteAllocError);
              } catch {
                errorMsg = String(deleteAllocError);
              }
            }

            if (errorMsg.includes('row-level security') || errorMsg.includes('permission denied')) {
              throw new Error(`You don't have permission to delete payment allocations. Please check your access settings.`);
            }
            throw new Error(`Failed to delete allocations: ${errorMsg}`);
          }
        }

        // Step 4: Delete the payment record
        console.log('Deleting payment:', paymentId);
        const { error: deletePaymentError } = await supabase
          .from('payments')
          .delete()
          .eq('id', paymentId);

        if (deletePaymentError) {
          console.error('Failed to delete payment - Full error object:', deletePaymentError);

          // Extract error message from Supabase error object
          let errorMsg = 'Unknown error';

          if (deletePaymentError?.message) {
            errorMsg = deletePaymentError.message;
          } else if (deletePaymentError?.code) {
            errorMsg = `Error code: ${deletePaymentError.code}`;
          } else if (typeof deletePaymentError === 'string') {
            errorMsg = deletePaymentError;
          } else {
            // Try to stringify and inspect the error
            try {
              errorMsg = JSON.stringify(deletePaymentError);
            } catch {
              errorMsg = String(deletePaymentError);
            }
          }

          console.error('Extracted error message:', errorMsg);

          // Handle specific error types
          if (errorMsg.includes('row-level security') || errorMsg.includes('permission denied')) {
            throw new Error(`You don't have permission to delete this payment. Please check your access settings.`);
          }
          if (errorMsg.includes('FOREIGN KEY') || errorMsg.includes('constraint')) {
            throw new Error(`Cannot delete this payment. It may be referenced by other records. Please try again or contact support.`);
          }
          if (errorMsg.includes('Failed to fetch')) {
            throw new Error(`Network error: Could not reach the server. Please check your connection and try again.`);
          }

          throw new Error(`Failed to delete payment: ${errorMsg}`);
        }

        console.log('Payment deleted successfully:', paymentId);
        return {
          success: true,
          payment_id: paymentId,
          allocations_reversed: allocationsList.length
        };
      } catch (error) {
        console.error('Error in useDeletePayment:', error);
        console.error('Error type:', typeof error);
        console.error('Error constructor:', error?.constructor?.name);

        // Handle different types of errors
        let errorMessage = 'Failed to delete payment';

        if (error instanceof TypeError) {
          // Handle network/fetch errors
          if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Network error: Could not connect to the server. Please check your internet connection and try again.';
          } else {
            errorMessage = `Connection error: ${error.message}`;
          }
        } else if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        } else if (error && typeof error === 'object') {
          // Try to extract message from various error object formats
          const errObj = error as any;
          if (errObj.message) {
            errorMessage = errObj.message;
          } else if (errObj.error?.message) {
            errorMessage = errObj.error.message;
          } else if (errObj.status) {
            errorMessage = `Error (${errObj.status}): ${errObj.statusText || 'Unknown'}`;
          } else {
            try {
              errorMessage = JSON.stringify(errObj);
            } catch {
              errorMessage = String(errObj);
            }
          }
        }

        console.error('Final error message:', errorMessage);
        throw new Error(errorMessage);
      }
    },
    onSuccess: () => {
      // Invalidate caches to refresh UI
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['customer_invoices'] });
      queryClient.invalidateQueries({ queryKey: ['customer_payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    }
  });
};

// Remittance Advice hooks
export const useRemittanceAdvice = (companyId?: string) => {
  return useQuery({
    queryKey: ['remittance_advice', companyId],
    queryFn: async () => {
      let query = supabase
        .from('remittance_advice')
        .select(`
          *,
          customers:customers!customer_id(name, email, address),
          remittance_advice_items(*, payments(payment_number), invoices(invoice_number))
        `)
        .order('created_at', { ascending: false });
      
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    },
  });
};

export const useCreateRemittanceAdvice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (remittance: Omit<RemittanceAdvice, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('remittance_advice')
        .insert([remittance])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remittance_advice'] });
    },
  });
};

export const useUpdateRemittanceAdvice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (remittance: Partial<RemittanceAdvice> & { id: string }) => {
      const { id, ...updateData } = remittance;
      const { data, error } = await supabase
        .from('remittance_advice')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remittance_advice'] });
    },
  });
};

// Remittance Advice Items hooks
export const useCreateRemittanceAdviceItems = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: Array<{
      remittance_advice_id: string;
      document_date: string;
      document_number: string;
      document_type: 'invoice' | 'credit_note' | 'payment';
      invoice_amount?: number;
      credit_amount?: number;
      payment_amount: number;
      payment_id?: string;
      invoice_id?: string;
      sort_order?: number;
    }>) => {
      const { data, error } = await supabase
        .from('remittance_advice_items')
        .insert(items)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remittance_advice'] });
    },
  });
};

export const useUpdateRemittanceAdviceItems = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      remittanceId,
      items
    }: {
      remittanceId: string;
      items: Array<{
        id?: string;
        document_date: string;
        document_number: string;
        document_type: 'invoice' | 'credit_note' | 'payment';
        invoice_amount?: number;
        credit_amount?: number;
        payment_amount: number;
        payment_id?: string;
        invoice_id?: string;
        sort_order?: number;
      }>;
    }) => {
      // First, delete existing items
      await supabase
        .from('remittance_advice_items')
        .delete()
        .eq('remittance_advice_id', remittanceId);

      // Then insert new items
      if (items.length > 0) {
        const itemsToInsert = items.map((item, index) => ({
          remittance_advice_id: remittanceId,
          document_date: item.document_date,
          document_number: item.document_number,
          document_type: item.document_type,
          invoice_amount: item.invoice_amount || null,
          credit_amount: item.credit_amount || null,
          payment_amount: item.payment_amount,
          payment_id: item.payment_id || null,
          invoice_id: item.invoice_id || null,
          sort_order: index + 1,
        }));

        const { data, error } = await supabase
          .from('remittance_advice_items')
          .insert(itemsToInsert)
          .select();

        if (error) throw error;
        return data;
      }
      return [];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remittance_advice'] });
    },
  });
};

// Quotations hooks - Fixed to avoid relationship ambiguity
export const useQuotations = (companyId?: string) => {
  return useQuery({
    queryKey: ['quotations', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      try {
        // Step 1: Get quotations without embedded relationships
        let query = supabase
          .from('quotations')
          .select(`
            id,
            company_id,
            customer_id,
            quotation_number,
            quotation_date,
            valid_until,
            status,
            subtotal,
            tax_amount,
            total_amount,
            notes,
            terms_and_conditions,
            created_at,
            updated_at
          `)
          .eq('company_id', companyId)
          .neq('status', 'deleted')
          .order('created_at', { ascending: false });

        const { data: quotations, error: quotationsError } = await query;

        if (quotationsError) throw quotationsError;
        if (!quotations || quotations.length === 0) return [];

        // Step 2: Get customers separately (filter out invalid UUIDs)
        const customerIds = [...new Set(quotations.map(quotation => quotation.customer_id).filter(id => id && typeof id === 'string' && id.length === 36))];
        const { data: customers } = customerIds.length > 0 ? await supabase
          .from('customers')
          .select('id, name, email, phone, address, city, country')
          .in('id', customerIds) : { data: [] };

        // Step 3: Get quotation items separately
        const { data: quotationItems } = await supabase
          .from('quotation_items')
          .select(`
            id,
            quotation_id,
            product_id,
            description,
            quantity,
            unit_price,
            discount_percentage,
            tax_percentage,
            tax_amount,
            tax_inclusive,
            line_total,
            sort_order,
            section_name,
            section_labor_cost,
            unit_of_measure
          `)
          .in('quotation_id', quotations.map(quot => quot.id));

        // Step 4: Get products for quotation items
        const productIds = [...new Set((quotationItems || []).map(item => item.product_id).filter(id => id))];
        const { data: products } = productIds.length > 0 ? await supabase
          .from('products')
          .select('id, name, unit_of_measure')
          .in('id', productIds) : { data: [] };

        // Step 5: Create lookup maps
        const customerMap = new Map();
        (customers || []).forEach(customer => {
          customerMap.set(customer.id, customer);
        });

        const productMap = new Map();
        (products || []).forEach(product => {
          productMap.set(product.id, product);
        });

        const itemsMap = new Map();
        (quotationItems || []).forEach(item => {
          if (!itemsMap.has(item.quotation_id)) {
            itemsMap.set(item.quotation_id, []);
          }
          itemsMap.get(item.quotation_id).push({
            ...item,
            products: productMap.get(item.product_id) || null
          });
        });

        // Step 6: Combine data
        return quotations.map(quotation => ({
          ...quotation,
          customers: customerMap.get(quotation.customer_id) || {
            name: 'Unknown Customer',
            email: null,
            phone: null,
            address: null,
            city: null,
            country: null
          },
          quotation_items: itemsMap.get(quotation.id) || []
        }));

      } catch (error) {
        const errorDetails = error instanceof Error
          ? { message: error.message, stack: error.stack }
          : (error as any)?.message
          ? { message: (error as any).message }
          : { details: String(error) };

        console.error('Error in useQuotations:', {
          ...errorDetails,
          code: (error as any)?.code,
          status: (error as any)?.status,
          details: error
        });

        const errorMessage = typeof error === 'string' ? error :
                            (error as any)?.message ||
                            'Failed to load quotations';
        throw new Error(errorMessage);
      }
    },
  });
};

export const useCreateQuotation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (quotation: any) => {
      // Ensure created_by defaults to authenticated user
      const payload: any = { ...quotation };
      try {
        const { data: userData } = await supabase.auth.getUser();
        const authUserId = userData?.user?.id || null;
        if (authUserId) {
          payload.created_by = authUserId;
        } else if (typeof payload.created_by === 'undefined') {
          payload.created_by = null;
        }
      } catch {
        if (typeof payload.created_by === 'undefined') payload.created_by = null;
      }

      let dataRes; let errorRes: any;
      {
        const { data, error } = await supabase
          .from('quotations')
          .insert([payload])
          .select()
          .single();
        dataRes = data; errorRes = error as any;
      }
      if (errorRes && errorRes.code === '23503' && String(errorRes.message || '').includes('created_by')) {
        const retryPayload = { ...payload, created_by: null };
        const { data: retryData, error: retryError } = await supabase
          .from('quotations')
          .insert([retryPayload])
          .select()
          .single();
        dataRes = retryData; errorRes = retryError as any;
      }

      if (errorRes) throw errorRes;
      return dataRes;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    },
  });
};

// Delete Quotation (attempt to delete related quotation_items first to avoid FK constraints)
export const useDeleteQuotation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: string }) => {
      // Delete quotation items first (if any)
      try {
        const { error: itemsError } = await supabase
          .from('quotation_items')
          .delete()
          .eq('quotation_id', id);
        if (itemsError) {
          // Log but don't fail on item deletion if the error indicates no rows or unsupported column
          console.warn('Warning deleting quotation_items for quotation', id, itemsError);
        }
      } catch (e) {
        console.warn('Unexpected error deleting quotation_items for quotation', id, e);
      }

      // Now delete the quotation record
      const { error } = await supabase
        .from('quotations')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) {
        // If deletion fails due to schema differences (e.g., missing company_id) or RLS, attempt soft-delete fallback
        const errorMessage = parseErrorMessage(error);
        const message = errorMessage.toLowerCase();
        console.warn('Quotation delete failed, attempting soft-delete fallback:', message);

        if (message.includes('company_id') || message.includes('does not exist') || message.includes('permission') || message.includes('rls')) {
          // Try to mark the quotation as 'deleted' instead of hard deleting
          const { error: updateError } = await supabase
            .from('quotations')
            .update({ status: 'deleted' })
            .eq('id', id)
            .eq('company_id', companyId);

          if (updateError) {
            // If update also fails, throw an error with the proper message
            throw new Error(errorMessage);
          }

          // Soft-delete succeeded; return early
          return;
        }

        // For other errors, throw with proper error message
        throw new Error(errorMessage);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    },
  });
};

// Delete Invoice
export const useDeleteInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Import the handler that will deal with BOQ reversal and inventory
      const { handleInvoiceDelete } = await import('@/utils/handleInvoiceDelete');

      try {
        const result = await handleInvoiceDelete(id);
        console.log('✅ Invoice deletion completed:', result);
        return result;
      } catch (err) {
        // Check if this is an RLS policy issue
        const error = err as any;
        const fullError = JSON.stringify(error);
        const msgLower = (error?.message || '').toLowerCase();

        if (msgLower.includes('company_id') ||
            msgLower.includes('has no field') ||
            msgLower.includes('policy') ||
            msgLower.includes('does not exist')) {
          console.error('🔧 RLS Policy Issue Detected');
          console.error('Error details:', error);
          // Throw a special RLS error that will trigger the fix dialog
          throw new RLSPolicyError(
            `Unable to delete invoice due to RLS policy issue: ${error.message}`,
            true
          );
        }

        const errorMessage = parseErrorMessage(error);
        throw new Error(errorMessage);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices_fixed'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['boqs'] });
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] });
    },
  });
};

// Stock movements hooks
export const useStockMovements = (companyId?: string) => {
  return useQuery({
    queryKey: ['stock_movements', companyId],
    queryFn: async () => {
      let query = supabase
        .from('stock_movements')
        .select(`
          *,
          products(name, product_code, unit_of_measure)
        `)
        .order('created_at', { ascending: false });
      
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    },
  });
};

// Helper function to generate document numbers
export const useGenerateDocumentNumber = () => {
  return useMutation({
    mutationFn: async ({ companyId, type }: { companyId: string; type: 'quotation' | 'invoice' | 'remittance' | 'proforma' }) => {
      const functionName = `generate_${type}_number`;
      const { data, error } = await supabase.rpc(functionName, { company_uuid: companyId });
      
      if (error) throw error;
      return data;
    },
  });
};

// Delivery Notes hooks
export const useDeliveryNotes = (companyId?: string) => {
  return useQuery({
    queryKey: ['delivery_notes', companyId],
    queryFn: async () => {
      let query = supabase
        .from('delivery_notes')
        .select(`
          *,
          customers:customers!customer_id(name, email, phone, address, city, country),
          invoices:invoices!invoice_id(invoice_number, total_amount),
          delivery_note_items(*, products(name, unit_of_measure))
        `)
        .order('created_at', { ascending: false });

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
  });
};

export const useCreateDeliveryNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deliveryNote: Omit<DeliveryNote, 'id' | 'created_at' | 'updated_at'>) => {
      // Validate that delivery note is backed by a sale (invoice)
      if (!deliveryNote.invoice_id) {
        throw new Error('Delivery note must be linked to an existing invoice or sale.');
      }

      // Verify the invoice exists and belongs to the same company
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('id, customer_id, company_id')
        .eq('id', deliveryNote.invoice_id)
        .eq('company_id', deliveryNote.company_id)
        .single();

      if (invoiceError || !invoice) {
        throw new Error('Related invoice not found or does not belong to this company.');
      }

      // Verify customer matches
      if (invoice.customer_id !== deliveryNote.customer_id) {
        throw new Error('Delivery note customer must match the invoice customer.');
      }

      const { data, error } = await supabase
        .from('delivery_notes')
        .insert([deliveryNote])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery_notes'] });
    },
  });
};

export const useUpdateDeliveryNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, companyId, ...deliveryNote }: Partial<DeliveryNote> & { id: string; companyId: string }) => {
      const { data, error } = await supabase
        .from('delivery_notes')
        .update(deliveryNote)
        .eq('id', id)
        .eq('company_id', companyId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery_notes'] });
    },
  });
};

// Dashboard stats hook
export const useDashboardStats = (companyId?: string) => {
  return useQuery({
    queryKey: ['dashboard_stats', companyId],
    queryFn: async () => {
      // Get counts and totals
      const [
        { data: invoices },
        { data: customers },
        { data: products },
        { data: cashReceipts }
      ] = await Promise.all([
        supabase
          .from('invoices')
          .select('total_amount, status')
          .eq('company_id', companyId || '550e8400-e29b-41d4-a716-446655440000'),
        supabase
          .from('customers')
          .select('id')
          .eq('company_id', companyId || '550e8400-e29b-41d4-a716-446655440000'),
        supabase
          .from('products')
          .select('stock_quantity, minimum_stock_level')
          .eq('company_id', companyId || '550e8400-e29b-41d4-a716-446655440000'),
        supabase
          .from('cash_receipts')
          .select('total_amount')
          .eq('company_id', companyId || '550e8400-e29b-41d4-a716-446655440000')
      ]);

      const totalRevenue = invoices?.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) || 0;
      const totalPayments = cashReceipts?.reduce((sum, receipt) => sum + Number(receipt.total_amount || 0), 0) || 0;
      const lowStockProducts = products?.filter(p => p.stock_quantity <= p.minimum_stock_level).length || 0;
      const pendingInvoices = invoices?.filter(inv => inv.status === 'sent').length || 0;

      return {
        totalRevenue,
        totalPayments,
        customerCount: customers?.length || 0,
        productCount: products?.length || 0,
        lowStockProducts,
        pendingInvoices,
        totalInvoices: invoices?.length || 0
      };
    },
  });
};

// ============= LPO Hooks =============

export const useLPOs = (companyId?: string) => {
  return useQuery({
    queryKey: ['lpos', companyId],
    queryFn: async () => {
      let query = supabase
        .from('lpos')
        .select(`
          *,
          suppliers:customers!supplier_id(name, email, phone, address, city, country),
          lpo_items(*, products(name, product_code, unit_of_measure))
        `)
        .order('created_at', { ascending: false });

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
};

export const useLPO = (lpoId?: string, companyId?: string) => {
  return useQuery({
    queryKey: ['lpo', lpoId, companyId],
    queryFn: async () => {
      let query = supabase
        .from('lpos')
        .select(`
          *,
          suppliers:customers!supplier_id(name, email, phone, address, city, country),
          lpo_items(*, products(name, product_code, unit_of_measure))
        `)
        .eq('id', lpoId);

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query.single();

      if (error) throw error;
      return data;
    },
    enabled: !!lpoId,
  });
};

export const useCreateLPO = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lpo, items }: { lpo: Omit<LPO, 'id' | 'created_at' | 'updated_at'>; items: Omit<LPOItem, 'id' | 'lpo_id'>[] }) => {
      // Validate required fields
      if (!lpo.company_id) {
        throw new Error('Company ID is required');
      }
      if (!lpo.supplier_id) {
        throw new Error('Supplier is required');
      }
      if (!lpo.lpo_number) {
        throw new Error('LPO number is required');
      }
      if (!items || items.length === 0) {
        throw new Error('At least one item is required');
      }

      // Create LPO (default created_by to authenticated user if column exists)
      const lpoPayload: any = { ...lpo };
      try {
        const { data: userData } = await supabase.auth.getUser();
        const authUserId = userData?.user?.id || null;
        if (authUserId) {
          lpoPayload.created_by = authUserId;
        } else if (typeof lpoPayload.created_by === 'undefined') {
          lpoPayload.created_by = null;
        }
      } catch {
        if (typeof lpoPayload.created_by === 'undefined') lpoPayload.created_by = null;
      }

      const { data: lpoData, error: lpoError } = await supabase
        .from('lpos')
        .insert([lpoPayload])
        .select()
        .single();

      if (lpoError) throw lpoError;

      // Create LPO items
      if (items.length > 0) {
        const lpoItems = items.map((item, index) => ({
          ...item,
          lpo_id: lpoData.id,
          sort_order: index + 1
        }));

        const { error: itemsError } = await supabase
          .from('lpo_items')
          .insert(lpoItems);

        if (itemsError) throw itemsError;
      }

      return lpoData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lpos'] });
    },
  });
};

export const useUpdateLPO = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LPO> & { id: string }) => {
      const { data, error } = await supabase
        .from('lpos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lpos'] });
      queryClient.invalidateQueries({ queryKey: ['lpo'] });
    },
  });
};

export const useDeleteLPO = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('lpos')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lpos'] });
    },
  });
};

// Generate LPO number
export const useGenerateLPONumber = () => {
  return useMutation({
    mutationFn: async (companyId: string) => {
      if (!companyId) {
        throw new Error('Company ID is required to generate LPO number');
      }

      const { data, error } = await supabase
        .rpc('generate_lpo_number', { company_uuid: companyId });

      if (error) {
        console.error('Error generating LPO number:', error);
        throw new Error(`Failed to generate LPO number: ${error.message}`);
      }

      if (!data) {
        throw new Error('No LPO number was generated');
      }

      return data;
    },
  });
};

// Get suppliers (only customers that are actually used as suppliers in LPOs)
export const useSuppliers = (companyId?: string) => {
  return useQuery({
    queryKey: ['suppliers', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      try {
        // First, get unique supplier IDs from LPOs
        const { data: lpoSuppliers, error: lpoError } = await supabase
          .from('lpos')
          .select('supplier_id')
          .eq('company_id', companyId)
          .not('supplier_id', 'is', null);

        if (lpoError) throw lpoError;

        // Get unique supplier IDs
        const supplierIds = [...new Set(lpoSuppliers?.map(lpo => lpo.supplier_id).filter(Boolean))] || [];

        if (supplierIds.length === 0) {
          // No LPOs exist yet, return empty array instead of all customers
          return [];
        }

        // Get only customers that are actually used as suppliers
        const { data: suppliers, error: suppliersError } = await supabase
          .from('customers')
          .select('*')
          .in('id', supplierIds)
          .eq('is_active', true)
          .eq('company_id', companyId)
          .order('name', { ascending: true });

        if (suppliersError) throw suppliersError;

        return suppliers || [];

      } catch (error) {
        console.error('Error fetching suppliers:', error);
        throw error;
      }
    },
    enabled: !!companyId,
  });
};

// Get potential suppliers (customers that haven't been used as suppliers yet)
export const usePotentialSuppliers = (companyId?: string) => {
  return useQuery({
    queryKey: ['potential_suppliers', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      try {
        // Get all customers for this company
        const { data: allCustomers, error: customersError } = await supabase
          .from('customers')
          .select('*')
          .eq('company_id', companyId)
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (customersError) throw customersError;

        // Get existing supplier IDs from LPOs
        const { data: lpoSuppliers, error: lpoError } = await supabase
          .from('lpos')
          .select('supplier_id')
          .eq('company_id', companyId)
          .not('supplier_id', 'is', null);

        if (lpoError) throw lpoError;

        const existingSupplierIds = new Set(lpoSuppliers?.map(lpo => lpo.supplier_id).filter(Boolean) || []);

        // Return customers that are NOT already suppliers
        return allCustomers?.filter(customer => !existingSupplierIds.has(customer.id)) || [];

      } catch (error) {
        console.error('Error fetching potential suppliers:', error);
        throw error;
      }
    },
    enabled: !!companyId,
  });
};

// Get all suppliers (existing + potential) - for comprehensive supplier selection
export const useAllSuppliersAndCustomers = (companyId?: string) => {
  return useQuery({
    queryKey: ['all_suppliers_customers', companyId],
    queryFn: async () => {
      if (!companyId) return { existing: [], potential: [], all: [] };

      try {
        // Get all customers for this company
        const { data: allCustomers, error: customersError } = await supabase
          .from('customers')
          .select('*')
          .eq('company_id', companyId)
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (customersError) throw customersError;

        // Get existing supplier IDs from LPOs
        const { data: lpoSuppliers, error: lpoError } = await supabase
          .from('lpos')
          .select('supplier_id')
          .eq('company_id', companyId)
          .not('supplier_id', 'is', null);

        if (lpoError) throw lpoError;

        const existingSupplierIds = new Set(lpoSuppliers?.map(lpo => lpo.supplier_id).filter(Boolean) || []);

        const existing = allCustomers?.filter(customer => existingSupplierIds.has(customer.id)) || [];
        const potential = allCustomers?.filter(customer => !existingSupplierIds.has(customer.id)) || [];

        // Add labels to distinguish them
        const existingWithLabels = existing.map(supplier => ({
          ...supplier,
          display_name: `${supplier.name} (Current Supplier)`,
          is_existing_supplier: true
        }));

        const potentialWithLabels = potential.map(customer => ({
          ...customer,
          display_name: `${customer.name} (Customer)`,
          is_existing_supplier: false
        }));

        return {
          existing: existingWithLabels,
          potential: potentialWithLabels,
          all: [...existingWithLabels, ...potentialWithLabels]
        };

      } catch (error) {
        console.error('Error fetching all suppliers and customers:', error);
        throw error;
      }
    },
    enabled: !!companyId,
  });
};

// LPO Items Management Hooks

// Create LPO Item
export const useCreateLPOItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: Omit<LPOItem, 'id'>) => {
      const { data, error } = await supabase
        .from('lpo_items')
        .insert([item])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lpos'] });
      queryClient.invalidateQueries({ queryKey: ['lpo', data.lpo_id] });
    },
  });
};

// Update LPO Item
export const useUpdateLPOItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<LPOItem> }) => {
      const { data, error } = await supabase
        .from('lpo_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lpos'] });
      queryClient.invalidateQueries({ queryKey: ['lpo', data.lpo_id] });
    },
  });
};

// Delete LPO Item
export const useDeleteLPOItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('lpo_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lpos'] });
    },
  });
};

// Update LPO with Items (complete update)
export const useUpdateLPOWithItems = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      lpoId,
      lpoUpdates,
      items
    }: {
      lpoId: string;
      lpoUpdates: Partial<LPO>;
      items: (Omit<LPOItem, 'lpo_id'> & { id?: string })[];
    }) => {
      // Update LPO
      const { data: lpoData, error: lpoError } = await supabase
        .from('lpos')
        .update(lpoUpdates)
        .eq('id', lpoId)
        .select()
        .single();

      if (lpoError) throw lpoError;

      // Get existing items
      const { data: existingItems, error: existingError } = await supabase
        .from('lpo_items')
        .select('id')
        .eq('lpo_id', lpoId);

      if (existingError) throw existingError;

      // Delete all existing items
      if (existingItems && existingItems.length > 0) {
        const { error: deleteError } = await supabase
          .from('lpo_items')
          .delete()
          .eq('lpo_id', lpoId);

        if (deleteError) throw deleteError;
      }

      // Insert new items
      if (items.length > 0) {
        const lpoItems = items.map((item, index) => ({
          ...item,
          id: undefined, // Let database generate new IDs
          lpo_id: lpoId,
          sort_order: index + 1,
        }));

        const { error: itemsError } = await supabase
          .from('lpo_items')
          .insert(lpoItems);

        if (itemsError) throw itemsError;
      }

      return lpoData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lpos'] });
      queryClient.invalidateQueries({ queryKey: ['lpo'] });
    },
  });
};
