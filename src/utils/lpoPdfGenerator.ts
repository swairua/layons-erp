import { PDF_PAGE_CSS } from './pdfMarginConstants';

import { PDF_PAGE_CSS } from './pdfMarginConstants';
import { DEFAULT_COMPANY_DETAILS, formatDateForPDF, formatCurrencyForPDF } from './pdfUtilities';

export interface LPOPDFData {
  id: string;
  lpo_number: string;
  lpo_date: string;
  delivery_date?: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  notes?: string;
  terms_and_conditions?: string;
  delivery_address?: string;
  contact_person?: string;
  contact_phone?: string;
  currency?: string;
  suppliers?: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
  };
  lpo_items?: Array<{
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    tax_amount: number;
    line_total: number;
    products?: {
      name: string;
      product_code: string;
      unit_of_measure?: string;
    };
  }>;
}

export interface CompanyData {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  registration_number?: string;
  tax_number?: string;
  logo_url?: string;
  header_image?: string;
  stamp_image?: string;
}

// Use shared DEFAULT_COMPANY from pdfUtilities - includes contractor details
const DEFAULT_COMPANY = DEFAULT_COMPANY_DETAILS as CompanyData;

export const generateLPOPDF = (lpo: LPOPDFData, company?: CompanyData) => {
  const companyData = company || DEFAULT_COMPANY;
  
  // Get stamp image with fallback
  const stampImage = companyData.stamp_image || DEFAULT_COMPANY.stamp_image;
  const headerImage = companyData.header_image || DEFAULT_COMPANY.header_image;

  // Create a new window with the document content
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Could not open print window. Please allow popups.');
  }

  // Generate items table rows
  const itemsTableRows = lpo.lpo_items?.map(item => `
    <tr>
      <td class="center">${item.products?.name || 'N/A'}</td>
      <td>${item.description}</td>
      <td class="center">${item.quantity} ${item.products?.unit_of_measure || 'pcs'}</td>
      <td class="amount">${formatCurrencyForPDF(item.unit_price)}</td>
      <td class="center">${item.tax_rate}%</td>
      <td class="amount">${formatCurrencyForPDF(item.tax_amount)}</td>
      <td class="amount">${formatCurrencyForPDF(item.line_total)}</td>
    </tr>
  `).join('') || '';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>LPO ${lpo.lpo_number}</title>
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
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 2px solid #333;
        }
        
        .company-info {
          flex: 1;
        }
        
        .company-name {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        
        .company-details {
          font-size: 10px;
          line-height: 1.6;
          color: #666;
        }
        
        .document-title {
          font-size: 24px;
          font-weight: bold;
          text-align: center;
          margin: 20px 0;
          text-transform: uppercase;
        }
        
        .info-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin: 20px 0;
        }
        
        .info-block {
          padding: 15px;
          background: #f8f9fa;
          border-radius: 4px;
          border: 1px solid #e9ecef;
        }
        
        .section-title {
          font-size: 12px;
          font-weight: bold;
          margin-bottom: 10px;
          text-transform: uppercase;
          color: #333;
        }
        
        .info-content {
          font-size: 11px;
          line-height: 1.8;
          color: #666;
        }
        
        .info-content div {
          margin-bottom: 4px;
        }
        
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          font-size: 10px;
          border: 1px solid #dee2e6;
        }
        
        .items-table thead {
          background: #f0f0f0;
          border: 1px solid #dee2e6;
        }
        
        .items-table th {
          padding: 10px;
          text-align: left;
          font-weight: bold;
          border: 1px solid #dee2e6;
        }
        
        .items-table td {
          padding: 8px 10px;
          border: 1px solid #dee2e6;
        }
        
        .items-table tbody tr:nth-child(even) {
          background: #f8f9fa;
        }
        
        .amount {
          text-align: right !important;
          font-weight: 500;
        }
        
        .center {
          text-align: center !important;
        }
        
        .totals-section {
          display: flex;
          justify-content: flex-end;
          margin: 20px 0;
        }
        
        .totals {
          width: 300px;
        }
        
        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #dee2e6;
        }
        
        .total-row.final {
          border-top: 2px solid #333;
          border-bottom: 2px solid #333;
          font-weight: bold;
          font-size: 12px;
          padding: 10px 0;
        }
        
        .notes-section {
          margin-top: 20px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        
        .notes-block {
          padding: 15px;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 4px;
        }
        
        .notes-block-title {
          font-weight: bold;
          margin-bottom: 10px;
          font-size: 11px;
          text-transform: uppercase;
        }
        
        .notes-content {
          font-size: 10px;
          line-height: 1.6;
          white-space: pre-wrap;
          color: #666;
        }
        
        .stamp-section {
          margin-top: 30px;
          padding: 20px;
          border-top: 1px solid #dee2e6;
          text-align: center;
        }
        
        .stamp-image {
          width: 44mm;
          height: 44mm;
          object-fit: contain;
          margin-top: 10px;
        }
        
        .footer {
          margin-top: 30px;
          padding-top: 15px;
          border-top: 1px solid #e9ecef;
          font-size: 9px;
          color: #999;
          text-align: center;
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
        <!-- Full-width header image -->
        ${headerImage ? `<img src="${headerImage}" alt="${companyData.name}" class="header-image" />` : ''}
        
        <!-- Header Section -->
        <div class="header">
          <div class="company-info">
            <div class="company-name">${companyData.name}</div>
            <div class="company-details">
              ${companyData.registration_number ? `Registration: ${companyData.registration_number}<br>` : ''}
              ${companyData.tax_number ? `PIN: ${companyData.tax_number}<br>` : ''}
              ${companyData.address ? `${companyData.address}<br>` : ''}
              ${[companyData.city, companyData.state, companyData.postal_code].filter(Boolean).join(', ')}${companyData.country ? `, ${companyData.country}` : ''}<br>
              ${companyData.phone ? `Tel: ${companyData.phone}<br>` : ''}
              ${companyData.email ? `Email: ${companyData.email}` : ''}
            </div>
          </div>
        </div>
        
        <!-- Document Title -->
        <div class="document-title">LOCAL PURCHASE ORDER</div>
        
        <!-- Info Sections -->
        <div class="info-section">
          <div class="info-block">
            <div class="section-title">LPO Details</div>
            <div class="info-content">
              <div><strong>LPO Number:</strong> ${lpo.lpo_number}</div>
              <div><strong>LPO Date:</strong> ${formatDateForPDF(lpo.lpo_date)}</div>
              ${lpo.delivery_date ? `<div><strong>Delivery Date:</strong> ${formatDateForPDF(lpo.delivery_date)}</div>` : ''}
              <div><strong>Status:</strong> ${lpo.status.toUpperCase()}</div>
            </div>
          </div>
          
          <div class="info-block">
            <div class="section-title">Supplier Information</div>
            <div class="info-content">
              ${lpo.suppliers ? `
                <div><strong>${lpo.suppliers.name}</strong></div>
                ${lpo.suppliers.address ? `<div>${lpo.suppliers.address}</div>` : ''}
                ${[lpo.suppliers.city, lpo.suppliers.country].filter(Boolean).join(', ') ? `<div>${[lpo.suppliers.city, lpo.suppliers.country].filter(Boolean).join(', ')}</div>` : ''}
                ${lpo.suppliers.phone ? `<div>Phone: ${lpo.suppliers.phone}</div>` : ''}
                ${lpo.suppliers.email ? `<div>Email: ${lpo.suppliers.email}</div>` : ''}
              ` : '<div>No supplier information provided</div>'}
            </div>
          </div>
        </div>
        
        ${lpo.delivery_address || lpo.contact_person || lpo.contact_phone ? `
          <div class="info-block">
            <div class="section-title">Delivery Information</div>
            <div class="info-content">
              ${lpo.contact_person ? `<div><strong>Contact Person:</strong> ${lpo.contact_person}</div>` : ''}
              ${lpo.contact_phone ? `<div><strong>Contact Phone:</strong> ${lpo.contact_phone}</div>` : ''}
              ${lpo.delivery_address ? `<div><strong>Address:</strong><br>${lpo.delivery_address.replace(/\n/g, '<br>')}</div>` : ''}
            </div>
          </div>
        ` : ''}
        
        <!-- Items Table -->
        ${lpo.lpo_items && lpo.lpo_items.length > 0 ? `
          <table class="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Tax %</th>
                <th>Tax Amount</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsTableRows}
            </tbody>
          </table>
          
          <!-- Totals -->
          <div class="totals-section">
            <div class="totals">
              <div class="total-row">
                <span>Subtotal:</span>
                <span>${formatCurrencyForPDF(lpo.subtotal)}</span>
              </div>
              <div class="total-row">
                <span>Tax Amount:</span>
                <span>${formatCurrencyForPDF(lpo.tax_amount)}</span>
              </div>
              <div class="total-row final">
                <span>Total Amount:</span>
                <span>${formatCurrencyForPDF(lpo.total_amount)}</span>
              </div>
            </div>
          </div>
        ` : ''}
        
        <!-- Notes Section -->
        <div class="notes-section">
          ${lpo.notes ? `
            <div class="notes-block">
              <div class="notes-block-title">Notes</div>
              <div class="notes-content">${lpo.notes}</div>
            </div>
          ` : ''}
          
          ${lpo.terms_and_conditions ? `
            <div class="notes-block">
              <div class="notes-block-title">Terms & Conditions</div>
              <div class="notes-content">${lpo.terms_and_conditions}</div>
            </div>
          ` : ''}
        </div>
        
        <!-- Stamp Section -->
        <div class="stamp-section">
          <div style="font-weight: bold;">COMPANY STAMP / AUTHORIZED BY</div>
          ${stampImage ? `<img src="${stampImage}" alt="Company Stamp" class="stamp-image" />` : '<div style="color: #999; margin-top: 20px;">Company Stamp</div>'}
        </div>
        
        <!-- Footer -->
        <div class="footer">
          Generated on ${new Date().toLocaleString()} | Page 1
        </div>
      </div>
      
      <script>
        window.print();
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
};
