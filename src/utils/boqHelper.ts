import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

export type BOQData = Database['public']['Tables']['boqs']['Row'];

export async function fetchBOQByNumber(boqNumber: string, companyId: string): Promise<BOQData | null> {
  const { data, error } = await supabase
    .from('boqs')
    .select('*')
    .eq('number', boqNumber)
    .eq('company_id', companyId)
    .single();

  if (error || !data) {
    console.error('Failed to fetch BOQ:', error);
    return null;
  }

  return data;
}

export function createPercentageCopy(originalBOQ: BOQData, percentage: number, newBoqNumber: string): BOQData {
  const multiplier = percentage / 100;

  const newData = JSON.parse(JSON.stringify(originalBOQ.data));

  if (newData.sections) {
    newData.sections = newData.sections.map((section: any) => ({
      ...section,
      subsections: section.subsections ? section.subsections.map((subsection: any) => ({
        ...subsection,
        items: (subsection.items || []).map((item: any) => ({
          ...item,
          quantity: Math.round(item.quantity * multiplier * 100) / 100,
        })),
      })) : [],
      items: section.items ? section.items.map((item: any) => ({
        ...item,
        quantity: Math.round(item.quantity * multiplier * 100) / 100,
      })) : [],
    }));
  }

  const newSubtotal = Math.round((originalBOQ.subtotal || 0) * multiplier * 100) / 100;
  const newTaxAmount = Math.round((originalBOQ.tax_amount || 0) * multiplier * 100) / 100;
  const newTotalAmount = Math.round((originalBOQ.total_amount || 0) * multiplier * 100) / 100;

  return {
    ...originalBOQ,
    number: newBoqNumber,
    subtotal: newSubtotal,
    tax_amount: newTaxAmount,
    total_amount: newTotalAmount,
    attachment_url: originalBOQ.attachment_url,
    status: 'draft',
    data: newData,
  };
}

export async function saveBOQCopy(boqCopy: Omit<BOQData, 'id'>, createdBy?: string): Promise<BOQData | null> {
  const { generateNextBOQNumber } = await import('@/utils/boqNumberGenerator');
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { data, error } = await supabase
      .from('boqs')
      .insert([
        {
          ...boqCopy,
          created_by: createdBy,
        },
      ])
      .select()
      .single();

    if (!error) return data;

    const isDuplicateKey =
      error?.message?.includes('duplicate key') ||
      error?.code === '23505';

    if (!isDuplicateKey || attempt >= MAX_RETRIES - 1) {
      console.error('Failed to save BOQ copy:', error);
      return null;
    }

    boqCopy.number = await generateNextBOQNumber(undefined, boqCopy.company_id);
  }

  return null;
}
