import { supabase } from '@/integrations/supabase/client';

/**
 * Extracts BOQ number from invoice notes
 * Expected format: "Converted from BOQ BOQ-2026-001\n\n..."
 * Returns the BOQ number if found, null otherwise
 */
export const extractBoqNumberFromNotes = (notes: string | null | undefined): string | null => {
  if (!notes) return null;

  // Match pattern "Converted from BOQ <BOQ_NUMBER>"
  const match = notes.match(/Converted from BOQ\s+([\w\-]+)/i);
  return match ? match[1] : null;
};

/**
 * Fetches project title from BOQ using the BOQ number
 * @param boqNumber - The BOQ number extracted from invoice notes
 * @param companyId - The company ID for filtering
 * @returns The project_title from BOQ or null if not found
 */
export const fetchBoqProjectTitle = async (boqNumber: string, companyId: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('boqs')
      .select('project_title')
      .eq('number', boqNumber)
      .eq('company_id', companyId)
      .single();

    if (error) {
      console.warn(`Failed to fetch BOQ ${boqNumber}:`, error.message);
      return null;
    }

    return data?.project_title || null;
  } catch (err) {
    console.error(`Error fetching BOQ project title for ${boqNumber}:`, err);
    return null;
  }
};

/**
 * Gets project title for an invoice by extracting BOQ number from notes and fetching from BOQ
 * This is used for invoice PDF filename generation
 * @param invoice - The invoice object with notes field
 * @param companyId - The company ID
 * @returns The project_title if found, null otherwise
 */
export const getProjectTitleFromInvoice = async (
  invoice: { notes?: string | null; invoice_number: string },
  companyId: string
): Promise<string | null> => {
  const boqNumber = extractBoqNumberFromNotes(invoice.notes);
  if (!boqNumber) {
    return null;
  }

  console.log(`Extracting project title from BOQ ${boqNumber} for invoice ${invoice.invoice_number}`);
  return await fetchBoqProjectTitle(boqNumber, companyId);
};
