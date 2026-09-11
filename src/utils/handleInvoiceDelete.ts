import { supabase } from '@/integrations/supabase/client';

/**
 * Handle invoice deletion with all related cleanup:
 * 1. Reverse BOQ status if invoice came from BOQ
 * 1.5. Delete related delivery notes (before invoice deletion due to FK constraint)
 * 2. Reverse inventory movements
 * 3. Delete the invoice
 */
export async function handleInvoiceDelete(invoiceId: string, companyId: string) {
  console.log('🗑️ Starting invoice deletion process for invoice:', invoiceId);

  try {
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, company_id')
      .eq('id', invoiceId)
      .eq('company_id', companyId)
      .single();

    if (invoiceError) throw new Error(`Unable to verify invoice: ${invoiceError.message}`);
    if (!invoice) throw new Error('Invoice not found for the active company');

    // Step 1: Check if this invoice came from a BOQ
    const { data: boqRecord, error: boqError } = await supabase
      .from('boqs')
      .select('id, company_id, status')
      .eq('converted_to_invoice_id', invoiceId)
      .eq('company_id', companyId)
      .single();

    let boqWasReversed = false;
    if (boqRecord && !boqError) {
      console.log('📋 Found BOQ that was converted to this invoice:', boqRecord.id);
      
      // Reverse the BOQ status back to draft
      const { error: reverseError } = await supabase
        .from('boqs')
        .update({
          status: 'draft',
          converted_to_invoice_id: null,
          converted_at: null
        })
        .eq('id', boqRecord.id)
        .eq('company_id', companyId);

      if (reverseError) {
        throw new Error(`Failed to reverse BOQ status: ${reverseError.message}`);
      } else {
        console.log('✅ BOQ status reversed to draft');
        boqWasReversed = true;
      }
    } else if (boqError && boqError.code !== 'PGRST116') {
      throw new Error(`Failed to check related BOQ: ${boqError.message}`);
    }

    // Step 1.5: Delete all delivery notes related to this invoice
    const { data: deliveryNotes, error: deliveryError } = await supabase
      .from('delivery_notes')
      .select('id')
      .eq('invoice_id', invoiceId)
      .eq('company_id', companyId);

    if (deliveryNotes && deliveryNotes.length > 0) {
      console.log('🚚 Found', deliveryNotes.length, 'delivery notes to delete');

      // Delete delivery notes (delivery_note_items will cascade delete)
      const { error: deleteDeliveryError } = await supabase
        .from('delivery_notes')
        .delete()
        .eq('invoice_id', invoiceId)
        .eq('company_id', companyId);

      if (deleteDeliveryError) {
        console.error('⚠️ Failed to delete delivery notes:', deleteDeliveryError);
        throw new Error(`Failed to delete delivery notes: ${deleteDeliveryError.message}`);
      }

      console.log('✅ Delivery notes deleted');
    } else if (deliveryError) {
      throw new Error(`Failed to check delivery notes: ${deliveryError.message}`);
    }

    // Step 2: Find and reverse all stock movements for this invoice
    const { data: stockMovements, error: stockError } = await supabase
      .from('stock_movements')
      .select('id, product_id, movement_type, quantity, company_id')
      .eq('reference_type', 'INVOICE')
      .eq('reference_id', invoiceId)
      .eq('company_id', companyId);

    if (stockError) {
      throw new Error(`Failed to check stock movements: ${stockError.message}`);
    }

    let inventoryReversed = false;
    if (stockMovements && stockMovements.length > 0) {
      console.log('📦 Found', stockMovements.length, 'stock movements to reverse');

      // Create reverse movements
      const reverseMovements = stockMovements.map(movement => ({
        company_id: movement.company_id,
        product_id: movement.product_id,
        movement_type: movement.movement_type === 'OUT' ? 'IN' : 'OUT', // Flip the type
        reference_type: 'INVOICE',
        reference_id: invoiceId,
        quantity: movement.quantity, // Same quantity but type reversed
        notes: `Reversal for deleted invoice (original movement: ${movement.id})`
      }));

      // Insert reverse movements
      const { error: insertError } = await supabase
        .from('stock_movements')
        .insert(reverseMovements);

      if (insertError) {
        throw new Error(`Failed to create reverse stock movements: ${insertError.message}`);
      } else {
        // Update product stock for each reversal using the RPC function
        try {
          const updatePromises = reverseMovements.map(movement =>
            supabase.rpc('update_product_stock', {
              product_uuid: movement.product_id,
              movement_type: movement.movement_type,
              quantity: Math.abs(movement.quantity)
            })
          );

          const results = await Promise.allSettled(updatePromises);
          
          const failed = results.filter(r => r.status === 'rejected').length;
          if (failed === 0) {
            console.log('✅ All product stock levels updated');
            inventoryReversed = true;
          } else {
            throw new Error(`${failed} of ${results.length} product stock updates failed`);
          }
        } catch (err) {
          throw err;
        }
      }
    }

    // Step 3: Delete the invoice (Supabase will cascade delete invoice_items automatically)
    const { data: deletedInvoice, error: deleteError } = await supabase
      .from('invoices')
      .delete()
      .eq('id', invoiceId)
      .eq('company_id', companyId)
      .select('id')
      .maybeSingle();

    if (deleteError) {
      console.error('❌ Failed to delete invoice:', deleteError);
      throw new Error(`Failed to delete invoice: ${deleteError.message}`);
    }
    if (!deletedInvoice) throw new Error('Invoice was not deleted');

    console.log('✅ Invoice deleted successfully');

    // Return summary of what was cleaned up
    return {
      success: true,
      invoiceDeleted: true,
      boqReversed: boqWasReversed,
      inventoryReversed: inventoryReversed,
      deliveryNotesDeleted: (deliveryNotes?.length || 0) > 0,
      stockMovementsReverted: stockMovements?.length || 0,
      message: [
        'Invoice deleted successfully',
        (deliveryNotes?.length || 0) > 0 ? `✅ ${deliveryNotes?.length || 0} delivery notes deleted` : null,
        boqWasReversed ? '✅ BOQ status reversed to draft' : null,
        inventoryReversed ? `✅ ${stockMovements?.length || 0} inventory movements reversed` : null
      ]
        .filter(Boolean)
        .join(', ')
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
    console.error('❌ Error during invoice deletion:', errorMsg);
    throw error;
  }
}

/**
 * Check if an invoice came from a BOQ
 */
export async function getInvoiceSource(invoiceId: string) {
  const { data, error } = await supabase
    .from('boqs')
    .select('id, number')
    .eq('converted_to_invoice_id', invoiceId)
    .single();

  if (!error && data) {
    return {
      sourceType: 'BOQ',
      sourceId: data.id,
      sourceNumber: data.number
    };
  }

  return {
    sourceType: 'direct',
    sourceId: null,
    sourceNumber: null
  };
}
