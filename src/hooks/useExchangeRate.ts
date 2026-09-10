import { useQuery } from '@tanstack/react-query';
import { getExchangeRate } from '@/services/exchangeRateService';

/**
 * Hook to fetch exchange rate between two currencies.
 * Uses React Query for caching and automatic refetch.
 * Only fetches when currencies are different.
 *
 * @param fromCurrency - Source currency (e.g., 'USD')
 * @param toCurrency - Target currency (e.g., 'KES')
 * @returns { rate, isLoading, error }
 *
 * @example
 * const { rate, isLoading } = useExchangeRate('USD', 'KES');
 * // rate = 129.43, isLoading = false
 */
export function useExchangeRate(fromCurrency: string, toCurrency: string) {
  const from = fromCurrency?.toUpperCase() || 'KES';
  const to = toCurrency?.toUpperCase() || 'KES';
  const isSameCurrency = from === to;

  const { data, isLoading, error } = useQuery({
    queryKey: ['exchangeRate', from, to],
    queryFn: () => getExchangeRate(from, to),
    enabled: !isSameCurrency,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours — rates update daily
    gcTime: 24 * 60 * 60 * 1000,
    retry: 2,
    retryDelay: 1000,
  });

  return {
    rate: isSameCurrency ? 1 : (data ?? 1),
    isLoading: isSameCurrency ? false : isLoading,
    error: isSameCurrency ? null : error,
    isForeignCurrency: !isSameCurrency,
  };
}
