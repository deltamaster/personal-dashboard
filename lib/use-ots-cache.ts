"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CACHE_PREFIX = "pd-ots:";
export const OTS_CACHE_TTL_MS = 60_000;

interface OtsCacheEntry<T> {
  data: T;
  updatedAt: number;
}

function readOtsCacheEntry<T>(key: string): OtsCacheEntry<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      "data" in parsed &&
      typeof (parsed as OtsCacheEntry<T>).updatedAt === "number"
    ) {
      return parsed as OtsCacheEntry<T>;
    }
    // Legacy entries stored raw payloads without metadata.
    return { data: parsed as T, updatedAt: 0 };
  } catch {
    return null;
  }
}

function writeOtsCacheEntry<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const entry: OtsCacheEntry<T> = { data, updatedAt: Date.now() };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // QuotaExceededError or private browsing — ignore
  }
}

function isCacheFresh(entry: OtsCacheEntry<unknown>, ttlMs: number): boolean {
  return entry.updatedAt > 0 && Date.now() - entry.updatedAt < ttlMs;
}

export function readOtsCache<T>(key: string): T | null {
  return readOtsCacheEntry<T>(key)?.data ?? null;
}

export function readOtsCacheUpdatedAt(key: string): number | null {
  const entry = readOtsCacheEntry(key);
  return entry && entry.updatedAt > 0 ? entry.updatedAt : null;
}

export function writeOtsCache<T>(key: string, data: T): void {
  writeOtsCacheEntry(key, data);
}

export interface UseOtsCacheResult<T> {
  data: T | null;
  /** True only while waiting for the first load with no cached data. */
  loading: boolean;
  /** Set when the initial load fails and there is nothing cached to show. */
  error: string | null;
  refresh: () => Promise<void>;
}

export function useOtsCache<T>(
  cacheKey: string,
  fetchData: () => Promise<T>
): UseOtsCacheResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchRef = useRef(fetchData);
  fetchRef.current = fetchData;

  useEffect(() => {
    let cancelled = false;

    const cached = readOtsCacheEntry<T>(cacheKey);
    if (cached) {
      setData(cached.data);
      setLoading(false);
    }

    if (cached && isCacheFresh(cached, OTS_CACHE_TTL_MS)) {
      return;
    }

    (async () => {
      if (!cached) setLoading(true);
      setError(null);
      try {
        const fresh = await fetchRef.current();
        if (cancelled) return;
        setData(fresh);
        writeOtsCacheEntry(cacheKey, fresh);
      } catch (e) {
        if (cancelled) return;
        if (!cached) {
          setError(e instanceof Error ? e.message : "Failed to load data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cacheKey]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const fresh = await fetchRef.current();
      setData(fresh);
      writeOtsCacheEntry(cacheKey, fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    }
  }, [cacheKey]);

  return { data, loading, error, refresh };
}
