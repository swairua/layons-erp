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
  attachmentUrl?: string;
  boqStatus?: string;
}

export interface BOQDraftRecord {
  id: string;
  company_id: string;
  user_id: string;
  draft_token: string;
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
  showCalculatedValuesInTerms: boolean;
  attachment_url?: string;
  status?: string;
  created_at: string;
  updated_at: string;
  last_autosaved_at: string;
}

/**
 * Save or update a BOQ draft to the database.
 * For create drafts (boq_id=null), uses draft_token to support multiple
 * concurrent create sessions per user/company.
 * When draftToken is provided, the draft is scoped to that token.
 */
export async function saveBoqDraft(
  userId: string,
  companyId: string,
  formData: BOQDraftData,
  draftToken?: string,
  existingDraftId?: string
): Promise<{ success: boolean; error?: string; draftId?: string }> {
  try {
    if (!userId || !companyId) {
      return { success: false, error: 'User ID and Company ID are required' };
    }

    console.log(`[saveBoqDraft] Attempting save for company: ${companyId}, user: ${userId}, token: ${draftToken || '(default)'}`);

    // Prepare the payload matching the boq_drafts table schema
    const payload: Record<string, any> = {
      company_id: companyId,
      user_id: userId,
      boq_id: null,
      number: formData.boqNumber || null,
      boq_date: formData.boqDate || null,
      due_date: formData.dueDate || null,
      customer_id: formData.clientId || null,
      client_name: formData.customerName || null,
      client_email: formData.customerEmail || null,
      client_phone: formData.customerPhone || null,
      client_address: formData.customerAddress || null,
      client_city: formData.clientCity || null,
      client_country: formData.clientCountry || null,
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

    if (formData.attachmentUrl) payload.attachment_url = formData.attachmentUrl;
    if (formData.boqStatus) payload.status = formData.boqStatus;
    if (draftToken) payload.draft_token = draftToken;

    let draftId: string | undefined;

    if (existingDraftId) {
      const { data, error } = await supabase
        .from('boq_drafts')
        .update(payload)
        .eq('id', existingDraftId)
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .is('boq_id', null)
        .select('id')
        .single();
      if (error) {
        const errorMsg = error instanceof Error ? error.message : (error?.message || JSON.stringify(error));
        return { success: false, error: errorMsg };
      }
      draftId = data?.id;
    } else if (draftToken) {
      // Scoped lookup by draft_token
      const { data: existingDraft, error: fetchError } = await supabase
        .from('boq_drafts')
        .select('id')
        .eq('draft_token', draftToken)
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .is('boq_id', null)
        .maybeSingle();

      if (fetchError) {
        const errorMsg = fetchError instanceof Error ? fetchError.message : (fetchError?.message || JSON.stringify(fetchError));
        console.error('[saveBoqDraft] Failed to check existing draft:', errorMsg);
        return { success: false, error: errorMsg };
      }

      if (existingDraft?.id) {
        const { data, error } = await supabase
          .from('boq_drafts')
          .update(payload)
          .eq('id', existingDraft.id)
          .select('id')
          .single();

        if (error) {
          const errorMsg = error instanceof Error ? error.message : (error?.message || JSON.stringify(error));
          console.error('[saveBoqDraft] Update failed:', errorMsg);
          return { success: false, error: errorMsg };
        }
        draftId = data?.id;
      } else {
        const { data, error } = await supabase
          .from('boq_drafts')
          .insert([payload])
          .select('id')
          .single();

        if (error) {
          const errorMsg = error instanceof Error ? error.message : (error?.message || JSON.stringify(error));
          console.error('[saveBoqDraft] Insert failed:', errorMsg);
          return { success: false, error: errorMsg };
        }
        draftId = data?.id;
      }
    } else {
      // Fallback: single-slot lookup (backward compat, no draft token)
      const { data: existingDraft, error: fetchError } = await supabase
        .from('boq_drafts')
        .select('id')
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .is('boq_id', null)
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        const errorMsg = fetchError instanceof Error ? fetchError.message : (fetchError?.message || JSON.stringify(fetchError));
        console.error('[saveBoqDraft] Failed to check existing draft:', errorMsg);
        return { success: false, error: errorMsg };
      }

      if (existingDraft?.id) {
        const { data, error } = await supabase
          .from('boq_drafts')
          .update(payload)
          .eq('id', existingDraft.id)
          .select('id')
          .single();

        if (error) {
          const errorMsg = error instanceof Error ? error.message : (error?.message || JSON.stringify(error));
          console.error('[saveBoqDraft] Update failed:', errorMsg);
          return { success: false, error: errorMsg };
        }
        draftId = data?.id;
      } else {
        const { data, error } = await supabase
          .from('boq_drafts')
          .insert([payload])
          .select('id')
          .single();

        if (error) {
          const errorMsg = error instanceof Error ? error.message : (error?.message || JSON.stringify(error));
          console.error('[saveBoqDraft] Insert failed:', errorMsg);
          return { success: false, error: errorMsg };
        }
        draftId = data?.id;
      }
    }

    console.log(`[saveBoqDraft] Successfully saved/updated draft with ID: ${draftId}`);
    return { success: true, draftId };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[saveBoqDraft] Unexpected error:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Load a draft for a user and company.
 * If draftToken is provided, loads the draft for that specific token.
 * Otherwise loads the most recent create draft (backward compat).
 * Returns null if no draft exists.
 */
export async function loadBoqDraft(
  userId: string,
  companyId: string,
  draftToken?: string
): Promise<BOQDraftRecord | null> {
  try {
    if (!userId || !companyId) {
      console.error('User ID and Company ID are required');
      return null;
    }

    console.log(`[loadBoqDraft] Attempting to load draft for user: ${userId}, company: ${companyId}, token: ${draftToken || '(any)'}`);

    let query = supabase
      .from('boq_drafts')
      .select('*')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .is('boq_id', null);

    if (draftToken) {
      query = query.eq('draft_token', draftToken);
    }

    const { data, error } = await query
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      const errorMsg = error instanceof Error ? error.message : (error?.message || JSON.stringify(error));
      console.error('[loadBoqDraft] Query error:', errorMsg);
      return null;
    }

    if (!data || data.length === 0) {
      console.log('[loadBoqDraft] No draft found');
      return null;
    }

    console.log(`[loadBoqDraft] Successfully loaded draft, last saved at: ${data[0].updated_at}`);
    return data[0] as BOQDraftRecord;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[loadBoqDraft] Unexpected error:', errorMsg);
    return null;
  }
}

/**
 * Delete a draft from the database.
 * If draftToken is provided, deletes only the draft with that token.
 */
export async function deleteDraft(
  userId: string,
  companyId: string,
  draftToken?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!userId || !companyId) {
      return { success: false, error: 'User ID and Company ID are required' };
    }

    console.log(`[deleteDraft] Deleting draft for user: ${userId}, company: ${companyId}, token: ${draftToken || '(all)'}`);

    let query = supabase
      .from('boq_drafts')
      .delete()
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .is('boq_id', null);

    if (draftToken) {
      query = query.eq('draft_token', draftToken);
    }

    const { error } = await query;

    if (error) {
      const errorMsg = error instanceof Error ? error.message : (error?.message || JSON.stringify(error));
      console.error('[deleteDraft] Failed to delete BOQ draft:', errorMsg);
      return { success: false, error: errorMsg };
    }

    console.log('[deleteDraft] Successfully deleted draft');
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[deleteDraft] Error deleting BOQ draft:', errorMsg);
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
      const errorMsg = fetchError instanceof Error ? fetchError.message : (fetchError?.message || JSON.stringify(fetchError));
      console.error('Failed to fetch draft for publishing:', errorMsg);
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
      termsAndConditions: draft.termsAndConditions,
      showCalculatedValuesInTerms: draft.showCalculatedValuesInTerms,
      created_by: createdByUserId || null,
    };

    let insertedBoq: any = null;
    let insertError: any = null;
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const result = await supabase
        .from('boqs')
        .insert([boqPayload])
        .select('id')
        .single();
      insertedBoq = result.data;
      insertError = result.error;

      if (!insertError) break;

      const isDuplicateKey =
        insertError?.message?.includes('duplicate key') ||
        insertError?.code === '23505';

      if (!isDuplicateKey) break;

      if (attempt < MAX_RETRIES - 1) {
        const { generateNextBOQNumber } = await import('@/utils/boqNumberGenerator');
        boqPayload.number = await generateNextBOQNumber(undefined, companyId);
      }
    }

    if (insertError) {
      const errorMsg = insertError instanceof Error ? insertError.message : (insertError?.message || JSON.stringify(insertError));
      console.error('Failed to publish draft:', errorMsg);
      return { success: false, error: errorMsg };
    }

    // Delete the draft
    const { error: deleteError } = await supabase
      .from('boq_drafts')
      .delete()
      .eq('id', draftId);

    if (deleteError) {
      const errorMsg = deleteError instanceof Error ? deleteError.message : (deleteError?.message || JSON.stringify(deleteError));
      console.error('Failed to delete draft after publishing:', errorMsg);
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
 * Save a draft for an existing BOQ being edited.
 * This creates/updates an edit-in-progress draft with boq_id set.
 * Allows one edit draft per BOQ per user.
 */
export async function saveEditingDraft(
  userId: string,
  companyId: string,
  boqId: string,
  boqData: any
): Promise<{ success: boolean; error?: string; draftId?: string }> {
  try {
    if (!userId || !companyId || !boqId) {
      return { success: false, error: 'User ID, Company ID, and BOQ ID are required' };
    }

    const payload: Record<string, any> = {
      company_id: companyId,
      user_id: userId,
      boq_id: boqId,
      number: boqData.number || null,
      boq_date: boqData.boq_date || null,
      due_date: boqData.due_date || null,
      customer_id: boqData.customer_id || null,
      client_name: boqData.client_name || null,
      client_email: boqData.client_email || null,
      client_phone: boqData.client_phone || null,
      client_address: boqData.client_address || null,
      client_city: boqData.client_city || null,
      client_country: boqData.client_country || null,
      contractor: boqData.contractor || null,
      project_title: boqData.project_title || null,
      currency: boqData.currency || 'KES',
      subtotal: boqData.subtotal || 0,
      tax_amount: boqData.tax_amount || 0,
      total_amount: boqData.total_amount || 0,
      data: boqData.data,
      terms_and_conditions: boqData.termsAndConditions || null,
      show_calculated_values_in_terms: boqData.showCalculatedValuesInTerms || false,
      updated_at: new Date().toISOString(),
      last_autosaved_at: new Date().toISOString(),
    };

    if (boqData.attachment_url) payload.attachment_url = boqData.attachment_url;
    if (boqData.status) payload.status = boqData.status;

    // Check if an existing edit draft exists for this BOQ
    const { data: existingDraft, error: fetchError } = await supabase
      .from('boq_drafts')
      .select('id')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .eq('boq_id', boqId)
      .single();

    let draftId: string | undefined;

    if (fetchError && fetchError.code !== 'PGRST116') {
      // Unexpected error (not "no rows found")
      const errorMsg = fetchError instanceof Error ? fetchError.message : (fetchError?.message || JSON.stringify(fetchError));
      console.error('Failed to check existing edit draft:', errorMsg);
      return { success: false, error: errorMsg };
    }

    if (existingDraft?.id) {
      // Update existing draft by ID
      const { data, error } = await supabase
        .from('boq_drafts')
        .update(payload)
        .eq('id', existingDraft.id)
        .select('id')
        .single();

      if (error) {
        const errorMsg = error instanceof Error ? error.message : (error?.message || JSON.stringify(error));
        console.error('Failed to update editing draft:', errorMsg);
        return { success: false, error: errorMsg };
      }
      draftId = data?.id;
    } else {
      // Insert new draft
      const { data, error } = await supabase
        .from('boq_drafts')
        .insert([payload])
        .select('id')
        .single();

      if (error) {
        const errorMsg = error instanceof Error ? error.message : (error?.message || JSON.stringify(error));
        console.error('Failed to insert editing draft:', errorMsg);
        return { success: false, error: errorMsg };
      }
      draftId = data?.id;
    }

    return { success: true, draftId };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error saving editing draft:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Load an edit draft for a specific BOQ.
 * Returns null if no draft exists.
 */
export async function loadEditDraft(
  userId: string,
  companyId: string,
  boqId: string
): Promise<BOQDraftRecord | null> {
  try {
    if (!userId || !companyId || !boqId) {
      console.warn('[loadEditDraft] Missing required parameters', { userId: !!userId, companyId: !!companyId, boqId: !!boqId });
      return null;
    }

    const { data, error } = await supabase
      .from('boq_drafts')
      .select('*')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .eq('boq_id', boqId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found - expected when no draft exists
        console.log('[loadEditDraft] No draft found for BOQ:', boqId);
        return null;
      }
      console.error('[loadEditDraft] Query error:', { code: error.code, message: error.message });
      return null;
    }

    console.log('[loadEditDraft] Successfully loaded draft for BOQ:', boqId);
    return data as BOQDraftRecord;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[loadEditDraft] Unexpected error:', errorMsg);
    return null;
  }
}

/**
 * Delete an edit draft for a specific BOQ.
 * Called after successful save to clean up.
 */
export async function deleteEditDraft(
  userId: string,
  companyId: string,
  boqId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!userId || !companyId || !boqId) {
      return { success: false, error: 'User ID, Company ID, and BOQ ID are required' };
    }

    const { error } = await supabase
      .from('boq_drafts')
      .delete()
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .eq('boq_id', boqId);

    if (error) {
      const errorMsg = error instanceof Error ? error.message : (error?.message || JSON.stringify(error));
      console.error('Failed to delete edit draft:', errorMsg);
      return { success: false, error: errorMsg };
    }

    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error deleting edit draft:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Check if a draft is stale based on its last autosaved timestamp.
 * A draft is considered stale if it hasn't been autosaved within the specified timeframe.
 * @param lastAutosavedAt ISO timestamp string
 * @param maxAgeMs Maximum age in milliseconds (default 30 minutes)
 * @returns true if draft is stale, false if it's fresh
 */
export function isDraftStale(lastAutosavedAt: string | null, maxAgeMs: number = 30 * 60 * 1000): boolean {
  if (!lastAutosavedAt) return true;

  try {
    const lastSavedTime = new Date(lastAutosavedAt).getTime();
    const ageMs = Date.now() - lastSavedTime;
    const isStale = ageMs > maxAgeMs;

    if (isStale) {
      const minutes = Math.floor(ageMs / 60000);
      console.log(`[isDraftStale] Draft is stale: last saved ${minutes} minutes ago, threshold is ${maxAgeMs / 60000} minutes`);
    }

    return isStale;
  } catch (err) {
    console.error('[isDraftStale] Error parsing timestamp:', err);
    return true; // Consider malformed timestamps as stale
  }
}

/**
 * Check if a user has an unsaved draft for a company.
 * Returns true if draft exists (checks only create drafts with boq_id=NULL).
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
      .eq('company_id', companyId)
      .is('boq_id', null);

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

/**
 * List all create drafts for a user/company.
 * Uses DISTINCT ON (draft_token) to return one row per unique draft session.
 * Returns an empty array if no drafts exist.
 */
export async function listCreateDrafts(
  userId: string,
  companyId: string
): Promise<BOQDraftRecord[]> {
  try {
    if (!userId || !companyId) {
      console.warn('[listCreateDrafts] User ID and Company ID are required');
      return [];
    }

    console.log(`[listCreateDrafts] Fetching create drafts for user: ${userId}, company: ${companyId}`);

    const { data, error } = await supabase
      .from('boq_drafts')
      .select('*')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .is('boq_id', null)
      .order('draft_token', { ascending: true })
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[listCreateDrafts] Query error:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Deduplicate by draft_token, keeping the most recent per token
    const tokenMap = new Map<string, BOQDraftRecord>();
    for (const row of data) {
      const token = row.draft_token;
      if (!tokenMap.has(token)) {
        tokenMap.set(token, row as BOQDraftRecord);
      }
    }

    const drafts = Array.from(tokenMap.values());
    console.log(`[listCreateDrafts] Found ${drafts.length} unique create drafts`);
    return drafts;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[listCreateDrafts] Unexpected error:', errorMsg);
    return [];
  }
}

/**
 * Clean up duplicate draft rows per draft_token, keeping only the most recent one.
 * This handles the edge case where duplicate drafts exist within the same token
 * (shouldn't happen after unique index, but safe to clean up).
 */
export async function cleanupDuplicateDrafts(
  userId: string,
  companyId: string
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    if (!userId || !companyId) {
      return { success: false, error: 'User ID and Company ID are required' };
    }

    console.log(`[cleanupDuplicateDrafts] Checking for duplicates for user: ${userId}, company: ${companyId}`);

    const { data: allDrafts, error: fetchError } = await supabase
      .from('boq_drafts')
      .select('id, draft_token, updated_at')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .is('boq_id', null)
      .order('updated_at', { ascending: false });

    if (fetchError) {
      const errorMsg = fetchError instanceof Error ? fetchError.message : (fetchError?.message || JSON.stringify(fetchError));
      console.error('[cleanupDuplicateDrafts] Failed to fetch drafts:', errorMsg);
      return { success: false, error: errorMsg };
    }

    if (!allDrafts || allDrafts.length <= 1) {
      console.log('[cleanupDuplicateDrafts] No duplicates found');
      return { success: true, deletedCount: 0 };
    }

    // Keep the most recent per draft_token, delete the rest
    const seenTokens = new Set<string>();
    const idsToDelete: string[] = [];

    for (const draft of allDrafts) {
      if (seenTokens.has(draft.draft_token)) {
        idsToDelete.push(draft.id);
      } else {
        seenTokens.add(draft.draft_token);
      }
    }

    if (idsToDelete.length === 0) {
      console.log('[cleanupDuplicateDrafts] No duplicates found');
      return { success: true, deletedCount: 0 };
    }

    console.log(`[cleanupDuplicateDrafts] Found ${idsToDelete.length} duplicate drafts to delete`);

    const { error: deleteError } = await supabase
      .from('boq_drafts')
      .delete()
      .in('id', idsToDelete);

    if (deleteError) {
      const errorMsg = deleteError instanceof Error ? deleteError.message : (deleteError?.message || JSON.stringify(deleteError));
      console.error('[cleanupDuplicateDrafts] Failed to delete duplicates:', errorMsg);
      return { success: false, error: errorMsg };
    }

    console.log(`[cleanupDuplicateDrafts] Successfully deleted ${idsToDelete.length} duplicate drafts`);
    return { success: true, deletedCount: idsToDelete.length };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[cleanupDuplicateDrafts] Error:', errorMsg);
    return { success: false, error: errorMsg };
  }
}
