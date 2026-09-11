/**
 * Currency formatter utility with support for KES, USD, EUR, GBP
 */

export const SUPPORTED_CURRENCIES = {
  KES: { code: 'KES', symbol: 'Ksh', locale: 'en-KE', name: 'Kenyan Shilling' },
  USD: { code: 'USD', symbol: '$', locale: 'en-US', name: 'US Dollar' },
  EUR: { code: 'EUR', symbol: '€', locale: 'en-GB', name: 'Euro' },
  GBP: { code: 'GBP', symbol: '£', locale: 'en-GB', name: 'British Pound' }
};

export type CurrencyCode = keyof typeof SUPPORTED_CURRENCIES;

/**
 * Format a number as currency with the specified currency code
 * @param amount Amount to format
 * @param currency Currency code (KES, USD, EUR). Defaults to KES
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number, currency?: string | null): string => {
  const currencyData = SUPPORTED_CURRENCIES[(currency || 'KES') as CurrencyCode] || SUPPORTED_CURRENCIES.KES;
  
  try {
    return new Intl.NumberFormat(currencyData.locale, {
      style: 'currency',
      currency: currencyData.code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch (e) {
    // Fallback to basic formatting if Intl fails
    return `${currencyData.symbol}${amount.toFixed(2)}`;
  }
};

/**
 * Get currency symbol by code
 */
export const getCurrencySymbol = (currency?: string | null): string => {
  const currencyData = SUPPORTED_CURRENCIES[(currency || 'KES') as CurrencyCode] || SUPPORTED_CURRENCIES.KES;
  return currencyData.symbol;
};

/**
 * Get currency name by code
 */
export const getCurrencyName = (currency?: string | null): string => {
  const currencyData = SUPPORTED_CURRENCIES[(currency || 'KES') as CurrencyCode] || SUPPORTED_CURRENCIES.KES;
  return currencyData.name;
};

/**
 * Get all available currencies
 */
export const getAvailableCurrencies = () => {
  return Object.entries(SUPPORTED_CURRENCIES).map(([code, data]) => ({
    code,
    ...data
  }));
};
