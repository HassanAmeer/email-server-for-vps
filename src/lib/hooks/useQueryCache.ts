import { useState, useEffect, useRef, useCallback } from "react";

interface QueryOptions<T> {
  enabled?: boolean;
  refreshInterval?: number; // ms interval
  dedupTime?: number; // ms to deduplicate identical in-flight requests (default 2000ms)
  onSuccess?: (data: T) => void;
  onError?: (err: any) => void;
}

// Global in-memory cache and promise deduplicator
const globalCache = new Map<string, { data: any; timestamp: number }>();
const inFlightRequests = new Map<string, Promise<any>>();

export function useQueryCache<T>(
  url: string | null,
  options: QueryOptions<T> = {}
) {
  const {
    enabled = true,
    refreshInterval = 0,
    dedupTime = 3000,
    onSuccess,
    onError
  } = options;

  const [data, setData] = useState<T | null>(() => {
    if (url && globalCache.has(url)) {
      return globalCache.get(url)!.data;
    }
    return null;
  });
  const [loading, setLoading] = useState<boolean>(() => !data && !!url && enabled);
  const [error, setError] = useState<any>(null);

  const isMountedRef = useRef(true);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const fetchData = useCallback(
    async (isSilent = false) => {
      if (!url || !enabled) return;

      const now = Date.now();
      const cached = globalCache.get(url);

      // Return instantly from cache if within dedup window
      if (cached && now - cached.timestamp < dedupTime && !isSilent) {
        setData(cached.data);
        setLoading(false);
        return cached.data;
      }

      if (!isSilent && !data) {
        setLoading(true);
      }

      // Check if same request is already in-flight
      let fetchPromise = inFlightRequests.get(url);
      if (!fetchPromise) {
        const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") || localStorage.getItem("mailbox_token") : null;
        fetchPromise = fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
          .then(async (res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
          })
          .finally(() => {
            inFlightRequests.delete(url);
          });

        inFlightRequests.set(url, fetchPromise);
      }

      try {
        const result = await fetchPromise;
        globalCache.set(url, { data: result, timestamp: Date.now() });

        if (isMountedRef.current) {
          setData(result);
          setError(null);
          setLoading(false);
          if (onSuccessRef.current) onSuccessRef.current(result);
        }
        return result;
      } catch (err: any) {
        if (isMountedRef.current) {
          setError(err);
          setLoading(false);
          if (onErrorRef.current) onErrorRef.current(err);
        }
      }
    },
    [url, enabled, dedupTime, data]
  );

  // Fetch on mount / url change
  useEffect(() => {
    isMountedRef.current = true;
    if (enabled && url) {
      fetchData();
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [url, enabled, fetchData]);

  // Window Focus Revalidation + Background Polling
  useEffect(() => {
    if (!enabled || !url) return;

    let intervalId: any = null;
    let isWindowFocused = typeof document !== "undefined" ? !document.hidden : true;

    const handleVisibilityChange = () => {
      isWindowFocused = !document.hidden;
      if (isWindowFocused) {
        // Revalidate when user returns to the tab
        fetchData(true);
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("focus", () => fetchData(true));
    }

    if (refreshInterval > 0) {
      intervalId = setInterval(() => {
        // Only fetch if tab is active/visible
        if (isWindowFocused) {
          fetchData(true);
        }
      }, refreshInterval);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [url, enabled, refreshInterval, fetchData]);

  const mutate = useCallback(
    (newData: T | ((prev: T | null) => T), shouldRevalidate = true) => {
      if (!url) return;
      const resolved = typeof newData === "function" ? (newData as any)(data) : newData;
      setData(resolved);
      globalCache.set(url, { data: resolved, timestamp: Date.now() });
      if (shouldRevalidate) {
        fetchData(true);
      }
    },
    [url, data, fetchData]
  );

  return { data, loading, error, refetch: () => fetchData(false), mutate };
}
