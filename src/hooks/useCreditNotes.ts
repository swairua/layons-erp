import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CreditNote {
  id: string;
  company_id: string;
  customer_id: string;
  invoice_id?: string;
  credit_note_number: string;
  credit_note_date: string;
  status: 'draft' | 'sent' | 'applied' | 'cancelled';
  reason?: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  applied_amount: number;
  balance: number;
  affects_inventory: boolean;
  notes?: string;
  terms_and_conditions?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  customers?: {
    name: string;
    email?: string;
    phone?: string;
    customer_code: string;
  };
  credit_note_items?: CreditNoteItem[];
  invoices?: {
    invoice_number: string;
    total_amount: number;
  };
}

export interface CreditNoteItem {
  id: string;
  credit_note_id: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_percentage: number;
  tax_amount: number;
  tax_inclusive: boolean;
  tax_setting_id?: string;
  line_total: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  products?: {
    name: string;
    product_code: string;
    unit_of_measure: string;
  };
}

export interface CreditNoteAllocation {
  id: string;
  credit_note_id: string;
  invoice_id: string;
  allocated_amount: number;
  allocation_date: string;
  notes?: string;
  created_by?: string;
  created_at: string;
}

// Fetch all credit notes for a company
export function useCreditNotes(
  companyId: string | undefined,
  options?: { page?: number; pageSize?: number; search?: string; fetchAll?: boolean }
) {
  const fetchAll = options?.fetchAll ?? true;
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 10;
  const search = options?.search ?? '';
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return useQuery({
    queryKey: ['creditNotes', companyId, fetchAll ? 'all' : page, pageSize, search],
    queryFn: async () => {
      if (!companyId) throw new Error('Company ID is required');

      let query = supabase
        .from('credit_notes')
        .select(`
          *,
          customers!customer_id (
            name,
            email,
            phone,
            customer_code
          ),
          credit_note_items (
            *,
            products!product_id (
              name,
              product_code,
              unit_of_measure
            )
          ),
          invoices!invoice_id (
            invoice_number,
            total_amount
          )
        `, { count: fetchAll ? undefined : 'exact' })
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`credit_note_number.ilike.%${search}%,reason.ilike.%${search}%,customers.name.ilike.%${search}%,customers.email.ilike.%${search}%`);
      }

      if (!fetchAll) {
        query = query.range(from, to);
      }
      const { data, error, count } = await query;

      if (error) throw error;
      return fetchAll
        ? { data: (data as CreditNote[]) || [], total: (data || []).length }
        : { data: (data as CreditNote[]) || [], total: count || 0 };
    },
    enabled: !!companyId,
  });
}

// Fetch credit notes for a specific customer
export function useCustomerCreditNotes(customerId: string | undefined, companyId: string | undefined) {
  return useQuery({
    queryKey: ['customerCreditNotes', customerId, companyId],
    queryFn: async () => {
      if (!customerId || !companyId) throw new Error('Customer ID and Company ID are required');

      const { data, error } = await supabase
        .from('credit_notes')
        .select(`
          *,
          customers!customer_id (
            name,
            email,
            phone,
            customer_code
          ),
          credit_note_items (
            *,
            products!product_id (
              name,
              product_code,
              unit_of_measure
            )
          )
        `)
        .eq('customer_id', customerId)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CreditNote[];
    },
    enabled: !!customerId && !!companyId,
  });
}

// Fetch a single credit note by ID
export function useCreditNote(creditNoteId: string | undefined, companyId: string | undefined) {
  return useQuery({
    queryKey: ['creditNote', creditNoteId, companyId],
    queryFn: async () => {
      if (!creditNoteId) throw new Error('Credit Note ID is required');

      let query = supabase
        .from('credit_notes')
        .select(`
          *,
          customers!customer_id (
            name,
            email,
            phone,
            customer_code
          ),
          credit_note_items (
            *,
            products!product_id (
              name,
              product_code,
              unit_of_measure
            )
          ),
          invoices!invoice_id (
            invoice_number,
            total_amount
          )
        `)
        .eq('id', creditNoteId);

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query.single();

      if (error) throw error;
      return data as CreditNote;
    },
    enabled: !!creditNoteId,
  });
}

// Create a new credit note
export function useCreateCreditNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (creditNote: Omit<CreditNote, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('credit_notes')
        .insert(creditNote)
        .select()
        .single();

      if (error) throw error;
      return data as CreditNote;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['creditNotes'] });
      queryClient.invalidateQueries({ queryKey: ['customerCreditNotes'] });
      toast.success(`Credit note ${data.credit_note_number} created successfully!`);
    },
    onError: (error: any) => {
      console.error('Error creating credit note:', error);
      toast.error('Failed to create credit note. Please try again.');
    },
  });
}

// Update an existing credit note
export function useUpdateCreditNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, companyId, updates }: { id: string; companyId: string; updates: Partial<CreditNote> }) => {
      const { data, error } = await supabase
        .from('credit_notes')
        .update(updates)
        .eq('id', id)
        .eq('company_id', companyId)
        .select()
        .single();

      if (error) throw error;
      return data as CreditNote;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['creditNotes'] });
      queryClient.invalidateQueries({ queryKey: ['creditNote', data.id] });
      queryClient.invalidateQueries({ queryKey: ['customerCreditNotes'] });
      toast.success(`Credit note ${data.credit_note_number} updated successfully!`);
    },
    onError: (error: any) => {
      console.error('Error updating credit note:', error);
      toast.error('Failed to update credit note. Please try again.');
    },
  });
}

// Delete a credit note
export function useDeleteCreditNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: string }) => {
      const { error } = await supabase
        .from('credit_notes')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditNotes'] });
      queryClient.invalidateQueries({ queryKey: ['customerCreditNotes'] });
      toast.success('Credit note deleted successfully!');
    },
    onError: (error: any) => {
      console.error('Error deleting credit note:', error);
      toast.error('Failed to delete credit note. Please try again.');
    },
  });
}

// Generate credit note number
export function useGenerateCreditNoteNumber() {
  return useMutation({
    mutationFn: async (companyId: string) => {
      const { data, error } = await supabase
        .rpc('generate_credit_note_number', { company_uuid: companyId });

      if (error) throw error;
      return data as string;
    },
    onError: (error: any) => {
      console.error('Error generating credit note number:', error);
      toast.error('Failed to generate credit note number. Please try again.');
    },
  });
}

// Fetch credit note allocations
export function useCreditNoteAllocations(creditNoteId: string | undefined) {
  return useQuery({
    queryKey: ['creditNoteAllocations', creditNoteId],
    queryFn: async () => {
      if (!creditNoteId) throw new Error('Credit Note ID is required');

      const { data, error } = await supabase
        .from('credit_note_allocations')
        .select(`
          *,
          invoices!invoice_id (
            invoice_number,
            total_amount,
            balance_due
          )
        `)
        .eq('credit_note_id', creditNoteId)
        .order('allocation_date', { ascending: false });

      if (error) throw error;
      return data as (CreditNoteAllocation & {
        invoices: {
          invoice_number: string;
          total_amount: number;
          balance_due: number;
        };
      })[];
    },
    enabled: !!creditNoteId,
  });
}

// Apply credit note to invoice
export function useApplyCreditNoteToInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      creditNoteId,
      invoiceId,
      amount,
      appliedBy
    }: {
      creditNoteId: string;
      invoiceId: string;
      amount: number;
      appliedBy: string;
    }) => {
      const { data, error } = await supabase
        .rpc('apply_credit_note_to_invoice', {
          credit_note_uuid: creditNoteId,
          invoice_uuid: invoiceId,
          amount_to_apply: amount,
          applied_by_uuid: appliedBy
        });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditNotes'] });
      queryClient.invalidateQueries({ queryKey: ['creditNoteAllocations'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Credit note applied to invoice successfully!');
    },
    onError: (error: any) => {
      console.error('Error applying credit note:', error);
      const errorMessage = error.message || 'Failed to apply credit note to invoice';
      toast.error(errorMessage);
    },
  });
}
