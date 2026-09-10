/**
 * Exchange Rate Service
 * Fetches live exchange rates from fawazahmed0/currency-api (free, no API key)
 * Caches rates in memory for the session (rates update daily)
 */

const API_BASE = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies';

// In-memory cache: { 'usd': { kes: 129.43, eur: 0.859 }, ... }
const rateCache = new Map<string, Record<string, number>>();

// Track in-flight requests to avoid duplicate fetches
const pendingRequests = new Map<string, Promise<Record<string, number>>>();

/**
 * Fetch all rates for a base currency (e.g., 'usd' → { kes: 129.43, eur: 0.859 })
 */
async function fetchRatesForBase(baseCurrency: string): Promise<Record<string, number>> {
  const cacheKey = baseCurrency.toLowerCase();

  // Return cached if available
  if (rateCache.has(cacheKey)) {
    return rateCache.get(cacheKey)!;
  }

  // Deduplicate in-flight requests
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)!;
  }

  const fetchPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/${cacheKey}.json`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      const rates = data[cacheKey] || {};
      rateCache.set(cacheKey, rates);
      return rates;
    } catch (err) {
      console.warn(`[ExchangeRate] Failed to fetch rates for ${baseCurrency}:`, err);
      // Return empty object — caller will fallback to 1.0
      return {};
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Get exchange rate from one currency to another.
 * Example: getExchangeRate('USD', 'KES') → 129.43
 * Returns 1.0 if currencies are the same or on failure.
 */
export async function getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  // Same currency — no conversion needed
  if (from === to) return 1;

  const rates = await fetchRatesForBase(from);
  const rate = rates[to.toLowerCase()];

  if (rate && typeof rate === 'number' && rate > 0) {
    return rate;
  }

  // Fallback: try reverse rate
  const reverseRates = await fetchRatesForBase(to);
  const reverseRate = reverseRates[from.toLowerCase()];
  if (reverseRate && typeof reverseRate === 'number' && reverseRate > 0) {
    return 1 / reverseRate;
  }

  // Last resort fallback
  console.warn(`[ExchangeRate] No rate found for ${from} → ${to}, defaulting to 1.0`);
  return 1;
}

/**
 * Get exchange rate synchronously from cache.
 * Returns null if not cached yet (useful for display after async fetch).
 */
export function getCachedRate(fromCurrency: string, toCurrency: string): number | null {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  if (from === to) return 1;

  const rates = rateCache.get(from.toLowerCase());
  if (rates) {
    const rate = rates[to.toLowerCase()];
    if (rate && typeof rate === 'number' && rate > 0) return rate;
  }
  return null;
}

/**
 * Clear the rate cache (useful for testing or manual refresh)
 */
export function clearRateCache(): void {
  rateCache.clear();
  pendingRequests.clear();
}
