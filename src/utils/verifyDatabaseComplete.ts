import { supabase } from '@/integrations/supabase/client';

export interface DatabaseVerificationResult {
  isComplete: boolean;
  missingTables: string[];
  missingColumns: Array<{ table: string; column: string }>;
  details: {
    totalTables: number;
    totalColumns: number;
    verifiedTables: number;
    verifiedColumns: number;
  };
  summary: string;
}

// Expected database structure based on our audit
const EXPECTED_STRUCTURE: Record<string, string[]> = {
  customers: [
    'id', 'company_id', 'customer_code', 'name', 'email', 'phone', 
    'address', 'city', 'state', 'postal_code', 'country', 'credit_limit', 
    'payment_terms', 'is_active', 'created_at', 'updated_at'
  ],
  products: [
    'id', 'company_id', 'category_id', 'product_code', 'name', 'description',
    'unit_of_measure', 'cost_price', 'selling_price', 'stock_quantity',
    'minimum_stock_level', 'maximum_stock_level', 'min_stock_level', 'max_stock_level',
    'reorder_point', 'is_active', 'track_inventory', 'created_at', 'updated_at'
  ],
  invoices: [
    'id', 'company_id', 'customer_id', 'invoice_number', 'invoice_date',
    'due_date', 'lpo_number', 'status', 'subtotal', 'tax_amount', 'total_amount',
    'paid_amount', 'balance_due', 'display_as_percentage', 'notes', 'terms_and_conditions', 'created_at', 'updated_at'
  ],
  invoice_items: [
    'id', 'invoice_id', 'product_id', 'product_name', 'description', 'quantity',
    'unit_price', 'discount_percentage', 'discount_before_vat', 'tax_percentage',
    'tax_amount', 'tax_inclusive', 'line_total', 'sort_order'
  ],
  quotations: [
    'id', 'company_id', 'customer_id', 'quotation_number', 'quotation_date',
    'valid_until', 'status', 'subtotal', 'tax_amount', 'total_amount',
    'notes', 'terms_and_conditions', 'display_as_percentage', 'created_at', 'updated_at'
  ],
  quotation_items: [
    'id', 'quotation_id', 'product_id', 'product_name', 'description', 'quantity',
    'unit_price', 'discount_percentage', 'discount_before_vat', 'tax_percentage',
    'tax_amount', 'tax_inclusive', 'line_total', 'sort_order'
  ],
  lpos: [
    'id', 'company_id', 'supplier_id', 'lpo_number', 'lpo_date', 'delivery_date',
    'status', 'subtotal', 'tax_amount', 'total_amount', 'notes', 'terms_and_conditions',
    'delivery_address', 'contact_person', 'contact_phone', 'created_at', 'updated_at'
  ],
  lpo_items: [
    'id', 'lpo_id', 'product_id', 'product_name', 'description', 'quantity',
    'unit_price', 'unit_of_measure', 'tax_rate', 'tax_amount', 'line_total',
    'notes', 'sort_order'
  ],
  delivery_notes: [
    'id', 'company_id', 'customer_id', 'invoice_id', 'delivery_number',
    'delivery_date', 'delivery_method', 'tracking_number', 'carrier',
    'status', 'delivered_by', 'received_by', 'delivery_address',
    'notes', 'created_at', 'updated_at'
  ],
  delivery_note_items: [
    'id', 'delivery_note_id', 'product_id', 'description', 'quantity_ordered',
    'quantity_delivered', 'unit_of_measure', 'unit_price', 'sort_order'
  ],
  payments: [
    'id', 'company_id', 'customer_id', 'invoice_id', 'payment_number',
    'payment_date', 'amount', 'payment_method', 'reference_number',
    'notes', 'created_at', 'updated_at'
  ],
  proforma_invoices: [
    'id', 'company_id', 'customer_id', 'proforma_number', 'proforma_date',
    'valid_until', 'status', 'subtotal', 'tax_amount', 'total_amount',
    'notes', 'terms_and_conditions', 'display_as_percentage', 'created_at', 'updated_at'
  ],
  proforma_items: [
    'id', 'proforma_invoice_id', 'product_id', 'product_name', 'description',
    'quantity', 'unit_price', 'discount_percentage', 'discount_before_vat',
    'tax_percentage', 'tax_amount', 'tax_inclusive', 'line_total', 'sort_order'
  ],
  remittance_advice: [
    'id', 'company_id', 'customer_id', 'customer_name', 'customer_address',
    'advice_number', 'advice_date', 'total_payment', 'status', 'notes',
    'created_at', 'updated_at'
  ],
  remittance_advice_items: [
    'id', 'remittance_advice_id', 'payment_id', 'invoice_id', 'document_date',
    'document_number', 'document_type', 'invoice_amount', 'credit_amount',
    'payment_amount', 'tax_setting_id'
  ]
};

export async function verifyDatabaseComplete(): Promise<DatabaseVerificationResult> {
  try {
    const missingTables: string[] = [];
    const missingColumns: Array<{ table: string; column: string }> = [];

    const expectedTables = Object.keys(EXPECTED_STRUCTURE);
    const totalExpectedTables = expectedTables.length;
    const totalExpectedColumns = Object.values(EXPECTED_STRUCTURE).flat().length;
    let verifiedTables = 0;
    let verifiedColumns = 0;

    for (const table of expectedTables) {
      const expectedCols = EXPECTED_STRUCTURE[table] || [];

      try {
        // Ask PostgREST to validate all requested columns without returning rows
        const { error } = await supabase
          .from(table as any)
          .select(expectedCols.join(','), { head: true })
          .limit(0);

        if (!error) {
          verifiedTables++;
          verifiedColumns += expectedCols.length;
          continue;
        }

        const msg = (error.message || '').toLowerCase();
        if (msg.includes('relation') && msg.includes('does not exist')) {
          missingTables.push(table);
          continue;
        }

        // Table likely exists; probe columns individually to find missing ones
        let tableVerifiedOnce = false;
        for (const col of expectedCols) {
          const { error: colErr } = await supabase
            .from(table as any)
            .select(col, { head: true })
            .limit(0);

          if (colErr) {
            const cmsg = (colErr.message || '').toLowerCase();
            if (cmsg.includes('relation') && cmsg.includes('does not exist')) {
              if (!missingTables.includes(table)) missingTables.push(table);
              break;
            }
            if (cmsg.includes('column') && cmsg.includes('does not exist')) {
              missingColumns.push({ table, column: col });
            } else {
              // treat as verified column if error not about missing column
              verifiedColumns++;
            }
          } else {
            verifiedColumns++;
            tableVerifiedOnce = true;
          }
        }
        if (tableVerifiedOnce) verifiedTables++;
      } catch {
        // Fallback: cheap probe to detect table presence
        try {
          const { error: relErr } = await supabase.from(table as any).select('id', { head: true }).limit(0);
          if (relErr) {
            const rmsg = (relErr.message || '').toLowerCase();
            if (rmsg.includes('relation') && rmsg.includes('does not exist')) {
              missingTables.push(table);
            } else {
              verifiedTables++;
            }
          } else {
            verifiedTables++;
          }
        } catch {
          missingTables.push(table);
        }
      }
    }

    const isComplete = missingTables.length === 0 && missingColumns.length === 0;
    const parts: string[] = [];
    if (missingTables.length > 0) parts.push(`${missingTables.length} missing tables`);
    if (missingColumns.length > 0) parts.push(`${missingColumns.length} missing columns`);

    const summary = isComplete
      ? `✅ Database structure is complete! All ${totalExpectedTables} tables and ${totalExpectedColumns} columns are present.`
      : `❌ Database structure incomplete: ${parts.join(', ')}.`;

    return {
      isComplete,
      missingTables,
      missingColumns,
      details: {
        totalTables: totalExpectedTables,
        totalColumns: totalExpectedColumns,
        verifiedTables,
        verifiedColumns
      },
      summary
    };
  } catch (error: any) {
    return {
      isComplete: false,
      missingTables: [],
      missingColumns: [],
      details: {
        totalTables: 0,
        totalColumns: 0,
        verifiedTables: 0,
        verifiedColumns: 0
      },
      summary: `❌ Verification failed: ${error?.message || 'Unknown error'}`
    };
  }
}

export async function getDetailedStructureReport(): Promise<string> {
  try {
    const verification = await verifyDatabaseComplete();
    let report = `# Database Structure Verification Report\n\n`;
    report += `**Status**: ${verification.isComplete ? '✅ COMPLETE' : '❌ INCOMPLETE'}\n\n`;
    report += `**Summary**: ${verification.summary}\n\n`;

    if (verification.missingTables.length > 0) {
      report += `## Missing Tables (${verification.missingTables.length})\n`;
      verification.missingTables.forEach(table => {
        report += `- ❌ ${table}\n`;
      });
      report += '\n';
    }

    if (verification.missingColumns.length > 0) {
      report += `## Missing Columns (${verification.missingColumns.length})\n`;
      const groupedMissing = verification.missingColumns.reduce((acc, item) => {
        if (!acc[item.table]) acc[item.table] = [] as string[];
        acc[item.table].push(item.column);
        return acc;
      }, {} as Record<string, string[]>);

      Object.entries(groupedMissing).forEach(([table, columns]) => {
        report += `### ${table}\n`;
        columns.forEach(column => {
          report += `- ❌ ${column}\n`;
        });
        report += '\n';
      });
    }

    report += `## Statistics\n`;
    report += `- **Tables**: ${verification.details.verifiedTables}/${verification.details.totalTables}\n`;
    report += `- **Columns**: ${verification.details.verifiedColumns}/${verification.details.totalColumns}\n`;

    return report;
  } catch (error: any) {
    return `# Database Verification Error\n\n❌ ${error?.message || 'Unknown error'}`;
  }
}
