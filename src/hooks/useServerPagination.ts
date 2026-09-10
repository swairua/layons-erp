import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

interface UseServerPaginationOptions {
  initialPageSize?: number;
  debounceMs?: number;
}

interface UseServerPaginationResult {
  page: number;
  pageSize: number;
  from: number;
  to: number;
  debouncedSearch: string;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setSearch: (search: string) => void;
  resetPage: () => void;
}

/**
 * State manager for server-side paginated queries.
 * Manages page, pageSize, and debounced search.
 * Auto-resets page to 1 when search or pageSize changes.
 */
export const useServerPagination = (
  options: UseServerPaginationOptions = {}
): UseServerPaginationResult => {
  const { initialPageSize = 10, debounceMs = 300 } = options;

  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, debounceMs);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, debounceMs]);

  // Reset page to 1 when debounced search changes
  const prevSearchRef = useRef(debouncedSearch);
  useEffect(() => {
    if (prevSearchRef.current !== debouncedSearch) {
      prevSearchRef.current = debouncedSearch;
      setPageState(1);
    }
  }, [debouncedSearch]);

  const setPage = useCallback((p: number) => {
    setPageState(Math.max(1, p));
  }, []);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPageState(1);
  }, []);

  const resetPage = useCallback(() => {
    setPageState(1);
  }, []);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return {
    page,
    pageSize,
    from,
    to,
    debouncedSearch,
    setPage,
    setPageSize,
    setSearch,
    resetPage,
  };
};
