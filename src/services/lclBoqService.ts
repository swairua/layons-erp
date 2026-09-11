import { supabase } from '@/integrations/supabase/client';
import { BOQData } from '@/utils/boqHelper';
import { reconstructHierarchicalDataFromSnapshot } from '@/utils/lclBoqPdfGenerator';
import { generateUniqueInvoiceNumber } from '@/utils/invoiceNumberGenerator';
import { invalidateBOQNumberCache } from '@/utils/boqNumberGenerator';

export interface LCLBOQRecord {
  id?: string;
  company_id: string;
  number: string;
  customer_id?: string | null;
  project_title?: string;
  boq_date?: string;
  items_snapshot?: any;
  notes?: string;
  status?: 'draft' | 'saved';
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  boq_id?: string | null;
}

class LCLBOQService {
  /**
   * Get all LCL BOQs for a company
   */
  async getLCLBOQs(companyId: string): Promise<LCLBOQRecord[]> {
    const { data, error } = await supabase
      .from('lcl_boqs')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as LCLBOQRecord[];
  }

  /**
   * Get the latest (most recent) LCL BOQ for a company
   */
  async getLCLBOQLatest(companyId: string): Promise<LCLBOQRecord | null> {
    const { data, error } = await supabase
      .from('lcl_boqs')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return (data || null) as LCLBOQRecord | null;
  }

  /**
   * Get a single LCL BOQ by ID
   */
  async getLCLBOQ(id: string): Promise<LCLBOQRecord> {
    const { data, error } = await supabase
      .from('lcl_boqs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as LCLBOQRecord;
  }

  /**
   * Save a new or update existing LCL BOQ
   */
  async saveLCLBOQ(boq: LCLBOQRecord): Promise<LCLBOQRecord> {
    const { id, ...data } = boq;

    console.log('saveLCLBOQ called', { id, hasId: !!id, dataKeys: Object.keys(data) });

    if (id) {
      // Update existing
      console.log('Performing UPDATE on lcl_boqs', { id });
      const { data: updated, error } = await supabase
        .from('lcl_boqs')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('UPDATE error on lcl_boqs', { id, error });
        throw error;
      }

      console.log('UPDATE successful', { id, updatedId: updated?.id, updatedAt: updated?.updated_at });

      // Invalidate BOQ number cache when updating
      if (updated?.company_id) {
        invalidateBOQNumberCache(updated.company_id);
      }

      return updated as LCLBOQRecord;
    } else {
      // Create new
      console.log('Performing INSERT on lcl_boqs (no id provided)');
      const { data: created, error } = await supabase
        .from('lcl_boqs')
        .insert({
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('INSERT error on lcl_boqs', { error });
        throw error;
      }

      console.log('INSERT successful', { createdId: created?.id });

      // Invalidate BOQ number cache when creating new LCL BOQ
      if (created?.company_id) {
        invalidateBOQNumberCache(created.company_id);
      }

      return created as LCLBOQRecord;
    }
  }

  /**
   * Delete an LCL BOQ
   */
  async deleteLCLBOQ(id: string): Promise<void> {
    const { error } = await supabase
      .from('lcl_boqs')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Auto-save draft (update or create with status='draft')
   */
  async autosaveLCLBOQDraft(boq: LCLBOQRecord): Promise<LCLBOQRecord> {
    return this.saveLCLBOQ({
      ...boq,
      status: 'draft',
    });
  }

  /**
   * Auto-save draft with upsert logic
   * Maintains a single draft per company by checking for existing draft and updating it
   * rather than creating a new one, avoiding UNIQUE constraint violations
   */
  async autosaveLCLBOQDraftWithUpsert(boq: LCLBOQRecord): Promise<LCLBOQRecord> {
    // Query for existing draft with number='DRAFT' for this company
    const { data: existingDraft } = await supabase
      .from('lcl_boqs')
      .select('id')
      .eq('company_id', boq.company_id)
      .eq('number', 'DRAFT')
      .maybeSingle();

    // If draft exists, update it; otherwise create new one
    if (existingDraft) {
      return this.saveLCLBOQ({
        ...boq,
        id: existingDraft.id,
        status: 'draft',
      });
    } else {
      return this.saveLCLBOQ({
        ...boq,
        status: 'draft',
      });
    }
  }

  /**
   * Save final version (update status to 'saved')
   */
  async saveLCLBOQFinal(boq: LCLBOQRecord): Promise<LCLBOQRecord> {
    return this.saveLCLBOQ({
      ...boq,
      status: 'saved',
    });
  }

  /**
   * Create a corresponding BOQ record from an LCL BOQ
   * Uses upsert logic to handle re-saves (if same number exists, update it)
   * Returns the created/updated BOQ with its ID so the relationship can be tracked
   */
  async createBOQFromLCLBOQ(
    lclBoq: LCLBOQRecord,
    customerData: { name?: string; email?: string; phone?: string; address?: string; city?: string; country?: string } | null,
    createdBy?: string
  ): Promise<BOQData> {
    // Calculate totals from items_snapshot
    const items = lclBoq.items_snapshot || [];
    let subtotal = 0;
    items.forEach((item: any) => {
      const itemTotal = (item.qty || 0) * (item.rate || 0);
      subtotal += itemTotal;
    });

    // Create hierarchical data structure for BOQ
    const boqData = {
      sections: [
        {
          title: 'Items',
          subsections: [
            {
              name: 'A',
              label: 'Items',
              items: items.map((item: any) => ({
                description: item.description,
                quantity: item.qty || 0,
                unit: item.unit || '',
                rate: item.rate || 0,
              })),
            },
          ],
        },
      ],
    };

    const boqRecord: Omit<BOQData, 'id'> = {
      number: lclBoq.number,
      company_id: lclBoq.company_id,
      boq_date: lclBoq.boq_date || new Date().toISOString().split('T')[0],
      project_title: lclBoq.project_title || '',
      client_name: customerData?.name || '',
      client_email: customerData?.email,
      client_phone: customerData?.phone,
      client_address: customerData?.address,
      client_city: customerData?.city,
      client_country: customerData?.country,
      currency: 'KES',
      subtotal,
      tax_amount: 0,
      total_amount: subtotal,
      data: boqData,
      created_by: createdBy,
    };

    let result: BOQData;

    // Check if BOQ already exists by boq_id (for updates)
    if (lclBoq.boq_id) {
      const { data, error } = await supabase
        .from('boqs')
        .update({
          ...boqRecord,
          updated_at: new Date().toISOString(),
        })
        .eq('id', lclBoq.boq_id)
        .select()
        .single();

      if (error) throw error;
      result = data as BOQData;
    } else {
      // Check if BOQ with this number already exists for this company
      const { data: existingBoq } = await supabase
        .from('boqs')
        .select('id')
        .eq('company_id', lclBoq.company_id)
        .eq('number', lclBoq.number)
        .single();

      if (existingBoq) {
        // Update existing BOQ (shouldn't happen if boq_id is set, but fallback)
        const { data, error } = await supabase
          .from('boqs')
          .update({
            ...boqRecord,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingBoq.id)
          .select()
          .single();

        if (error) throw error;
        result = data as BOQData;
      } else {
        // Insert new BOQ
        const { data, error } = await supabase
          .from('boqs')
          .insert([boqRecord])
          .select()
          .single();

        if (error) throw error;
        result = data as BOQData;
      }
    }

    // Invalidate BOQ number cache after creating/updating BOQ
    invalidateBOQNumberCache(lclBoq.company_id);

    return result;
  }
}

export const lclBoqService = new LCLBOQService();

function safeN(v: number | undefined | null): number {
  return typeof v === 'number' && !isNaN(v) ? v : 0;
}

function generateCustomerCode(name: string): string {
  const alphaOnly = name.replace(/[^A-Za-z]/g, '');
  let prefix = alphaOnly.substring(0, 3).toUpperCase() || 'CUS';
  prefix = prefix.padEnd(3, 'X').substring(0, 3);
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const timestamp = Date.now().toString().slice(-4);
  return `${prefix}${randomNum}${timestamp}`.substring(0, 50);
}

export async function convertLCLBOQToInvoice(params: {
  boqId: string;
  companyId: string;
}): Promise<{ id: string; invoice_number: string }> {
  const { boqId, companyId } = params;

  // 1. Fetch BOQ record
  const { data: boq, error: boqError } = await supabase
    .from('boqs')
    .select('*')
    .eq('id', boqId)
    .eq('company_id', companyId)
    .single();

  if (boqError || !boq) {
    throw new Error(`Failed to fetch BOQ: ${boqError?.message || 'Not found'}`);
  }

  if (boq.converted_to_invoice_id) {
    throw new Error('BOQ has already been converted to an invoice');
  }

  // 2. Fetch LCL BOQ record
  const { data: lclBoq, error: lclError } = await supabase
    .from('lcl_boqs')
    .select('*')
    .eq('boq_id', boqId)
    .single();

  if (lclError || !lclBoq) {
    throw new Error(`Failed to fetch LCL BOQ: ${lclError?.message || 'Not found'}`);
  }

  // 3. Reconstruct hierarchical data from snapshot
  if (!lclBoq.items_snapshot || !Array.isArray(lclBoq.items_snapshot) || lclBoq.items_snapshot.length === 0) {
    throw new Error('LCL BOQ has no items in snapshot');
  }

  const hierarchicalData = reconstructHierarchicalDataFromSnapshot(lclBoq.items_snapshot);

  // 4. Find/create customer
  let customerId: string | null = null;
  const clientName = boq.client_name || 'Unknown Client';

  const { data: existingCustomers } = await supabase
    .from('customers')
    .select('id')
    .eq('company_id', companyId)
    .eq('name', clientName)
    .limit(1);

  if (existingCustomers && existingCustomers.length > 0) {
    customerId = existingCustomers[0].id;
  } else {
    const customerPayload = {
      company_id: companyId,
      name: clientName,
      customer_code: generateCustomerCode(clientName),
      email: boq.client_email || null,
      phone: boq.client_phone || null,
      address: boq.client_address || null,
      city: boq.client_city || null,
      country: boq.client_country || null,
      is_active: true,
    };

    const { data: newCustomer, error: customerError } = await supabase
      .from('customers')
      .insert([customerPayload])
      .select()
      .single();

    if (!customerError && newCustomer) {
      customerId = newCustomer.id;
    }
  }

  // 5. Generate invoice number
  const invoiceNumber = await generateUniqueInvoiceNumber(companyId);

  // 6. Get current user
  let createdBy: string | null = null;
  try {
    const { data: userData } = await supabase.auth.getUser();
    createdBy = userData?.user?.id || null;
  } catch {
    createdBy = null;
  }

  // 7. Flatten hierarchy into invoice items
  const invoiceItems: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    unit_of_measure: string;
    section_name: string;
  }> = [];

  let subtotal = 0;

  hierarchicalData.sections.forEach((section) => {
    section.subsections.forEach((subsection) => {
      subsection.items.forEach((item) => {
        const qty = safeN((item as any).qty);
        const rate = safeN((item as any).rate);
        const amount = safeN((item as any).amount) || qty * rate;
        if (qty > 0 || rate > 0) {
          invoiceItems.push({
            description: item.description || '',
            quantity: Math.round(qty),
            unit_price: rate,
            line_total: amount,
            unit_of_measure: item.unit || 'Item',
            section_name: `${section.section_name} - ${subsection.subsection_name}`,
          });
          subtotal += amount;
        }
      });
    });
  });

  if (invoiceItems.length === 0) {
    throw new Error('LCL BOQ has no items with quantity or rate. Cannot convert.');
  }

  // 8. Create invoice
  const totalAmount = subtotal;

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert([
      {
        company_id: companyId,
        customer_id: customerId,
        invoice_number: invoiceNumber,
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'draft',
        subtotal,
        tax_amount: 0,
        total_amount: totalAmount,
        currency: boq.currency || 'KES',
        notes: `Converted from LCL BOQ ${boq.number}`,
        terms_and_conditions: boq.terms_and_conditions || null,
        created_by: createdBy,
        balance_due: totalAmount,
        paid_amount: 0,
        display_as_percentage: false,
      },
    ])
    .select()
    .single();

  if (invoiceError || !invoice) {
    throw new Error(`Failed to create invoice: ${invoiceError?.message || 'Unknown error'}`);
  }

  // 9. Insert invoice items with section_name
  const itemsToInsert = invoiceItems.map((item, index) => ({
    invoice_id: invoice.id,
    product_id: null,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total: item.line_total,
    unit_of_measure: item.unit_of_measure,
    section_name: item.section_name,
    discount_percentage: 0,
    sort_order: index,
  }));

  const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);

  if (itemsError) {
    // Clean up invoice if items fail
    await supabase.from('invoices').delete().eq('id', invoice.id);
    throw new Error(`Failed to create invoice items: ${itemsError?.message || 'Unknown error'}`);
  }

  // 10. Mark BOQ as converted
  const { error: updateError } = await supabase
    .from('boqs')
    .update({
      converted_to_invoice_id: invoice.id,
      converted_at: new Date().toISOString(),
      status: 'converted',
    })
    .eq('id', boqId)
    .eq('company_id', companyId);

  if (updateError) {
    console.error('Failed to mark BOQ as converted:', updateError);
    await supabase.from('invoices').delete().eq('id', invoice.id);
    throw new Error(`Failed to mark BOQ as converted: ${updateError.message}`);
  }

  return { id: invoice.id, invoice_number: invoice.invoice_number };
}
