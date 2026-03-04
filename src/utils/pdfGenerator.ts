// PDF Generation utility using jsPDF + html2canvas for auto-download
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-expressions, prefer-const, no-self-assign, no-useless-escape */
// Two-column bank details layout updated
import { PDF_PAGE_CSS } from './pdfMarginConstants';
import { formatCurrency as formatCurrencyUtil } from './currencyFormatter';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { getProjectTitleFromInvoice } from './boqInvoiceLinkage';

// Helper function to render HTML content to canvas
const renderHTMLToCanvas = async (htmlContent: string, pageSelector: string) => {
  let wrapper: HTMLElement | null = null;
  try {
    // Create a temporary wrapper for proper rendering
    wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.left = '0';
    wrapper.style.top = '0';
    wrapper.style.width = '210mm';
    wrapper.style.height = 'auto';
    wrapper.style.backgroundColor = '#ffffff';
    wrapper.style.zIndex = '-999999';
    wrapper.style.pointerEvents = 'none';
    wrapper.innerHTML = htmlContent;

    // Append to body to allow CSS to render
    document.body.appendChild(wrapper);

    // Wait longer for images and fonts to load
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Force a reflow to ensure content is rendered
    wrapper.offsetHeight;

    // Preload all images in the wrapper to ensure they're loaded before canvas conversion
    const images = wrapper.querySelectorAll('img');
    const imageLoadPromises = Array.from(images).map(img => {
      return new Promise<void>((resolve) => {
        if (!img.src) {
          resolve();
          return;
        }

        const onLoad = () => {
          resolve();
        };

        const onError = () => {
          // Log error but still resolve to continue
          console.warn('Failed to load image:', img.src);
          resolve();
        };

        if (img.complete && img.naturalHeight > 0) {
          resolve();
        } else {
          img.addEventListener('load', onLoad);
          img.addEventListener('error', onError);
          // Force reload
          img.src = img.src;
        }
      });
    });

    await Promise.all(imageLoadPromises);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Select the specific page section to render
    const pageElement = wrapper.querySelector(pageSelector) as HTMLElement;
    if (!pageElement) {
      throw new Error(`Page selector "${pageSelector}" not found in HTML content`);
    }

    // Convert HTML to canvas - render only the specific page
    const canvas = await html2canvas(pageElement, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      allowTaint: true,
      useCORS: true,
      imageTimeout: 15000,
      timeout: 45000,
      windowHeight: Math.max(pageElement.scrollHeight, pageElement.offsetHeight) || 1000,
      windowWidth: 210 * 3.779527559, // 210mm to pixels
      proxy: undefined,
      foreignObjectRendering: false,
      ignoreElements: (el) => {
        // Don't ignore any elements needed for PDF
        return false;
      }
    });

    return { canvas, wrapper };
  } catch (error) {
    if (wrapper && wrapper.parentNode) {
      wrapper.parentNode.removeChild(wrapper);
    }
    throw error;
  }
};

// Helper function to render BOQ sections separately to avoid row splitting
const renderBOQSectionsToPDF = async (pdf: jsPDF, wrapper: HTMLElement, pageWidth: number, pageHeight: number, headerHTML: string) => {
  let isFirstPage = true;

  // First render and add header on first page
  const headerWrapper = document.createElement('div');
  headerWrapper.style.position = 'absolute';
  headerWrapper.style.left = '0';
  headerWrapper.style.top = '0';
  headerWrapper.style.width = '210mm';
  headerWrapper.style.height = 'auto';
  headerWrapper.style.backgroundColor = '#ffffff';
  headerWrapper.style.zIndex = '-999999';
  headerWrapper.style.pointerEvents = 'none';
  headerWrapper.innerHTML = headerHTML;
  document.body.appendChild(headerWrapper);

  await new Promise(resolve => setTimeout(resolve, 2000));

  const headerCanvas = await html2canvas(headerWrapper, {
    scale: 2,
    backgroundColor: '#ffffff',
    logging: false,
    allowTaint: true,
    useCORS: true,
    imageTimeout: 15000,
    timeout: 45000,
    windowHeight: Math.max(headerWrapper.scrollHeight, headerWrapper.offsetHeight) || 1000,
    windowWidth: 210 * 3.779527559,
    proxy: undefined,
    foreignObjectRendering: false
  });

  const headerImgData = headerCanvas.toDataURL('image/png');
  const headerImgHeight = (headerCanvas.height * pageWidth) / headerCanvas.width;
  pdf.addImage(headerImgData, 'PNG', 0, 0, pageWidth, headerImgHeight);

  document.body.removeChild(headerWrapper);

  // Now render each section separately
  const sectionBlocks = wrapper.querySelectorAll('.section-block');
  let currentPageHeight = headerImgHeight;

  for (const sectionBlock of sectionBlocks) {
    const sectionWrapper = document.createElement('div');
    sectionWrapper.style.position = 'absolute';
    sectionWrapper.style.left = '0';
    sectionWrapper.style.top = '0';
    sectionWrapper.style.width = '210mm';
    sectionWrapper.style.height = 'auto';
    sectionWrapper.style.backgroundColor = '#ffffff';
    sectionWrapper.style.zIndex = '-999999';
    sectionWrapper.style.pointerEvents = 'none';
    sectionWrapper.innerHTML = (sectionBlock as HTMLElement).outerHTML;
    document.body.appendChild(sectionWrapper);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const sectionCanvas = await html2canvas(sectionWrapper, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      allowTaint: true,
      useCORS: true,
      imageTimeout: 15000,
      timeout: 45000,
      windowHeight: Math.max(sectionWrapper.scrollHeight, sectionWrapper.offsetHeight) || 1000,
      windowWidth: 210 * 3.779527559,
      proxy: undefined,
      foreignObjectRendering: false
    });

    const sectionImgData = sectionCanvas.toDataURL('image/png');
    const sectionImgHeight = (sectionCanvas.height * pageWidth) / sectionCanvas.width;

    // Check if section fits on current page, if not start new page
    if (currentPageHeight + sectionImgHeight > pageHeight + 10) {
      pdf.addPage();
      currentPageHeight = 0;
    }

    pdf.addImage(sectionImgData, 'PNG', 0, currentPageHeight, pageWidth, sectionImgHeight);
    currentPageHeight += sectionImgHeight;

    document.body.removeChild(sectionWrapper);
  }
};

// Helper function to add canvas to PDF with proper page handling
const addCanvasToPDF = async (pdf: jsPDF, canvas: HTMLCanvasElement, pageWidth: number, pageHeight: number) => {
  // Validate canvas
  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    console.error('Canvas rendering failed - content may not be visible', {
      width: canvas?.width,
      height: canvas?.height
    });
    throw new Error('Failed to render content to canvas - canvas is empty');
  }

  // Get canvas data
  const imgData = canvas.toDataURL('image/png');
  const imgWidth = pageWidth; // A4 width in mm
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;
  let isFirstPage = true;

  // Add images to PDF pages - only add pages with actual content
  while (heightLeft > 1) { // Use > 1 instead of >= 0 to avoid blank pages
    if (!isFirstPage) {
      pdf.addPage();
    }

    pdf.addImage(imgData, 'PNG', 0, -position, pageWidth, imgHeight);
    heightLeft -= pageHeight;
    position += pageHeight;
    isFirstPage = false;
  }
};

// Helper function to convert HTML to PDF and auto-download
const convertHTMLToPDFAndDownload = async (htmlContent: string, filename: string) => {
  let wrapper: HTMLElement | null = null;
  try {
    // Create a temporary wrapper for proper rendering
    wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.left = '0';
    wrapper.style.top = '0';
    wrapper.style.width = '210mm';
    wrapper.style.height = 'auto';
    wrapper.style.backgroundColor = '#ffffff';
    wrapper.style.zIndex = '-999999';
    wrapper.style.pointerEvents = 'none';
    wrapper.innerHTML = htmlContent;

    // Append to body to allow CSS to render
    document.body.appendChild(wrapper);

    // Wait longer for images and fonts to load
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Force a reflow to ensure content is rendered
    wrapper.offsetHeight;

    // Preload all images in the wrapper to ensure they're loaded before canvas conversion
    const images = wrapper.querySelectorAll('img');
    const imageLoadPromises = Array.from(images).map(img => {
      return new Promise<void>((resolve) => {
        if (!img.src) {
          resolve();
          return;
        }

        const onLoad = () => {
          resolve();
        };

        const onError = () => {
          // Log error but still resolve to continue
          console.warn('Failed to load image:', img.src);
          resolve();
        };

        if (img.complete && img.naturalHeight > 0) {
          resolve();
        } else {
          img.addEventListener('load', onLoad);
          img.addEventListener('error', onError);
          // Force reload
          img.src = img.src;
        }
      });
    });

    await Promise.all(imageLoadPromises);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm

    // Validate PDF was created
    if (!pdf || !pdf.internal) {
      throw new Error('Failed to create PDF document');
    }

    // Find all page sections in the wrapper
    const pageSections = wrapper.querySelectorAll('.page, .page-section');
    let isFirstPage = true;

    // Render each page section separately to avoid cutting across pages
    for (const pageElement of pageSections) {
      // Convert each page element to canvas
      const pageCanvas = await html2canvas(pageElement as HTMLElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: true,
        useCORS: true,
        imageTimeout: 15000,
        timeout: 45000,
        windowHeight: Math.max((pageElement as HTMLElement).scrollHeight, (pageElement as HTMLElement).offsetHeight) || 1000,
        windowWidth: 210 * 3.779527559, // 210mm to pixels
        proxy: undefined,
        foreignObjectRendering: false
      });

      // Validate canvas
      if (!pageCanvas || pageCanvas.width === 0 || pageCanvas.height === 0) {
        console.warn('Canvas rendering failed for a page - content may not be visible');
        continue;
      }

      // Get canvas data with proper DPI scaling
      const imgData = pageCanvas.toDataURL('image/png');
      const pageImgWidth = pageWidth; // 210mm
      const pageImgHeight = (pageCanvas.height * pageImgWidth) / pageCanvas.width;

      // Account for margins - each page should have 15mm margins on all sides
      const marginTop = 0; // Already included in the page element's padding
      const marginLeft = 0; // Already included in the page element's padding

      let heightLeft = pageImgHeight;
      let position = 0;

      // Add image to PDF, handling multiple page-heights if needed
      while (heightLeft > 1) { // Use > 1 instead of >= 0 to avoid blank pages
        if (!isFirstPage) {
          pdf.addPage();
        }

        // Calculate the height to print on this PDF page
        const heightToPrint = Math.min(pageHeight, heightLeft);
        pdf.addImage(imgData, 'PNG', marginLeft, marginTop - position, pageImgWidth, pageImgHeight);

        heightLeft -= pageHeight;
        position += pageHeight;
        isFirstPage = false;
      }
    }

    // Fallback: if no page sections found, render entire content
    if (pageSections.length === 0) {
      const canvas = await html2canvas(wrapper, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: true,
        useCORS: true,
        imageTimeout: 15000,
        timeout: 45000,
        windowHeight: Math.max(wrapper.scrollHeight, wrapper.offsetHeight) || 1000,
        windowWidth: 210 * 3.779527559,
        proxy: undefined,
        foreignObjectRendering: false
      });

      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        throw new Error('Failed to render content to canvas - canvas is empty');
      }

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      while (heightLeft > 1) { // Use > 1 instead of >= 0 to avoid blank pages
        if (!isFirstPage) {
          pdf.addPage();
        }
        pdf.addImage(imgData, 'PNG', 0, -position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        position += pageHeight;
        isFirstPage = false;
      }
    }

    // Validate PDF has content
    if (pdf.internal.pages.length === 0) {
      throw new Error('Failed to add content to PDF');
    }

    // Download the PDF with proper error handling
    try {
      pdf.save(filename);
      // Give browser time to start download before returning
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (downloadError) {
      console.error('Failed to trigger PDF download:', downloadError);
      throw new Error(`Failed to download PDF file: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    // Re-throw to be handled by caller
    throw error;
  } finally {
    // Clean up
    if (wrapper && document.body.contains(wrapper)) {
      document.body.removeChild(wrapper);
    }
  }
};

export interface DocumentData {
  type: 'quotation' | 'invoice' | 'remittance' | 'proforma' | 'delivery' | 'statement' | 'receipt' | 'lpo' | 'boq';
  number: string;
  date: string;
  lpo_number?: string;
  currency?: string; // Currency code: 'KES', 'USD', 'EUR'
  customTitle?: string; // Optional custom title for BOQ PDFs
  stampImageUrl?: string; // Optional stamp image URL for special PDFs
  customer: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
  };
  company?: CompanyDetails; // Optional company details override
  // BOQ-specific structured fields
  project_title?: string;
  contractor?: string;
  items?: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    discount_percentage?: number;
    discount_before_vat?: number;
    discount_amount?: number;
    tax_percentage?: number;
    tax_amount?: number;
    tax_inclusive?: boolean;
    line_total: number;
    unit_of_measure?: string;
    transaction_date?: string;
    reference?: string;
    debit?: number;
    credit?: number;
    transaction_type?: string;
    balance?: number;
    days_overdue?: number;
    due_date?: string;
    item_code?: string;
    section_name?: string;
    section_labor_cost?: number;
  }>;
  preliminaries_items?: Array<{
    item_code: string;
    description: string;
    line_total: number;
  }>;
  subtotal?: number;
  tax_amount?: number;
  total_amount: number;
  paid_amount?: number;
  balance_due?: number;
  notes?: string;
  terms_and_conditions?: string;
  showCalculatedValuesInTerms?: boolean; // Whether to show calculated values (e.g., "50% (KES 50,000)") in terms
  valid_until?: string; // For proforma invoices
  due_date?: string; // For invoices
  // Receipt specific fields
  value_tendered?: number;
  change?: number;
  payment_method?: string;
  // Delivery note specific fields
  delivery_date?: string;
  delivery_address?: string;
  delivery_method?: string;
  carrier?: string;
  tracking_number?: string;
  delivered_by?: string;
  received_by?: string;
  // Quotation sections
  sections?: Array<{
    name: string;
    items: Array<{
      description: string;
      quantity: number;
      unit_price: number;
      tax_percentage?: number;
      tax_amount?: number;
      line_total: number;
    }>;
    labor_cost: number;
  }>;
}

// Company details interface
interface CompanyDetails {
  name: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  tax_number?: string;
  company_services?: string;
  logo_url?: string;
  header_image?: string;
  stamp_image?: string;
  default_terms_and_conditions?: string;
}

// Default company details (fallback) - logo will be determined dynamically
const DEFAULT_COMPANY: CompanyDetails = {
  name: 'Layons Construction Limited',
  address: '',
  city: 'Nairobi',
  country: 'Kenya',
  phone: '',
  email: 'layonscoltd@gmail.com',
  tax_number: '',
  logo_url: 'https://cdn.builder.io/api/v1/image/assets%2Fb048b36350454e4dba55aefd37788f9c%2Fbd04dab542504461a2451b061741034c?format=webp&width=800',
  header_image: 'https://cdn.builder.io/api/v1/image/assets%2Ff04fab3fe283460ba50093ba53a92dcd%2F1ce2c870c8304b9cab69f4c60615a6af?format=webp&width=800',
  stamp_image: 'https://cdn.builder.io/api/v1/image/assets%2Fd268027e32e4464daae70b56ad7162a8%2Fab5f0478b4fc4e3f942ccde11c08b62e?format=webp&width=800'
};

// Helper function to determine which columns have values
const analyzeColumns = (items: DocumentData['items']) => {
  if (!items || items.length === 0) return {};

  const columns = {
    discountPercentage: false,
    discountBeforeVat: false,
    discountAmount: false,
    taxPercentage: false,
    taxAmount: false,
  };

  items.forEach(item => {
    if (item.discount_percentage && item.discount_percentage > 0) {
      columns.discountPercentage = true;
    }
    if (item.discount_before_vat && item.discount_before_vat > 0) {
      columns.discountBeforeVat = true;
    }
    if (item.discount_amount && item.discount_amount > 0) {
      columns.discountAmount = true;
    }
    if (item.tax_percentage && item.tax_percentage > 0) {
      columns.taxPercentage = true;
    }
    if (item.tax_amount && item.tax_amount > 0) {
      columns.taxAmount = true;
    }
  });

  return columns;
};

// Reusable function to generate PDF header HTML
const generatePDFHeader = (
  headerImage: string,
  company: CompanyDetails,
  companyServices: string,
  data: DocumentData,
  formatDateLong: (date: string) => string,
  documentType: string = 'Quotation'
): string => {
  let documentNumber = 'Reference';
  // Use common 'Reference' label for all document types
  // Previously: 'Qtn No' for Quotation, 'BOQ No' for BOQ, 'Invoice No' for Invoice, 'Proforma No' for Proforma

  const displayNumber = data.customTitle === 'INVOICE'
    ? (data.number?.replace(/^BOQ-/, '') || '')
    : (data.number || '');

  return `
    <!-- Header Section -->
    <div class="header">
      <!-- Full-width header image -->
      ${headerImage ? `<img src="${headerImage}" alt="Layons Construction Limited" class="header-image" />` : ''}

      <!-- Header content below image -->
      <div class="header-content" style="display: flex; flex-direction: column; gap: 8px; margin-top: 2px; margin-bottom: 8px;">
        <!-- Top row: Services (left) and Company details (right) -->
        <div class="header-top" style="display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; width: calc(100% + 12mm); margin-right: -12mm; box-sizing: border-box; min-width: 0;">
          <!-- Services Section -->
          <div class="services-section" style="font-size: 12px; font-weight: bold; color: #000; line-height: 1.6; text-align: left; flex: 0 1 auto; box-sizing: border-box; min-width: 0;">
            ${(() => {
              const services = companyServices.split(/[\n,]/).map((s: string) => s.trim()).filter((s: string) => s.length > 0);
              const itemsPerLine = Math.ceil(services.length / 3);
              const line1 = services.slice(0, itemsPerLine).join(' • ');
              const line2 = services.slice(itemsPerLine, itemsPerLine * 2).join(' • ');
              const line3 = services.slice(itemsPerLine * 2).join(' • ');
              return `<div>${line1}</div>${line2 ? `<div>${line2}</div>` : ''}${line3 ? `<div>${line3}</div>` : ''}`;
            })()}
          </div>

          <!-- Company details (right-aligned) -->
          <div class="header-right" style="text-align: right; font-size: 12px; line-height: 1.6; font-weight: bold; flex: 0 0 auto; box-sizing: border-box; padding-right: 12mm; white-space: nowrap;">
            ${company.address ? `<div>${company.address}</div>` : ''}
            ${company.city ? `<div>${company.city}${company.country ? ', ' + company.country : ''}</div>` : ''}
            ${company.phone ? `<div>Telephone: ${company.phone}</div>` : ''}
            ${company.email ? `<div>${company.email}</div>` : ''}
            ${company.tax_number ? `<div>PIN: ${company.tax_number}</div>` : ''}
          </div>
        </div>

        <!-- Bottom row: All details with borderless two-column table -->
        <table style="font-size: 12px; line-height: 1.3; width: 100%; border-collapse: collapse; border: none; margin-bottom: 10px;">
          <tr style="border: none;">
            <td style="width: 70px; vertical-align: top; border: none; padding: 1px 0; line-height: 1.3; font-weight: bold;">Client</td>
            <td style="border: none; padding: 1px 0; line-height: 1.3; font-weight: bold;">
              <div style="line-height: 1.2;">${data.customer?.name || ''}</div>
              ${data.customer?.address ? `<div style="line-height: 1.2;">${data.customer.address}</div>` : ''}
              ${data.customer?.city ? `<div style="line-height: 1.2;">${data.customer.city}</div>` : ''}
              ${data.customer?.country ? `<div style="line-height: 1.2;">${data.customer.country}</div>` : ''}
            </td>
          </tr>
          ${data.project_title ? `
          <tr style="border: none;">
            <td style="width: 70px; vertical-align: top; border: none; padding: 1px 0; line-height: 1.3; font-weight: bold;">Project</td>
            <td style="border: none; padding: 1px 0; line-height: 1.3; font-weight: bold;">${data.project_title}</td>
          </tr>
          ` : ''}
          <tr style="border: none;">
            <td style="width: 70px; vertical-align: top; border: none; padding: 1px 0; line-height: 1.3; font-weight: bold;">Subject</td>
            <td style="border: none; padding: 1px 0; line-height: 1.3; font-weight: bold;">${documentType}</td>
          </tr>
          <tr style="border: none;">
            <td style="width: 70px; vertical-align: top; border: none; padding: 1px 0; line-height: 1.3; font-weight: bold;">Date</td>
            <td style="border: none; padding: 1px 0; line-height: 1.3; font-weight: bold;">${formatDateLong(data.date || '')}</td>
          </tr>
          <tr style="border: none;">
            <td style="width: 70px; vertical-align: top; border: none; padding: 1px 0; line-height: 1.3; font-weight: bold;">${documentNumber}</td>
            <td style="border: none; padding: 1px 0; line-height: 1.3; font-weight: bold;">${displayNumber}</td>
          </tr>
        </table>
      </div>
    </div>
  `;
};

// Helper function to escape HTML special characters
const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// Helper function to parse custom terms and render with flexbox alignment
const parseAndRenderTerms = (termsText: string, totalAmount?: number, showCalculatedValues: boolean = true, formatCurrency?: (amount: number) => string): string => {
  if (!termsText) return '';

  // Helper function to calculate percentage values
  const calculateValue = (text: string): string => {
    if (!totalAmount || !showCalculatedValues || !formatCurrency) return text;

    // Match percentage patterns like "50%" or "40%"
    const percentMatch = text.match(/(\d+)%/);
    if (percentMatch) {
      const percentage = parseInt(percentMatch[1], 10);
      const value = totalAmount * (percentage / 100);
      // Replace percentage with calculated value while preserving the text
      return text.replace(/\d+%/, `${percentage}% (${formatCurrency(value)})`);
    }
    return text;
  };

  // Split by lines and clean up
  const allLines = termsText.split('\n').filter(line => line.trim());

  interface TermItem {
    number: string;
    text: string;
    subItems: string[];
  }

  const items: TermItem[] = [];
  let currentMainItem: TermItem | null = null;

  for (const line of allLines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Try to match main numbered items (1., 2., 3., etc.)
    const mainMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
    if (mainMatch) {
      // Save previous item if exists
      if (currentMainItem) {
        items.push(currentMainItem);
      }
      // Create new main item
      currentMainItem = {
        number: mainMatch[1],
        text: mainMatch[2],
        subItems: []
      };
      continue;
    }

    // Try to match lettered sub-items (a., b., c., etc.)
    const subMatch = trimmedLine.match(/^([a-z])\.\s+(.+)$/i);
    if (subMatch && currentMainItem) {
      currentMainItem.subItems.push(subMatch[2]);
      continue;
    }

    // If we have a current main item and this is additional text (not starting with a number),
    // treat it as a sub-item (for bullet formatting)
    if (currentMainItem && trimmedLine && !trimmedLine.match(/^\d+\./)) {
      // Remove trailing comma if present for cleaner display
      const cleanedLine = trimmedLine.replace(/,\s*$/, '');
      currentMainItem.subItems.push(cleanedLine);
    } else if (!currentMainItem && trimmedLine) {
      // Standalone text - treat as part of main text if no current item
      console.warn('Unparsed term line:', trimmedLine);
    }
  }

  // Don't forget the last item
  if (currentMainItem) {
    items.push(currentMainItem);
  }

  // Render as HTML with proper numbered list and bullet points for sub-items
  let html = '<div style="margin: 0; padding-left: 0; font-size: 11px; line-height: 1.4;">';

  items.forEach((item) => {
    const mainText = calculateValue(escapeHtml(item.text));
    const itemNumber = parseInt(item.number, 10);

    if (item.subItems.length > 0 && itemNumber === 1) {
      // Item 1 with sub-items: use bullet points
      html += `<div style="margin-bottom: 4px;">
        <span style="font-weight: normal;">${itemNumber}. ${mainText}</span>
        <div style="margin-left: 20px; margin-top: 2px;">`;

      item.subItems.forEach(subItem => {
        const subText = calculateValue(escapeHtml(subItem));
        html += `<div style="margin-bottom: 2px;">• ${subText}</div>`;
      });

      html += `</div>
      </div>`;
    } else {
      // Main item without sub-items, or sub-items for items other than 1
      html += `<div style="margin-bottom: 4px;"><span>${itemNumber}. ${mainText}</span></div>`;

      // In case other items have sub-items, render them as bullets too
      if (item.subItems.length > 0) {
        html += `<div style="margin-left: 20px; margin-top: -2px; margin-bottom: 4px;">`;
        item.subItems.forEach(subItem => {
          const subText = calculateValue(escapeHtml(subItem));
          html += `<div style="margin-bottom: 2px;">• ${subText}</div>`;
        });
        html += `</div>`;
      }
    }
  });

  html += '</div>';

  return html;
};

export const generatePDF = async (data: DocumentData) => {
  console.log('🎨 generatePDF called');
  console.log('📄 Document type:', data.type);
  console.log('📋 Items count:', data.items?.length || 0);
  console.log('📑 Sections count:', data.sections?.length || 0);
  console.log('💰 Total amount:', data.total_amount);

  // Extract theme color variables from the main document so PDFs match the app theme
  const computed = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  const primaryVar = computed ? (computed.getPropertyValue('--primary') || '46 65% 53%').trim() : '46 65% 53%';
  const primaryForegroundVar = computed ? (computed.getPropertyValue('--primary-foreground') || '0 0% 10%').trim() : '0 0% 10%';
  const successVar = computed ? (computed.getPropertyValue('--success') || '140 50% 45%').trim() : '140 50% 45%';
  const warningVar = computed ? (computed.getPropertyValue('--warning') || '45 85% 57%').trim() : '45 85% 57%';

  // Build CSS root variables to inject into the PDF window
  const pdfRootVars = `:root { --primary: ${primaryVar}; --primary-foreground: ${primaryForegroundVar}; --success: ${successVar}; --warning: ${warningVar}; }`;

  // Use company details from data or fall back to defaults
  const company = data.company || DEFAULT_COMPANY;

  // Default services fallback
  const DEFAULT_SERVICES = 'BUILDING WORKS, RENOVATIONS, ROADWORKS, LANDSCAPING, ELECTRICAL WORKS, WATER WORKS, MECHANICAL WORKS';
  const companyServices = company.company_services || DEFAULT_SERVICES;

  // Get header and stamp images with fallbacks
  const headerImage = company.header_image || DEFAULT_COMPANY.header_image;
  const stampImage = company.stamp_image || DEFAULT_COMPANY.stamp_image;

  console.log('🖼️ Header Image:', headerImage);
  console.log('🔖 Stamp Image:', stampImage);
  console.log('📋 Company data:', company);

  // Analyze which columns have values
  const visibleColumns = analyzeColumns(data.items);
  const formatCurrency = (amount: number) => {
    return formatCurrencyUtil(amount, data.currency || 'KES');
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Longer, human-friendly date (e.g. 23 July 2025)
  const formatDateLong = (date: string) => {
    try {
      if (!date) return '';
      const d = new Date(date);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return String(date || '');
    }
  };

  const documentTitle = data.customTitle ||
                       (data.type === 'proforma' ? 'Proforma Invoice' :
                       data.type === 'delivery' ? 'Delivery Note' :
                       data.type === 'statement' ? 'Customer Statement' :
                       data.type === 'receipt' ? 'Payment Receipt' :
                       data.type === 'remittance' ? 'Remittance Advice' :
                       data.type === 'lpo' ? 'Purchase Order' :
                       data.type === 'boq' ? 'Bill of Quantities' :
                       data.type.charAt(0).toUpperCase() + data.type.slice(1));
  
  // Prefer structured fields if present, otherwise fall back to parsing notes
  let boqProject = data.project_title || '';
  let boqContractor = data.contractor || '';
  if (data.type === 'boq' && (!boqProject || !boqContractor) && data.notes) {
    const parts = data.notes.split('\n');
    parts.forEach(p => {
      const t = p.trim();
      if (!boqProject && t.toUpperCase().startsWith('PROJECT:')) boqProject = t.replace(/PROJECT:\s*/i, '').trim();
      if (!boqContractor && t.toUpperCase().startsWith('CONTRACTOR:')) boqContractor = t.replace(/CONTRACTOR:\s*/i, '').trim();
    });
  }

  // If this is a BOQ, render a dedicated BOQ-style layout
  if (data.type === 'boq') {
    // Build preliminaries table HTML if present
    let preliminariesHtml = '';
    let preliminariesTotal = 0;
    if (data.preliminaries_items && data.preliminaries_items.length > 0) {
      preliminariesHtml = `
        <div class="preliminaries-section">
          <table class="items">
            <thead>
              <tr>
                <th style="width:8%; font-weight: bold;">ITEM</th>
                <th style="width:72%; text-align:left; font-weight: bold;">DESCRIPTION</th>
                <th style="width:20%; font-weight: bold;">AMOUNT (${data.currency || 'KES'})</th>
              </tr>
            </thead>
            <tbody>
              <tr class="section-row"><td colspan="3" class="section-title">SECTION NO. 1: PRELIMINARIES</td></tr>
      `;
      let itemNo = 1;
      data.preliminaries_items.forEach((item) => {
        preliminariesHtml += `<tr class="item-row">
          <td class="num" style="text-align:center; width:8%">${item.item_code || ''}</td>
          <td class="desc" style="width:72%">${item.description}</td>
          <td class="amount" style="width:20%; text-align:right; font-weight:600">${formatCurrency(item.line_total || 0)}</td>
        </tr>`;
        preliminariesTotal += item.line_total || 0;
      });
      preliminariesHtml += `
              <tr class="section-total">
                <td colspan="2" class="label" style="text-align:right; font-weight:700">SECTION TOTAL:</td>
                <td class="amount" style="text-align:right; font-weight:700">${formatCurrency(preliminariesTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

    // Build separate table blocks for each section to enable page breaks
    let tablesHtml = '';
    let currentSection = '';
    let sectionRowsHtml = '';
    let itemNo = 0;

    // Detect if subsections are present (items produced by boqPdfGenerator)
    const hasSubsections = (data.items || []).some((it) => typeof it.description === 'string' && it.description.toLowerCase().includes('subsection'));

    // Keep track of section totals to compute final total as sum of section totals
    const sectionTotals: number[] = [];

    // Helpers to detect row kinds
    const isSectionHeader = (d: string) => /^section\s+[a-z]:\s*/i.test(d);
    const isSubsectionHeader = (d: string) => /^\s*[→-]?\s*subsection\s+[^:]+:\s*/i.test(d);
    const isSubsectionSubtotal = (d: string) => /^subsection\s+[^\s]+\s+subtotal\s*$/i.test(d);
    const isSectionTotalRow = (d: string) => /^section\s+total$/i.test(d);

    let sectionCount = 0;

    // Helper to create a table block for a section
    const createSectionTable = (sectionTitle: string, sectionRows: string, isFirstSection: boolean): string => {
      return `
        <div class="section-block" style="page-break-before: ${isFirstSection ? 'avoid' : 'always'} !important; page-break-inside: avoid !important; break-before: ${isFirstSection ? 'avoid' : 'page'};">
          <table class="items" style="margin-bottom: 12mm; margin-left: 15mm; margin-right: 15mm; width: calc(100% - 30mm); page-break-after: auto;">
            <thead>
              <tr>
                <th style="width:5%; font-weight: bold;">No</th>
                <th style="width:55%; text-align:left; font-weight: bold;">DESCRIPTION</th>
                <th style="width:8%; font-weight: bold;">QTY</th>
                <th style="width:9%; font-weight: bold;">UNIT</th>
                <th style="width:11%; font-weight: bold;">RATE (${data.currency || 'KES'})</th>
                <th style="width:12%; text-align:right; font-weight: bold;">AMOUNT (${data.currency || 'KES'})</th>
              </tr>
            </thead>
            <tbody>
              <tr class="section-row-header"><td colspan="6" class="section-title-in-table" style="background:#f4f4f4; font-weight:700; padding: 8px 10px; line-height: 1.4; font-size: 9px; text-align: left; letter-spacing: 0.3px;">${sectionTitle}</td></tr>
              ${sectionRows}
            </tbody>
          </table>
        </div>
      `;
    };

    if (hasSubsections) {
      (data.items || []).forEach((it) => {
        const desc = String(it.description || '');

        if (isSectionHeader(desc)) {
          // Close previous section table if exists
          if (currentSection && sectionRowsHtml) {
            tablesHtml += createSectionTable(currentSection, sectionRowsHtml, sectionCount === 0);
            sectionCount++;
          }
          // Start new section
          currentSection = desc;
          sectionRowsHtml = '';
          itemNo = 0;
          return;
        }

        if (isSubsectionSubtotal(desc)) {
          sectionRowsHtml += `<tr class=\"subsection-total\">\n          <td class=\"num\"></td>\n          <td colspan=\"4\" class=\"label\">${desc}</td>\n          <td class=\"amount\">${formatCurrency(it.line_total || 0)}</td>\n        </tr>`;
          return;
        }

        if (isSubsectionHeader(desc)) {
          itemNo = 0;
          sectionRowsHtml += `<tr class=\"subsection-row\"><td class=\"num\"></td><td colspan=\"5\" class=\"subsection-title\">${desc.replace(/^\s*[→-]?\s*/, '')}</td></tr>`;
          return;
        }

        if (isSectionTotalRow(desc)) {
          const total = Number(it.line_total || 0);
          sectionTotals.push(total);
          sectionRowsHtml += `<tr class=\"section-total\">\n          <td class=\"num\"></td>\n          <td colspan=\"4\" class=\"label\">SECTION TOTAL:</td>\n          <td class=\"amount\">${formatCurrency(total)}</td>\n        </tr>`;
          itemNo = 0;
          return;
        }

        // Regular item row within subsection
        itemNo += 1;
        sectionRowsHtml += `<tr class=\"item-row\">\n        <td class=\"num\">${itemNo}</td>\n        <td class=\"desc\">${it.description}</td>\n        <td class=\"qty\">${it.quantity || ''}</td>\n        <td class=\"unit\">${(it as any).unit_abbreviation || it.unit_of_measure || ''}</td>\n        <td class=\"rate\">${formatCurrency(it.unit_price || 0)}</td>\n        <td class=\"amount\">${formatCurrency(it.line_total || 0)}</td>\n      </tr>`;
      });
      // Flush last section
      if (currentSection && sectionRowsHtml) {
        tablesHtml += createSectionTable(currentSection, sectionRowsHtml, sectionCount === 0);
      }
    } else {
      // Legacy behavior: section headers are items with qty=0 and unit_price=0; totals are computed per section
      let runningSectionTotal = 0;
      (data.items || []).forEach((it) => {
        const isSection = (it.quantity === 0 && it.unit_price === 0);
        if (isSection) {
          // Close previous section table if exists
          if (itemNo > 0) {
            sectionRowsHtml += `<tr class=\"section-total\">\n          <td class=\"num\"></td>\n          <td colspan=\"4\" class=\"label\">SECTION TOTAL:</td>\n          <td class=\"amount\">${formatCurrency(runningSectionTotal)}</td>\n        </tr>`;
            sectionTotals.push(runningSectionTotal);
            tablesHtml += createSectionTable(currentSection, sectionRowsHtml, sectionCount === 0);
            sectionCount++;
          }
          runningSectionTotal = 0;
          itemNo = 0;
          currentSection = it.description;
          sectionRowsHtml = '';
          return;
        }
        itemNo += 1;
        const line = (it.line_total || 0);
        runningSectionTotal += line;
        sectionRowsHtml += `<tr class=\"item-row\">\n        <td class=\"num\">${itemNo}</td>\n        <td class=\"desc\">${it.description}</td>\n        <td class=\"qty\">${it.quantity || ''}</td>\n        <td class=\"unit\">${(it as any).unit_abbreviation || it.unit_of_measure || ''}</td>\n        <td class=\"rate\">${formatCurrency(it.unit_price || 0)}</td>\n        <td class=\"amount\">${formatCurrency(line)}</td>\n      </tr>`;
      });
      // Flush last section
      if (itemNo > 0) {
        sectionRowsHtml += `<tr class=\"section-total\">\n          <td class=\"num\"></td>\n          <td colspan=\"4\" class=\"label\">SECTION TOTAL:</td>\n          <td class=\"amount\">${formatCurrency(runningSectionTotal)}</td>\n        </tr>`;
        sectionTotals.push(runningSectionTotal);
        tablesHtml += createSectionTable(currentSection, sectionRowsHtml, sectionCount === 0);
      }
    }

    // Compute grand total for BOQ as sum of section totals if present; otherwise fallback to provided total
    let mainSectionsTotal = (sectionTotals.length > 0)
      ? sectionTotals.reduce((a, b) => a + b, 0)
      : (data.total_amount || data.subtotal || 0);
    const grandTotalForBOQ = preliminariesTotal + mainSectionsTotal;

    const htmlContentBOQ = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>BILLS OF QUANTITIES ${data.number}</title>
      <meta charset="UTF-8">
      <style>
        ${pdfRootVars}
        ${PDF_PAGE_CSS}
        @media print { @page { orphans: 3; widows: 3; } }
        @media print {
          @page { counter-increment: page; }
        }
        * { box-sizing: border-box; }
        body { font-family: 'Arial', sans-serif; margin:0; padding:0; color:#222; font-size:12px; }
        body { counter-reset: page; }

        /* Compact styles for special invoice */
        body.special-invoice { font-size: 11px; }
        body.special-invoice .boq-main { padding: 0; }
        body.special-invoice .items th, body.special-invoice .items td { padding: 4px 6px; font-size: 10px; }
        body.special-invoice .header-content { gap: 8px; margin-top: 4px; }
        body.special-invoice .header-right > div { margin-bottom: 2px; }
        body.special-invoice .services-section > div { margin: 0 0 2px 0; }
        .pagefoot::after { content: "Page " counter(page) ""; }
        .container { width: 100%; box-sizing: border-box; max-width: 100%; margin: 0; padding: 0; }

        /* Header styling - full page width, no overflow */
        .header { margin: 0; padding: 0; width: 100%; box-sizing: border-box; page-break-inside: avoid; page-break-after: avoid; }
        .header-image { width: 100%; max-height: 150px; height: auto; object-fit: contain; display: block; margin: 0; padding: 0; box-sizing: border-box; }
        .header-content { display: flex; flex-direction: column; gap: 12px; margin-top: 6px; width: 100%; padding: 0 15mm; box-sizing: border-box; page-break-inside: avoid; }
        .header-top { display: flex; align-items: flex-start; width: 100%; margin: 0 0 10px 0; padding: 0; gap: 20px; box-sizing: border-box; min-width: 0; }
        .services-section { display: block; font-size: 12px; font-weight: bold; color: #000; line-height: 1.6; text-align: left; flex: 0 1 50%; box-sizing: border-box; min-width: 0; }
        .services-section > div { margin: 0 0 4px 0; }
        .services-section > div:last-child { margin-bottom: 0; }
        .header-right { display: block; text-align: right; font-size: 12px; line-height: 1.6; flex: 0 0 auto; padding: 0; margin: 0; box-sizing: border-box; }
        .header-right > div { font-weight: bold; text-align: right; margin-bottom: 4px; word-wrap: break-word; overflow-wrap: break-word; }
        .header-right > div:last-child { margin-bottom: 0; }

        body.special-invoice .header-top { margin-bottom: 6px; gap: 15px; }
        body.special-invoice .services-section { font-size: 11px; line-height: 1.4; }
        body.special-invoice .header-right { font-size: 11px; line-height: 1.4; }

        .items { width:100%; border-collapse:collapse; margin-top:0; margin-bottom: 4mm; margin-left: 15mm; margin-right: 15mm; width: calc(100% - 30mm); }
        .items th, .items td { border:1px solid #e6e6e6; padding: 4px 6px; font-size: 10px; vertical-align: middle; } .items tbody { margin-top: -1px; }
        .items thead th { background:#f8f9fa; color:#000; font-weight:bold; text-transform: uppercase; padding: 5px 6px 4px 6px; }
        .items thead { display: table-header-group; }

        body.special-invoice .items { margin-top: 3px; margin-bottom: 3px; }
        body.special-invoice .preliminaries-section { margin-bottom: 6px; }
        .section-row { page-break-inside: avoid; page-break-before: auto; page-break-after: avoid; margin: 2mm 0 0 0; height: auto; } .section-row td { height: auto; vertical-align: middle; padding: 7px 8px; }
        .section-row:first-of-type { page-break-before: avoid; margin-top: 0; margin-bottom: 1mm; }
        .section-row:not(:first-of-type) { page-break-before: auto; margin-top: 0; }
        .section-row td.section-title { background:#f4f4f4; font-weight:700; padding: 8px 10px; line-height: 1.4; font-size: 9px; text-align: left; vertical-align: middle; letter-spacing: 0.3px; }
        .item-row { page-break-inside: avoid; margin-bottom: 0; page-break-after: auto; } .item-row td { padding: 4px 7px; line-height: 1.3; }
        .item-row td.num { text-align:center; width: 5%; font-weight: 500; }
        .item-row td.desc { width: 55%; text-align: left; }
        .item-row td.qty { width: 8%; text-align:center; }
        .item-row td.unit { width: 9%; text-align:center; }
        .item-row td.rate { width: 11%; text-align:right; }
        .item-row td.amount { width: 12%; text-align:right; font-weight: 500; }
        .section-total { page-break-inside: avoid; page-break-before: avoid; margin-bottom: 3mm; margin-top: 2mm; page-break-after: auto; border-top: 2px solid #ddd; }
        .section-total td { font-weight:700; background:#f9f9f9; padding: 6px 8px; line-height: 1.4; }
        .section-total .label { text-align:right; padding: 6px 12px 6px 8px; }
        .preliminaries-section { margin-bottom: 8mm; page-break-inside: avoid; margin-left: 15mm; margin-right: 15mm; }
        .preliminaries-section .items { margin-top:0; margin-left: 0; margin-right: 0; width: 100%; }
        .subsection-row { page-break-inside: avoid; page-break-after: auto; margin: 3mm 0 2mm 0; padding: 2mm 0; }
        .subsection-row td { background:#f7f7f7; font-weight:600; padding: 5px 8px; line-height: 1.35; font-size: 10px; height: auto; vertical-align: middle; border-left: 3px solid #e0e0e0; }
        .subsection-title { padding: 5px 8px; vertical-align: middle; text-align: left; }
        .subsection-total { page-break-inside: avoid; page-break-before: avoid; margin-bottom: 4mm; margin-top: 2mm; page-break-after: auto; background: #fafafa; }
        .subsection-total td { font-weight:600; background:#fafafa; padding: 5px 8px; line-height: 1.4; border-left: 3px solid #e0e0e0; }
        .subsection-total .label { text-align:right; padding: 5px 12px 5px 8px; }
        .totals { margin-top:4mm; margin-bottom: 0; width: calc(100% - 30mm); margin-left: 15mm; margin-right: 15mm; page-break-inside: avoid; padding-bottom: 10mm; page-break-before: avoid; padding-top: 3mm; border-top: 1px solid #ddd; }

        body.special-invoice .section-total { margin-bottom: 2mm; }
        body.special-invoice .subsection-total { margin-bottom: 2mm; }
        body.special-invoice .totals { margin-top: 6px; padding-bottom: 20mm; }
        body.special-invoice .footer { margin-top: 12px; gap: 10px; }
        body.special-invoice .sig-block { gap: 4px; }
        body.special-invoice .sigline { height: 12px; }
        body.special-invoice .field-row { gap: 4px; }
        .totals .label { text-align:right; padding-right:12px; }
        .footer { margin-top:8mm; display:flex; flex-direction:column; gap:6mm; padding: 0 15mm; page-break-inside: avoid; }
        .sig-block { display:flex; flex-direction:column; gap:8px; }
        .sig-title { font-weight:700; font-size: 11px; }
        .sig-role { font-weight:600; font-size: 10px; color: #000; }
        .sigline { height:18px; border-bottom:1px solid #333; margin-top: 8px; }
        .field-row { display:flex; align-items:flex-end; gap:10px; }
        .field-row .label { width:100px; font-weight:600; font-size: 10px; }
        .field-row .fill { flex:1; height:18px; border-bottom:1px dotted #999; }
        .pagefoot { position:fixed; bottom:18mm; left:15mm; right:15mm; text-align:center; font-size:9px; color:#777; font-weight: 500; }

        /* Page sections are rendered separately to avoid text cutting */
        .boq-main {
          display: block;
          width: 100%;
          padding: 0;
          box-sizing: border-box;
          max-width: 100%;
          overflow: hidden;
          margin: 0;
          page-break-after: auto;
        }

        /* New page top spacing */
        .boq-main > .items:first-of-type {
          margin-top: 0;
        }

        .boq-main > .items {
          margin-top: 8mm;
        }

        .boq-main > .preliminaries-section {
          margin-top: 0;
        }

        .boq-main .items {
          margin-left: 0 !important;
          margin-right: 0 !important;
          width: 100% !important;
        }

        .boq-main .preliminaries-section {
          margin-left: 0 !important;
          margin-right: 0 !important;
        }

        .boq-main .totals {
          margin-left: 0 !important;
          margin-right: 0 !important;
          width: 100% !important;
        }

        .sections-container {
          display: block;
          width: 100%;
          box-sizing: border-box;
        }

        .section-block {
          page-break-inside: avoid;
          break-inside: avoid;
          margin-bottom: 0;
        }

        .section-block + .section-block {
          page-break-before: always !important;
          break-before: page !important;
        }

        .sections-container table {
          page-break-inside: avoid;
          break-inside: avoid;
          page-break-after: auto;
        }

        .sections-container table thead {
          display: table-header-group;
        }

        .section-row-header {
          page-break-inside: avoid;
          page-break-after: auto;
        }

        .boq-main .header-content {
          padding-left: 0 !important;
          padding-right: 0 !important;
        }

        .boq-main .pagefoot {
          left: 0 !important;
          right: 0 !important;
        }

        .terms-page {
          display: block;
          width: 100%;
          padding: 12mm;
          page-break-before: always;
          box-sizing: border-box;
          margin: 0;
          page-break-after: auto;
          font-size: 11px;
          line-height: 1.3;
        }

        .terms-page table { border-collapse: collapse; width: 100%; }
        .terms-page table tr { border: none; }
        .terms-page table td { border: none; padding: 4px 0; }
        .stamp-image { width: 44mm; height: 44mm; }

        @media print {
          .header { margin: 0; padding: 0; }
          .header-content { margin: 0; padding: 0; }
          body { margin: 0; padding: 0; }
        }
      </style>
    </head>
    <body${data.customTitle === 'INVOICE' ? ' class="special-invoice"' : ''}>
      <!-- Page 1: BOQ Details -->
      <div class="boq-main">
        <div class="container">
          ${generatePDFHeader(headerImage, company, companyServices, { ...data, project_title: boqProject }, formatDateLong, documentTitle)}

          ${preliminariesHtml}

          <div style="height: 2mm;"></div>

          <div class="sections-container">
            ${tablesHtml}
          </div>

          <div class="totals">
            <table style="width:100%; margin-top:8px; margin-left: 0; margin-right: 0;">
              <tr>
                <td class="label" style="text-align:right; font-weight:700;">TOTAL:</td>
                <td style="width:150px; text-align:right; font-weight:700;">${formatCurrency(grandTotalForBOQ)}</td>
              </tr>
            </table>
          </div>

          ${data.customTitle === 'INVOICE' ? `
          <!-- Stamp for Invoice -->
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; display: flex; justify-content: center;">
            <div style="text-align: center; width: 60mm;">
              <img src="${data.stampImageUrl || stampImage}" alt="Company Stamp" style="width: 60mm; height: 60mm; object-fit: contain;" />
            </div>
          </div>
          ` : ''}
        </div>
      </div>

      <!-- Page 2: Terms and Conditions -->
      <div class="terms-page">
        <!-- Terms Section -->
        <div style="margin-bottom: 8px;">
          <h3 style="font-size: 13px; font-weight: bold; margin-bottom: 4px; margin-top: 0; text-transform: uppercase;">Terms;</h3>
          ${(data.terms_and_conditions || company.default_terms_and_conditions) ? `
            <div style="font-size: 11px; line-height: 1.4; margin: 0; padding: 0; color: #000;">
              ${parseAndRenderTerms(data.terms_and_conditions || company.default_terms_and_conditions, grandTotalForBOQ, data.showCalculatedValuesInTerms !== false, formatCurrency)}
            </div>
          ` : `
            <div style="font-size: 11px; line-height: 1.4; margin: 0; padding: 0; color: #000;">
              <p style="margin: 0; color: #666;">No terms and conditions specified.</p>
            </div>
          `}
        </div>

        <!-- Acceptance of Quote Section -->
        <div style="margin-bottom: 6px; padding-top: 4px;">
          <h3 style="font-size: 12px; font-weight: bold; margin-bottom: 3px; margin-top: 0; text-transform: uppercase;">Acceptance of Quote;</h3>
          <p style="font-size: 10px; margin: 0; line-height: 1.3; color: #000;">The above prices specifications and terms are satisfactory.</p>
        </div>

        <!-- Contractor Section -->
        <div style="margin-bottom: 6px; padding-top: 3px;">
          <table style="font-size: 10px; width: 100%; line-height: 1.4; color: #000; border: none;">
            <tr style="border: none;">
              <td style="width: 30%; border: none; padding: 2px 0;"><strong>Contractor;</strong></td>
              <td style="width: 70%; border: none; padding: 2px 0;">${company.name}</td>
            </tr>
            <tr style="border: none;">
              <td style="border: none; padding: 2px 0;"><strong>Tel No;</strong></td>
              <td style="border: none; padding: 2px 0;">254720717463</td>
            </tr>
            <tr style="border: none;">
              <td style="border: none; padding: 2px 0;"><strong>Signed;</strong></td>
              <td style="border: none; padding: 2px 0;">KELVIN MURIITHI</td>
            </tr>
          </table>
        </div>

        <!-- Client Section -->
        <div style="margin-bottom: 6px; padding-top: 3px;">
          <table style="font-size: 10px; width: 100%; line-height: 1.4; color: #000; border: none;">
            <tr style="border: none;">
              <td style="width: 30%; border: none; vertical-align: top; padding: 2px 0;"><strong>Client;</strong></td>
              <td style="width: 70%; border: none; padding: 2px 0;">
                ${data.customer.name}${data.customer.address ? '<br/>' + data.customer.address : ''}${data.customer.city ? '<br/>' + data.customer.city : ''}${data.customer.country ? '<br/>' + data.customer.country : ''}
              </td>
            </tr>
            ${data.customer.phone ? `
            <tr style="border: none;">
              <td style="width: 30%; border: none; padding: 2px 0;"><strong>Tel No;</strong></td>
              <td style="width: 70%; border: none; padding: 2px 0;">${data.customer.phone}</td>
            </tr>
            ` : ''}
            <tr style="border: none;">
              <td style="width: 30%; border: none; padding: 2px 0;"><strong>Customer signed;</strong></td>
              <td style="width: 70%; border: none; padding: 2px 0;">........................</td>
            </tr>
          </table>
        </div>

        <!-- Prepaired By Section -->
        <div style="margin-bottom: 4px; padding-top: 2px;">
          <table style="font-size: 10px; width: 100%; line-height: 1.4; color: #000; border: none;">
            <tr style="border: none;">
              <td style="width: 30%; border: none; padding: 2px 0;"><strong>PREPAIRED BY;</strong></td>
              <td style="width: 70%; border: none; padding: 2px 0;">${company.name}</td>
            </tr>
          </table>
        </div>

        <!-- Account Details Section with Stamp -->
        <div style="margin-top: 8px; padding-top: 4px; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; page-break-inside: avoid;">
          <div style="flex: 1;">
            <h3 style="font-size: 12px; font-weight: bold; margin-bottom: 8px; text-transform: uppercase;">Account Details;</h3>
            <table style="font-size: 10px; width: 100%; line-height: 1.8; color: #000; border: none;">
              <tr style="border: none;">
                <td style="width: 25%; border: none;"><strong>BANK;</strong></td>
                <td style="width: 37.5%; border: none;">CO-OPERATIVE BANK OF KENYA</td>
                <td style="width: 37.5%; border: none;">KCB BANK LIMITED</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>ACCOUNT NAME;</strong></td>
                <td style="border: none;">LAYONS CONSTRUCTION LIMITED</td>
                <td style="border: none;">LAYONS CONSTRUCTION LIMITED</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>ACCOUNT NUMBER;</strong></td>
                <td style="border: none;">01192659527000</td>
                <td style="border: none;">1349793760</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>BRANCH;</strong></td>
                <td style="border: none;">JUJA</td>
                <td style="border: none;">JKUAT</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>SWIFT CODE;</strong></td>
                <td style="border: none;">KCOOKENA</td>
                <td style="border: none;">KCBLKENX</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>BANK CODE;</strong></td>
                <td style="border: none;">11000</td>
                <td style="border: none;">01</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>BRANCH CODE;</strong></td>
                <td style="border: none;">11124</td>
                <td style="border: none;">314</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>PAYBILL;</strong></td>
                <td style="border: none;">400200</td>
                <td style="border: none;">522533</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>ACCOUNT;</strong></td>
                <td style="border: none;">01192659527000</td>
                <td style="border: none;">8064381</td>
              </tr>
            </table>
          </div>
          <div style="text-align: center; flex-shrink: 0; width: 44mm;">
            <img src="${data.stampImageUrl || stampImage}" alt="Stamp" style="width: 44mm; height: 44mm; object-fit: contain;" />
          </div>
        </div>
      </div>
    </body>
    </html>
    `;

    // Use separate rendering for BOQ main content and terms to avoid text cutting
    let boqWrapper: HTMLElement | null = null;
    let termsWrapper: HTMLElement | null = null;

    try {
      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm
      const margin = 15; // 15mm margins on all sides
      const contentWidth = pageWidth - (margin * 2); // 180mm

      // Render Page 1: BOQ Main Content
      console.log('Rendering BOQ main content...');
      boqWrapper = document.createElement('div');
      boqWrapper.style.position = 'absolute';
      boqWrapper.style.left = '0';
      boqWrapper.style.top = '0';
      boqWrapper.style.width = `${contentWidth}mm`;
      boqWrapper.style.height = 'auto';
      boqWrapper.style.backgroundColor = '#ffffff';
      boqWrapper.style.zIndex = '-999999';
      boqWrapper.style.pointerEvents = 'none';
      boqWrapper.innerHTML = htmlContentBOQ;

      document.body.appendChild(boqWrapper);
      await new Promise(resolve => setTimeout(resolve, 5000));
      boqWrapper.offsetHeight;

      // Preload images
      const boqImages = boqWrapper.querySelectorAll('img');
      const boqImagePromises = Array.from(boqImages).map(img => {
        return new Promise<void>((resolve) => {
          if (!img.src) {
            resolve();
            return;
          }
          if (img.complete && img.naturalHeight > 0) {
            resolve();
          } else {
            img.addEventListener('load', () => resolve());
            img.addEventListener('error', () => resolve());
            img.src = img.src;
          }
        });
      });
      await Promise.all(boqImagePromises);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Render BOQ main section
      const boqMainElement = boqWrapper.querySelector('.boq-main') as HTMLElement;
      if (!boqMainElement) {
        throw new Error('BOQ main section not found');
      }

      // Render sections separately to avoid row splitting across pages
      const headerElement = boqMainElement.querySelector('.container > .header') as HTMLElement;
      const preliminariesElement = boqMainElement.querySelector('.preliminaries-section') as HTMLElement;
      const sectionsContainer = boqMainElement.querySelector('.sections-container') as HTMLElement;

      // Render header first
      let currentPageY = margin;
      if (headerElement) {
        const headerWrapper2 = document.createElement('div');
        headerWrapper2.style.position = 'absolute';
        headerWrapper2.style.left = '0';
        headerWrapper2.style.top = '0';
        headerWrapper2.style.width = '210mm';
        headerWrapper2.style.height = 'auto';
        headerWrapper2.style.backgroundColor = '#ffffff';
        headerWrapper2.style.zIndex = '-999999';
        headerWrapper2.style.pointerEvents = 'none';
        headerWrapper2.style.overflow = 'visible';
        headerWrapper2.innerHTML = headerElement.outerHTML;
        document.body.appendChild(headerWrapper2);

        await new Promise(resolve => setTimeout(resolve, 2000));

        const headerCanvas = await html2canvas(headerWrapper2, {
          scale: 2,
          backgroundColor: '#ffffff',
          logging: false,
          allowTaint: true,
          useCORS: true,
          imageTimeout: 15000,
          timeout: 45000,
          windowHeight: Math.max(headerWrapper2.scrollHeight, headerWrapper2.offsetHeight, 500) + 100,
          windowWidth: 210 * 3.779527559,
          proxy: undefined,
          foreignObjectRendering: false
        });

        const headerImgData = headerCanvas.toDataURL('image/png');
        const headerImgWidth = pageWidth;
        const headerImgHeight = (headerCanvas.height * headerImgWidth) / headerCanvas.width;
        pdf.addImage(headerImgData, 'PNG', 0, currentPageY, headerImgWidth, headerImgHeight);
        currentPageY += headerImgHeight;

        document.body.removeChild(headerWrapper2);
      }

      // Render preliminaries if present
      if (preliminariesElement) {
        const prelim = document.createElement('div');
        prelim.style.position = 'absolute';
        prelim.style.left = '0';
        prelim.style.top = '0';
        prelim.style.width = '210mm';
        prelim.style.height = 'auto';
        prelim.style.backgroundColor = '#ffffff';
        prelim.style.zIndex = '-999999';
        prelim.style.pointerEvents = 'none';
        prelim.innerHTML = preliminariesElement.outerHTML;
        document.body.appendChild(prelim);

        await new Promise(resolve => setTimeout(resolve, 1000));

        const prelimCanvas = await html2canvas(prelim, {
          scale: 2,
          backgroundColor: '#ffffff',
          logging: false,
          allowTaint: true,
          useCORS: true,
          imageTimeout: 15000,
          timeout: 45000,
          windowHeight: Math.max(prelim.scrollHeight, prelim.offsetHeight) || 1000,
          windowWidth: 210 * 3.779527559,
          proxy: undefined,
          foreignObjectRendering: false
        });

        const prelimImgData = prelimCanvas.toDataURL('image/png');
        const prelimImgWidth = pageWidth;
        const prelimImgHeight = (prelimCanvas.height * prelimImgWidth) / prelimCanvas.width;

        const availHeight = pageHeight - currentPageY - margin;
        if (prelimImgHeight > availHeight && currentPageY > margin + 10) {
          pdf.addPage();
          currentPageY = margin;
        }

        pdf.addImage(prelimImgData, 'PNG', 0, currentPageY, prelimImgWidth, prelimImgHeight);
        currentPageY += prelimImgHeight;

        document.body.removeChild(prelim);
      }

      // Render each section block separately
      const sectionBlocks = sectionsContainer ? Array.from(sectionsContainer.querySelectorAll('.section-block')) : [];

      for (const sectionBlock of sectionBlocks) {
        const secWrapper = document.createElement('div');
        secWrapper.style.position = 'absolute';
        secWrapper.style.left = '0';
        secWrapper.style.top = '0';
        secWrapper.style.width = '210mm';
        secWrapper.style.height = 'auto';
        secWrapper.style.backgroundColor = '#ffffff';
        secWrapper.style.zIndex = '-999999';
        secWrapper.style.pointerEvents = 'none';
        secWrapper.innerHTML = (sectionBlock as HTMLElement).outerHTML;
        document.body.appendChild(secWrapper);

        await new Promise(resolve => setTimeout(resolve, 1000));

        const secCanvas = await html2canvas(secWrapper, {
          scale: 2,
          backgroundColor: '#ffffff',
          logging: false,
          allowTaint: true,
          useCORS: true,
          imageTimeout: 15000,
          timeout: 45000,
          windowHeight: Math.max(secWrapper.scrollHeight, secWrapper.offsetHeight) || 1000,
          windowWidth: 210 * 3.779527559,
          proxy: undefined,
          foreignObjectRendering: false
        });

        const secImgData = secCanvas.toDataURL('image/png');
        const secImgWidth = pageWidth;
        const secImgHeight = (secCanvas.height * secImgWidth) / secCanvas.width;

        const secAvailHeight = pageHeight - currentPageY - margin;
        if (secImgHeight > secAvailHeight && currentPageY > margin + 10) {
          pdf.addPage();
          currentPageY = margin;
        }

        pdf.addImage(secImgData, 'PNG', 0, currentPageY, secImgWidth, secImgHeight);
        currentPageY += secImgHeight;

        document.body.removeChild(secWrapper);
      }

      // Render totals section
      const totalsElement = boqMainElement.querySelector('.totals') as HTMLElement;
      if (totalsElement) {
        const totalsWrapper2 = document.createElement('div');
        totalsWrapper2.style.position = 'absolute';
        totalsWrapper2.style.left = '0';
        totalsWrapper2.style.top = '0';
        totalsWrapper2.style.width = '210mm';
        totalsWrapper2.style.height = 'auto';
        totalsWrapper2.style.backgroundColor = '#ffffff';
        totalsWrapper2.style.zIndex = '-999999';
        totalsWrapper2.style.pointerEvents = 'none';
        totalsWrapper2.innerHTML = totalsElement.outerHTML;
        document.body.appendChild(totalsWrapper2);

        await new Promise(resolve => setTimeout(resolve, 1000));

        const totalsCanvas = await html2canvas(totalsWrapper2, {
          scale: 2,
          backgroundColor: '#ffffff',
          logging: false,
          allowTaint: true,
          useCORS: true,
          imageTimeout: 15000,
          timeout: 45000,
          windowHeight: Math.max(totalsWrapper2.scrollHeight, totalsWrapper2.offsetHeight) || 1000,
          windowWidth: 210 * 3.779527559,
          proxy: undefined,
          foreignObjectRendering: false
        });

        const totalsImgData = totalsCanvas.toDataURL('image/png');
        const totalsImgWidth = pageWidth;
        const totalsImgHeight = (totalsCanvas.height * totalsImgWidth) / totalsCanvas.width;

        const totalsAvailHeight = pageHeight - currentPageY - margin;
        if (totalsImgHeight > totalsAvailHeight && currentPageY > margin + 10) {
          pdf.addPage();
          currentPageY = margin;
        }

        pdf.addImage(totalsImgData, 'PNG', 0, currentPageY, totalsImgWidth, totalsImgHeight);

        document.body.removeChild(totalsWrapper2);
      }

      // Render Page 2: Terms and Conditions (on a fresh page) - only if terms section exists
      const termsElement = boqWrapper.querySelector('.terms-page') as HTMLElement;
      if (termsElement) {
        console.log('Rendering terms and conditions...');
        const termsCanvas = await html2canvas(termsElement, {
          scale: 2,
          backgroundColor: '#ffffff',
          logging: false,
          allowTaint: true,
          useCORS: true,
          imageTimeout: 15000,
          timeout: 45000,
          windowHeight: Math.max(termsElement.scrollHeight, termsElement.offsetHeight) || 1000,
          windowWidth: contentWidth * 3.779527559, // 180mm to pixels
          proxy: undefined,
          foreignObjectRendering: false,
          onclone: (clonedDocument) => {
            // Ensure CSS page breaks are respected during rendering
            const style = clonedDocument.createElement('style');
            style.textContent = '@media print { * { page-break-inside: avoid !important; } }';
            clonedDocument.head.appendChild(style);
          }
        });

        // Add a fresh page for terms (always add new page)
        pdf.addPage();

        // Add terms to the new page
        const imgTermsData = termsCanvas.toDataURL('image/png');
        const imgTermsWidth = contentWidth; // Content width 180mm (210mm - 30mm margins)
        const imgTermsHeight = (termsCanvas.height * imgTermsWidth) / termsCanvas.width;
        let termsHeightLeft = imgTermsHeight;
        let termsPosition = 0;
        let firstTermsPage = true;

        // Add terms content to PDF
        while (termsHeightLeft >= 0) {
          if (!firstTermsPage) {
            pdf.addPage();
          }
          pdf.addImage(imgTermsData, 'PNG', margin, margin - termsPosition, imgTermsWidth, imgTermsHeight);
          termsHeightLeft -= (pageHeight - (margin * 2) - 8); // Account for margins and spacing
          termsPosition += pageHeight;
          firstTermsPage = false;

          if (termsHeightLeft > 0) {
            // Proper spacing before next page
          }
        }
      } else {
        console.log('Terms page section not included (customTitle may be set)');
      }

      // Download PDF
      const filename = data.project_title
        ? `${data.number}-${data.project_title}.pdf`
        : `${data.number}.pdf`;
      pdf.save(filename);
      console.log('BOQ PDF generated successfully');
      return;

    } catch (error) {
      console.error('Error generating BOQ PDF:', error);
      throw error;
    } finally {
      // Clean up
      if (boqWrapper && boqWrapper.parentNode) {
        boqWrapper.parentNode.removeChild(boqWrapper);
      }
      if (termsWrapper && termsWrapper.parentNode) {
        termsWrapper.parentNode.removeChild(termsWrapper);
      }
    }
  }

  // Handle quotations, invoices, and proformas with sections
  if ((data.type === 'quotation' || data.type === 'invoice' || data.type === 'proforma') && data.sections && data.sections.length > 0) {
    // For section-based PDFs, render each section separately to avoid text cutting across pages
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm
    const pageContentHeight = pageHeight - 30; // Account for margins (15mm top + 15mm bottom = 30mm)
    let firstPage = true;

    // Helper function to render a single page section
    const renderPageSection = async (htmlContent: string): Promise<void> => {
      let wrapper: HTMLElement | null = null;
      try {
        wrapper = document.createElement('div');
        wrapper.style.position = 'absolute';
        wrapper.style.left = '0';
        wrapper.style.top = '0';
        wrapper.style.width = '210mm';
        wrapper.style.height = 'auto';
        wrapper.style.backgroundColor = '#ffffff';
        wrapper.style.zIndex = '-999999';
        wrapper.style.pointerEvents = 'none';
        wrapper.innerHTML = htmlContent;

        document.body.appendChild(wrapper);
        await new Promise(resolve => setTimeout(resolve, 3000));
        wrapper.offsetHeight;

        // Preload images
        const images = wrapper.querySelectorAll('img');
        const imagePromises = Array.from(images).map(img => {
          return new Promise<void>((resolve) => {
            if (!img.src) {
              resolve();
              return;
            }
            if (img.complete && img.naturalHeight > 0) {
              resolve();
            } else {
              img.addEventListener('load', () => resolve());
              img.addEventListener('error', () => resolve());
              img.src = img.src;
            }
          });
        });
        await Promise.all(imagePromises);
        await new Promise(resolve => setTimeout(resolve, 500));

        // Get the page element and render it
        const pageElement = wrapper.querySelector('.page-section') as HTMLElement;
        if (!pageElement) {
          throw new Error('Page section not found');
        }

        const canvas = await html2canvas(pageElement, {
          scale: 2,
          backgroundColor: '#ffffff',
          logging: false,
          allowTaint: true,
          useCORS: true,
          imageTimeout: 15000,
          timeout: 45000,
          windowHeight: Math.max(pageElement.scrollHeight, pageElement.offsetHeight) || 1000,
          windowWidth: 210 * 3.779527559,
          proxy: undefined,
          foreignObjectRendering: false,
        });

        // Add to PDF
        if (!firstPage) {
          pdf.addPage();
        }

        const imgData = canvas.toDataURL('image/png');
        const imgHeight = (canvas.height * pageWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;
        let isFirstPageOfSection = !firstPage;

        while (heightLeft >= 0) {
          if (!isFirstPageOfSection) {
            pdf.addPage();
          }
          pdf.addImage(imgData, 'PNG', 0, -position, pageWidth, imgHeight);
          heightLeft -= pageContentHeight;
          position += pageContentHeight;
          isFirstPageOfSection = false;

          if (heightLeft > 0) {
            // More content to add on next page
          }
        }

        firstPage = false;
      } catch (error) {
        console.error('Error rendering page section:', error);
        throw error;
      } finally {
        if (wrapper && wrapper.parentNode) {
          wrapper.parentNode.removeChild(wrapper);
        }
      }
    };

    // Render header with first section
    let pagesHtml = '';

    // Render one section per page
    data.sections.forEach((section, sectionIndex) => {
      const sectionMaterialsTotal = section.items.reduce((sum, item) => sum + (item.line_total || 0), 0);
      const sectionLaborCost = Number(section.labor_cost || 0);
      const sectionTotal = sectionMaterialsTotal + sectionLaborCost;
      const sectionTaxAmount = section.items.reduce((sum, item) => sum + (item.tax_amount || 0), 0);

      // Generate alphabetical section letter (A, B, C, etc.)
      const sectionLetter = String.fromCharCode(65 + sectionIndex); // 65 = 'A'
      const sectionTitleWithLetter = `${sectionLetter}. ${section.name.toUpperCase()}`;

      // Only show header on first section page
      const showHeader = sectionIndex === 0;

      pagesHtml += `
        <div class="page-section">
          ${showHeader ? generatePDFHeader(headerImage, company, companyServices, data, formatDateLong, documentTitle) : ''}

          <!-- Section Title with alphabetical letter -->
          <div class="section-title" style="margin: ${showHeader ? '20px 0 12px 0' : '15px 0 10px 0'}; padding: 0; background: transparent; border-left: none; font-size: 13px; font-weight: bold; text-transform: uppercase;">${sectionTitleWithLetter}</div>

          <!-- Materials Subsection -->
          <div class="subsection" style="margin-bottom:12px;">
            <div style="font-weight:600; margin-bottom:6px;">Materials</div>
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 5%;">Item #</th>
                  <th style="width: 30%;">Description</th>
                  <th style="width: 10%;">Unit</th>
                  <th style="width: 10%;">Qty</th>
                  <th style="width: 18%;">Unit Price</th>
                  <th style="width: 27%;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${section.items.map((item, itemIndex) => {
                  const unit = item.products?.unit_of_measure || item.unit_of_measure || '-';
                  return `
                  <tr>
                    <td>${itemIndex + 1}</td>
                    <td class="description-cell">${item.description}</td>
                    <td class="center">${unit}</td>
                    <td class="center">${item.quantity}</td>
                    <td class="amount-cell">${formatCurrency(item.unit_price)}</td>
                    <td class="amount-cell">${formatCurrency(item.line_total)}</td>
                  </tr>
                `;
                }).join('')}
                <tr style="background: #fff; font-weight: 600; border-top: 2px solid #000;">
                  <td colspan="5" style="text-align: right; padding: 8px 8px;">Materials Subtotal:</td>
                  <td style="text-align: right; padding: 8px 8px;">${formatCurrency(sectionMaterialsTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Labour Subsection (only display if labor cost > 0) -->
          ${Number(sectionLaborCost) > 0 ? `
          <div class="subsection" style="margin-bottom:12px;">
            <div style="font-weight:600; margin-bottom:6px;">Labour</div>
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 6%;">#</th>
                  <th style="width: 74%; text-align:left;">Description</th>
                  <th style="width: 20%;">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="text-align:center;">1</td>
                  <td class="description-cell">Labour for ${section.name}</td>
                  <td class="amount-cell">${formatCurrency(sectionLaborCost)}</td>
                </tr>
                <tr style="background: #fff; font-weight: 600; border-top: 2px solid #000;">
                  <td colspan="2" style="text-align: right; padding: 8px 8px;">Labour Subtotal:</td>
                  <td style="text-align: right; padding: 8px 8px;">${formatCurrency(sectionLaborCost)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          ` : ''}

          <!-- Section Totals -->
          <div class="totals-section">
            <table class="totals-table">
              <tr class="total-row">
                <td class="label">SECTION ${sectionLetter} TOTAL:</td>
                <td class="amount">${formatCurrency(sectionTotal)}</td>
              </tr>
            </table>
          </div>

        </div>
      `;
    });

    // Add Summary Page with section totals only
    const grandTotal = data.sections.reduce((sum, sec) => {
      const secTotal = sec.items.reduce((s, item) => s + (item.line_total || 0), 0) + Number(sec.labor_cost || 0);
      return sum + secTotal;
    }, 0);

    pagesHtml += `
      <div class="page">
        <!-- Summary Section Title -->
        <div style="margin: 20px 0 15px 0;">
          <h3 style="font-size: 14px; font-weight: bold; margin: 0 0 12px 0; text-transform: uppercase; color: #000;">SECTION ${String.fromCharCode(65 + data.sections.length)}. SUMMARY</h3>
        </div>
        <!-- Section Totals Table Only -->
        <div style="margin: 20px 0;">
          <table class="totals-table" style="width: 100%;">
            <thead>
              <tr style="border-bottom: 2px solid #000;">
                <th style="text-align: left; padding: 10px 15px; font-weight: bold; color: #000; font-size: 12px;">SECTION</th>
                <th style="text-align: right; padding: 10px 15px; font-weight: bold; color: #000; font-size: 12px;">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${data.sections.map((section, idx) => {
                const sectionLetter = String.fromCharCode(65 + idx);
                const matTotal = section.items.reduce((sum, item) => sum + (item.line_total || 0), 0);
                const labour = Number(section.labor_cost || 0);
                const secTotal = matTotal + labour;

                return `
                  <tr style="border-bottom: 1px solid #e9ecef;">
                    <td style="padding: 10px 15px; text-align: left; font-weight: 500;">${sectionLetter}. ${section.name}</td>
                    <td style="padding: 10px 15px; text-align: right; font-weight: 600;">${formatCurrency(secTotal)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Grand Total -->
        <div style="display: flex; justify-content: flex-start; margin-top: 20px;">
          <table class="totals-table" style="width: 100%;">
            <tr class="total-row" style="border-top: 2px solid #000; background: #fff;">
              <td class="label" style="padding: 12px 15px; text-align: left; font-weight: bold; color: #000; font-size: 14px;">GRAND TOTAL:</td>
              <td class="amount" style="padding: 12px 15px; text-align: right; font-weight: bold; color: #000; font-size: 14px;">${formatCurrency(grandTotal)}</td>
            </tr>
          </table>
        </div>
      </div>
    `;

    // Add Terms and Conditions Page (Final Page)
    pagesHtml += `
      <div class="page">
        <div style="padding: 8px;">

          <!-- Terms Section -->
          <div style="margin-bottom: 15px;">
            <h3 style="font-size: 13px; font-weight: bold; margin-bottom: 8px; text-transform: uppercase;">Terms;</h3>
            ${(data.terms_and_conditions || company.default_terms_and_conditions) ? `
              <div style="font-size: 11px; line-height: 1.6; margin: 0; padding: 0; color: #000;">
                ${parseAndRenderTerms(data.terms_and_conditions || company.default_terms_and_conditions, data.total_amount, false, formatCurrency)}
              </div>
            ` : `
              <p style="font-size: 11px; margin: 0; color: #666;">No terms and conditions specified.</p>
            `}
          </div>

          <!-- Acceptance of Quote Section -->
          <div style="margin-bottom: 12px; padding-top: 8px;">
            <h3 style="font-size: 12px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase;">Acceptance of Quote;</h3>
            <p style="font-size: 10px; margin: 0; color: #000;">The above prices specifications and terms are satisfactory.</p>
          </div>

          <!-- Contractor Section -->
          <div style="margin-bottom: 10px; padding-top: 6px;">
            <table style="font-size: 10px; width: 100%; line-height: 1.6; color: #000; border: none;">
              <tr style="border: none;">
                <td style="width: 30%; border: none;"><strong>Contractor;</strong></td>
                <td style="width: 70%; border: none;">${company.name}</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>Tel No;</strong></td>
                <td style="border: none;">254720717463</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>Signed;</strong></td>
                <td style="border: none;">KELVIN MURIITHI</td>
              </tr>
            </table>
          </div>

          <!-- Client Section with Stamp -->
          <div style="margin-bottom: 10px; padding-top: 6px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <table style="font-size: 10px; flex: 1; line-height: 1.6; color: #000; border: none;">
              <tr style="border: none;">
                <td style="width: 40%; border: none;"><strong>Client;</strong></td>
                <td style="width: 60%; border: none;">${data.customer?.name || '________________________'}</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>Tel No;</strong></td>
                <td style="border: none;">${data.customer?.phone || '________________________'}</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>Customer signed;</strong></td>
                <td style="border: none;">........................</td>
              </tr>
            </table>
            <div style="text-align: center; flex-shrink: 0; width: 44mm;">
              <img src="${stampImage}" alt="Layons Construction Stamp" style="width: 44mm; height: 44mm; object-fit: contain;" />
            </div>
          </div>

          <!-- Prepaired By Section -->
          <div style="margin-bottom: 8px; padding-top: 4px;">
            <table style="font-size: 10px; width: 100%; line-height: 1.6; color: #000; border: none;">
              <tr style="border: none;">
                <td style="width: 30%; border: none;"><strong>PREPAIRED BY;</strong></td>
                <td style="width: 70%; border: none;">${company.name}</td>
              </tr>
            </table>
          </div>

          <!-- Account Details Section -->
          <div style="margin-top: 8px; padding-top: 4px;">
            <h3 style="font-size: 12px; font-weight: bold; margin-bottom: 8px; text-transform: uppercase;">Account Details;</h3>
            <table style="font-size: 10px; width: 100%; line-height: 1.8; color: #000; border: none;">
              <tr style="border: none;">
                <td style="width: 25%; border: none;"><strong>BANK;</strong></td>
                <td style="width: 37.5%; border: none;">CO-OPERATIVE BANK OF KENYA</td>
                <td style="width: 37.5%; border: none;">KCB BANK LIMITED</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>ACCOUNT NAME;</strong></td>
                <td style="border: none;">LAYONS CONSTRUCTION LIMITED</td>
                <td style="border: none;">LAYONS CONSTRUCTION LIMITED</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>ACCOUNT NUMBER;</strong></td>
                <td style="border: none;">01192659527000</td>
                <td style="border: none;">1349793760</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>BRANCH;</strong></td>
                <td style="border: none;">JUJA</td>
                <td style="border: none;">JKUAT</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>SWIFT CODE;</strong></td>
                <td style="border: none;">KCOOKENA</td>
                <td style="border: none;">KCBLKENX</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>BANK CODE;</strong></td>
                <td style="border: none;">11000</td>
                <td style="border: none;">01</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>BRANCH CODE;</strong></td>
                <td style="border: none;">11124</td>
                <td style="border: none;">314</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>PAYBILL;</strong></td>
                <td style="border: none;">400200</td>
                <td style="border: none;">522533</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>ACCOUNT;</strong></td>
                <td style="border: none;">01192659527000</td>
                <td style="border: none;">8064381</td>
              </tr>
            </table>
          </div>
        </div>
      </div>
    `;

    const htmlContentWithSections = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${data.type === 'invoice' ? 'Invoice' : data.type === 'proforma' ? 'Proforma Invoice' : 'Quotation'} ${data.number}</title>
        <meta charset="UTF-8">
        <style>
          ${pdfRootVars}
          ${PDF_PAGE_CSS}

          * {
            box-sizing: border-box;
          }

          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 0;
            color: #000;
            line-height: 1.4;
            font-size: 12px;
            background: white;
          }

          .page,
          .page-section {
            width: 100%;
            margin: 0 0 10mm 0;
            background: white;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            padding: 15mm;
            position: relative;
            page-break-after: always;
            page-break-inside: avoid;
            break-after: page;
            break-inside: avoid;
            box-sizing: border-box;
            min-height: auto;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
          }

          .page:last-of-type,
          .page-section:last-of-type {
            page-break-after: auto;
            break-after: auto;
            margin-bottom: 0;
          }

          @media print {
            .page,
            .page-section {
              box-shadow: none;
              width: 100%;
              margin: 0 0 10mm 0;
              padding: 15mm;
              min-height: auto;
              page-break-after: always;
              page-break-inside: avoid;
              break-after: page;
              break-inside: avoid;
              box-sizing: border-box;
            }

            .page:last-of-type,
            .page-section:last-of-type {
              page-break-after: auto;
              break-after: auto;
              margin-bottom: 0;
            }
          }

          @media screen {
            .page,
            .page-section {
              width: 210mm;
              padding: 15mm;
              margin: 15mm auto 25mm auto;
              min-height: auto;
              box-sizing: border-box;
            }
          }

          .header {
            display: flex;
            flex-direction: column;
            margin-bottom: 12px;
            padding-bottom: 0;
            border-bottom: none;
            margin-left: 0;
            margin-right: 0;
            padding-left: 0;
            padding-right: 0;
            page-break-inside: avoid;
            break-inside: avoid;
            page-break-after: avoid;
          }

          .header-image {
            width: 100%;
            max-height: 150px;
            object-fit: contain;
            height: auto;
            margin: 0 0 8px 0;
            padding: 0;
            display: block;
            border: none;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .header-content {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 15px;
            padding: 8px 0;
            margin: 0;
            width: 100%;
            border-bottom: 2px solid #000;
            box-sizing: border-box;
            page-break-inside: avoid;
            page-break-after: avoid;
          }

          @media screen {
            .header-content {
              margin: 0;
              padding: 20px 0;
              width: 100%;
            }
          }

          .company-info {
            flex: 1;
          }

          .logo {
            width: 120px;
            height: 120px;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f8f9fa;
            border-radius: 4px;
            overflow: hidden;
          }

          .logo img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
          }

          .company-name {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 8px;
            color: #000;
          }

          .company-details {
            font-size: 10px;
            color: #000;
            line-height: 1.6;
          }

          .document-info {
            text-align: right;
            flex: 1;
            padding-right: 0;
            margin-right: 0;
          }

          .document-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 6px;
            color: #000;
            text-transform: uppercase;
          }

          .document-details table {
            width: 100%;
            margin-top: 10px;
          }

          .document-details td {
            padding: 4px 0;
          }

          .document-details .label {
            font-weight: bold;
            color: #000;
            width: 40%;
          }

          .document-details .value {
            text-align: right;
            color: #000;
          }

          .section-title {
            font-size: 12px;
            font-weight: bold;
            color: #000;
            margin: 12px 0 8px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 0;
            background: transparent;
            border-left: none;
            page-break-inside: avoid;
            page-break-before: auto;
            page-break-after: avoid;
            break-inside: avoid;
          }

          .customer-name {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 8px;
            color: #000;
          }

          .customer-details {
            color: #000;
            line-height: 1.6;
          }

          .items-section {
            margin: 0 0 6px 0;
            page-break-inside: avoid;
            break-inside: avoid;
            display: flex;
            flex-direction: column;
          }

          .subsection {
            page-break-inside: avoid;
            break-inside: avoid;
            margin-bottom: 2px;
            margin-top: 0;
            padding: 0;
          }

          .subsection > div:first-child {
            font-weight: 600;
            margin-bottom: 1px;
            margin-top: 0;
            font-size: 10px;
            line-height: 1.2;
            page-break-after: avoid;
          }

          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 4px 0;
            font-size: 10px;
            border: 1px solid #000;
            border-radius: 0;
            overflow: hidden;
            page-break-inside: avoid;
            break-inside: avoid;
            table-layout: auto;
          }

          .items-table thead {
            background: #f8f9fa;
            color: #000;
            display: table-header-group;
          }

          .items-table th {
            padding: 1px 4px;
            text-align: center;
            font-weight: bold;
            font-size: 9px;
            line-height: 1;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-right: 1px solid rgba(255,255,255,0.2);
            page-break-after: avoid;
            break-after: avoid;
          }

          .items-table th:last-child {
            border-right: none;
          }

          .items-table tbody tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .items-table td {
            padding: 4px 4px;
            border-bottom: 1px solid #e9ecef;
            border-right: 1px solid #e9ecef;
            text-align: center;
            vertical-align: top;
            page-break-inside: avoid;
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
            margin-top: 6px;
            margin-bottom: 8px;
            display: flex;
            justify-content: flex-end;
            page-break-inside: avoid;
            break-inside: avoid;
            page-break-before: avoid;
            break-before: avoid;
            padding-bottom: 0;
          }

          .totals-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .totals-table td {
            padding: 4px 8px;
            border: none;
            page-break-inside: avoid;
            font-size: 10px;
          }

          .totals-table .label {
            text-align: left;
            color: #000;
            font-weight: 500;
          }

          .totals-table .amount {
            text-align: right;
            font-weight: 600;
            color: #000;
          }

          .totals-table .total-row {
            border-top: 2px solid #000;
            background: #fff;
            page-break-inside: avoid;
          }

          .totals-table .total-row .label {
            font-size: 13px;
            font-weight: bold;
            color: #000;
          }

          .totals-table .total-row .amount {
            font-size: 13px;
            font-weight: bold;
            color: #000;
          }

          /* Allow sections to break naturally but start new sections on new page if needed */
          .section-summary {
            break-inside: avoid;
            page-break-inside: avoid;
            margin-bottom: 15px;
          }

          .section-summary:not(:last-of-type) {
            page-break-after: always;
            break-after: page;
          }

          .section-summary table,
          .section-summary .subsection,
          .section-summary .items-table,
          .section-summary .totals-table {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          /* Stamp and footer sections */
          .stamp-section {
            page-break-inside: avoid;
            page-break-before: avoid;
            margin: 30mm 0 15mm 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 120px;
          }

          .stamp-section img {
            max-width: 44mm;
            max-height: 44mm;
            object-fit: contain;
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
        ${pagesHtml}
      </body>
      </html>
    `;

    const filename = data.project_title
      ? `${data.number}-${data.project_title}.pdf`
      : `${data.number}.pdf`;
    await convertHTMLToPDFAndDownload(htmlContentWithSections, filename);
  }

  // Fallback generic document HTML (existing template)
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${documentTitle} ${data.number}</title>
      <meta charset="UTF-8">
      <style>
        ${pdfRootVars}
        ${PDF_PAGE_CSS}

        * {
          box-sizing: border-box;
        }

        body {
          font-family: 'Arial', sans-serif;
          margin: 0;
          padding: 0;
          color: #000;
          line-height: 1.4;
          font-size: 12px;
          background: white;
        }

        .page {
          width: 100%;
          margin: 0;
          background: white;
          box-shadow: 0 0 10px rgba(0,0,0,0.1);
          padding: 0;
          position: relative;
        }

        @media print {
          .page {
            box-shadow: none;
            margin: 0;
            padding: 0;
            width: 100%;
            min-height: auto;
          }
        }

        .header {
          display: block;
          margin: 0 0 8px 0;
          padding: 0 0 8px 0;
          width: 100%;
          box-sizing: border-box;
        }

        @media screen {
          .header {
            margin: 0 -20mm 15px -20mm;
            padding: 0 20mm 15px 20mm;
            width: calc(100% + 40mm);
          }
        }

        .header-image {
          width: 100% !important;
          max-height: 150px !important;
          height: auto !important;
          object-fit: contain !important;
          margin: 0 0 12px 0 !important;
          padding: 0 !important;
          display: block !important;
          border: none !important;
          box-sizing: border-box !important;
        }

        .header-content {
          display: block;
          margin: 0;
          padding: 0;
          width: 100%;
          box-sizing: border-box;
          overflow: hidden;
        }

        .header-top {
          display: flex;
          align-items: flex-start;
          width: 100%;
          margin: 0 0 10px 0;
          padding: 0;
          gap: 20px;
          box-sizing: border-box;
          min-width: 0;
        }

        .services-section {
          display: block;
          font-size: 12px;
          font-weight: bold;
          color: #000;
          line-height: 1.6;
          text-align: left;
          flex: 0 1 50%;
          box-sizing: border-box;
          min-width: 0;
        }

        .services-section > div {
          margin: 0 0 4px 0;
        }

        .services-section > div:last-child {
          margin-bottom: 0;
        }

        .header-right {
          display: block;
          text-align: right;
          font-size: 12px;
          line-height: 1.6;
          flex: 0 0 auto;
          padding: 0;
          margin: 0;
          box-sizing: border-box;
        }

        .header-right > div {
          font-weight: bold;
          text-align: right;
          margin-bottom: 4px;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }

        .header-right > div:last-child {
          margin-bottom: 0;
        }

        .header-left {
          display: block;
          font-size: 12px;
          font-weight: bold;
          line-height: 1.6;
          text-align: left;
          margin-left: 0;
          margin-right: 0;
          padding-left: 0;
          padding-right: 0;
          width: 100%;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #999;
        }

        .header-left > div {
          margin-bottom: 4px;
          display: flex;
          align-items: baseline;
          gap: 4px;
          flex-wrap: wrap;
        }

        .header-left > div strong {
          display: inline;
          white-space: nowrap;
        }

        .client-details-table {
          width: 100%;
          border-collapse: collapse;
          border: none;
          font-size: 12px;
          line-height: 1.6;
        }

        .client-details-table tr {
          border: none;
        }

        .client-details-table td {
          border: none;
          padding: 4px 0;
          vertical-align: top;
        }

        .client-details-table td.label {
          font-weight: bold;
          width: 25%;
          padding-right: 12px;
        }

        .client-details-table td.value {
          width: 75%;
          color: #000;
        }

        .logo {
          display: none;
        }

        .logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        
        .document-title {
          font-size: 16px;
          font-weight: bold;
          margin: 0 0 12px 0;
          color: #000;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .document-details {
          background: transparent;
          padding: 0;
          border-radius: 0;
          border: none;
        }

        .document-details table {
          width: 100%;
          border-collapse: collapse;
        }

        .document-details td {
          padding: 4px 0;
          border: none;
          font-size: 10px;
        }

        .document-details .label {
          font-weight: bold;
          color: #000;
          width: 50%;
        }

        .document-details .value {
          text-align: left;
          color: #000;
        }
        
        
        .section-title {
          font-size: 12px;
          font-weight: bold;
          color: #000;
          margin: 0 0 2px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 2px 2px 2px 6px;
        }

        .customer-name {
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 8px;
          color: #000;
        }

        .customer-details {
          color: #000;
          line-height: 1.6;
        }

        .items-section {
          margin: 0 0 4px 0;
        }

        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 2px 0;
          font-size: 10px;
          border: 1px solid #000;
          border-radius: 0;
          overflow: hidden;
        }

        .items-table thead {
          background: #f8f9fa;
          color: #000;
          display: table-header-group;
        }

        .items-table th {
          padding: 2px 4px;
          text-align: center;
          font-weight: bold;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-right: 1px solid rgba(255,255,255,0.2);
          line-height: 1;
          height: auto;
        }

        .items-table th:last-child {
          border-right: none;
        }

        .items-table td {
          padding: 3px 4px;
          border-bottom: 1px solid #e9ecef;
          border-right: 1px solid #e9ecef;
          text-align: center;
          vertical-align: top;
          line-height: 1.2;
        }

        .items-table td:last-child {
          border-right: none;
        }

        .items-table tbody tr:first-child td {
          padding-top: 1px;
        }

        .items-table tbody tr:last-child td {
          border-bottom: none;
        }

        .items-table tbody tr:nth-child(even) {
          background: #f8f9fa;
        }
        
        .items-table tbody tr:hover {
          background: hsl(var(--primary-light));
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
          margin-top: 6px;
          display: flex;
          justify-content: flex-end;
        }

        .totals-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
        }

        .totals-table td {
          padding: 4px 8px;
          border: none;
        }
        
        .totals-table .label {
          text-align: left;
          color: #000;
          font-weight: 500;
        }
        
        .totals-table .amount {
          text-align: right;
          font-weight: 600;
          color: #000;
        }
        
        .totals-table .subtotal-row {
          border-top: 1px solid #dee2e6;
        }
        
        .totals-table .total-row {
          border-top: 2px solid #000;
          background: #fff;
        }

        .totals-table .total-row .label {
          font-size: 14px;
          font-weight: bold;
          color: #000;
        }

        .totals-table .total-row .amount {
          font-size: 14px;
          font-weight: bold;
          color: #000;
        }
        
        
        .footer {
          position: absolute;
          bottom: 20mm;
          left: 20mm;
          right: 20mm;
          text-align: center;
          font-size: 10px;
          color: #000;
          border-top: 1px solid #e9ecef;
          padding-top: 15px;
        }
        
        .delivery-info-section {
          margin: 6px 0;
          padding: 8px;
          background: #f8f9fa;
          border-radius: 0;
          border: 1px solid #e9ecef;
        }

        .delivery-details {
          margin-top: 4px;
        }

        .delivery-row {
          display: flex;
          gap: 20px;
          margin-bottom: 12px;
        }

        .delivery-field {
          flex: 1;
          min-width: 0;
        }

        .delivery-field.full-width {
          flex: 100%;
        }

        .field-label {
          font-size: 10px;
          font-weight: bold;
          color: #000;
          margin-bottom: 4px;
          text-transform: uppercase;
        }

        .field-value {
          font-size: 11px;
          color: #000;
          line-height: 1.4;
          word-wrap: break-word;
        }

        .signature-section {
          margin: 6px 0 6px 0;
          padding: 6px;
          border-top: 1px solid #e9ecef;
        }

        .signature-row {
          display: flex;
          gap: 20px;
        }

        .signature-box {
          flex: 1;
          text-align: center;
        }

        .signature-label {
          font-size: 10px;
          font-weight: bold;
          color: #000;
          margin-bottom: 8px;
          text-transform: uppercase;
        }

        .signature-line {
          font-size: 10px;
          font-weight: bold;
          color: #000;
          border-bottom: 1px solid #333;
          margin-bottom: 4px;
          padding-bottom: 2px;
          min-height: 16px;
        }

        .signature-date {
          font-size: 10px;
          color: #000;
        }

        .watermark {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 72px;
          color: hsl(var(--primary) / 0.12);
          font-weight: bold;
          z-index: -1;
          pointer-events: none;
          text-transform: uppercase;
          letter-spacing: 5px;
        }
        
        @media print {
          body {
            background: white;
            margin: 0;
            padding: 0;
          }

          .page {
            box-shadow: none;
            margin: 0;
            padding: 0;
            width: 100%;
            min-height: auto;
          }

          .watermark {
            display: ${data.type === 'proforma' ? 'block' : 'none'};
          }
        }
        
        @media screen {
          body {
            background: #f5f5f5;
            padding: 20px;
          }

          .page {
            padding: 20mm;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
        }
        \n        .payment-banner {\n          background: #f8f9fa;\n          padding: 8px 15px;\n          margin-bottom: 20px;\n          border-left: 4px solid hsl(var(--primary));\n          font-size: 10px;\n          color: #000;\n          text-align: center;\n          border-radius: 4px;\n          font-weight: 600;\n        }\n        \n        .bank-details {\n          background: #f8f9fa;\n          padding: 10px;\n          margin: 15px 0;\n          border-left: 4px solid hsl(var(--primary));\n          font-size: 10px;\n          color: #000;\n          text-align: center;\n          border-radius: 4px;\n          font-weight: 600;\n        }\n      </style>
    </head>
    <body>
      <div class="page">
        <!-- Watermark for proforma invoices -->
        ${data.type === 'proforma' ? '<div class="watermark">Proforma</div>' : ''}

        <!-- Header Section using generatePDFHeader -->
        ${generatePDFHeader(headerImage, company, companyServices, data, formatDateLong, documentTitle)}

        <!-- Delivery Information Section (for delivery notes) -->
        ${data.type === 'delivery' ? `
        <div class="delivery-info-section">
          <div class="section-title">Delivery Information</div>
          <div class="delivery-details">
            <div class="delivery-row">
              ${data.delivery_date ? `
              <div class="delivery-field">
                <div class="field-label">Delivery Date:</div>
                <div class="field-value">${new Date(data.delivery_date).toLocaleDateString()}</div>
              </div>
              ` : ''}
              ${data.delivery_method ? `
              <div class="delivery-field">
                <div class="field-label">Delivery Method:</div>
                <div class="field-value">${data.delivery_method}</div>
              </div>
              ` : ''}
            </div>

            ${data.delivery_address ? `
            <div class="delivery-row">
              <div class="delivery-field full-width">
                <div class="field-label">Delivery Address:</div>
                <div class="field-value">${data.delivery_address}</div>
              </div>
            </div>
            ` : ''}

            <div class="delivery-row">
              ${data.carrier ? `
              <div class="delivery-field">
                <div class="field-label">Carrier:</div>
                <div class="field-value">${data.carrier}</div>
              </div>
              ` : ''}
              ${data.tracking_number ? `
              <div class="delivery-field">
                <div class="field-label">Tracking Number:</div>
                <div class="field-value">${data.tracking_number}</div>
              </div>
              ` : ''}
            </div>

            <div class="delivery-row">
              ${data.delivered_by ? `
              <div class="delivery-field">
                <div class="field-label">Delivered By:</div>
                <div class="field-value">${data.delivered_by}</div>
              </div>
              ` : ''}
              ${data.received_by ? `
              <div class="delivery-field">
                <div class="field-label">Received By:</div>
                <div class="field-value">${data.received_by}</div>
              </div>
              ` : ''}
            </div>
          </div>
        </div>
        ` : ''}

        <!-- Items Section -->
        ${data.items && data.items.length > 0 ? `
        <div class="items-section">
          <table class="items-table">
            <thead>
              <tr>
                ${data.type === 'delivery' ? `
                <th style="width: 5%;">#</th>
                <th style="width: 40%;">Item Description</th>
                <th style="width: 15%;">Ordered Qty</th>
                <th style="width: 15%;">Delivered Qty</th>
                <th style="width: 15%;">Unit</th>
                <th style="width: 10%;">Status</th>
                ` : data.type === 'statement' ? `
                <th style="width: 12%;">Date</th>
                <th style="width: 25%;">Description</th>
                <th style="width: 15%;">Reference</th>
                <th style="width: 12%;">Debit</th>
                <th style="width: 12%;">Credit</th>
                <th style="width: 12%;">Balance</th>
                ` : data.type === 'remittance' ? `
                <th style="width: 15%;">Date</th>
                <th style="width: 15%;">Document Type</th>
                <th style="width: 20%;">Document Number</th>
                <th style="width: 16%;">Invoice Amount</th>
                <th style="width: 16%;">Credit Amount</th>
                <th style="width: 18%;">Payment Amount</th>
                ` : data.type === 'boq' ? `
                <th style="width: 5%;">#</th>
                <th style="width: 45%;">Item Description</th>
                <th style="width: 10%;">Qty</th>
                <th style="width: 10%;">Unit</th>
                <th style="width: 15%;">Rate</th>
                <th style="width: 15%;">Amount</th>
                ` : `
                <th style="width: 5%;">Item #</th>
                <th style="width: 35%;">Description</th>
                <th style="width: 12%;">Unit</th>
                <th style="width: 10%;">Qty</th>
                <th style="width: 18%;">Unit Price</th>
                <th style="width: 20%;">Total</th>
                `}
              </tr>
            </thead>
            <tbody>
              ${data.items.map((item, index) => `
                <tr>
                  ${data.type === 'statement' ? `
                  <td>${formatDate((item as any).transaction_date)}</td>
                  <td class="description-cell">${item.description}</td>
                  <td>${(item as any).reference}</td>
                  <td class="amount-cell">${(item as any).debit > 0 ? formatCurrency((item as any).debit) : ''}</td>
                  <td class="amount-cell">${(item as any).credit > 0 ? formatCurrency((item as any).credit) : ''}</td>
                  <td class="amount-cell">${formatCurrency(item.line_total)}</td>
                  ` : data.type === 'remittance' ? `
                  <td>${formatDate((item as any).document_date)}</td>
                  <td>${(item as any).description ? (item as any).description.split(':')[0] : 'Payment'}</td>
                  <td>${(item as any).description ? (item as any).description.split(':')[1] || (item as any).description : ''}</td>
                  <td class="amount-cell">${(item as any).invoice_amount ? formatCurrency((item as any).invoice_amount) : ''}</td>
                  <td class="amount-cell">${(item as any).credit_amount ? formatCurrency((item as any).credit_amount) : ''}</td>
                  <td class="amount-cell" style="font-weight: bold;">${formatCurrency(item.line_total)}</td>
                  ` : `
                  <td>${index + 1}</td>
                  <td class="description-cell">${item.description}</td>
                  ${data.type === 'delivery' ? `
                  <td>${(item as any).quantity_ordered || item.quantity}</td>
                  <td style="font-weight: bold; color: ${(item as any).quantity_delivered >= (item as any).quantity_ordered ? 'hsl(var(--primary))' : '#F59E0B'};">${(item as any).quantity_delivered || item.quantity}</td>
                  <td>${(item as any).unit_of_measure || 'pcs'}</td>
                  <td style="font-size: 10px;">
                    ${(item as any).quantity_delivered >= (item as any).quantity_ordered ?
                      '<span style="color: hsl(var(--primary)); font-weight: bold;">✓ Complete</span>' :
                      '<span style="color: #F59E0B; font-weight: bold;">⚠ Partial</span>'
                    }
                  </td>
                  ` : data.type === 'boq' ? `
                  <td>${item.quantity}</td>
                  <td>${(item as any).unit_of_measure || (item as any).unit || 'Item'}</td>
                  <td class="amount-cell">${formatCurrency(item.unit_price)}</td>
                  <td class="amount-cell">${formatCurrency(item.line_total)}</td>
                  ` : `
                  <td>${item.unit_of_measure || 'pcs'}</td>
                  <td class="center">${item.quantity}</td>
                  <td class="amount-cell">${formatCurrency(item.unit_price)}</td>
                  <td class="amount-cell">${formatCurrency(item.line_total)}</td>
                  `}
                  `}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}
        
        <!-- Totals Section (not for delivery notes) -->
        ${data.type !== 'delivery' ? `
        <div class="totals-section">
          <table class="totals-table">
            ${data.subtotal ? `
            <tr class="subtotal-row">
              <td class="label">Subtotal:</td>
              <td class="amount">${formatCurrency(data.subtotal)}</td>
            </tr>
            ` : ''}
            ${data.tax_amount && data.tax_amount > 0 ? `
            <tr>
              <td class="label">Tax Amount:</td>
              <td class="amount">${formatCurrency(data.tax_amount)}</td>
            </tr>
            ` : ''}
            <tr class="total-row">
              <td class="label">${data.type === 'statement' ? 'TOTAL OUTSTANDING:' : 'TOTAL:'}</td>
              <td class="amount">${formatCurrency(data.total_amount)}</td>
            </tr>
            ${(data.type === 'invoice' || data.type === 'proforma') && data.paid_amount !== undefined ? `
            <tr class="payment-info">
              <td class="label">Paid Amount:</td>
              <td class="amount" style="color: hsl(var(--primary));">${formatCurrency(data.paid_amount || 0)}</td>
            </tr>
            <tr class="balance-info">
              <td class="label" style="font-weight: bold;">Balance Due:</td>
              <td class="amount" style="font-weight: bold; color: ${(data.balance_due || 0) > 0 ? '#DC2626' : 'hsl(var(--primary))'};">${formatCurrency(data.balance_due || 0)}</td>
            </tr>
            ` : ''}
          </table>
        </div>
        ` : ''}

        <!-- Payment Details Section (for receipts) -->
        ${data.type === 'receipt' ? `
        <div class="payment-section" style="margin-top: 25px; border-top: 2px solid #000; padding-top: 15px;">
          <!-- Invoice Particulars Table -->
          ${data.items && data.items.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h3 style="font-size: 12px; font-weight: bold; margin-bottom: 10px; margin-top: 0;">Invoice Particulars</h3>
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">
              <thead>
                <tr style="background-color: #f5f5f5;">
                  <th style="padding: 8px; text-align: left; border: 1px solid #ddd; font-weight: bold; font-size: 10px;">Invoice No</th>
                  <th style="padding: 8px; text-align: right; border: 1px solid #ddd; font-weight: bold; font-size: 10px;">Previous Balance</th>
                  <th style="padding: 8px; text-align: right; border: 1px solid #ddd; font-weight: bold; font-size: 10px;">Amount Paid</th>
                  <th style="padding: 8px; text-align: right; border: 1px solid #ddd; font-weight: bold; font-size: 10px;">Current Balance</th>
                </tr>
              </thead>
              <tbody>
                ${(data.items as any[]).map((item: any) => item.invoice_number ? `
                <tr style="border: 1px solid #ddd;">
                  <td style="padding: 8px; text-align: left; border: 1px solid #ddd; font-size: 10px;">${item.invoice_number || ''}</td>
                  <td style="padding: 8px; text-align: right; border: 1px solid #ddd; font-size: 10px;">${formatCurrency((item as any).previous_balance || 0)}</td>
                  <td style="padding: 8px; text-align: right; border: 1px solid #ddd; font-size: 10px; font-weight: 600;">${formatCurrency((item as any).allocated_amount || 0)}</td>
                  <td style="padding: 8px; text-align: right; border: 1px solid #ddd; font-size: 10px;">${formatCurrency((item as any).current_balance || 0)}</td>
                </tr>
                ` : '').join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          <!-- Payment Summary -->
          <table class="payment-details-table" style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <tr style="border-bottom: 1px solid #e9ecef;">
              <td style="padding: 10px 0; font-weight: 600; width: 50%;">Total Amount Paid:</td>
              <td style="padding: 10px 0; text-align: right; font-weight: 600;">${formatCurrency(data.total_amount)}</td>
            </tr>
            ${(data as any).value_tendered !== undefined && (data as any).value_tendered > 0 ? `
            <tr style="border-bottom: 1px solid #e9ecef;">
              <td style="padding: 10px 0; font-weight: 600; width: 50%;">Amount Tendered:</td>
              <td style="padding: 10px 0; text-align: right; font-weight: 600;">${formatCurrency((data as any).value_tendered)}</td>
            </tr>
            ` : ''}
            ${(data as any).change !== undefined && (data as any).change > 0 ? `
            <tr style="border-bottom: 1px solid #e9ecef;">
              <td style="padding: 10px 0; font-weight: 600; width: 50%;">Change:</td>
              <td style="padding: 10px 0; text-align: right; font-weight: 600;">${formatCurrency((data as any).change)}</td>
            </tr>
            ` : ''}
            ${(data as any).payment_method ? `
            <tr style="border-bottom: 1px solid #e9ecef;">
              <td style="padding: 10px 0; font-weight: 600; width: 50%;">Payment Method:</td>
              <td style="padding: 10px 0; text-align: right; font-weight: 600;">${(data as any).payment_method}</td>
            </tr>
            ` : ''}
          </table>
        </div>
        ` : ''}

        <!-- Signature Section (for delivery notes) -->
        ${data.type === 'delivery' ? `
        <div class="signature-section">
          <div class="signature-row">
            <div class="signature-box">
              <div class="signature-label">Delivered By:</div>
              <div class="signature-line">${data.delivered_by || '_________________________'}</div>
              <div class="signature-date">Date: ${data.delivery_date ? new Date(data.delivery_date).toLocaleDateString() : '__________'}</div>
            </div>
            <div class="signature-box">
              <div class="signature-label">Received By:</div>
              <div class="signature-line">${data.received_by || '_________________________'}</div>
              <div class="signature-date">Date: __________</div>
            </div>
          </div>
        </div>
        ` : ''}


        <!-- Footer (only for non-invoice/quotation types) -->
        ${(data.type !== 'invoice' && data.type !== 'quotation') ? `
        <div class="footer">
          <strong>Thank you for your business!</strong><br>
          <strong>${company.name}</strong><br>
          This document was generated on ${new Date().toLocaleString()}
          ${data.type === 'proforma' ? '<br><em>This is a proforma invoice and not a request for payment</em>' : ''}
          ${data.type === 'delivery' ? '<br><em>This delivery note confirms the items delivered</em>' : ''}
          ${data.type === 'receipt' ? '<br><em>This receipt serves as proof of payment received</em>' : ''}
          ${data.type === 'remittance' ? '<br><em>This remittance advice details payments made to your account</em>' : ''}
          ${data.type === 'lpo' ? '<br><em>This Local Purchase Order serves as an official request for goods/services</em>' : ''}
        </div>
        ` : ''}
      </div>

      <!-- Last Page for Invoices and Quotations -->
      ${(data.type === 'invoice' || data.type === 'quotation') ? `
      <div class="page">
        <div style="padding: 10mm;">

          <!-- Terms Section -->
          <div style="margin-bottom: 15px;">
            <h3 style="font-size: 13px; font-weight: bold; margin-bottom: 8px; text-transform: uppercase;">Terms;</h3>
            ${(data.terms_and_conditions || company.default_terms_and_conditions) ? `
              <div style="font-size: 11px; line-height: 1.6; margin: 0; padding: 0; color: #000;">
                ${parseAndRenderTerms(data.terms_and_conditions || company.default_terms_and_conditions, data.total_amount || 0, false, formatCurrency)}
              </div>
            ` : `
              <p style="font-size: 11px; margin: 0; color: #666;">No terms and conditions specified.</p>
            `}
          </div>

          <!-- Acceptance of Quote Section -->
          <div style="margin-bottom: 12px; padding-top: 8px;">
            <h3 style="font-size: 12px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase;">Acceptance of Quote;</h3>
            <p style="font-size: 10px; margin: 0; color: #000;">The above prices specifications and terms are satisfactory.</p>
          </div>

          <!-- Contractor Section -->
          <div style="margin-bottom: 10px; padding-top: 6px;">
            <table style="font-size: 10px; width: 100%; line-height: 1.6; color: #000; border: none;">
              <tr style="border: none;">
                <td style="width: 30%; border: none;"><strong>Contractor;</strong></td>
                <td style="width: 70%; border: none;">${company.name}</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>Tel No;</strong></td>
                <td style="border: none;">254720717463</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>Signed;</strong></td>
                <td style="border: none;">KELVIN MURIITHI</td>
              </tr>
            </table>
          </div>

          <!-- Client Section with Stamp -->
          <div style="margin-bottom: 10px; padding-top: 6px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <table style="font-size: 10px; flex: 1; line-height: 1.6; color: #000; border: none;">
              <tr style="border: none;">
                <td style="width: 40%; border: none;"><strong>Client;</strong></td>
                <td style="width: 60%; border: none;">${data.customer?.name || '________________________'}</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>Tel No;</strong></td>
                <td style="border: none;">${data.customer?.phone || '________________________'}</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>Customer signed;</strong></td>
                <td style="border: none;">........................</td>
              </tr>
            </table>
            <div style="text-align: center; flex-shrink: 0; width: 44mm;">
              <img src="${stampImage}" alt="Layons Construction Stamp" style="width: 44mm; height: 44mm; object-fit: contain;" />
            </div>
          </div>

          <!-- Prepaired By Section -->
          <div style="margin-bottom: 8px; padding-top: 4px;">
            <table style="font-size: 10px; width: 100%; line-height: 1.6; color: #000; border: none;">
              <tr style="border: none;">
                <td style="width: 30%; border: none;"><strong>PREPAIRED BY;</strong></td>
                <td style="width: 70%; border: none;">${company.name}</td>
              </tr>
            </table>
          </div>

          <!-- Account Details Section -->
          <div style="margin-top: 8px; padding-top: 4px;">
            <h3 style="font-size: 12px; font-weight: bold; margin-bottom: 8px; text-transform: uppercase;">Account Details;</h3>
            <table style="font-size: 10px; width: 100%; line-height: 1.8; color: #000; border: none;">
              <tr style="border: none;">
                <td style="width: 25%; border: none;"><strong>BANK;</strong></td>
                <td style="width: 37.5%; border: none;">CO-OPERATIVE BANK OF KENYA</td>
                <td style="width: 37.5%; border: none;">KCB BANK LIMITED</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>ACCOUNT NAME;</strong></td>
                <td style="border: none;">LAYONS CONSTRUCTION LIMITED</td>
                <td style="border: none;">LAYONS CONSTRUCTION LIMITED</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>ACCOUNT NUMBER;</strong></td>
                <td style="border: none;">01192659527000</td>
                <td style="border: none;">1349793760</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>BRANCH;</strong></td>
                <td style="border: none;">JUJA</td>
                <td style="border: none;">JKUAT</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>SWIFT CODE;</strong></td>
                <td style="border: none;">KCOOKENA</td>
                <td style="border: none;">KCBLKENX</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>BANK CODE;</strong></td>
                <td style="border: none;">11000</td>
                <td style="border: none;">01</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>BRANCH CODE;</strong></td>
                <td style="border: none;">11124</td>
                <td style="border: none;">314</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>PAYBILL;</strong></td>
                <td style="border: none;">400200</td>
                <td style="border: none;">522533</td>
              </tr>
              <tr style="border: none;">
                <td style="border: none;"><strong>ACCOUNT;</strong></td>
                <td style="border: none;">01192659527000</td>
                <td style="border: none;">8064381</td>
              </tr>
            </table>
          </div>
        </div>
      </div>
      ` : ''}
    </body>
    </html>
  `;

  const fallbackFilename = data.project_title
    ? `${data.number}-${data.project_title}.pdf`
    : `${data.number}.pdf`;
  await convertHTMLToPDFAndDownload(htmlContent, fallbackFilename);
};

// Specific function for invoice PDF generation
export const downloadInvoicePDF = async (invoice: any, documentType: 'INVOICE' | 'PROFORMA' = 'INVOICE', company?: CompanyDetails, companyId?: string) => {
  console.log('🎯 downloadInvoicePDF called for:', invoice.invoice_number);
  console.log('📊 Raw invoice_items count:', invoice.invoice_items?.length || 0);
  console.log('📊 Raw invoice_items:', invoice.invoice_items);

  // Fetch project title from BOQ if this invoice was converted from a BOQ
  let projectTitle: string | null = null;
  if (companyId) {
    try {
      projectTitle = await getProjectTitleFromInvoice(invoice, companyId);
      if (projectTitle) {
        console.log('✅ Found project title from BOQ:', projectTitle);
      }
    } catch (err) {
      console.warn('⚠️ Failed to fetch project title from BOQ:', err);
      // Continue without project title - not a critical error
    }
  }

  const items = invoice.invoice_items?.map((item: any) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unit_price || 0);
    const taxAmount = Number(item.tax_amount || 0);
    const discountAmount = Number(item.discount_amount || 0);
    const computedLineTotal = quantity * unitPrice - discountAmount + taxAmount;

    return {
      description: item.description || item.product_name || item.products?.name || 'Unknown Item',
      quantity: quantity,
      unit_price: unitPrice,
      discount_percentage: Number(item.discount_percentage || 0),
      discount_before_vat: Number(item.discount_before_vat || 0),
      discount_amount: discountAmount,
      tax_percentage: Number(item.tax_percentage || 0),
      tax_amount: taxAmount,
      tax_inclusive: item.tax_inclusive || false,
      line_total: Number(item.line_total ?? computedLineTotal),
      unit_of_measure: item.unit_of_measure || item.products?.unit_of_measure || 'pcs',
      section_name: item.section_name,
      section_labor_cost: Number(item.section_labor_cost || 0),
    };
  }) || [];

  console.log('✅ Mapped items count:', items.length);
  console.log('✅ Mapped items:', items);

  // Check if items have sections
  const hasSections = items.some((item: any) => item.section_name);
  console.log('🔍 Has sections:', hasSections);

  let documentData: DocumentData;

  if (hasSections) {
    // Group items by section
    const sectionMap = new Map<string, any[]>();
    items.forEach((item: any) => {
      const sectionName = item.section_name || 'Untitled Section';
      if (!sectionMap.has(sectionName)) {
        sectionMap.set(sectionName, []);
      }
      sectionMap.get(sectionName)!.push(item);
    });

    // Create sections array with labor costs
    const sections = Array.from(sectionMap.entries()).map(([sectionName, sectionItems]) => {
      const laborCost = sectionItems.length > 0 ? sectionItems[0].section_labor_cost : 0;
      return {
        name: sectionName,
        items: sectionItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_percentage: item.tax_percentage,
          tax_amount: item.tax_amount,
          line_total: item.line_total,
          unit_of_measure: item.unit_of_measure,
          products: item.products,
        })),
        labor_cost: laborCost,
      };
    });

    documentData = {
      type: documentType === 'PROFORMA' ? 'proforma' : 'invoice',
      number: invoice.invoice_number,
      date: invoice.invoice_date,
      due_date: invoice.due_date,
      lpo_number: invoice.lpo_number,
      currency: invoice.currency || 'KES',
      company: company,
      customer: {
        name: invoice.customers?.name || 'Unknown Customer',
        email: invoice.customers?.email,
        phone: invoice.customers?.phone,
        address: invoice.customers?.address,
        city: invoice.customers?.city,
        country: invoice.customers?.country,
      },
      items: items,
      sections: sections,
      subtotal: invoice.subtotal,
      tax_amount: invoice.tax_amount,
      total_amount: invoice.total_amount,
      paid_amount: invoice.paid_amount || 0,
      balance_due: invoice.balance_due || (invoice.total_amount - (invoice.paid_amount || 0)),
      notes: invoice.notes,
      terms_and_conditions: invoice.terms_and_conditions || company?.default_terms_and_conditions,
      showCalculatedValuesInTerms: false, // Never show calculated values in invoice terms
      customTitle: 'INVOICE',
      project_title: projectTitle || undefined,
    };
  } else {
    documentData = {
      type: documentType === 'PROFORMA' ? 'proforma' : 'invoice',
      number: invoice.invoice_number,
      date: invoice.invoice_date,
      due_date: invoice.due_date,
      lpo_number: invoice.lpo_number,
      currency: invoice.currency || 'KES',
      company: company,
      customer: {
        name: invoice.customers?.name || 'Unknown Customer',
        email: invoice.customers?.email,
        phone: invoice.customers?.phone,
        address: invoice.customers?.address,
        city: invoice.customers?.city,
        country: invoice.customers?.country,
      },
      items: items,
      subtotal: invoice.subtotal,
      tax_amount: invoice.tax_amount,
      total_amount: invoice.total_amount,
      paid_amount: invoice.paid_amount || 0,
      balance_due: invoice.balance_due || (invoice.total_amount - (invoice.paid_amount || 0)),
      notes: invoice.notes,
      terms_and_conditions: invoice.terms_and_conditions || company?.default_terms_and_conditions,
      showCalculatedValuesInTerms: false, // Never show calculated values in invoice terms
      customTitle: 'INVOICE',
      project_title: projectTitle || undefined,
    };
  }

  return generatePDF(documentData);
};

// Function for quotation PDF generation
export const downloadQuotationPDF = async (quotation: any, company?: CompanyDetails) => {
  const items = quotation.quotation_items?.map((item: any) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unit_price || 0);
    const taxAmount = Number(item.tax_amount || 0);
    const discountAmount = Number(item.discount_amount || 0);
    const computedLineTotal = quantity * unitPrice - discountAmount + taxAmount;

    return {
      description: item.description || item.product_name || item.products?.name || 'Unknown Item',
      quantity: quantity,
      unit_price: unitPrice,
      discount_percentage: Number(item.discount_percentage || 0),
      discount_amount: discountAmount,
      tax_percentage: Number(item.tax_percentage || 0),
      tax_amount: taxAmount,
      tax_inclusive: item.tax_inclusive || false,
      line_total: Number(item.line_total ?? computedLineTotal),
      unit_of_measure: item.unit_of_measure || item.products?.unit_of_measure || 'pcs',
      section_name: item.section_name,
      section_labor_cost: Number(item.section_labor_cost || 0),
    };
  }) || [];

  // Check if items have sections
  const hasSections = items.some((item: any) => item.section_name);

  let documentData: DocumentData;

  if (hasSections) {
    // Group items by section
    const sectionMap = new Map<string, any[]>();
    items.forEach((item: any) => {
      const sectionName = item.section_name || 'Untitled Section';
      if (!sectionMap.has(sectionName)) {
        sectionMap.set(sectionName, []);
      }
      sectionMap.get(sectionName)!.push(item);
    });

    // Create sections array with labor costs
    const sections = Array.from(sectionMap.entries()).map(([sectionName, sectionItems]) => {
      const laborCost = sectionItems.length > 0 ? sectionItems[0].section_labor_cost : 0;
      return {
        name: sectionName,
        items: sectionItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_percentage: item.tax_percentage,
          tax_amount: item.tax_amount,
          line_total: item.line_total,
          unit_of_measure: item.unit_of_measure,
          products: item.products,
        })),
        labor_cost: laborCost,
      };
    });

    documentData = {
      type: 'quotation',
      number: quotation.quotation_number,
      date: quotation.quotation_date,
      valid_until: quotation.valid_until,
      currency: quotation.currency || 'KES',
      company: company,
      customer: {
        name: quotation.customers?.name || 'Unknown Customer',
        email: quotation.customers?.email,
        phone: quotation.customers?.phone,
        address: quotation.customers?.address,
        city: quotation.customers?.city,
        country: quotation.customers?.country,
      },
      items: items,
      sections: sections,
      subtotal: quotation.subtotal,
      tax_amount: quotation.tax_amount,
      total_amount: quotation.total_amount,
      notes: quotation.notes,
      terms_and_conditions: quotation.terms_and_conditions,
    };
  } else {
    documentData = {
      type: 'quotation',
      number: quotation.quotation_number,
      date: quotation.quotation_date,
      valid_until: quotation.valid_until,
      currency: quotation.currency || 'KES',
      company: company,
      customer: {
        name: quotation.customers?.name || 'Unknown Customer',
        email: quotation.customers?.email,
        phone: quotation.customers?.phone,
        address: quotation.customers?.address,
        city: quotation.customers?.city,
        country: quotation.customers?.country,
      },
      items: items,
      subtotal: quotation.subtotal,
      tax_amount: quotation.tax_amount,
      total_amount: quotation.total_amount,
      notes: quotation.notes,
      terms_and_conditions: quotation.terms_and_conditions,
    };
  }

  return generatePDF(documentData);
};

// Function for generating customer statement PDF
export const generateCustomerStatementPDF = async (customer: any, invoices: any[], payments: any[], statementData?: any, company?: CompanyDetails) => {
  const today = new Date();
  const statementDate = statementData?.statement_date || today.toISOString().split('T')[0];

  // Calculate outstanding amounts
  const totalOutstanding = invoices.reduce((sum, inv) =>
    sum + ((inv.total_amount || 0) - (inv.paid_amount || 0)), 0
  );

  // Calculate aging buckets
  const current = invoices.filter(inv => {
    const dueDate = new Date(inv.due_date);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysOverdue <= 0 && (inv.total_amount - (inv.paid_amount || 0)) > 0;
  }).reduce((sum, inv) => sum + (inv.total_amount - (inv.paid_amount || 0)), 0);

  const days30 = invoices.filter(inv => {
    const dueDate = new Date(inv.due_date);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysOverdue > 0 && daysOverdue <= 30 && (inv.total_amount - (inv.paid_amount || 0)) > 0;
  }).reduce((sum, inv) => sum + (inv.total_amount - (inv.paid_amount || 0)), 0);

  const days60 = invoices.filter(inv => {
    const dueDate = new Date(inv.due_date);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysOverdue > 30 && daysOverdue <= 60 && (inv.total_amount - (inv.paid_amount || 0)) > 0;
  }).reduce((sum, inv) => sum + (inv.total_amount - (inv.paid_amount || 0)), 0);

  const days90 = invoices.filter(inv => {
    const dueDate = new Date(inv.due_date);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysOverdue > 60 && daysOverdue <= 90 && (inv.total_amount - (inv.paid_amount || 0)) > 0;
  }).reduce((sum, inv) => sum + (inv.total_amount - (inv.paid_amount || 0)), 0);

  const over90 = invoices.filter(inv => {
    const dueDate = new Date(inv.due_date);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysOverdue > 90 && (inv.total_amount - (inv.paid_amount || 0)) > 0;
  }).reduce((sum, inv) => sum + (inv.total_amount - (inv.paid_amount || 0)), 0);

  // Create all transactions (invoices and payments) with running balance
  const allTransactions = [
    // Add all invoices as debits
    ...invoices.map(inv => ({
      date: inv.invoice_date,
      type: 'invoice',
      reference: inv.invoice_number,
      description: `Invoice ${inv.invoice_number}`,
      debit: inv.total_amount || 0,
      credit: 0,
      due_date: inv.due_date
    })),
    // Add all payments as credits
    ...payments.map(pay => ({
      date: pay.payment_date,
      type: 'payment',
      reference: pay.payment_number || pay.id || 'PMT',
      description: `Payment - ${pay.method || 'Cash'}`,
      debit: 0,
      credit: pay.amount || 0,
      due_date: null
    }))
  ];

  // Sort by date
  allTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate running balance
  let runningBalance = 0;
  const statementItems = allTransactions.map((transaction, index) => {
    runningBalance += transaction.debit - transaction.credit;

    return {
      description: transaction.description,
      quantity: 1,
      unit_price: Number(transaction.debit || transaction.credit || 0),
      tax_percentage: 0,
      tax_amount: 0,
      tax_inclusive: false,
      line_total: Number(runningBalance),
      balance: Number(runningBalance),
      transaction_date: transaction.date,
      transaction_type: transaction.type,
      reference: transaction.reference,
      debit: Number(transaction.debit || 0),
      credit: Number(transaction.credit || 0),
      due_date: transaction.due_date,
      days_overdue: transaction.due_date ? Math.max(0, Math.floor((today.getTime() - new Date(transaction.due_date).getTime()) / (1000 * 60 * 60 * 24))) : 0
    };
  });

  // Calculate final balance from last transaction
  const finalBalance = statementItems.length > 0 ? statementItems[statementItems.length - 1].line_total : 0;

  const documentData: DocumentData = {
    type: 'statement', // Use statement type for proper formatting
    number: `STMT-${customer.customer_code || customer.id}-${statementDate}`,
    date: statementDate,
    company: company, // Pass company details
    customer: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      city: customer.city,
      country: customer.country,
    },
    items: statementItems,
    subtotal: finalBalance,
    tax_amount: 0,
    total_amount: finalBalance,
    notes: `Statement of Account as of ${new Date(statementDate).toLocaleDateString()}\n\nThis statement shows all transactions including invoices (debits) and payments (credits) with running balance.\n\nAging Summary for Outstanding Invoices:\nCurrent: $${current.toFixed(2)}\n1-30 Days: $${days30.toFixed(2)}\n31-60 Days: $${days60.toFixed(2)}\n61-90 Days: $${days90.toFixed(2)}\nOver 90 Days: $${over90.toFixed(2)}`,
    terms_and_conditions: 'Please remit payment for any outstanding amounts. Contact us if you have any questions about this statement.',
  };

  return generatePDF(documentData);
};

// Function for generating payment receipt PDF
export const generatePaymentReceiptPDF = async (payment: any, company?: CompanyDetails) => {
  // Debug: Log the payment structure
  console.log('generatePaymentReceiptPDF received payment:', {
    payment_number: payment.payment_number,
    has_allocations: !!payment.payment_allocations,
    allocations_count: payment.payment_allocations?.length || 0,
    allocations: payment.payment_allocations
  });

  // Extract invoice particulars from payment allocations
  const invoiceParticulars = payment.payment_allocations && payment.payment_allocations.length > 0
    ? payment.payment_allocations.map((alloc: any) => ({
        invoice_number: alloc.invoice_number || 'N/A',
        invoice_total: alloc.invoice_total || 0,
        allocated_amount: alloc.allocated_amount || 0,
        // Use enriched previous_balance if available, otherwise calculate
        previous_balance: alloc.previous_balance !== undefined ? alloc.previous_balance : (alloc.invoice_total || 0),
      }))
    : [];

  console.log('Invoice particulars extracted:', invoiceParticulars);

  // Ensure current balance is properly calculated or use enriched data
  const invoicesToDisplay = invoiceParticulars.map((inv: any) => {
    const currentBalance = inv.previous_balance - inv.allocated_amount;
    return {
      ...inv,
      // Current balance = previous balance - amount paid in this payment
      current_balance: Math.max(0, currentBalance),
    };
  });

  const documentData: DocumentData = {
    type: 'receipt', // Use receipt type for payment receipts
    number: payment.number || payment.payment_number || `REC-${Date.now()}`,
    date: payment.date || payment.payment_date || new Date().toISOString().split('T')[0],
    company: company, // Pass company details
    customer: {
      name: payment.customer || payment.customers?.name || 'Unknown Customer',
      email: payment.customers?.email,
      phone: payment.customers?.phone,
    },
    total_amount: typeof payment.amount === 'string' ?
      parseFloat(payment.amount.replace('$', '').replace(',', '')) :
      payment.amount,
    // Add invoice particulars and balance information
    items: invoicesToDisplay.map((inv: any) => ({
      description: `Invoice ${inv.invoice_number}`,
      quantity: 1,
      unit_price: 0,
      tax_percentage: 0,
      tax_amount: 0,
      tax_inclusive: false,
      line_total: 0,
      // Custom fields for receipt display
      invoice_number: inv.invoice_number,
      invoice_total: inv.invoice_total,
      allocated_amount: inv.allocated_amount,
      previous_balance: inv.previous_balance,
      current_balance: inv.current_balance,
    })),
    notes: `Payment received via ${payment.payment_method?.replace('_', ' ') || payment.method?.replace('_', ' ') || 'Unknown method'}\n\nReference: ${payment.reference_number || 'N/A'}`,
    terms_and_conditions: 'Thank you for your payment. This receipt confirms that payment has been received and processed.',
    payment_method: payment.payment_method?.replace('_', ' ') || payment.method?.replace('_', ' ') || 'Unknown',
  };

  return generatePDF(documentData);
};

// Function for generating remittance advice PDF
export const downloadRemittancePDF = async (remittance: any, company?: CompanyDetails) => {
  const documentData: DocumentData = {
    type: 'remittance',
    number: remittance.adviceNumber || remittance.advice_number || `REM-${Date.now()}`,
    date: remittance.adviceDate || remittance.advice_date || new Date().toISOString().split('T')[0],
    company: company, // Pass company details
    customer: {
      name: remittance.customerName || remittance.customers?.name || 'Unknown Customer',
      email: remittance.customers?.email,
      phone: remittance.customers?.phone,
      address: remittance.customers?.address,
      city: remittance.customers?.city,
      country: remittance.customers?.country,
    },
    items: (remittance.remittance_advice_items || remittance.items || []).map((item: any) => ({
      description: item.document_number
        ? `${item.document_type === 'invoice' ? 'Invoice' : item.document_type === 'credit_note' ? 'Credit Note' : 'Payment'}: ${item.document_number}`
        : item.description
        || `Payment for ${item.invoiceNumber || item.creditNote || 'Document'}`,
      quantity: 1,
      unit_price: item.payment_amount || item.payment || 0,
      tax_percentage: item.tax_percentage || 0,
      tax_amount: item.tax_amount || 0,
      tax_inclusive: item.tax_inclusive || false,
      line_total: item.payment_amount || item.payment || 0,
      // Additional details for remittance-specific display
      document_date: item.document_date || item.date,
      invoice_amount: item.invoice_amount || item.invoiceAmount,
      credit_amount: item.credit_amount || item.creditAmount,
    })),
    subtotal: remittance.totalPayment || remittance.total_payment || 0,
    tax_amount: 0,
    total_amount: remittance.totalPayment || remittance.total_payment || 0,
    notes: remittance.notes || 'Remittance advice for payments made',
    terms_and_conditions: 'This remittance advice details payments made to your account.',
  };

  return generatePDF(documentData);
};

// Function for delivery note PDF generation
export const downloadDeliveryNotePDF = async (deliveryNote: any, company?: CompanyDetails) => {
  // Get invoice information for reference
  const invoiceNumber = deliveryNote.invoice_number ||
                       deliveryNote.invoices?.invoice_number ||
                       (deliveryNote.invoice_id ? `INV-${deliveryNote.invoice_id.slice(-8)}` : 'N/A');

  const documentData: DocumentData = {
    type: 'delivery',
    number: deliveryNote.delivery_note_number || deliveryNote.delivery_number,
    date: deliveryNote.delivery_date,
    delivery_date: deliveryNote.delivery_date,
    delivery_address: deliveryNote.delivery_address,
    delivery_method: deliveryNote.delivery_method,
    carrier: deliveryNote.carrier,
    tracking_number: deliveryNote.tracking_number,
    delivered_by: deliveryNote.delivered_by,
    received_by: deliveryNote.received_by,
    // Add invoice reference for delivery notes
    lpo_number: `Related Invoice: ${invoiceNumber}`,
    company: company, // Pass company details
    customer: {
      name: deliveryNote.customers?.name || 'Unknown Customer',
      email: deliveryNote.customers?.email,
      phone: deliveryNote.customers?.phone,
      address: deliveryNote.customers?.address,
      city: deliveryNote.customers?.city,
      country: deliveryNote.customers?.country,
    },
    items: (deliveryNote.delivery_note_items || deliveryNote.delivery_items)?.map((item: any, index: number) => ({
      description: `${item.products?.name || item.product_name || item.description || 'Unknown Item'}${invoiceNumber !== 'N/A' ? ` (From Invoice: ${invoiceNumber})` : ''}`,
      quantity: item.quantity_delivered || item.quantity || 0,
      unit_price: 0, // Not relevant for delivery notes
      tax_percentage: 0,
      tax_amount: 0,
      tax_inclusive: false,
      line_total: 0,
      unit_of_measure: item.products?.unit_of_measure || item.unit_of_measure || 'pcs',
      // Add delivery-specific details
      quantity_ordered: item.quantity_ordered || item.quantity || 0,
      quantity_delivered: item.quantity_delivered || item.quantity || 0,
    })) || [],
    total_amount: 0, // Not relevant for delivery notes
    notes: deliveryNote.notes || `Items delivered as per Invoice ${invoiceNumber}`,
  };

  return generatePDF(documentData);
};

// Function for LPO PDF generation
export const downloadLPOPDF = async (lpo: any, company?: CompanyDetails) => {
  const documentData: DocumentData = {
    type: 'lpo', // Use LPO document type
    number: lpo.lpo_number,
    date: lpo.lpo_date,
    due_date: lpo.delivery_date,
    delivery_date: lpo.delivery_date,
    delivery_address: lpo.delivery_address,
    company: company, // Pass company details
    customer: {
      name: lpo.suppliers?.name || 'Unknown Supplier',
      email: lpo.suppliers?.email,
      phone: lpo.suppliers?.phone,
      address: lpo.suppliers?.address,
      city: lpo.suppliers?.city,
      country: lpo.suppliers?.country,
    },
    items: lpo.lpo_items?.map((item: any) => {
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unit_price || 0);
      const taxAmount = Number(item.tax_amount || 0);
      const computedLineTotal = quantity * unitPrice + taxAmount;

      return {
        description: item.description || item.products?.name || 'Unknown Item',
        quantity: quantity,
        unit_price: unitPrice,
        discount_percentage: 0,
        discount_amount: 0,
        tax_percentage: Number(item.tax_rate || 0),
        tax_amount: taxAmount,
        tax_inclusive: false,
        line_total: Number(item.line_total ?? computedLineTotal),
        unit_of_measure: item.products?.unit_of_measure || 'pcs',
      };
    }) || [],
    subtotal: lpo.subtotal,
    tax_amount: lpo.tax_amount,
    total_amount: lpo.total_amount,
    notes: `${lpo.notes || ''}${lpo.contact_person ? `\n\nContact Person: ${lpo.contact_person}` : ''}${lpo.contact_phone ? `\nContact Phone: ${lpo.contact_phone}` : ''}`.trim(),
    terms_and_conditions: lpo.terms_and_conditions,
  };

  return generatePDF(documentData);
};

// Function for generating cash receipt PDF
export const downloadCashReceiptPDF = async (receipt: any, company?: CompanyDetails) => {
  // Format items from receipt
  const items = (receipt.cash_receipt_items || []).map((item: any) => ({
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    tax_percentage: item.tax_percentage || 0,
    tax_amount: item.tax_amount || 0,
    tax_inclusive: false,
    line_total: item.line_total,
  }));

  // Calculate totals
  const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price), 0);
  const totalTax = items.reduce((sum: number, item: any) => sum + (item.tax_amount || 0), 0);

  const documentData: DocumentData = {
    type: 'receipt',
    number: receipt.receipt_number || `RCP-${Date.now()}`,
    date: receipt.receipt_date || new Date().toISOString().split('T')[0],
    company: company || receipt.company,
    customer: {
      name: receipt.customers?.name || 'Unknown Customer',
      email: receipt.customers?.email,
      phone: receipt.customers?.phone,
      address: receipt.customers?.address,
      city: receipt.customers?.city,
      country: receipt.customers?.country,
    },
    items: items.length > 0 ? items : [
      {
        description: 'Payment Received',
        quantity: 1,
        unit_price: receipt.total_amount || 0,
        tax_percentage: 0,
        tax_amount: 0,
        tax_inclusive: false,
        line_total: receipt.total_amount || 0,
      }
    ],
    total_amount: receipt.total_amount || subtotal + totalTax,
    subtotal: subtotal || receipt.total_amount || 0,
    tax_amount: totalTax,
    value_tendered: receipt.value_tendered || 0,
    change: receipt.change || 0,
    payment_method: receipt.payment_method || 'Cash',
    notes: receipt.notes ? `${receipt.notes}` : '',
    terms_and_conditions: 'Thank you for your payment. This receipt confirms payment has been received.',
  };

  return generatePDF(documentData);
};
