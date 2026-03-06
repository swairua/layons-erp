import { supabase } from '@/integrations/supabase/client';

export interface BOQDraftData {
  boqNumber: string;
  boqDate: string;
  dueDate: string;
  clientId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerCity?: string;
  customerCountry?: string;
  projectTitle: string;
  contractor: string;
  notes: string;
  termsAndConditions: string;
  showCalculatedValuesInTerms: boolean;
  currency: string;
  sections: any[];
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
}

export interface BOQDraftRecord {
  id: string;
  company_id: string;
  user_id: string;
  number: string;
  boq_date: string;
  due_date: string;
  customer_id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  client_address: string;
  client_city: string;
  client_country: string;
  contractor: string;
  project_title: string;
  currency: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  data: any;
  terms_and_conditions: string;
  show_calculated_values_in_terms: boolean;
  created_at: string;
  updated_at: string;
  last_autosaved_at: string;
}

/**
 * Save or update a BOQ draft to the database.
 * Uses upsert logic (update if exists, insert if new).
 * Only one draft per user per company is allowed.
 */
export async function saveBoqDraft(
  userId: string,
  companyId: string,
  formData: BOQDraftData
): Promise<{ success: boolean; error?: string; draftId?: string }> {
  try {
    if (!userId || !companyId) {
      return { success: false, error: 'User ID and Company ID are required' };
    }

    // Prepare the payload matching the boq_drafts table schema
    const payload = {
      company_id: companyId,
      user_id: userId,
      number: formData.boqNumber || null,
      boq_date: formData.boqDate || null,
      due_date: formData.dueDate || null,
      customer_id: formData.clientId || null,
      client_name: formData.customerName || null,
      client_email: formData.customerEmail || null,
      client_phone: formData.customerPhone || null,
      client_address: formData.customerAddress || null,
      client_city: formData.customerCity || null,
      client_country: formData.customerCountry || null,
      contractor: formData.contractor || null,
      project_title: formData.projectTitle || null,
      currency: formData.currency || 'KES',
      subtotal: formData.subtotal || 0,
      tax_amount: formData.taxAmount || 0,
      total_amount: formData.totalAmount || 0,
      data: {
        sections: formData.sections,
        notes: formData.notes,
      },
      terms_and_conditions: formData.termsAndConditions || null,
      show_calculated_values_in_terms: formData.showCalculatedValuesInTerms || false,
      updated_at: new Date().toISOString(),
      last_autosaved_at: new Date().toISOString(),
    };

    // Use upsert: on conflict (company_id, user_id), update the existing draft
    const { data, error } = await supabase
      .from('boq_drafts')
      .upsert([payload], {
        onConflict: 'company_id,user_id',
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to save BOQ draft:', error);
      return { success: false, error: error.message };
    }

    return { success: true, draftId: data?.id };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error saving BOQ draft:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Load the latest draft for a user and company.
 * Returns null if no draft exists.
 */
export async function loadBoqDraft(
  userId: string,
  companyId: string
): Promise<BOQDraftRecord | null> {
  try {
    if (!userId || !companyId) {
      console.error('User ID and Company ID are required');
      return null;
    }

    const { data, error } = await supabase
      .from('boq_drafts')
      .select('*')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found - this is expected when no draft exists
        return null;
      }
      console.error('Failed to load BOQ draft:', error);
      return null;
    }

    return data as BOQDraftRecord;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error loading BOQ draft:', errorMsg);
    return null;
  }
}

/**
 * Delete a draft from the database.
 * This is called when the user resets/clears the form.
 */
export async function deleteDraft(
  userId: string,
  companyId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!userId || !companyId) {
      return { success: false, error: 'User ID and Company ID are required' };
    }

    const { error } = await supabase
      .from('boq_drafts')
      .delete()
      .eq('user_id', userId)
      .eq('company_id', companyId);

    if (error) {
      console.error('Failed to delete BOQ draft:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error deleting BOQ draft:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Publish a draft by converting it to a finalized BOQ.
 * This moves the draft from boq_drafts to boqs table with status='draft'.
 * The draft is then deleted.
 */
export async function publishDraft(
  draftId: string,
  userId: string,
  companyId: string,
  createdByUserId?: string
): Promise<{ success: boolean; error?: string; boqId?: string }> {
  try {
    if (!draftId) {
      return { success: false, error: 'Draft ID is required' };
    }

    // Load the draft to get its data
    const { data: draft, error: fetchError } = await supabase
      .from('boq_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (fetchError) {
      console.error('Failed to fetch draft for publishing:', fetchError);
      return { success: false, error: 'Draft not found' };
    }

    // Insert into boqs table with status='draft'
    const boqPayload = {
      company_id: draft.company_id,
      number: draft.number,
      boq_date: draft.boq_date,
      due_date: draft.due_date,
      client_name: draft.client_name,
      client_email: draft.client_email,
      client_phone: draft.client_phone,
      client_address: draft.client_address,
      client_city: draft.client_city,
      client_country: draft.client_country,
      contractor: draft.contractor,
      project_title: draft.project_title,
      currency: draft.currency,
      subtotal: draft.subtotal,
      tax_amount: draft.tax_amount,
      total_amount: draft.total_amount,
      attachment_url: null,
      data: draft.data,
      terms_and_conditions: draft.terms_and_conditions,
      created_by: createdByUserId || null,
    };

    const { data: insertedBoq, error: insertError } = await supabase
      .from('boqs')
      .insert([boqPayload])
      .select('id')
      .single();

    if (insertError) {
      console.error('Failed to publish draft:', insertError);
      return { success: false, error: insertError.message };
    }

    // Delete the draft
    const { error: deleteError } = await supabase
      .from('boq_drafts')
      .delete()
      .eq('id', draftId);

    if (deleteError) {
      console.error('Failed to delete draft after publishing:', deleteError);
      // Don't fail the operation, as the BOQ was already created
    }

    return { success: true, boqId: insertedBoq?.id };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error publishing draft:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Check if a user has an unsaved draft for a company.
 * Returns true if draft exists.
 */
export async function hasDraft(
  userId: string,
  companyId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('boq_drafts')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('company_id', companyId);

    if (error) {
      console.error('Failed to check for draft:', error);
      return false;
    }

    return (data?.length ?? 0) > 0;
  } catch (err) {
    console.error('Error checking for draft:', err);
    return false;
  }
}
