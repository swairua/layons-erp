// Shared utilities for PDF generation across all document types

export interface DefaultCompanyData {
  name: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  tax_number?: string;
  logo_url?: string;
  header_image?: string;
  stamp_image?: string;
  contractor_signature?: string;
  contractor_phone?: string;
}

export const DEFAULT_COMPANY_DETAILS: DefaultCompanyData = {
  name: 'Layons Construction Limited',
  address: '',
  city: 'Nairobi',
  country: 'Kenya',
  phone: '',
  email: 'layonscoltd@gmail.com',
  tax_number: '',
  contractor_signature: 'KELVIN MURIITHI',
  contractor_phone: '254720717463',
  logo_url: 'https://cdn.builder.io/api/v1/image/assets%2Fb048b36350454e4dba55aefd37788f9c%2Fbd04dab542504461a2451b061741034c?format=webp&width=800',
  header_image: 'https://cdn.builder.io/api/v1/image/assets%2Ff04fab3fe283460ba50093ba53a92dcd%2F1ce2c870c8304b9cab69f4c60615a6af?format=webp&width=800',
  stamp_image: 'https://cdn.builder.io/api/v1/image/assets%2Fd268027e32e4464daae70b56ad7162a8%2Fab5f0478b4fc4e3f942ccde11c08b62e?format=webp&width=800'
};

/**
 * Format a date string to a locale-specific format
 * @param dateString ISO date string
 * @param format 'short' for 2-digit month, 'text' for abbreviated month
 */
export const formatDateForPDF = (dateString: string, format: 'short' | 'text' = 'text'): string => {
  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: format === 'text' ? 'short' : '2-digit',
    year: 'numeric'
  };
  return new Date(dateString).toLocaleDateString('en-GB', options);
};

/**
 * Format currency amount with locale-specific formatting
 * @param amount Number to format
 * @param currency Currency code (KES, USD, EUR, GBP)
 */
export const formatCurrencyForPDF = (amount: number, currency: string = 'KES'): string => {
  const localeMap: { [key: string]: string } = {
    'KES': 'en-KE',
    'USD': 'en-US',
    'EUR': 'en-GB',
    'GBP': 'en-GB',
  };

  return new Intl.NumberFormat(localeMap[currency] || 'en-KE', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Get company details with fallback to defaults
 */
export const getCompanyDetails = (company?: Partial<DefaultCompanyData>): DefaultCompanyData => {
  return {
    ...DEFAULT_COMPANY_DETAILS,
    ...company
  };
};
