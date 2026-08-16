import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** Runs an async fetcher, tracking loading / error / data and exposing reload(). */
export function useFetch(fetcher, deps = [], { skip = false } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (skip) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.resolve()
      .then(fetcher)
      .then((result) => {
        if (!cancelled && mounted.current) setData(result);
      })
      .catch((err) => {
        if (!cancelled && mounted.current) setError(err.message || 'Request failed');
      })
      .finally(() => {
        if (!cancelled && mounted.current) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, skip]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { data, loading, error, reload, setData };
}

/**
 * Paginated list state: debounced search, filters, page and a reload hook.
 * `listFn` receives the assembled query params and returns { data, pagination }.
 */
export function usePaginatedList(listFn, { limit = 10, initialFilters = {} } = {}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [nonce, setNonce] = useState(0);

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters]);

  const params = useMemo(
    () => ({ page, limit, search: debouncedSearch || undefined, ...filters }),
    [page, limit, debouncedSearch, filters]
  );

  const listRef = useRef(listFn);
  listRef.current = listFn;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    listRef
      .current(params)
      .then((res) => {
        if (cancelled) return;
        setItems(res.data || []);
        setPagination(res.pagination || null);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params, nonce]);

  const setFilter = useCallback((key, value) => {
    setFilters((current) => ({ ...current, [key]: value || undefined }));
  }, []);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return {
    items,
    pagination,
    loading,
    error,
    search,
    setSearch,
    filters,
    setFilter,
    setFilters,
    page,
    setPage,
    reload,
  };
}

/** Tracks in-flight state for a one-off action (submit, delete, …). */
export function useAction() {
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (fn) => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, run };
}
