import type { CreditNote } from '@/hooks/useCreditNotes';
import { PDF_PAGE_CSS } from './pdfMarginConstants';
import { DEFAULT_COMPANY_DETAILS, formatDateForPDF, formatCurrencyForPDF } from './pdfUtilities';

export interface CreditNotePDFData extends CreditNote {
  customers: {
    name: string;
    email?: string;
    phone?: string;
    customer_code: string;
    address?: string;
    city?: string;
    country?: string;
  };
  credit_note_items?: Array<{
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    tax_percentage: number;
    tax_amount: number;
    line_total: number;
    products?: {
      name: string;
      product_code: string;
    };
  }>;
  invoices?: {
    invoice_number: string;
  };
}

export interface CompanyData {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  tax_number?: string;
  registration_number?: string;
  logo_url?: string;
  header_image?: string;
  stamp_image?: string;
}

// Use shared DEFAULT_COMPANY from pdfUtilities - includes contractor details
const DEFAULT_COMPANY = DEFAULT_COMPANY_DETAILS as CompanyData;

export const generateCreditNotePDF = (creditNote: CreditNotePDFData, company?: CompanyData) => {
  // Use company details from parameter or fall back to defaults
  const companyData = company || DEFAULT_COMPANY;

  // Get stamp image with fallback
  const stampImage = companyData.stamp_image || DEFAULT_COMPANY.stamp_image;

  // Create a new window with the document content
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Could not open print window. Please allow popups.');
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Credit Note ${creditNote.credit_note_number}</title>
      <meta charset="UTF-8">
      <style>
        ${PDF_PAGE_CSS}
        
        * {
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Arial', sans-serif;
          margin: 0;
          padding: 0;
          color: #333;
          line-height: 1.4;
          font-size: 12px;
          background: white;
        }
        
        .page {
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          background: white;
          box-shadow: 0 0 10px rgba(0,0,0,0.1);
          padding: 20mm;
          position: relative;
        }
        
        .header-image {
          width: 100%;
          height: 140px;
          margin-bottom: 15px;
          display: block;
          object-fit: cover;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #DC3545;
        }
        
        .company-info {
          flex: 1;
        }
        
        .logo {
          width: 120px;
          height: 60px;
          margin-bottom: 15px;
          border-radius: 8px;
          overflow: hidden;
        }
        
        .logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        
        .company-name {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 5px;
          color: #DC3545;
        }
        
        .company-details {
          font-size: 11px;
          line-height: 1.6;
          color: #666;
          margin-bottom: 0;
        }
        
        .document-info {
          text-align: right;
          flex: 1;
          max-width: 300px;
        }
        
        .document-title {
          font-size: 28px;
          font-weight: bold;
          margin: 0 0 15px 0;
          color: #DC3545;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        
        .document-details {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          border: 1px solid #e9ecef;
        }
        
        .document-details table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .document-details td {
          padding: 5px 0;
          border: none;
        }
        
        .document-details .label {
          font-weight: bold;
          color: #495057;
          width: 40%;
        }
        
        .document-details .value {
          text-align: right;
          color: #212529;
        }
        
        .customer-section {
          margin: 30px 0;
          display: flex;
          justify-content: space-between;
          gap: 30px;
        }
        
        .bill-to, .related-info {
          flex: 1;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
          border: 1px solid #e9ecef;
        }
        
        .section-title {
          font-size: 14px;
          font-weight: bold;
          color: #DC3545;
          margin: 0 0 15px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .customer-name {
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 8px;
          color: #212529;
        }
        
        .customer-details, .related-details {
          color: #666;
          line-height: 1.6;
        }
        
        .items-section {
          margin: 30px 0;
        }
        
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          font-size: 11px;
          border: 2px solid #DC3545;
          border-radius: 8px;
          overflow: hidden;
        }
        
        .items-table thead {
          background: #DC3545;
          color: white;
        }
        
        .items-table th {
          padding: 12px 8px;
          text-align: center;
          font-weight: bold;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-right: 1px solid rgba(255,255,255,0.2);
        }
        
        .items-table th:last-child {
          border-right: none;
        }
        
        .items-table td {
          padding: 10px 8px;
          border-bottom: 1px solid #e9ecef;
          border-right: 1px solid #e9ecef;
          text-align: center;
          vertical-align: top;
        }
        
        .items-table td:last-child {
          border-right: none;
        }
        
        .items-table tbody tr:last-child td {
          border-bottom: none;
        }
        
        .items-table tbody tr:nth-child(even) {
          background: #f8f9fa;
        }
        
        .items-table tbody tr:hover {
          background: #ffebeb;
        }
        
        .description-cell {
          text-align: left !important;
          max-width: 200px;
          word-wrap: break-word;
        }
        
        .amount-cell {
          text-align: center !important;
          font-weight: 500;
        }

        .center {
          text-align: center !important;
        }
        
        .totals-section {
          margin-top: 20px;
          display: flex;
          justify-content: flex-end;
        }
        
        .totals-table {
          width: 300px;
          border-collapse: collapse;
          font-size: 12px;
        }
        
        .totals-table td {
          padding: 8px 15px;
          border: none;
        }
        
        .totals-table .label {
          text-align: left;
          color: #495057;
          font-weight: 500;
        }
        
        .totals-table .amount {
          text-align: right;
          font-weight: 600;
          color: #212529;
        }
        
        .totals-table .subtotal-row {
          border-top: 1px solid #dee2e6;
        }
        
        .totals-table .total-row {
          border-top: 2px solid #DC3545;
          background: #f8f9fa;
        }
        
        .totals-table .total-row .label {
          font-size: 14px;
          font-weight: bold;
          color: #DC3545;
        }
        
        .totals-table .total-row .amount {
          font-size: 16px;
          font-weight: bold;
          color: #DC3545;
        }

        .totals-table .balance-row {
          border-top: 1px solid #DC3545;
          background: #ffebeb;
        }

        .totals-table .balance-row .label {
          font-weight: bold;
          color: #DC3545;
        }

        .totals-table .balance-row .amount {
          font-weight: bold;
          color: #DC3545;
        }
        
        .notes-section {
          margin-top: 30px;
          display: flex;
          gap: 20px;
        }
        
        .notes, .terms {
          flex: 1;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
          border: 1px solid #e9ecef;
        }
        
        .section-subtitle {
          font-size: 12px;
          font-weight: bold;
          color: #DC3545;
          margin: 0 0 10px 0;
          text-transform: uppercase;
        }
        
        .notes-content, .terms-content {
          font-size: 10px;
          line-height: 1.6;
          color: #666;
          white-space: pre-wrap;
        }
        
        .footer {
          position: absolute;
          bottom: 20mm;
          left: 20mm;
          right: 20mm;
          text-align: center;
          font-size: 10px;
          color: #666;
          border-top: 1px solid #e9ecef;
          padding-top: 15px;
        }
        
        .watermark {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 72px;
          color: rgba(220, 53, 69, 0.1);
          font-weight: bold;
          z-index: -1;
          pointer-events: none;
          text-transform: uppercase;
          letter-spacing: 5px;
        }
        
        @media print {
          body {
            background: white;
          }
          
          .page {
            box-shadow: none;
            margin: 0;
            padding: 0;
          }
        }
        
        @media screen {
          body {
            background: #f5f5f5;
            padding: 20px;
          }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <!-- Watermark -->
        <div class="watermark">Credit Note</div>

        <!-- Full-width header image -->
        ${companyData.header_image ? `<img src="${companyData.header_image}" alt="${companyData.name}" class="header-image" />` : ''}

        <!-- Header Section -->
        <div class="header">
          <div class="company-info">
            <div class="logo">
              <img src="${companyData.logo_url || ''}" alt="${companyData.name} Logo" />
            </div>
            <div class="company-name">${companyData.name}</div>
            <div class="company-details">
              ${companyData.tax_number ? `PIN: ${companyData.tax_number}<br>` : ''}
              ${companyData.address ? `${companyData.address}<br>` : ''}
              ${companyData.city ? `${companyData.city}` : ''}${companyData.country ? `, ${companyData.country}` : ''}<br>
              ${companyData.phone ? `Tel: ${companyData.phone}<br>` : ''}
              ${companyData.email ? `Email: ${companyData.email}` : ''}
            </div>
          </div>
          
          <div class="document-info">
            <div class="document-title">Credit Note</div>
            <div class="document-details">
              <table>
                <tr>
                  <td class="label">Credit Note #:</td>
                  <td class="value">${creditNote.credit_note_number}</td>
                </tr>
                <tr>
                  <td class="label">Date:</td>
                  <td class="value">${formatDateForPDF(creditNote.credit_note_date)}</td>
                </tr>
                <tr>
                  <td class="label">Status:</td>
                  <td class="value">${creditNote.status.toUpperCase()}</td>
                </tr>
                <tr>
                  <td class="label">Credit Amount:</td>
                  <td class="value" style="font-weight: bold; color: #DC3545;">${formatCurrencyForPDF(creditNote.total_amount)}</td>
                </tr>
              </table>
            </div>
          </div>
        </div>
        
        <!-- Customer Section -->
        <div class="customer-section">
          <div class="bill-to">
            <div class="section-title">Credit To</div>
            <div class="customer-name">${creditNote.customers.name}</div>
            <div class="customer-details">
              ${creditNote.customers.email ? `${creditNote.customers.email}<br>` : ''}
              ${creditNote.customers.phone ? `${creditNote.customers.phone}<br>` : ''}
              ${creditNote.customers.address ? `${creditNote.customers.address}<br>` : ''}
              ${creditNote.customers.city ? `${creditNote.customers.city}` : ''}
              ${creditNote.customers.country ? `, ${creditNote.customers.country}` : ''}<br>
              Customer Code: ${creditNote.customers.customer_code}
            </div>
          </div>
          
          <div class="related-info">
            <div class="section-title">Credit Details</div>
            <div class="related-details">
              ${creditNote.reason ? `<strong>Reason:</strong><br>${creditNote.reason}<br><br>` : ''}
              ${creditNote.invoices?.invoice_number ? `<strong>Related Invoice:</strong><br>${creditNote.invoices.invoice_number}<br><br>` : ''}
              <strong>Applied Amount:</strong><br>${formatCurrencyForPDF(creditNote.applied_amount)}<br><br>
              <strong>Remaining Balance:</strong><br>${formatCurrencyForPDF(creditNote.balance)}
            </div>
          </div>
        </div>

        <!-- Items Section -->
        ${creditNote.credit_note_items && creditNote.credit_note_items.length > 0 ? `
        <div class="items-section">
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 40%;">Description</th>
                <th style="width: 10%;">Qty</th>
                <th style="width: 15%;">Unit Price</th>
                <th style="width: 10%;">Tax %</th>
                <th style="width: 15%;">Tax Amount</th>
                <th style="width: 15%;">Line Total</th>
              </tr>
            </thead>
            <tbody>
              ${creditNote.credit_note_items.map((item, index) => `
                <tr>
                  <td class="center">${index + 1}</td>
                  <td class="description-cell">${item.description || item.product_name || item.products?.name || 'Unknown Item'}</td>
                  <td class="center">${item.quantity}</td>
                  <td class="amount-cell">${formatCurrencyForPDF(item.unit_price)}</td>
                  <td class="center">${item.tax_percentage}%</td>
                  <td class="amount-cell">${formatCurrencyForPDF(item.tax_amount)}</td>
                  <td class="amount-cell">${formatCurrencyForPDF(item.line_total)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}
        
        <!-- Totals Section -->
        <div class="totals-section">
          <table class="totals-table">
            <tr class="subtotal-row">
              <td class="label">Subtotal:</td>
              <td class="amount">${formatCurrencyForPDF(creditNote.subtotal)}</td>
            </tr>
            <tr>
              <td class="label">Tax Amount:</td>
              <td class="amount">${formatCurrencyForPDF(creditNote.tax_amount)}</td>
            </tr>
            <tr class="total-row">
              <td class="label">TOTAL CREDIT:</td>
              <td class="amount">${formatCurrencyForPDF(creditNote.total_amount)}</td>
            </tr>
            <tr>
              <td class="label">Applied Amount:</td>
              <td class="amount">${formatCurrencyForPDF(creditNote.applied_amount)}</td>
            </tr>
            <tr class="balance-row">
              <td class="label">REMAINING BALANCE:</td>
              <td class="amount">${formatCurrencyForPDF(creditNote.balance)}</td>
            </tr>
          </table>
        </div>

        <!-- Notes Section -->
        ${creditNote.notes || creditNote.terms_and_conditions ? `
        <div class="notes-section">
          ${creditNote.notes ? `
          <div class="notes">
            <div class="section-subtitle">Notes</div>
            <div class="notes-content">${creditNote.notes}</div>
          </div>
          ` : ''}

          ${creditNote.terms_and_conditions ? `
          <div class="terms">
            <div class="section-subtitle">Terms & Conditions</div>
            <div class="terms-content">${creditNote.terms_and_conditions}</div>
          </div>
          ` : ''}
        </div>
        ` : ''}

        <!-- Stamp Section -->
        <div style="display:flex; justify-content:center; margin:30px 0 24px 0;">
          <img src="${stampImage}" alt="Company Stamp" style="width: 44mm; height: 44mm; object-fit: contain;" />
        </div>

        <!-- Footer -->
        <div class="footer">
          <strong>Thank you for your business!</strong><br>
          <strong>${companyData.name}</strong><br>
          This credit note was generated on ${new Date().toLocaleString()}<br>
          <em>This credit note can be applied against future invoices or refunded as per our terms</em>
        </div>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();

  // Wait for content to load before printing
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  // Fallback if onload doesn't fire
  setTimeout(() => {
    if (printWindow && !printWindow.closed) {
      printWindow.print();
    }
  }, 1000);

  return printWindow;
};
