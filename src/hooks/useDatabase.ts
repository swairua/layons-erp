import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { parseErrorMessage } from '@/utils/errorHelpers';
import { RLSPolicyError } from '@/utils/RLSError';
import { ensureCompanyImageColumns, ensureQuantityColumnsAreDecimal } from '@/utils/ensureDatabaseColumns';
import { extractBoqNumberFromNotes, fetchBoqProjectTitle } from '@/utils/boqInvoiceLinkage';

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
  const { isAuthenticated, user } = useAuth();

  return useQuery({
    queryKey: ['companies', user?.id],
    enabled: isAuthenticated,
    queryFn: async () => {
      // NOTE: ensureCompanyImageColumns() is now called once at app startup in App.tsx
      // This avoids expensive per-hook RPC calls and improves performance significantly
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
export const useCustomers = (
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
    queryKey: ['customers', companyId, fetchAll ? 'all' : page, pageSize, search],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return { data: [], total: 0 };
      let query = supabase
        .from('customers')
        .select('*', { count: fetchAll ? undefined : 'exact' })
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`name.ilike.%${search}%,customer_code.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
      }

      if (!fetchAll) {
        query = query.range(from, to);
      }
      const { data, error, count } = await query;

      if (error) throw error;
      return fetchAll ? { data: (data as Customer[]) || [], total: (data || []).length } : { data: (data as Customer[]) || [], total: count || 0 };
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
export const useProducts = (
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
    queryKey: ['products', companyId, fetchAll ? 'all' : page, pageSize, search],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          *,
          product_categories(name)
        `, { count: fetchAll ? undefined : 'exact' })
        .order('created_at', { ascending: false });
      
      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      if (search) {
        query = query.or(`name.ilike.%${search}%,product_code.ilike.%${search}%,product_categories.name.ilike.%${search}%`);
      }

      if (!fetchAll) {
        query = query.range(from, to);
      }
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      return fetchAll
        ? { data: data || [], total: (data || []).length }
        : { data: data || [], total: count || 0 };
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
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['tax_settings', companyId],
    enabled: isAuthenticated && !!companyId,
    queryFn: async () => {
      let query = supabase
        .from('tax_settings')
        .select('*')
        .order('created_at', { ascending: false });

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query;

      if (error?.code === 'PGRST205') return [];
      if (error) throw error;
      return data as TaxSetting[];
    },
    retry: false,
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
export const useBOQs = (companyId?: string, selectFields?: string) => {
  return useQuery({
    queryKey: ['boqs', companyId, selectFields],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return [];
      const fields = selectFields || 'id, number, boq_date, due_date, client_name, project_title, currency, exchange_rate, status, total_amount, subtotal, tax_amount, terms_and_conditions, showCalculatedValuesInTerms, client_email, client_phone, client_address, client_city, client_country, contractor, converted_to_invoice_id, created_at, updated_at, data';
      const { data, error } = await supabase
        .from('boqs')
        .select(fields)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};

export interface BOQListFilters {
  page: number;
  pageSize: number;
  search?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  dueStatus?: 'all' | 'overdue' | 'aging' | 'current';
  currency?: string;
  conversionStatus?: 'all' | 'converted' | 'unconverted';
}

const BOQ_LIST_FIELDS = 'id, number, boq_date, due_date, client_name, project_title, currency, exchange_rate, status, total_amount, subtotal, tax_amount, client_email, client_phone, client_address, client_city, client_country, contractor, converted_to_invoice_id, created_at, updated_at, created_by';

const localDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const applyBOQListFilters = (query: any, filters: BOQListFilters) => {
  const search = filters.search?.trim().replace(/[%,()_]/g, '');
  if (search) {
    query = query.or([
      `number.ilike.%${search}%`,
      `client_name.ilike.%${search}%`,
      `contractor.ilike.%${search}%`,
      `project_title.ilike.%${search}%`,
    ].join(','));
  }
  if (filters.dueDateFrom) query = query.gte('due_date', filters.dueDateFrom);
  if (filters.dueDateTo) query = query.lte('due_date', filters.dueDateTo);
  if (filters.currency) query = query.eq('currency', filters.currency);
  if (filters.conversionStatus === 'converted') query = query.not('converted_to_invoice_id', 'is', null);
  if (filters.conversionStatus === 'unconverted') query = query.is('converted_to_invoice_id', null);

  const today = new Date();
  const todayString = localDateString(today);
  const agingEnd = new Date(today);
  agingEnd.setDate(agingEnd.getDate() + 7);
  const agingEndString = localDateString(agingEnd);
  if (filters.dueStatus === 'overdue') query = query.lt('due_date', todayString);
  if (filters.dueStatus === 'aging') query = query.gte('due_date', todayString).lte('due_date', agingEndString);
  if (filters.dueStatus === 'current') query = query.or(`due_date.is.null,due_date.gt.${agingEndString}`);
  return query;
};

export const usePaginatedBOQs = (companyId?: string, filters: BOQListFilters = { page: 1, pageSize: 10 }) => {
  return useQuery({
    queryKey: ['boq-list', companyId, filters],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return { rows: [], total: 0, summary: { overdue: 0, aging: 0, current: 0 } };
      const from = (filters.page - 1) * filters.pageSize;
      const to = from + filters.pageSize - 1;
      const listQuery = applyBOQListFilters(
        supabase.from('boqs').select(BOQ_LIST_FIELDS, { count: 'exact' }).eq('company_id', companyId),
        filters,
      ).order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to);

      const today = new Date();
      const todayString = localDateString(today);
      const agingEnd = new Date(today);
      agingEnd.setDate(agingEnd.getDate() + 7);
      const agingEndString = localDateString(agingEnd);
      const countQuery = (status: 'overdue' | 'aging' | 'current') => {
        let query = supabase.from('boqs').select('id', { count: 'exact', head: true }).eq('company_id', companyId);
        if (status === 'overdue') query = query.lt('due_date', todayString);
        if (status === 'aging') query = query.gte('due_date', todayString).lte('due_date', agingEndString);
        if (status === 'current') query = query.or(`due_date.is.null,due_date.gt.${agingEndString}`);
        return query;
      };

      const [listResult, overdueResult, agingResult, currentResult] = await Promise.all([
        listQuery,
        countQuery('overdue'),
        countQuery('aging'),
        countQuery('current'),
      ]);
      if (listResult.error) throw listResult.error;
      if (overdueResult.error) throw overdueResult.error;
      if (agingResult.error) throw agingResult.error;
      if (currentResult.error) throw currentResult.error;
      return {
        rows: listResult.data || [],
        total: listResult.count || 0,
        summary: {
          overdue: overdueResult.count || 0,
          aging: agingResult.count || 0,
          current: currentResult.count || 0,
        },
      };
    },
  });
};

export const fetchBOQDetails = async (companyId: string, boqId: string) => {
  const { data, error } = await supabase.from('boqs').select('*').eq('company_id', companyId).eq('id', boqId).single();
  if (error) throw error;
  return data;
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
export const useInvoices = (
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
    queryKey: ['invoices', companyId, fetchAll ? 'all' : page, pageSize, search],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return { data: [], total: 0 };

      try {
        // If searching by customer name, first find matching customer IDs
        let matchingCustomerIds: string[] | null = null;
        if (search) {
          const { data: matchedCustomers } = await supabase
            .from('customers')
            .select('id')
            .eq('company_id', companyId)
            .or(`name.ilike.%${search}%,email.ilike.%${search}%`);
          matchingCustomerIds = (matchedCustomers || []).map(c => c.id);
        }

        // Step 1: Get invoices with pagination
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

        if (invoicesError) throw invoicesError;
        if (!invoices || invoices.length === 0) {
          return { data: [], total: count || 0 };
        }

        // Step 2: Get customers
        const customerIds = [...new Set(invoices.map(invoice => invoice.customer_id).filter(id => id && typeof id === 'string' && id.length === 36))];
        const { data: customers } = customerIds.length > 0 ? await supabase
          .from('customers')
          .select('id, name, email, phone, address, city, country')
          .in('id', customerIds) : { data: [] };

        // Step 3: Get invoice items for paginated invoices only
        const invoiceIds = invoices.map(inv => inv.id);
        const { data: invoiceItems } = invoiceIds.length > 0 ? await supabase
          .from('invoice_items')
          .select(`
            id, invoice_id, product_id, description, quantity, unit_price,
            discount_before_vat, tax_percentage, tax_amount, tax_inclusive,
            line_total, sort_order, section_name, section_labor_cost,
            unit_of_measure, products(id, name, product_code, unit_of_measure)
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
        const enrichedInvoices = invoices.map(invoice => ({
          ...invoice,
          customers: customerMap.get(invoice.customer_id) || {
            name: 'Unknown Customer',
            email: null,
            phone: null
          },
          invoice_items: itemsMap.get(invoice.id) || []
        }));

        return { data: enrichedInvoices, total: count || 0 };

      } catch (error) {
        console.error('Error in useInvoices:', error);
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
export const usePayments = (
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
    queryKey: ['payments', companyId, fetchAll ? 'all' : page, pageSize, search],
    queryFn: async () => {
      if (!companyId) return { data: [], total: 0 };

      try {
        // If searching by customer name, first find matching customer IDs
        let matchingCustomerIds: string[] | null = null;
        if (search) {
          const { data: matchedCustomers } = await supabase
            .from('customers')
            .select('id')
            .eq('company_id', companyId)
            .or(`name.ilike.%${search}%,email.ilike.%${search}%`);
          matchingCustomerIds = (matchedCustomers || []).map(c => c.id);
        }

        // Step 1: Get payments with pagination
        let query = supabase
          .from('payments')
          .select(`
            id, company_id, customer_id, payment_number, payment_date,
            amount, currency, exchange_rate, payment_method, reference_number, notes, created_at, updated_at
          `, { count: fetchAll ? undefined : 'exact' })
          .eq('company_id', companyId)
          .order('payment_date', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: false });

        if (search) {
          if (matchingCustomerIds && matchingCustomerIds.length > 0) {
            query = query.or(`payment_number.ilike.%${search}%,customer_id.in.(${matchingCustomerIds.join(',')})`);
          } else {
            query = query.ilike('payment_number', `%${search}%`);
          }
        }

        if (!fetchAll) {
          query = query.range(from, to);
        }

        const { data: payments, error: paymentsError, count } = await query;

        if (paymentsError) throw paymentsError;
        if (!payments || payments.length === 0) {
          return { data: [], total: count || 0 };
        }

        // Step 2: Get customers
        let customers: any[] = [];
        try {
          const customerIds = [...new Set(payments.map(p => p.customer_id).filter(id => id && typeof id === 'string' && id.length === 36))];
          if (customerIds.length > 0) {
            const { data, error } = await supabase
              .from('customers')
              .select('id, name, email, phone, address, city, country')
              .in('id', customerIds);
            if (!error && data) customers = data;
          }
        } catch (err) {
          console.warn('Error fetching customers:', err);
        }

        // Step 3: Get payment allocations
        let paymentAllocations: any[] = [];
        try {
          const paymentIds = payments.map(p => p.id);
          const { data, error } = await supabase
            .from('payment_allocations')
            .select(`id, payment_id, invoice_id, amount_allocated, created_at`)
            .in('payment_id', paymentIds);
          if (!error && data) paymentAllocations = data;
        } catch (err) {
          console.warn('Error fetching payment allocations:', err);
        }

        // Step 3b: Get invoice details
        let invoiceMap = new Map();
        try {
          if (paymentAllocations.length > 0) {
            const validInvoiceIds = [...new Set(paymentAllocations.map(a => a.invoice_id).filter(Boolean))];
            if (validInvoiceIds.length > 0) {
              const { data: invoiceData, error: invoiceError } = await supabase
                .from('invoices')
                .select('id, invoice_number, notes, total_amount, paid_amount, balance_due, company_id')
                .in('id', validInvoiceIds);

              if (!invoiceError && invoiceData && invoiceData.length > 0) {
                invoiceData.forEach(invoice => invoiceMap.set(invoice.id, invoice));
              }

              // BOQ project titles
              const boqNumbers = [...new Set(
                [...invoiceMap.values()]
                  .map(invoice => extractBoqNumberFromNotes(invoice.notes))
                  .filter((boqNumber): boqNumber is string => Boolean(boqNumber))
              )];
              const boqProjectTitles = new Map<string, string | null>();
              await Promise.all(boqNumbers.map(async boqNumber => {
                boqProjectTitles.set(boqNumber, await fetchBoqProjectTitle(boqNumber, companyId));
              }));
              invoiceMap.forEach(invoice => {
                const boqNumber = extractBoqNumberFromNotes(invoice.notes);
                invoice.project_title = boqNumber ? boqProjectTitles.get(boqNumber) || null : null;
              });
            }
          }
        } catch (err) {
          console.warn('Error fetching invoice details:', err);
        }

        // Step 4: Create lookup maps
        const customerMap = new Map();
        (customers || []).forEach(c => customerMap.set(c.id, c));

        const allocationsMap = new Map();
        (paymentAllocations || []).forEach(allocation => {
          if (!allocationsMap.has(allocation.payment_id)) allocationsMap.set(allocation.payment_id, []);
          const invoice = invoiceMap.get(allocation.invoice_id);
          allocationsMap.get(allocation.payment_id).push({
            id: allocation.id,
            invoice_number: invoice?.invoice_number || 'N/A',
            project_title: invoice?.project_title || null,
            allocated_amount: Number(allocation.amount_allocated || 0),
            invoice_total: Number(invoice?.total_amount || 0),
            paid_amount: Number(invoice?.paid_amount || 0),
            balance_due: Number(invoice?.balance_due || 0),
            allocation_created_at: allocation.created_at || null,
            invoice_id: allocation.invoice_id || null
          });
        });

        // Step 5: Combine data
        const enrichedPayments = payments.map(payment => ({
          ...payment,
          customers: customerMap.get(payment.customer_id) || { name: 'Unknown Customer', email: null, phone: null },
          payment_allocations: allocationsMap.get(payment.id) || []
        }));

        return { data: enrichedPayments, total: count || 0 };

      } catch (error) {
        let errorMessage = 'Failed to load payments';
        if (error instanceof TypeError) {
          errorMessage = (error as any).message?.includes('Failed to fetch')
            ? 'Unable to connect to the server. Please check your internet connection.'
            : `Network error: ${(error as any).message || 'Failed to fetch data'}`;
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

/**
 * Hook for payment summary stats (today's total, month total, month count) across ALL payments.
 * Uses server-side aggregation instead of filtering paginated data.
 */
export const usePaymentSummary = (companyId?: string) => {
  return useQuery({
    queryKey: ['payment_summary', companyId],
    queryFn: async () => {
      if (!companyId) return { todayTotal: 0, monthTotal: 0, monthCount: 0 };

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthStr = monthStart.toISOString().split('T')[0];

      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const monthEndStr = monthEnd.toISOString().split('T')[0];

      const [todayResult, monthResult, monthCountResult] = await Promise.all([
        supabase
          .from('payments')
          .select('amount')
          .eq('company_id', companyId)
          .eq('payment_date', todayStr),
        supabase
          .from('payments')
          .select('amount')
          .eq('company_id', companyId)
          .gte('payment_date', monthStr)
          .lte('payment_date', monthEndStr),
        supabase
          .from('payments')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .gte('payment_date', monthStr)
          .lte('payment_date', monthEndStr),
      ]);

      const todayTotal = (todayResult.data || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const monthTotal = (monthResult.data || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      return {
        todayTotal,
        monthTotal,
        monthCount: monthCountResult.count || 0,
      };
    },
    enabled: !!companyId,
    staleTime: 60000,
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
          const { error: tableCheckError } = await supabase
            .from('payment_allocations')
            .select('id')
            .limit(1);

          if (tableCheckError && tableCheckError.message?.includes('relation') && tableCheckError.message?.includes('does not exist')) {
            allocationError = new Error('payment_allocations table does not exist. Please run the table setup SQL.');
          } else {
            // Table exists, try to insert allocation

            const { data: insertedAllocation, error: insertError } = await supabase
              .from('payment_allocations')
              .insert([{
                payment_id: paymentResult.id,
                invoice_id: invoice_id,
                amount_allocated: paymentData.amount
              }])
              .select();

            if (insertError) {
              allocationError = insertError;
            } else if (insertedAllocation && insertedAllocation.length > 0) {
              allocationCreated = true;
            } else {
              allocationError = new Error('Allocation was not created - no response from server');
            }
          }
        } catch (err) {
          console.error('Exception during allocation creation:', err);
          allocationError = err;
        }

        if (allocationError || !allocationCreated) {
          await supabase.from('payments').delete().eq('id', paymentResult.id);
          throw new Error(`Payment was not recorded because invoice allocation failed: ${allocationError?.message || 'allocation returned no row'}`);
        }

        // Derive the invoice balance from its current allocation total so repeated
        // payments cannot overwrite each other with stale invoice fields.
        const { data: allocations, error: allocationsError } = await supabase
          .from('payment_allocations')
          .select('amount_allocated')
          .eq('invoice_id', invoice_id);

        if (allocationsError) {
          await supabase.from('payment_allocations').delete().eq('payment_id', paymentResult.id);
          await supabase.from('payments').delete().eq('id', paymentResult.id);
          throw allocationsError;
        }

        const { data: invoice, error: fetchError } = await supabase
          .from('invoices')
          .select('id, total_amount')
          .eq('id', invoice_id)
          .single();

        if (fetchError || !invoice) {
          await supabase.from('payment_allocations').delete().eq('payment_id', paymentResult.id);
          await supabase.from('payments').delete().eq('id', paymentResult.id);
          throw fetchError || new Error('Invoice not found');
        }

        const paidAmount = (allocations || []).reduce(
          (sum, allocation) => sum + Number(allocation.amount_allocated || 0),
          0
        );
        const balanceDue = invoice.total_amount - paidAmount;
        const status = balanceDue <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'draft';

        const { error: invoiceError } = await supabase
          .from('invoices')
          .update({
            paid_amount: paidAmount,
            balance_due: balanceDue,
            status,
            updated_at: new Date().toISOString()
          })
          .eq('id', invoice_id);

        if (invoiceError) {
          await supabase.from('payment_allocations').delete().eq('payment_id', paymentResult.id);
          await supabase.from('payments').delete().eq('id', paymentResult.id);
          throw invoiceError;
        }

        const result = {
          success: true,
          payment_id: paymentResult.id,
          invoice_id: invoice_id,
          amount_allocated: paymentData.amount,
          allocation_created: true,
          fallback_used: true,
          allocation_failed: false,
          allocation_error: null
        };

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
                }
              }
            } catch (err) {
              console.warn(`Error processing allocation ${allocation.id}:`, err);
              // Continue to next allocation
            }
          }

          // Step 3: Delete payment allocations
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
            try {
              errorMsg = JSON.stringify(deletePaymentError);
            } catch {
              errorMsg = String(deletePaymentError);
            }
          }

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
export const useRemittanceAdvice = (
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
    queryKey: ['remittance_advice', companyId, fetchAll ? 'all' : page, pageSize, search],
    queryFn: async () => {
      let query = supabase
        .from('remittance_advice')
        .select(`
          *,
          customers:customers!customer_id(name, email, address),
          remittance_advice_items(*, payments(payment_number), invoices(invoice_number))
        `, { count: fetchAll ? undefined : 'exact' })
        .order('created_at', { ascending: false });
      
      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      if (search) {
        query = query.or(`advice_number.ilike.%${search}%,customers.name.ilike.%${search}%`);
      }

      if (!fetchAll) {
        query = query.range(from, to);
      }
      const { data, error, count } = await query;
      
      if (error) throw error;
      return fetchAll
        ? { data: data || [], total: (data || []).length }
        : { data: data || [], total: count || 0 };
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
export const useQuotations = (
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
    queryKey: ['quotations', companyId, fetchAll ? 'all' : page, pageSize, search],
    queryFn: async () => {
      if (!companyId) return { data: [], total: 0 };

      try {
        // If searching by customer name, first find matching customer IDs
        let matchingCustomerIds: string[] | null = null;
        if (search) {
          const { data: matchedCustomers } = await supabase
            .from('customers')
            .select('id')
            .eq('company_id', companyId)
            .or(`name.ilike.%${search}%,email.ilike.%${search}%`);
          matchingCustomerIds = (matchedCustomers || []).map(c => c.id);
        }

        // Step 1: Get quotations with pagination
        let query = supabase
          .from('quotations')
          .select(`
            id, company_id, customer_id, quotation_number, quotation_date,
            valid_until, status, subtotal, tax_amount, total_amount,
            currency, exchange_rate, notes, terms_and_conditions, created_at, updated_at
          `, { count: fetchAll ? undefined : 'exact' })
          .eq('company_id', companyId)
          .neq('status', 'deleted')
          .order('created_at', { ascending: false });

        if (search) {
          if (matchingCustomerIds && matchingCustomerIds.length > 0) {
            query = query.or(`quotation_number.ilike.%${search}%,customer_id.in.(${matchingCustomerIds.join(',')})`);
          } else {
            query = query.ilike('quotation_number', `%${search}%`);
          }
        }

        if (!fetchAll) {
          query = query.range(from, to);
        }

        const { data: quotations, error: quotationsError, count } = await query;

        if (quotationsError) throw quotationsError;
        if (!quotations || quotations.length === 0) {
          return { data: [], total: count || 0 };
        }

        // Step 2: Get customers
        const customerIds = [...new Set(quotations.map(q => q.customer_id).filter(id => id && typeof id === 'string' && id.length === 36))];
        const { data: customers } = customerIds.length > 0 ? await supabase
          .from('customers')
          .select('id, name, email, phone, address, city, country')
          .in('id', customerIds) : { data: [] };

        // Step 3: Get quotation items
        const quotationIds = quotations.map(q => q.id);
        const { data: quotationItems } = quotationIds.length > 0 ? await supabase
          .from('quotation_items')
          .select(`
            id, quotation_id, product_id, description, quantity, unit_price,
            discount_percentage, tax_percentage, tax_amount, tax_inclusive,
            line_total, sort_order, section_name, section_labor_cost, unit_of_measure
          `)
          .in('quotation_id', quotationIds) : { data: [] };

        // Step 4: Get products
        const productIds = [...new Set((quotationItems || []).map(item => item.product_id).filter(id => id))];
        const { data: products } = productIds.length > 0 ? await supabase
          .from('products')
          .select('id, name, unit_of_measure')
          .in('id', productIds) : { data: [] };

        // Step 5: Create lookup maps
        const customerMap = new Map();
        (customers || []).forEach(c => customerMap.set(c.id, c));

        const productMap = new Map();
        (products || []).forEach(p => productMap.set(p.id, p));

        const itemsMap = new Map();
        (quotationItems || []).forEach(item => {
          if (!itemsMap.has(item.quotation_id)) itemsMap.set(item.quotation_id, []);
          itemsMap.get(item.quotation_id).push({ ...item, products: productMap.get(item.product_id) || null });
        });

        // Step 6: Combine data
        const enrichedQuotations = quotations.map(quotation => ({
          ...quotation,
          customers: customerMap.get(quotation.customer_id) || { name: 'Unknown Customer', email: null, phone: null, address: null, city: null, country: null },
          quotation_items: itemsMap.get(quotation.id) || []
        }));

        return { data: enrichedQuotations, total: count || 0 };

      } catch (error) {
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
    mutationFn: async ({ id, companyId }: { id: string; companyId: string }) => {
      // Import the handler that will deal with BOQ reversal and inventory
      const { handleInvoiceDelete } = await import('@/utils/handleInvoiceDelete');

      try {
        const result = await handleInvoiceDelete(id, companyId);
        return result;
      } catch (err) {
        const error = err as any;
        const msgLower = (error?.message || '').toLowerCase();

        console.error('Invoice delete error:', error);

        const isTrueRLS =
          msgLower.includes('row level security') ||
          msgLower.includes('violates policy') ||
          msgLower.includes('permission denied') ||
          msgLower.includes('insufficient privilege');

        if (isTrueRLS) {
          console.error('🔧 RLS Policy Issue Detected');
          throw new RLSPolicyError(
            `Unable to delete invoice due to RLS policy issue: ${error.message}`,
            true
          );
        }

        const errorMessage = parseErrorMessage(error);
        throw new Error(errorMessage);
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices_fixed'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['boqs'] });
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] });
      queryClient.invalidateQueries({ queryKey: ['invoice_summary', variables.companyId] });
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
export const useDeliveryNotes = (
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
    queryKey: ['delivery_notes', companyId, page, pageSize, search],
    queryFn: async () => {
      let query = supabase
        .from('delivery_notes')
        .select(`
          *,
          customers:customers!customer_id(name, email, phone, address, city, country),
          invoices:invoices!invoice_id(invoice_number, total_amount),
          delivery_note_items(*, products(name, unit_of_measure))
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      if (search) {
        query = query.or(`delivery_note_number.ilike.%${search}%,delivery_number.ilike.%${search}%,tracking_number.ilike.%${search}%,customers.name.ilike.%${search}%`);
      }

      if (!fetchAll) {
        query = query.range(from, to);
      }
      const { data, error, count } = await query;

      if (error) throw error;
      return { data: data || [], total: count || 0 };
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
export const useDashboardStats = (companyId?: string, month?: number, year?: number) => {
  return useQuery({
    queryKey: ['dashboard_stats', companyId, month, year],
    queryFn: async () => {
      const [
        { data: invoices },
        { data: customers },
        { data: products }
      ] = await Promise.all([
        supabase
          .from('invoices')
          .select('total_amount, paid_amount, balance_due, status, invoice_date')
          .eq('company_id', companyId || '550e8400-e29b-41d4-a716-446655440000'),
        supabase
          .from('customers')
          .select('id')
          .eq('company_id', companyId || '550e8400-e29b-41d4-a716-446655440000'),
        supabase
          .from('products')
          .select('stock_quantity, minimum_stock_level')
          .eq('company_id', companyId || '550e8400-e29b-41d4-a716-446655440000')
      ]);

      const filterByMonth = (item: any, dateField: string) => {
        if (!month || !year) return true;
        const date = new Date(item[dateField]);
        return date.getMonth() === month && date.getFullYear() === year;
      };

      const filteredInvoices = invoices?.filter(inv => filterByMonth(inv, 'invoice_date')) || [];

      const totalRevenue = filteredInvoices
        .filter(inv => inv.status !== 'draft')
        .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);

      const totalPayments = filteredInvoices.reduce((sum, inv) => sum + Number(inv.paid_amount || 0), 0);

      const outstandingAmount = filteredInvoices.reduce((sum, inv) => sum + Number(inv.balance_due || 0), 0);

      const lowStockProducts = products?.filter(p => Number(p.stock_quantity) <= Number(p.minimum_stock_level)).length || 0;
      const pendingInvoices = filteredInvoices.filter(inv => inv.status === 'sent').length;

      return {
        totalRevenue,
        totalPayments,
        outstandingAmount,
        customerCount: customers?.length || 0,
        productCount: products?.length || 0,
        lowStockProducts,
        pendingInvoices,
        totalInvoices: filteredInvoices.length
      };
    },
  });
};

// ============= LPO Hooks =============

export const useLPOs = (
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
    queryKey: ['lpos', companyId, fetchAll ? 'all' : page, pageSize, search],
    queryFn: async () => {
      let query = supabase
        .from('lpos')
        .select(`
          *,
          suppliers:customers!supplier_id(name, email, phone, address, city, country),
          lpo_items(*, products(name, product_code, unit_of_measure))
        `, { count: fetchAll ? undefined : 'exact' })
        .order('created_at', { ascending: false });

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      if (search) {
        query = query.or(`lpo_number.ilike.%${search}%,notes.ilike.%${search}%,suppliers.name.ilike.%${search}%`);
      }

      if (!fetchAll) {
        query = query.range(from, to);
      }
      const { data, error, count } = await query;

      if (error) throw error;
      return fetchAll ? { data: data || [], total: (data || []).length } : { data: data || [], total: count || 0 };
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
