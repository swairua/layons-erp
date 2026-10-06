import { supabase } from '@/integrations/supabase/client';

/**
 * Generates a unique invoice number in the format INV-YYYY-XXX
 * Example: INV-2025-004
 * Counter resets each year
 * @param companyId - The company ID
 * @returns Unique invoice number
 */
export async function generateUniqueInvoiceNumber(companyId: string): Promise<string> {
  try {
    const rpcTimeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('RPC timeout')), 3000);
    });

    const rpcCall = supabase.rpc('generate_invoice_number', {
      company_uuid: companyId
    });

    const { data, error } = await Promise.race([rpcCall, rpcTimeout]) as any;

    if (error) {
      console.error('RPC generate_invoice_number failed:', error);
      return generateFallbackInvoiceNumber(companyId);
    }

    if (data) {
      return data;
    }

    return generateFallbackInvoiceNumber(companyId);
  } catch (error) {
    console.error('Failed to generate invoice number:', error);
    return generateFallbackInvoiceNumber(companyId);
  }
}

/**
 * Fallback invoice number generation if RPC fails
 * Format: INV-YYYY-XXX
 */
async function generateFallbackInvoiceNumber(companyId: string): Promise<string> {
  try {
    const now = new Date();
    const year = now.getFullYear();

    // Get the highest existing invoice/quotation number for this company for current year
    const { data: invoices, error: invoiceError } = await supabase
      .from('invoices')
      .select('invoice_number')
      .eq('company_id', companyId)
      .like('invoice_number', `INV-${year}-%`)
      .order('invoice_number', { ascending: false })
      .limit(1);

    const { data: quotations, error: quotationError } = await supabase
      .from('quotations')
      .select('quotation_number')
      .eq('company_id', companyId)
      .like('quotation_number', `INV-${year}-%`)
      .order('quotation_number', { ascending: false })
      .limit(1);

    if (invoiceError) console.error('Error fetching invoices:', invoiceError);
    if (quotationError) console.error('Error fetching quotations:', quotationError);

    let maxNumber = 0;

    // Extract numeric part from existing numbers (INV-YYYY-XXX format)
    if (invoices && invoices.length > 0) {
      const numericMatch = invoices[0].invoice_number.match(/INV-\d{4}-(\d{3})/);
      if (numericMatch) {
        maxNumber = Math.max(maxNumber, parseInt(numericMatch[1], 10));
      }
    }

    if (quotations && quotations.length > 0) {
      const numericMatch = quotations[0].quotation_number.match(/INV-\d{4}-(\d{3})/);
      if (numericMatch) {
        maxNumber = Math.max(maxNumber, parseInt(numericMatch[1], 10));
      }
    }

    // Generate next number
    const nextNumber = maxNumber + 1;
    const paddedNumber = String(nextNumber).padStart(3, '0');

    return `INV-${year}-${paddedNumber}`;
  } catch (error) {
    console.error('Fallback invoice number generation failed:', error);
    // Last resort: generate a timestamp-based number
    const timestamp = Date.now().toString().slice(-3);
    const now = new Date();
    const year = now.getFullYear();
    return `INV-${year}-${timestamp}`;
  }
}
