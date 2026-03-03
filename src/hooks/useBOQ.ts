import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BoqDocument, BoqSection } from '@/utils/boqPdfGenerator';
import { ensureQuantityColumnsAreDecimal } from '@/utils/ensureDatabaseColumns';

const safeN = (v: number | undefined) => (typeof v === 'number' && !isNaN(v) ? v : 0);

interface BoqItemForInvoice {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  unit_of_measure: string;
  section_name?: string;
  is_header?: boolean;
}

/**
 * Generates a unique customer code based on customer name
 * Format: First 3 letters of name + random 4-digit number + timestamp suffix
 * Includes validation and retry logic for uniqueness
 */
function generateCustomerCode(name: string): string {
  // Extract alphabetic characters from the name
  const alphaOnly = name.replace(/[^A-Za-z]/g, '');

  // If no alpha characters, use a default prefix
  let prefix = alphaOnly.substring(0, 3).toUpperCase() || 'CUS';

  // Ensure prefix is exactly 3 characters
  prefix = prefix.padEnd(3, 'X').substring(0, 3);

  // Generate a random 4-digit number
  const randomNum = Math.floor(1000 + Math.random() * 9000);

  // Add timestamp-based suffix for additional uniqueness
  const timestamp = Date.now().toString().slice(-4);

  return `${prefix}${randomNum}${timestamp}`.substring(0, 50); // Ensure under VARCHAR(50)
}

/**
 * Flatten BOQ sections and subsections into items for invoice
 * Properly filters out header/section rows that shouldn't be invoice items
 */
const flattenBoqItems = (boqData: BoqDocument): { invoiceItems: BoqItemForInvoice[]; subtotal: number } => {
  const flatItems: BoqItemForInvoice[] = [];

  boqData.sections.forEach((section) => {
    // Handle subsections (new structure)
    if (section.subsections && section.subsections.length > 0) {
      section.subsections.forEach((subsection) => {
        // Add actual items from subsection (skip the header row)
        if (subsection.items && subsection.items.length > 0) {
          subsection.items.forEach((item) => {
            const qty = safeN(item.quantity ?? 1);
            const rate = safeN(item.rate ?? 0);
            const amount = safeN(item.amount ?? qty * rate);

            // Only add if it has quantity and price (filters out lump sum headers)
            if (qty > 0 || rate > 0) {
              flatItems.push({
                description: item.description,
                quantity: qty,
                unit_price: rate,
                line_total: amount,
                unit_of_measure: item.unit_name || item.unit || 'Item',
                section_name: section.title ? `${section.title} - ${subsection.label}` : subsection.label,
                is_header: false
              });
            }
          });
        }
      });
    }
    // Handle legacy items (non-subsection format)
    else if (section.items && section.items.length > 0) {
      section.items.forEach((item) => {
        const qty = safeN(item.quantity ?? 1);
        const rate = safeN(item.rate ?? 0);
        const amount = safeN(item.amount ?? qty * rate);

        // Only add if it has quantity and price
        if (qty > 0 || rate > 0) {
          flatItems.push({
            description: item.description,
            quantity: qty,
            unit_price: rate,
            line_total: amount,
            unit_of_measure: item.unit_name || item.unit || 'Item',
            section_name: section.title || 'General',
            is_header: false
          });
        }
      });
    }
  });

  // Calculate subtotal from actual items only (not headers)
  const subtotal = flatItems.reduce((sum, item) => sum + item.line_total, 0);

  return { invoiceItems: flatItems, subtotal };
};

export const useConvertBoqToInvoice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ boqId, companyId }: { boqId: string; companyId: string }) => {
      // Get BOQ data
      const { data: boq, error: boqError } = await supabase
        .from('boqs')
        .select('*')
        .eq('id', boqId)
        .eq('company_id', companyId)
        .single();

      if (boqError) {
        const errorMsg = boqError?.message || boqError?.details || JSON.stringify(boqError);
        console.error('BOQ fetch error:', { boqError, boqId, companyId });
        throw new Error(`Failed to fetch BOQ: ${errorMsg}`);
      }

      if (!boq) throw new Error('BOQ not found');

      const boqData = boq.data as BoqDocument;
      if (!boqData) {
        console.error('BOQ data invalid:', { boq });
        throw new Error('BOQ data is invalid or missing');
      }

      // Validate BOQ has sections and items
      if (!boqData.sections || boqData.sections.length === 0) {
        console.error('BOQ has no sections:', { boqData });
        throw new Error('BOQ has no sections. Cannot convert empty BOQ.');
      }

      // Get customer data from BOQ if available
      const customerData = boqData.client;

      // Check if customer exists or create a new one
      let customerId: string | null = null;
      let customerCreationError: string | null = null;

      if (customerData?.name) {
        // Try to find existing customer by name and company - use limit without .single() to handle no results
        const { data: existingCustomers, error: searchError } = await supabase
          .from('customers')
          .select('id')
          .eq('company_id', boq.company_id)
          .eq('name', customerData.name)
          .limit(1);

        if (existingCustomers && existingCustomers.length > 0) {
          customerId = existingCustomers[0].id;
        } else if (!searchError) {
          // No customer found, create a new one - with retry logic for code conflicts
          let customerCreated = false;
          let retryCount = 0;
          const maxRetries = 3;

          while (!customerCreated && retryCount < maxRetries) {
            try {
              const customerPayload = {
                company_id: boq.company_id,
                name: customerData.name,
                customer_code: generateCustomerCode(customerData.name),
                email: customerData.email || null,
                phone: customerData.phone || null,
                address: customerData.address || null,
                city: customerData.city || null,
                country: customerData.country || null,
                is_active: true
              };

              // Validate customer code is not empty
              if (!customerPayload.customer_code || customerPayload.customer_code.trim() === '') {
                throw new Error('Failed to generate valid customer code');
              }

              const { data: newCustomer, error: customerError } = await supabase
                .from('customers')
                .insert([customerPayload])
                .select()
                .single();

              if (customerError) {
                // Check if it's a unique constraint violation (code already exists)
                if (customerError.message?.includes('duplicate key') || customerError.message?.includes('unique constraint')) {
                  retryCount++;
                  if (retryCount >= maxRetries) {
                    customerCreationError = `Could not create unique customer code after ${maxRetries} attempts: ${customerError.message}`;
                    console.warn('Customer code conflict - invoice will be created without customer:', customerCreationError);
                  }
                  // Retry with a new code
                  continue;
                } else {
                  // Other error (RLS, permission, etc.)
                  customerCreationError = customerError.message || JSON.stringify(customerError);
                  console.warn('Could not create customer from BOQ data:', customerCreationError);
                  break;
                }
              } else if (newCustomer) {
                customerId = newCustomer.id;
                customerCreated = true;
              }
            } catch (err) {
              customerCreationError = err instanceof Error ? err.message : String(err);
              console.warn('Error during customer creation:', customerCreationError);
              break;
            }
          }
        } else {
          // Unexpected error searching for customer
          customerCreationError = searchError?.message || JSON.stringify(searchError);
          console.warn('Error searching for existing customer:', customerCreationError);
        }
      }

      // Generate invoice number
      let invoiceNumber: string;
      try {
        const { data: genNumber, error: invoiceNumberError } = await supabase.rpc('generate_invoice_number', {
          company_uuid: boq.company_id
        });

        if (invoiceNumberError) {
          const errorMsg = invoiceNumberError?.message || invoiceNumberError?.details || JSON.stringify(invoiceNumberError);
          throw new Error(`Failed to generate invoice number: ${errorMsg}`);
        }

        if (!genNumber || typeof genNumber !== 'string') {
          throw new Error('Failed to generate invoice number: received invalid response');
        }

        invoiceNumber = genNumber;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('Invoice number generation error:', { errorMsg, company_id: boq.company_id });
        throw new Error(`Failed to generate invoice number: ${errorMsg}`);
      }

      // Get current user
      let createdBy: string | null = null;
      try {
        const { data: userData } = await supabase.auth.getUser();
        createdBy = userData?.user?.id || null;
      } catch (err) {
        console.warn('Could not get current user:', err);
        createdBy = null;
      }

      // Flatten BOQ items and calculate subtotal
      let invoiceItems, subtotal;
      try {
        const result = flattenBoqItems(boqData);
        invoiceItems = result.invoiceItems;
        subtotal = result.subtotal;
      } catch (flattenError) {
        console.error('Error flattening BOQ items:', { flattenError, boqData });
        throw new Error(`Failed to process BOQ items: ${flattenError instanceof Error ? flattenError.message : JSON.stringify(flattenError)}`);
      }

      if (invoiceItems.length === 0) {
        console.error('No items resulted from BOQ conversion:', { boqData });
        throw new Error('BOQ conversion resulted in no items. Please check BOQ structure.');
      }

      // Calculate tax if available from BOQ
      const taxAmount = boq.tax_amount || 0;
      const totalAmount = subtotal + taxAmount;

      // Create invoice with BOQ's currency preserved
      const invoiceData = {
        company_id: boq.company_id,
        customer_id: customerId,
        invoice_number: invoiceNumber,
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'draft',
        subtotal: subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        currency: boq.currency || 'KES', // Preserve BOQ currency
        notes: boqData.notes ? `Converted from BOQ ${boq.number}\n\n${boqData.notes}` : `Converted from BOQ ${boq.number}`,
        terms_and_conditions: boq.terms_and_conditions || null,
        created_by: createdBy,
        balance_due: totalAmount,
        paid_amount: 0
      };

      let invoice;
      try {
        const { data: createdInvoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert([invoiceData])
          .select()
          .single();

        if (invoiceError) {
          const errorMsg = invoiceError?.message || invoiceError?.details || JSON.stringify(invoiceError);
          console.error('Invoice creation error:', {
            error: invoiceError,
            invoiceData,
            company_id: boq.company_id,
            customer_id: invoiceData.customer_id,
            customer_error: customerCreationError
          });

          // Provide specific error messages based on the error type
          if (errorMsg.includes('row level security') || errorMsg.includes('violates') || errorMsg.includes('permission')) {
            throw new Error(`Invoice creation blocked: ${errorMsg}. This may be a permissions issue. Please try again or contact support.`);
          } else {
            throw new Error(`Failed to create invoice: ${errorMsg}`);
          }
        }

        if (!createdInvoice) {
          throw new Error('Invoice creation returned empty result');
        }

        invoice = createdInvoice;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('Invoice creation failed:', errorMsg);
        throw err;
      }

      // Create invoice items with proper validation
      if (invoiceItems.length > 0) {
        try {
          const itemsToInsert = invoiceItems.map((item, index) => {
            // Validate item data
            if (!item.description || item.description.trim() === '') {
              throw new Error(`Item ${index + 1} has missing description`);
            }

            // TEMPORARY WORKAROUND: Round quantities to integers
            // Database column is INTEGER instead of DECIMAL(10,3)
            // This preserves decimal values in line_total which carries the actual amounts
            const roundedQuantity = Math.round(item.quantity);

            // Log warning if we're losing precision
            if (item.quantity !== roundedQuantity) {
              console.warn(
                `Item "${item.description}": Quantity rounded from ${item.quantity} to ${roundedQuantity} due to database schema limitation`,
                {
                  original: item.quantity,
                  rounded: roundedQuantity,
                  difference: item.quantity - roundedQuantity
                }
              );
            }

            return {
              invoice_id: invoice.id,
              product_id: null, // BOQ items don't map to products
              description: item.description,
              quantity: roundedQuantity, // Round to integer to match INTEGER column
              unit_price: item.unit_price,
              line_total: item.line_total, // This preserves the actual total with decimals
              unit_of_measure: item.unit_of_measure,
              discount_percentage: 0,
              sort_order: index
            };
          });

          const { error: itemsError } = await supabase
            .from('invoice_items')
            .insert(itemsToInsert);

          if (itemsError) {
            // Try to clean up the invoice if items insertion fails
            console.error('Invoice items creation failed, attempting cleanup...');
            try {
              await supabase.from('invoices').delete().eq('id', invoice.id);
              console.log('Invoice cleaned up successfully after items error');
            } catch (cleanupErr) {
              console.error('Failed to clean up invoice after items error:', cleanupErr);
            }

            const errorMsg = itemsError?.message || itemsError?.details || JSON.stringify(itemsError);
            console.error('Invoice items creation error:', {
              itemsError,
              itemCount: itemsToInsert.length,
              invoice_id: invoice.id
            });

            if (errorMsg.includes('row level security') || errorMsg.includes('permission')) {
              throw new Error(`Cannot create invoice items: Permission denied (RLS policy). Please check your database configuration.`);
            } else {
              throw new Error(`Failed to create invoice items: ${errorMsg}`);
            }
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error('Invoice items operation error:', errorMsg);
          throw err;
        }
      }

      // Update BOQ to mark as converted
      const { error: updateError } = await supabase
        .from('boqs')
        .update({
          converted_to_invoice_id: invoice.id,
          converted_at: new Date().toISOString(),
          status: 'converted'
        })
        .eq('id', boqId)
        .eq('company_id', companyId);

      if (updateError) {
        const errorMsg = updateError?.message || updateError?.details || JSON.stringify(updateError);
        console.error('ERROR: Failed to mark BOQ as converted:', { updateError, errorMsg });
        throw new Error(`Failed to update BOQ status: ${errorMsg}`);
      }

      console.log('✅ BOQ status updated to converted successfully');
      return invoice;
    },
    onSuccess: () => {
      // Invalidate relevant queries to refetch data
      console.log('🔄 Invalidating BOQ and Invoice queries');
      queryClient.invalidateQueries({ queryKey: ['boqs'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices_fixed'] });

      // Also manually refetch after a short delay to ensure fresh data
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['boqs'] });
      }, 200);
    }
  });
};
