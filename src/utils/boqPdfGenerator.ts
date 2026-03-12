import { generatePDF } from '@/utils/pdfGenerator';

export interface BoqItem {
  description: string;
  quantity?: number; // defaults to 1 for lump sum items
  unit_id?: string; // unit id reference
  unit_name?: string; // human readable unit name
  unit?: string; // legacy fallback
  rate?: number; // KES per unit
  amount?: number; // optional; if omitted computed as qty*rate
  unit_abbreviation?: string; // abbreviation for the unit
}

export interface BoqSubsection {
  name: string; // "A", "B", "C", etc.
  label: string; // "Materials", "Labor", etc.
  items: BoqItem[];
}

export interface BoqSection {
  title?: string; // optional section title like "BILL NO. 01: DEMOLITIONS"
  subsections?: BoqSubsection[]; // new subsections support
  items?: BoqItem[]; // legacy items support (for backwards compatibility)
}

export interface BoqDocument {
  number: string; // e.g., BOQ-0001
  date: string;   // ISO date
  client: { name: string; email?: string; phone?: string; address?: string; city?: string; country?: string };
  contractor?: string;
  project_title?: string; // e.g., Proposed Development - House Renovations
  sections: BoqSection[];
  notes?: string;
  terms_and_conditions?: string;
  showCalculatedValuesInTerms?: boolean; // Whether to show calculated values in terms (e.g., "50% (KES 50,000)")
  currency?: string; // Currency code: 'KES', 'USD', 'EUR'
}

// Helper
const safeN = (v: number | undefined) => (typeof v === 'number' && !isNaN(v) ? v : 0);

export interface BoqPdfOptions {
  customTitle?: string;
  amountMultiplier?: number;
  forceCurrency?: string;
  customClient?: { name: string; email?: string; phone?: string; address?: string; city?: string; country?: string };
  stampImageUrl?: string;
  specialPaymentPercentage?: number;
  invoiceNumber?: string;
  invoiceDate?: string;
  useCurrentDate?: boolean;
}

export async function downloadBOQPDF(doc: BoqDocument, company?: { name: string; logo_url?: string; address?: string; city?: string; country?: string; phone?: string; email?: string }, options?: BoqPdfOptions) {
  // Flatten items and auto-calc amounts; prefix section titles and subsection titles as bold rows
  const flatItems: Array<{ description: string; quantity: number; unit_price: number; line_total: number; unit_of_measure?: string; unit_abbreviation?: string; _isSectionHeader?: boolean; _isSubtotal?: boolean; _isSectionTotal?: boolean }> = [];

  console.log('📊 BOQ PDF Generation - Input:', {
    boqNumber: doc.number,
    sectionsCount: doc.sections?.length || 0,
    sections: doc.sections?.map((s, i) => ({
      index: i,
      title: s.title,
      hasSubsections: !!s.subsections && s.subsections.length > 0,
      subsectionCount: s.subsections?.length || 0,
      hasLegacyItems: !!s.items && s.items.length > 0,
      legacyItemCount: s.items?.length || 0,
    }))
  });

  doc.sections.forEach((section, sectionIndex) => {
    if (section.title) {
      const sectionLetter = String.fromCharCode(65 + sectionIndex); // A, B, C, etc.
      flatItems.push({
        description: `SECTION ${sectionLetter}: ${section.title}`,
        quantity: 0,
        unit_price: 0,
        line_total: 0,
        unit_of_measure: undefined,
        unit_abbreviation: undefined,
        _isSectionHeader: true,
        _isSubtotal: false,
        _isSectionTotal: false
      });
    }

    // Handle new subsection structure
    if (section.subsections && section.subsections.length > 0) {
      section.subsections.forEach((subsection) => {
        // Calculate subsection total first
        const subsectionTotal = subsection.items.reduce((sum, it) => {
          const qty = safeN(it.quantity ?? 1);
          const rate = safeN(it.rate ?? 0);
          return sum + (qty * rate);
        }, 0);

        // Only add subsection if it has items with total > 0
        if (subsectionTotal > 0) {
          // Add subsection header as bold/special row
          flatItems.push({
            description: `→ Subsection ${subsection.name}: ${subsection.label}`,
            quantity: 0,
            unit_price: 0,
            line_total: 0,
            unit_of_measure: undefined,
            unit_abbreviation: undefined,
            _isSectionHeader: true,
            _isSubtotal: false,
            _isSectionTotal: false
          });

          // Add items for this subsection
          subsection.items.forEach((it) => {
            const qty = safeN(it.quantity ?? 1);
            const rate = safeN(it.rate ?? (it.amount ? it.amount : 0));
            const amount = safeN(it.amount ?? qty * rate);
            flatItems.push({
              description: it.description,
              quantity: qty,
              unit_price: rate,
              line_total: amount,
              unit_of_measure: it.unit_name || it.unit || 'Item',
              unit_abbreviation: (it.unit_abbreviation || ''),
              _isSectionHeader: false,
              _isSubtotal: false,
              _isSectionTotal: false
            });
          });

          // Add subsection subtotal row
          flatItems.push({
            description: `Subsection ${subsection.name} Subtotal`,
            quantity: 0,
            unit_price: 0,
            line_total: subsectionTotal,
            unit_of_measure: undefined,
            unit_abbreviation: undefined,
            _isSectionHeader: false,
            _isSubtotal: true,
            _isSectionTotal: false
          });
        }
      });

      // Add section total row (sum of all subsections)
      const sectionTotal = section.subsections.reduce((sum, sub) => {
        return sum + sub.items.reduce((subSum, it) => {
          const qty = safeN(it.quantity ?? 1);
          const rate = safeN(it.rate ?? 0);
          return subSum + (qty * rate);
        }, 0);
      }, 0);
      flatItems.push({
        description: `Section Total`,
        quantity: 0,
        unit_price: 0,
        line_total: sectionTotal,
        unit_of_measure: undefined,
        unit_abbreviation: undefined,
        _isSectionHeader: false,
        _isSubtotal: false,
        _isSectionTotal: true
      });
    } else if (section.items && section.items.length > 0) {
      // Handle legacy structure (backward compatibility)
      section.items.forEach((it) => {
        const qty = safeN(it.quantity ?? 1);
        const rate = safeN(it.rate ?? (it.amount ? it.amount : 0));
        const amount = safeN(it.amount ?? qty * rate);
        flatItems.push({
          description: it.description,
          quantity: qty,
          unit_price: rate,
          line_total: amount,
          unit_of_measure: it.unit_name || it.unit || 'Item',
          unit_abbreviation: (it.unit_abbreviation || ''),
          _isSectionHeader: false,
          _isSubtotal: false,
          _isSectionTotal: false
        });
      });
    }
  });

  const subtotal = flatItems.reduce((s, r) => s + (r.line_total || 0), 0);

  console.log('📋 BOQ PDF - Flattened Items:', {
    totalItems: flatItems.length,
    subtotal: subtotal,
    items: flatItems.map(it => ({
      description: it.description.substring(0, 50),
      qty: it.quantity,
      rate: it.unit_price,
      total: it.line_total,
      isHeader: it._isSectionHeader
    }))
  });

  // Apply customizations if provided
  const multiplier = options?.amountMultiplier ?? 1;
  const paymentPercentageText = options?.specialPaymentPercentage
    ? `Being payment of ${options.specialPaymentPercentage}% of the total`
    : null;

  const customizedItems = flatItems.map(item => ({
    ...item,
    unit_price: item.unit_price * multiplier,
    line_total: item.line_total * multiplier,
    unit_of_measure: paymentPercentageText && !item._isSectionHeader && !item._isSubtotal && !item._isSectionTotal
      ? paymentPercentageText
      : item.unit_of_measure
  }));

  const customizedSubtotal = subtotal * multiplier;
  const currency = options?.forceCurrency || doc.currency || 'KES';
  const customer = options?.customClient || doc.client;

  // Use current date if requested, otherwise use document date
  const pdfDate = options?.useCurrentDate
    ? new Date().toISOString().split('T')[0]
    : (options?.invoiceDate || doc.date);

  // Use invoice number if provided, otherwise use BOQ number
  const pdfNumber = options?.invoiceNumber || doc.number;

  return await generatePDF({
    type: 'boq',
    number: pdfNumber,
    date: pdfDate,
    company,
    customer: customer,
    items: customizedItems,
    subtotal: customizedSubtotal,
    total_amount: customizedSubtotal,
    project_title: doc.project_title,
    contractor: doc.contractor,
    notes: doc.notes || '',
    terms_and_conditions: doc.terms_and_conditions,
    showCalculatedValuesInTerms: doc.showCalculatedValuesInTerms,
    currency: currency,
    customTitle: options?.customTitle,
    stampImageUrl: options?.stampImageUrl
  });
}
